import crypto from 'crypto'
// Cuentas del cliente, buscadas en el servidor por su DIP (nunca las decide el navegador).
const BASE = 'https://placetaone.vercel.app/api/v1/'
const cache = new Map() // dip -> { at, ibans }
const TTL = 30_000

export const bankFetch = (path, init = {}) => fetch(BASE + path, {
  ...init, signal: AbortSignal.timeout(15000),
  headers: { 'x-api-key': process.env.PLACETA_API_KEY || '', accept: 'application/json', ...(init.headers || {}) },
})
export const invalidate = (dip) => cache.delete(dip)

export async function ownedIbans(dip, force = false) {
  const hit = cache.get(dip)
  if (!force && hit && Date.now() - hit.at < TTL) return hit.ibans
  // Búsqueda de cuentas por titular (DIP). Ajusta aquí si tu API usa otra ruta.
  const r = await bankFetch('accounts?dip=' + encodeURIComponent(dip))
  if (!r.ok) throw Object.assign(new Error(r.status === 403 ? 'La clave de API no tiene permiso para buscar cuentas.' : 'No se pudieron cargar tus cuentas (' + r.status + ').'), { status: r.status })
  const d = await r.json().catch(() => ({}))
  const items = Array.isArray(d) ? d : d.accounts || d.data || d.items || []
  const ibans = [...new Set(items.map((x) => (typeof x === 'string' ? x : x?.iban)).filter(Boolean))]
  cache.set(dip, { at: Date.now(), ibans })
  return ibans
}
export const newKey = () => crypto.randomUUID()
