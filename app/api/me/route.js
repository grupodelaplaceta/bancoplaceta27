import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { readSession, readIbans, setIbans, sameOrigin, MAX_IBANS } from '../../../lib/session'
import { upstream, unwrapServer } from '../../../lib/upstream'
import { normIban, isIban } from '../../../lib/validate'
import { hit } from '../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const J = (o, status = 200) => NextResponse.json(o, { status, headers: { 'cache-control': 'no-store' } })
const bad = (status, message) => J({ error: { message } }, status)
const fold = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function GET(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get)
  if (!s) return bad(401, 'Sesión caducada.')
  return J({ name: s.name, ibans: readIbans(get, s) })
}

// Vincular una cuenta: se comprueba contra el banco antes de guardarla.
// Con STRICT_HOLDER=1 solo se vinculan cuentas cuyo titular coincide con el nombre de PlacetaID.
export async function POST(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get)
  if (!s) return bad(401, 'Sesión caducada.')
  if (!sameOrigin(req)) return bad(403, 'Origen no permitido.')
  const rl = hit('link:' + s.uid, 15, 60_000)
  if (!rl.ok) return bad(429, `Demasiados intentos. Espera ${rl.retry} s.`)

  const { iban } = await req.json().catch(() => ({}))
  const v = normIban(iban)
  if (!isIban(v)) return bad(422, 'Escribe un IBAN válido, por ejemplo PZ-0001-0002.')
  const owned = readIbans(get, s)
  if (!owned.includes(v) && owned.length >= MAX_IBANS) return bad(422, `Has alcanzado el máximo de ${MAX_IBANS} cuentas vinculadas.`)

  const r = await upstream('accounts/' + encodeURIComponent(v))
  if (r.status >= 300) {
    const m = r.json?.error?.message || r.json?.message
    const st = r.status === 401 ? 502 : r.status
    return bad(st, m || (r.status === 404 ? 'No existe ninguna cuenta con ese IBAN.' : 'No se ha podido vincular la cuenta.'))
  }
  if (process.env.STRICT_HOLDER === '1') {
    const a = unwrapServer(r.json)
    const holder = [a.holder_name, a.holder, a.owner_name, a.owner].find((x) => typeof x === 'string')
    if (!holder || fold(holder) !== fold(s.name)) return bad(403, 'Esa cuenta no figura a tu nombre.')
  }
  const list = [...new Set([...owned, v])]
  const res = J({ ibans: list, linked: v })
  setIbans(res, s, list)
  return res
}

export async function DELETE(req) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get)
  if (!s) return bad(401, 'Sesión caducada.')
  if (!sameOrigin(req)) return bad(403, 'Origen no permitido.')
  const v = normIban(req.nextUrl.searchParams.get('iban'))
  const list = readIbans(get, s).filter((i) => i !== v)
  const res = J({ ibans: list })
  setIbans(res, s, list)
  return res
}
