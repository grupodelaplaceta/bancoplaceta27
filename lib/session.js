import crypto from 'crypto'
const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret')
export const hasSecret = () => !!secret()
const mac = (b) => crypto.createHmac('sha256', secret()).update(b).digest('base64url')
export const sign = (o) => { if (!secret()) throw new Error('Falta SESSION_SECRET'); const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + mac(b) }
export const verify = (t) => {
  if (!t || !secret()) return null
  const [b, s] = String(t).split('.'); if (!b || !s) return null
  const e = mac(b)
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()) } catch { return null }
}
// Variables de entorno obligatorias que faltan (para avisar en pantalla en vez de dar un 500).
export const missingEnv = () => ['SESSION_SECRET', 'PLACETA_API_KEY', 'PLACETAID_CLIENT_ID', 'PLACETAID_CLIENT_SECRET', 'APP_URL'].filter((k) => k === 'SESSION_SECRET' ? !hasSecret() : !process.env[k])
