// Utilidades de cliente: llamadas al proxy, formato y normalización tolerante de respuestas.
export const eur = (n, c = 'EUR') => { try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c || 'EUR' }).format(Number(n) || 0) } catch { return Number(n || 0).toFixed(2) + ' ' + c } }
export const list = (d, ...keys) => Array.isArray(d) ? d : [...keys, 'data', 'items'].map((k) => d?.[k]).find(Array.isArray) || []
export const uid = () => (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2))
export const fdate = (v, o = { day: 'numeric', month: 'long', year: 'numeric' }) => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', o) }

export async function api(path, body, idem) {
  const init = body ? { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(idem && { 'x-idempotency-key': idem }) } } : undefined
  const r = await fetch(path.startsWith('../') ? '/api/' + path.slice(3) : '/api/bank/' + path, init)
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) { location.href = '/'; throw new Error('Sesión caducada') }
  if (!r.ok) {
    const m = d.error?.message || d.message || (typeof d.error === 'string' && d.error)
    throw Object.assign(new Error(r.status === 429 ? 'Demasiadas peticiones, espera un momento.' : m || 'Error ' + r.status), { status: r.status })
  }
  return d
}
// Importe con signo: acepta amount negativo o campo direction/type.
export const signed = (t) => {
  const n = Number(t.amount) || 0, dir = String(t.direction || t.type || t.kind || '').toLowerCase()
  return /out|debit|withdraw|sent/.test(dir) ? -Math.abs(n) : /in|credit|deposit|received/.test(dir) && !/out/.test(dir) ? Math.abs(n) : n
}
export const acct = (d) => d?.account || d || {}
export const bal = (a) => Number(a.balance ?? a.available_balance ?? a.available ?? 0)
