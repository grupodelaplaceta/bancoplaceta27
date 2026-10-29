import { NextResponse } from 'next/server'
import { sign } from '../../lib/session'
export async function GET(req) {
  const app = process.env.APP_URL || 'https://bancoplaceta27.vercel.app'
  const q = req.nextUrl.searchParams
  const ok = q.get('state') && q.get('state') === req.cookies.get('pid_state')?.value
  const fail = (m) => NextResponse.redirect(app + '/?error=' + encodeURIComponent(m))
  if (!ok || !q.get('code')) return fail('Sesión no válida. Inténtalo de nuevo.')
  const res = await fetch('https://placetaid-web-plan2027.vercel.app/api/public/exchange', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.PLACETAID_CLIENT_ID, client_secret: process.env.PLACETAID_CLIENT_SECRET, code: q.get('code'), redirect_uri: app + '/placetaid' })
  })
  if (!res.ok) return fail('PlacetaID no ha podido validar el acceso.')
  const d = await res.json()
  const u = d.user || d.profile || d
  const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || 'Cliente'
  const r = NextResponse.redirect(app + '/')
  r.cookies.set('sess', sign({ name, exp: Date.now() + 36e5 * 8 }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 28800 })
  r.cookies.delete('pid_state')
  return r
}
