import { NextResponse } from 'next/server'
import { readSession, sameOrigin } from '../../../lib/session'
import { upstream, errMsg } from '../../../lib/upstream'
import { OPS, catalogoPublico, construir, kindsOf } from '../../../lib/ops'
import { contexto } from '../../../lib/titular'
import { OPS_LABEL } from '../../../lib/kinds'
import { isIdemKey } from '../../../lib/validate'
import { hit } from '../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const J = (status, body) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const bad = (status, message) => J(status, { error: { message } })

// Gestión de la cuenta activa (?iban=…). Solo el titular o cotitular de esa cuenta; las funciones dependen de su tipo.
export async function GET(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return bad(401, 'Sesión caducada.')
  const c = await contexto(s, req.nextUrl.searchParams.get('iban'))
  if (!c.ok) return bad(c.status, c.message)
  const ops = catalogoPublico(c.kind)
  if (!ops.length) return bad(403, 'Este tipo de cuenta no tiene funciones de gestión.')
  return J(200, { kind: c.kind, label: OPS_LABEL[c.kind] || 'Gestión', ops })
}

// Ejecuta una operación de la lista blanca. Body: { op, iban, valores }. Idempotency-Key si la operación la exige.
export async function POST(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get)
  if (!s) return bad(401, 'Sesión caducada.')
  if (!sameOrigin(req)) return bad(403, 'Origen no permitido.')
  if (!hit('ops:' + s.uid, 60, 60_000).ok) return bad(429, 'Demasiadas peticiones.')

  const b = await req.json().catch(() => ({}))
  const c = await contexto(s, b?.iban)   // titular/cotitular de la cuenta, según el banco y con el token del propio usuario
  if (!c.ok) return bad(c.status, c.message)
  const op = OPS[b?.op]
  if (!op || !kindsOf(op).includes(c.kind)) return bad(404, 'Operación no disponible para este tipo de cuenta.')
  let idem = null
  if (op.idem) {
    idem = req.headers.get('idempotency-key')
    if (!isIdemKey(idem)) return bad(400, 'Falta una clave de idempotencia válida (Idempotency-Key).')
  }

  const built = construir(b.op, b.valores, { cip: process.env.ENTIDAD_CIP || '', actor: String(s.dip || ''), iban: c.iban, kind: c.kind })
  if (built.error) return bad(422, built.error)

  const search = Object.keys(built.query).length ? '?' + new URLSearchParams(Object.entries(built.query).map(([k, v]) => [k, String(v)])) : ''
  const r = await upstream(built.path, { method: op.m, body: built.body ?? undefined, idem, search, signed: true })
  if (r.status === 401) return bad(502, 'El banco no ha aceptado la clave o la firma del servidor.')
  if (r.status >= 300) return bad(r.status === 429 ? 429 : r.status, errMsg(r.json, 'El banco no ha podido completar la operación.'))
  return J(r.status, r.json ?? {})
}
