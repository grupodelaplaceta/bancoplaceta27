import { verify, sign } from '../../../../lib/session'
// TEMPORAL: guarda en la sesión el DIP que el cliente escribe, cuando PlacetaID no lo devuelve.
export async function POST(req) {
  const s = verify(req.cookies.get('sess')?.value)
  if (!s || s.exp < Date.now()) return Response.json({ error: 'Sesión caducada' }, { status: 401 })
  const o = req.headers.get('origin')
  if (o && new URL(o).host !== req.headers.get('host')) return Response.json({ error: 'Origen no permitido' }, { status: 403 })
  const { dip } = await req.json().catch(() => ({}))
  const v = String(dip || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,32}$/.test(v)) return Response.json({ error: 'DIP no válido' }, { status: 422 })
  const r = Response.json({ ok: true })
  r.headers.append('set-cookie', `sess=${sign({ ...s, dip: v })}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.max(60, Math.floor((s.exp - Date.now()) / 1000))}`)
  return r
}
