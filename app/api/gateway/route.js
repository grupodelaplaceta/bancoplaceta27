import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { readSession, sameOrigin, readGw, setGw } from '../../../lib/session'
import { upstream, errMsg } from '../../../lib/upstream'
import { gwConfig, isGwAdmin, cleanDip, isDip, cleanOrigin } from '../../../lib/gateway'
import { isBusiness, isAdminRole } from '../../../lib/kinds'
import { normIban, isIban, cleanAmount, cleanText } from '../../../lib/validate'
import { list } from '../../../lib/shape'
import { hit } from '../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const J = (status, body) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const bad = (status, message) => J(status, { error: { message } })

/** Cuentas de empresa de las que el usuario es titular o cotitular (lo dice el banco con SU token, no el navegador). */
async function companyAccounts(s) {
  const r = await upstream('me/accounts', { token: s.tok })
  if (r.status >= 300) return { error: r }
  return { list: list(r.json, 'cuentas').filter((a) => isBusiness(a) && (!a.rol || isAdminRole(a.rol))) }
}
const approvedOrigins = async () => {
  const r = await upstream('bk/origenes', { signed: true })
  return r.status < 300 ? list(r.json, 'origenes').filter((o) => /aprob/i.test(o.estado || '')) : null
}

// Resumen: configuración de la entidad, cuentas de empresa, orígenes aprobados y mis cobros.
export async function GET(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get); if (!s) return bad(401, 'Sesión caducada.')
  const cfg = gwConfig()
  const acc = await companyAccounts(s)
  if (acc.error) return bad(acc.error.status === 401 ? 401 : 502, errMsg(acc.error.json, 'No se han podido leer tus cuentas.'))
  const origins = cfg.enabled && acc.list.length ? await approvedOrigins() : []
  return J(200, {
    config: cfg, enabled: cfg.enabled && acc.list.length > 0,
    accounts: acc.list.map((a) => ({ iban: a.iban, nombre: a.nombre })),
    origins: (origins || []).map((o) => ({ origin: o.origin, entorno: o.entorno })), originsError: origins === null,
    admin: isGwAdmin(s), items: readGw(get, s),
  })
}

// Crear un cobro. Todo se valida aquí: el navegador solo propone, la entidad dispone.
export async function POST(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get); if (!s) return bad(401, 'Sesión caducada.')
  if (!sameOrigin(req)) return bad(403, 'Origen no permitido.')
  if (!hit('gw:' + s.uid, 10, 60_000).ok) return bad(429, 'Demasiadas peticiones.')
  const cfg = gwConfig(); if (!cfg.enabled) return bad(403, 'La pasarela no está activa en esta entidad.')
  const b = await req.json().catch(() => ({}))

  const acc = await companyAccounts(s)
  if (acc.error) return bad(502, 'No se han podido comprobar tus cuentas.')
  const destino = normIban(b.iban_destino)
  if (!acc.list.some((a) => a.iban === destino)) return bad(403, 'Solo puedes cobrar en una cuenta de empresa de la que seas titular.')

  const dip = cleanDip(b.dip), pagador = normIban(b.iban_pagador), importe = cleanAmount(b.importe)
  if (!isDip(dip)) return bad(422, 'El DIP del pagador no es válido.')
  if (!isIban(pagador)) return bad(422, 'El IBAN del pagador no es válido.')
  if (importe === null || importe < cfg.min || importe > cfg.max) return bad(422, `El importe debe estar entre ${cfg.min} y ${cfg.max}.`)
  let concepto = cleanText(b.concepto, 140)
  if (!cfg.allow.concepto) concepto = ''
  if (cfg.requireConcept && !concepto) return bad(422, 'Indica el concepto del cobro.')

  const minutos = cfg.allow.minutos ? Math.min(cfg.maxMinutes, Math.max(1, Math.round(Number(b.minutos)) || cfg.defaultMinutes)) : cfg.defaultMinutes
  const origins = await approvedOrigins()
  if (!origins) return bad(502, 'No se han podido comprobar los orígenes autorizados.')
  const asked = cfg.allow.origen ? cleanOrigin(b.origen) : ''
  const origen = asked || cleanOrigin(cfg.defaultOrigin) || origins[0]?.origin || ''
  if (!origen || !origins.some((o) => o.origin === origen)) return bad(422, 'La entidad no tiene ningún origen aprobado para este cobro.')

  const client_ref = cleanText(b.client_ref, 40) || 'gw-' + Date.now().toString(36) + '-' + crypto.randomBytes(2).toString('hex')
  const r = await upstream('bk/checkouts', { method: 'POST', signed: true, body: { origen, client_ref, dip, iban_pagador: pagador, iban_destino: destino, importe, concepto, minutos } })
  if (r.status >= 300) return bad(r.status === 401 ? 502 : r.status, errMsg(r.json, 'No se ha podido crear el cobro.'))
  const item = { id: r.json.id, ref: client_ref, iban: destino, importe, concepto, creado: new Date().toISOString(), expira: r.json.expira, url: r.json.url }
  const res = J(201, item)
  setGw(res, s, [item, ...readGw(get, s)])
  return res
}
