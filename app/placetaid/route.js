import { NextResponse } from 'next/server'
import { appBase } from '../../lib/session'
import { startSession } from '../../lib/login'

export const dynamic = 'force-dynamic'

// El DIP (documento de identidad del cliente) viene en el perfil de PlacetaID.
// Si tu PlacetaID lo devuelve con otro nombre, indícalo en PLACETAID_DIP_FIELD.
const dipOf = (u) => {
  const keys = [process.env.PLACETAID_DIP_FIELD, 'dip', 'DIP', 'dni', 'nif', 'document', 'document_number', 'documento'].filter(Boolean)
  for (const k of keys) { const v = u?.[k]; if (typeof v === 'string' && v.trim()) return v.trim().toUpperCase() }
  return ''
}

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
  const dip = dipOf(u) || dipOf(d)

  const r = NextResponse.redirect(base + '/')
  const err = await startSession(r, { uid, name, dip })
  if (err) return fail(err)
  r.cookies.delete('pid_state')
  return r
}
