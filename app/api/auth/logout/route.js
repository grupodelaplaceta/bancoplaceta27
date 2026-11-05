import { NextResponse } from 'next/server'
import { appBase, readSession } from '../../../../lib/session'
import { upstream } from '../../../../lib/upstream'

export const dynamic = 'force-dynamic'

// Cierra la sesión en el banco (revoca el token) y borra la cookie.
async function out(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (s) await upstream('sessions', { method: 'DELETE', token: s.tok }).catch(() => {})
  const r = NextResponse.redirect(appBase(req) + '/', 303)
  r.cookies.delete('sess')
  return r
}
export { out as GET, out as POST }
