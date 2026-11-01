// Sesión del usuario en una cookie CIFRADA (AES-256-GCM) con el token pus_… de Placeta dentro.
// El navegador nunca lee el token (httpOnly) y, aunque lo viera, está cifrado. Sin base de datos.
import crypto from 'crypto'

const PROD = process.env.NODE_ENV === 'production'
export const minutes = () => Math.min(60, Math.max(5, Number(process.env.SESSION_MINUTES) || 30))
export const PERMISOS = ['me:read', 'me:transfer', 'me:contratar', 'me:seguridad']

export const APP_URL = () => (process.env.APP_URL || 'https://bancoplaceta27.vercel.app').replace(/\/$/, '')
/** URL base para redirecciones: la configurada en producción, el origen de la petición en local. */
export const appBase = (req) => (PROD ? APP_URL() : req.nextUrl.origin)

const key = () => {
  const s = process.env.SESSION_SECRET
  const k = s && s.length >= 16 ? s : PROD ? null : 'dev-only-secret-change-me'
  return k && crypto.createHash('sha256').update(k).digest()
}

export const seal = (o) => {
  const k = key()
  if (!k) throw new Error('Falta SESSION_SECRET (mínimo 16 caracteres) en el servidor.')
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv)
  const enc = Buffer.concat([c.update(JSON.stringify(o), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url')
}

export const open = (t) => {
  const k = key()
  if (!k || typeof t !== 'string' || t.length < 40) return null
  try {
    const b = Buffer.from(t, 'base64url')
    const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28))
    const o = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'))
    return o && o.exp > Date.now() ? o : null
  } catch { return null }
}

/** `get` es (nombre) => valor de cookie. Sirve igual con req.cookies o cookies() de next/headers. */
export const readSession = (get) => { const s = open(get('sess')); return s && s.uid && s.tok ? s : null }

export const setSession = (res, { uid, name, tok, perms, expMs }) => {
  const exp = Math.min(expMs, Date.now() + 8 * 36e5)
  res.cookies.set('sess', seal({ uid: String(uid).slice(0, 120), name: String(name || 'Cliente').slice(0, 80), tok, perms, exp }),
    { httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', maxAge: Math.max(60, Math.floor((exp - Date.now()) / 1000)) })
}

/** Comprobación anti-CSRF para operaciones que modifican algo. */
export const sameOrigin = (req) => {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false
  const o = req.headers.get('origin')
  if (!o) return true // SameSite=Lax ya bloquea las peticiones entre sitios sin Origin
  return o === req.nextUrl.origin || o === new URL(APP_URL()).origin
}
