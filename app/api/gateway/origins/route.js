import { NextResponse } from 'next/server'
import { readSession, sameOrigin } from '../../../../lib/session'
import { upstream, errMsg } from '../../../../lib/upstream'
import { isGwAdmin, cleanOrigin } from '../../../../lib/gateway'

export const dynamic = 'force-dynamic'
const J = (status, body) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const bad = (status, message) => J(status, { error: { message } })

// Orígenes de navegador de la ENTIDAD (no de cada empresa): solo los administradores definidos en GATEWAY_ADMINS.
async function guard(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return { err: bad(401, 'Sesión caducada.') }
  if (!sameOrigin(req)) return { err: bad(403, 'Origen no permitido.') }
  if (!isGwAdmin(s)) return { err: bad(403, 'Solo los administradores de la entidad pueden gestionar los orígenes.') }
  return {}
}

export async function GET(req) {
  const g = await guard(req); if (g.err) return g.err
  const r = await upstream('bk/origenes', { signed: true })
  return r.status < 300 ? J(200, r.json) : bad(502, errMsg(r.json, 'No se han podido leer los orígenes.'))
}
export async function POST(req) {
  const g = await guard(req); if (g.err) return g.err
  const b = await req.json().catch(() => ({})), origen = cleanOrigin(b.origen), entorno = /^[a-z]{3,20}$/.test(b.entorno) ? b.entorno : 'produccion'
  if (!origen) return bad(422, 'El origen debe ser una URL https (por ejemplo https://app.tubanco.es).')
  const r = await upstream('bk/origenes', { method: 'POST', signed: true, body: { origen, entorno } })
  return J(r.status < 300 ? 201 : r.status === 401 ? 502 : r.status, r.json)
}
export async function DELETE(req) {
  const g = await guard(req); if (g.err) return g.err
  const origen = cleanOrigin(req.nextUrl.searchParams.get('origen')); if (!origen) return bad(422, 'Origen no válido.')
  const r = await upstream('bk/origenes', { method: 'DELETE', signed: true, search: '?origen=' + encodeURIComponent(origen) })
  return J(r.status < 300 ? 200 : r.status === 401 ? 502 : r.status, r.json)
}
