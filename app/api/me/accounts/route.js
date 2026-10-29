import { verify } from '../../../../lib/session'
import { ownedIbans } from '../../../../lib/owned'
export const dynamic = 'force-dynamic'
export async function GET(req) {
  const s = verify(req.cookies.get('sess')?.value)
  if (!s || s.exp < Date.now()) return Response.json({ error: 'Sesión caducada' }, { status: 401 })
  if (!s.dip) return Response.json({ error: 'Tu PlacetaID no incluye DIP. Vuelve a entrar.' }, { status: 409 })
  try { return Response.json({ ibans: await ownedIbans(s.dip, req.nextUrl.searchParams.has('fresh')) }, { headers: { 'cache-control': 'no-store' } }) }
  catch (e) { return Response.json({ error: e.message }, { status: e.status === 403 ? 403 : 502 }) }
}
