// Cliente del lado servidor para la API v1 de Placeta One.
//  · con `token`  → llamadas de usuario (Authorization: Bearer pus_…), rutas /me/*
//  · con `signed` → llamadas del backend (x-api-key + firma HMAC), p. ej. crear sesión
import { signedHeaders } from './sign'

export const UPSTREAM = () => (process.env.PLACETA_API_URL || 'https://placetaone.vercel.app/api/v1').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function upstream(path, { method = 'GET', body, idem, search = '', token, signed } = {}) {
  const headers = { accept: 'application/json' }
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  const bodyStr = hasBody ? JSON.stringify(body ?? {}) : ''
  const url = UPSTREAM() + '/' + path + search
  if (signed) {
    if (!process.env.PLACETA_API_KEY) return { status: 500, json: { error: { message: 'Falta configurar PLACETA_API_KEY en el servidor.' } } }
    headers['x-api-key'] = process.env.PLACETA_API_KEY
    const sig = signedHeaders(method, new URL(url).pathname + search, bodyStr)
    if (!sig) return { status: 500, json: { error: { message: 'Falta configurar PLACETA_API_SECRET (firma HMAC) en el servidor.' } } }
    Object.assign(headers, sig)
  }
  if (token) headers.authorization = 'Bearer ' + token
  if (hasBody) { headers['content-type'] = 'application/json'; if (idem) headers['Idempotency-Key'] = idem }
  const init = { method, headers, cache: 'no-store', ...(hasBody && { body: bodyStr }) }
  // Las lecturas se reintentan una vez si el banco no responde; las escrituras nunca (para eso está la idempotencia).
  const attempts = method === 'GET' ? 2 : 1
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
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

export const errMsg = (j, fb) => j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : '') || fb
