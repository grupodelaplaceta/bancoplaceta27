// Quién puede gestionar qué: ADMINISTRA una cuenta quien es TITULAR o COTITULAR de ella.
// Se comprueba con el token del propio usuario (GET /me/accounts): es el banco quien dice su rol en cada cuenta,
// nunca el navegador. La cuenta activa fija el tipo (institucional, empresa, junior…) y con él qué funciones hay.
import { upstream, errMsg } from './upstream'
import { kindOf, isAdminRole } from './kinds'
import { normIban } from './validate'
import { list } from './shape'

const TTL = 20_000
const cache = new Map()

/** Cuentas del usuario con su rol y tipo (caché breve en memoria: si pierde la titularidad, la pierde en segundos). */
export async function misCuentas(s) {
  const k = s.uid + ':' + String(s.tok).slice(-12)
  const hit = cache.get(k)
  if (hit && hit.t > Date.now()) return hit.v
  const r = await upstream('me/accounts', { token: s.tok })
  if (r.status >= 300) return { error: { status: r.status === 401 ? 401 : 502, message: errMsg(r.json, 'No se han podido leer tus cuentas.') } }
  const v = { cuentas: list(r.json, 'cuentas').map((a) => ({ iban: a.iban, rol: a.rol || a.role || '', kind: kindOf(a), raw: a })) }
  cache.set(k, { t: Date.now() + TTL, v })
  if (cache.size > 500) for (const [kk, x] of cache) if (x.t < Date.now()) cache.delete(kk)
  return v
}

/** Contexto de gestión para la cuenta `iban`: { ok, kind, iban } o { ok:false, status, message }. */
export async function contexto(s, iban) {
  const ib = normIban(iban)
  if (!ib) return { ok: false, status: 400, message: 'Falta la cuenta desde la que gestionas.' }
  const r = await misCuentas(s)
  if (r.error) return { ok: false, ...r.error }
  const c = r.cuentas.find((x) => x.iban === ib)
  if (!c) return { ok: false, status: 403, message: 'Esa cuenta no es tuya.' }
  if (!isAdminRole(c.rol)) return { ok: false, status: 403, message: 'Solo el titular o el cotitular de la cuenta pueden gestionarla.' }
  return { ok: true, kind: c.kind, iban: ib }
}
