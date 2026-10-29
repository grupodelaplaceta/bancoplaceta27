import crypto from 'crypto'
import { verify } from '../../../../lib/session'
import { ownedIbans, invalidate } from '../../../../lib/owned'

const BASE = 'https://placetaone.vercel.app/api/v1/'
const SEG = '[A-Za-z0-9_.-]{1,64}'
// Solo se exponen al navegador los endpoints de la API v1 que la app realmente usa.
const ALLOW = {
  GET: [
    /^products$/,
    new RegExp(`^accounts/${SEG}$`),
    new RegExp(`^accounts/${SEG}/(transactions|receipts|cards|membership)$`),
    new RegExp(`^transfers/${SEG}$`),
  ],
  POST: [/^accounts$/, /^transfers$/, new RegExp(`^accounts/${SEG}/membership/renew$`)],
}
const json = (o, status = 200, h = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...h } })

async function proxy(req, { params }) {
  const s = verify(req.cookies.get('sess')?.value)
  if (!s || s.exp < Date.now()) return json({ error: 'Sesión caducada. Vuelve a entrar.' }, 401)

  const path = params.path.join('/')
  if (!(ALLOW[req.method] || []).some((r) => r.test(path))) return json({ error: 'Operación no permitida' }, 404)

  if (req.method === 'POST') { // protección CSRF: el origen debe ser la propia app
    const o = req.headers.get('origin'), host = req.headers.get('host')
    if (o && new URL(o).host !== host) return json({ error: 'Origen no permitido' }, 403)
  }

  // Solo se puede operar sobre cuentas del propio cliente (buscadas por su DIP en el servidor).
  let mine
  try { mine = await ownedIbans(s.dip) } catch (e) { return json({ error: e.message }, 502) }
  const m = path.match(/^accounts\/([^/]+)/)
  if (m && !mine.includes(m[1])) return json({ error: 'Esa cuenta no es tuya' }, 403)
  let body
  if (req.method === 'POST') {
    body = await req.text()
    try {
      const b = JSON.parse(body || '{}')
      if (path === 'transfers' && !mine.includes(b.from_iban)) return json({ error: 'La cuenta de origen no es tuya' }, 403)
      if (path === 'accounts') { b.dip = s.dip; b.holder_name = b.holder_name || s.name; body = JSON.stringify(b) }
    } catch { return json({ error: 'JSON no válido' }, 400) }
  }

  const headers = { 'x-api-key': process.env.PLACETA_API_KEY || '', accept: 'application/json' }
  const init = { method: req.method, headers, signal: AbortSignal.timeout(15000) }
  if (req.method === 'POST') {
    headers['content-type'] = 'application/json'
    // El cliente aporta la clave para que un reintento o doble clic no duplique el movimiento.
    const k = req.headers.get('x-idempotency-key')
    headers['Idempotency-Key'] = k && /^[\w-]{8,100}$/.test(k) ? k : crypto.randomUUID()
    init.body = body
  }
  try {
    const r = await fetch(BASE + path.split('/').map(encodeURIComponent).join('/') + req.nextUrl.search, init)
    const text = await r.text()
    if (r.ok && req.method === 'POST') invalidate(s.dip)
    if (r.ok && /^transfers\//.test(path)) { // seguimiento: solo transferencias que tocan una cuenta propia
      try { const t = JSON.parse(text); const t2 = t.transfer || t; if (![t2.from_iban, t2.to_iban].some((i) => mine.includes(i))) return json({ error: 'Transferencia no encontrada' }, 404) } catch {}
    }
    const extra = r.headers.get('retry-after') ? { 'retry-after': r.headers.get('retry-after') } : {}
    return new Response(text, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } })
  } catch {
    return json({ error: 'El banco no responde. Inténtalo en unos segundos.' }, 504)
  }
}
export { proxy as GET, proxy as POST }
