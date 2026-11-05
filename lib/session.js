import crypto from 'crypto'
const key = () => process.env.SESSION_SECRET || 'dev-secret'
export const sign = (o) => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', key()).update(b).digest('base64url') }
export const verify = (t) => { if (!t) return null; const [b, s] = t.split('.'); const e = crypto.createHmac('sha256', key()).update(b).digest('base64url'); if (!s || s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null; try { return JSON.parse(Buffer.from(b, 'base64url').toString()) } catch { return null } }
