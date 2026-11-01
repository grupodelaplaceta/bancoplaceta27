import { NextResponse } from 'next/server'
import { appBase, setSession } from '../../lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const base = appBase(req)
  const q = req.nextUrl.searchParams
  const fail = (m) => { const r = NextResponse.redirect(base + '/?error=' + encodeURIComponent(m)); r.cookies.delete('pid_state'); return r }

  if (q.get('error')) return fail('Has cancelado el acceso con PlacetaID.')
  const state = req.cookies.get('pid_state')?.value
  if (!state || q.get('state') !== state || !q.get('code')) return fail('Sesión no válida. Inténtalo de nuevo.')
  if (!process.env.PLACETAID_CLIENT_ID || !process.env.PLACETAID_CLIENT_SECRET) return fail('Falta configurar PlacetaID en el servidor.')

  let d
  try {
    const res = await fetch('https://placetaid-web-plan2027.vercel.app/api/public/exchange', {
      method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ client_id: process.env.PLACETAID_CLIENT_ID, client_secret: process.env.PLACETAID_CLIENT_SECRET, code: q.get('code'), redirect_uri: base + '/placetaid' }),
    })
    if (!res.ok) return fail('PlacetaID no ha podido validar el acceso.')
    d = await res.json()
  } catch { return fail('No se ha podido contactar con PlacetaID.') }

  const u = d.user || d.profile || d
  const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || 'Cliente'
  const uid = u.id || u.sub || u.user_id || u.uid || u.email || name
  const r = NextResponse.redirect(base + '/')
  try { setSession(r, { uid, name }) } catch (e) { return fail(e.message) }
  r.cookies.delete('pid_state')
  return r
}
