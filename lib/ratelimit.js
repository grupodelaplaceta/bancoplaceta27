// Límite de peticiones en memoria (por instancia). Protege la clave de API del servidor
// de un usuario que dispare peticiones sin parar; el banco aplica además su propio límite.
const buckets = new Map()

export function hit(key, limit, windowMs) {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b) }
  b.n++
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k)
  return { ok: b.n <= limit, retry: Math.max(1, Math.ceil((b.reset - now) / 1000)) }
}
