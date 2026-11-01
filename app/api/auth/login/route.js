import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { appBase, setSession } from '../../../../lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const base = appBase(req)
  const fail = (m) => NextResponse.redirect(base + '/?error=' + encodeURIComponent(m))

  // Acceso de pruebas (solo local, nunca en producción): DEV_LOGIN=1 npm run dev
  if (process.env.DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production') {
    const r = NextResponse.redirect(base + '/')
    setSession(r, { uid: 'dev-user', name: process.env.DEV_NAME || 'Cliente de prueba' })
    return r
  }
  if (!process.env.PLACETAID_CLIENT_ID) return fail('Falta configurar PLACETAID_CLIENT_ID en el servidor.')

  const state = crypto.randomBytes(24).toString('base64url')
  const u = new URL('https://placetaid-web-plan2027.vercel.app/')
  u.searchParams.set('client_id', process.env.PLACETAID_CLIENT_ID)
  u.searchParams.set('redirect_uri', base + '/placetaid')
  u.searchParams.set('service', 'general')
  u.searchParams.set('state', state)
  const r = NextResponse.redirect(u)
  r.cookies.set('pid_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' })
  return r
}
