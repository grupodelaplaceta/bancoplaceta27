// Cliente del lado servidor para la API v1 de Banca Placeta. La clave x-api-key nunca sale de aquí.
export const UPSTREAM = () => (process.env.PLACETA_API_URL || 'https://placetaone.vercel.app/api/v1').replace(/\/$/, '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function upstream(path, { method = 'GET', body, idem, search = '' } = {}) {
  if (!process.env.PLACETA_API_KEY) {
    return { status: 500, json: { error: { message: 'Falta configurar PLACETA_API_KEY en el servidor.' } } }
  }
  const headers = { 'x-api-key': process.env.PLACETA_API_KEY, accept: 'application/json' }
  const init = { method, headers, cache: 'no-store' }
  if (method === 'POST') {
    headers['content-type'] = 'application/json'
    if (idem) headers['Idempotency-Key'] = idem
    init.body = JSON.stringify(body ?? {})
  }
  // Las lecturas se reintentan una vez si el banco no responde; las escrituras nunca (para eso está la idempotencia).
  const attempts = method === 'GET' ? 2 : 1
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(UPSTREAM() + '/' + path + search, { ...init, signal: AbortSignal.timeout(15000) })
      const text = await r.text()
      let json = null
      try { json = JSON.parse(text) } catch {}
      last = { status: r.status, json: json ?? { error: { message: text.slice(0, 200) || 'Respuesta vacía del banco' } }, retryAfter: r.headers.get('retry-after'), replay: r.headers.get('idempotent-replay') }
      if (r.status < 502) return last
    } catch (e) {
      const msg = e?.name === 'TimeoutError' ? 'El banco ha tardado demasiado en responder.' : 'No se ha podido contactar con el banco.'
      last = { status: 502, json: { error: { message: msg } } }
    }
    if (i < attempts - 1) await sleep(250)
  }
  return last
}

/** Saca el objeto útil de { data: {...} }, { account: {...} } o { transfer: {...} }. */
export const unwrapServer = (d) => {
  if (!d || typeof d !== 'object') return {}
  const x = d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : d
  return x.account || x.transfer || x
}
