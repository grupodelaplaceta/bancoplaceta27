import { NextResponse } from 'next/server'
import { appBase } from '../../../../lib/session'

export const dynamic = 'force-dynamic'

// Cierra la sesión pero conserva las cuentas vinculadas (cookie "ibn"), atadas a tu uid.
function out(req) {
  const r = NextResponse.redirect(appBase(req) + '/', 303)
  r.cookies.delete('sess')
  return r
}
export { out as GET, out as POST }
