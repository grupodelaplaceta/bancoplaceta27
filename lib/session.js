import crypto from 'crypto'
const key = () => {
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') throw new Error('Falta SESSION_SECRET')
  return process.env.SESSION_SECRET || 'dev-secret'
}
const mac = (b) => crypto.createHmac('sha256', key()).update(b).digest('base64url')
export const sign = (o) => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + mac(b) }
export const verify = (t) => {
  if (!t) return null
  const [b, s] = t.split('.'); if (!b || !s) return null
  const e = mac(b)
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()) } catch { return null }
}
