// Cliente del proxy /api/bank. `path` ya viene con los segmentos codificados.
export async function call(method, path, { query, body, form, idem } = {}) {
  const qs = query && Object.keys(query).length ? '?' + new URLSearchParams(query) : ''
  const init = { method, headers: {} }
  if (form) init.body = form
  else if (body !== undefined && method !== 'GET') { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body) }
  if (idem && method === 'POST') init.headers['Idempotency-Key'] = idem
  const r = await fetch('/api/bank/' + path + qs, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(d.error?.message || d.message || (typeof d.error === 'string' && d.error) || 'Error ' + r.status)
    e.status = r.status
    throw e
  }
  return d
}
