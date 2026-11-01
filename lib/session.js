// Sesión y cuentas vinculadas, en cookies firmadas con HMAC (sin base de datos).
//  · sess  → quién eres (8 h)
//  · ibn   → qué cuentas has vinculado, atada a tu uid (180 días). El servidor solo opera sobre ellas.
import crypto from 'crypto'
import { isIban } from './validate'

const PROD = process.env.NODE_ENV === 'production'
export const SESSION_MS = 8 * 36e5
export const IBANS_MS = 180 * 864e5
export const MAX_IBANS = 20

export const APP_URL = () => (process.env.APP_URL || 'https://bancoplaceta27.vercel.app').replace(/\/$/, '')
/** URL base para redirecciones: la configurada en producción, el origen de la petición en local. */
export const appBase = (req) => (PROD ? APP_URL() : req.nextUrl.origin)

const secret = () => {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 16) return s
  if (PROD) return null
  return 'dev-only-secret-change-me'
}

export const sign = (o) => {
  const k = secret()
  if (!k) throw new Error('Falta SESSION_SECRET (mínimo 16 caracteres) en el servidor.')
  const b = Buffer.from(JSON.stringify(o)).toString('base64url')
  return b + '.' + crypto.createHmac('sha256', k).update(b).digest('base64url')
}

export const verify = (t) => {
  const k = secret()
  if (!k || typeof t !== 'string') return null
  const [b, s] = t.split('.')
  if (!b || !s) return null
  const e = crypto.createHmac('sha256', k).update(b).digest('base64url')
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null
  try {
    const o = JSON.parse(Buffer.from(b, 'base64url').toString())
    return o && (!o.exp || o.exp > Date.now()) ? o : null
  } catch { return null }
}

const cookieOpts = (maxAgeMs) => ({ httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', maxAge: Math.floor(maxAgeMs / 1000) })

/** `get` es (nombre) => valor de cookie. Sirve igual con req.cookies o cookies() de next/headers. */
export const readSession = (get) => {
  const s = verify(get('sess'))
  return s && s.uid ? s : null
}

export const setSession = (res, { uid, name }) => {
  res.cookies.set('sess', sign({ uid: String(uid).slice(0, 120), name: String(name || 'Cliente').slice(0, 80), exp: Date.now() + SESSION_MS }), cookieOpts(SESSION_MS))
}

export const readIbans = (get, s) => {
  const o = verify(get('ibn'))
  if (!o || o.uid !== s.uid || !Array.isArray(o.ibans)) return []
  return o.ibans.filter(isIban).slice(0, MAX_IBANS)
}

export const setIbans = (res, s, list) => {
  res.cookies.set('ibn', sign({ uid: s.uid, ibans: list.slice(0, MAX_IBANS), exp: Date.now() + IBANS_MS }), cookieOpts(IBANS_MS))
}

/** Comprobación anti-CSRF para operaciones que modifican algo. */
export const sameOrigin = (req) => {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false
  const o = req.headers.get('origin')
  if (!o) return true // SameSite=Lax ya bloquea las peticiones entre sitios sin Origin
  return o === req.nextUrl.origin || o === new URL(APP_URL()).origin
}
