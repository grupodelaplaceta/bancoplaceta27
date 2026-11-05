import { NextResponse } from 'next/server'
import crypto from 'crypto'
export async function GET() {
  const state = crypto.randomBytes(24).toString('base64url')
  const app = process.env.APP_URL || 'https://bancoplaceta27.vercel.app'
  const u = new URL('https://placetaid-web-plan2027.vercel.app/')
  u.searchParams.set('client_id', process.env.PLACETAID_CLIENT_ID)
  u.searchParams.set('redirect_uri', app + '/placetaid')
  u.searchParams.set('service', 'general')
  u.searchParams.set('state', state)
  const r = NextResponse.redirect(u)
  r.cookies.set('pid_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return r
}
