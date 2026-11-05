// Administrador de la entidad = titular o cotitular de una cuenta de la entidad.
// Se consulta a la API (bk/personas, permiso personas:buscar) con el DIP de la sesión; así, si dejan de
// ser titulares, pierden el acceso en menos de un minuto. Autorizados y lectores NO son administradores.
const TTL = 60_000
const cache = new Map()
const ROLE_KEYS = ['role', 'rol', 'tipo_titular', 'holder_type', 'titularidad', 'relation', 'relacion', 'vinculo', 'tipo']
const OWNER = /(^|[^a-z])(co-?titular|titular|owner|co-?owner|holder)/i
const NOT_OWNER = /autorizad|lector|reader|viewer|authori[sz]ed/i

const rowsOf = (d) => Array.isArray(d) ? d : d?.data || d?.items || d?.accounts || d?.cuentas || d?.results || []
const roleOf = (r) => { for (const k of ROLE_KEYS) { const v = r?.[k] ?? r?.membership?.[k]; if (typeof v === 'string' && v) return v } return '' }

export function parse(d) {
  const owned = []
  for (const r of rowsOf(d)) {
    const role = roleOf(r)
    if (OWNER.test(role) && !NOT_OWNER.test(role)) owned.push(r.iban || r.account?.iban || r.account_iban)
  }
  return { admin: owned.length > 0, owned: owned.filter(Boolean) }
}

export async function access(dip) {
  if (!dip) return { admin: false, owned: [] }
  const hit = cache.get(dip)
  if (hit && hit.t > Date.now()) return hit.v
  let v = { admin: false, owned: [] }
  try {
    const r = await fetch('https://placetaone.vercel.app/api/v1/bk/personas?dip=' + encodeURIComponent(dip), { headers: { 'x-api-key': process.env.PLACETA_API_KEY }, cache: 'no-store' })
    if (r.ok) v = parse(await r.json())
  } catch {}
  cache.set(dip, { t: Date.now() + TTL, v })
  return v
}
