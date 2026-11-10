import { NextResponse } from 'next/server'
import { readSession, readGw } from '../../../../lib/session'
import { upstream, errMsg } from '../../../../lib/upstream'
import { isSegment } from '../../../../lib/validate'

export const dynamic = 'force-dynamic'
const bad = (status, message) => NextResponse.json({ error: { message } }, { status, headers: { 'cache-control': 'no-store' } })

// Estado de un cobro. Solo de los que ha creado este usuario (lista en su cookie cifrada).
export async function GET(req, { params }) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get); if (!s) return bad(401, 'Sesión caducada.')
  const id = params.id
  if (!isSegment(id) || !readGw(get, s).some((x) => x.id === id)) return bad(404, 'Cobro no encontrado.')
  const r = await upstream('bk/checkouts/' + encodeURIComponent(id), { signed: true })
  if (r.status >= 300) return bad(r.status === 401 ? 502 : r.status, errMsg(r.json, 'No se ha podido consultar el cobro.'))
  return NextResponse.json(r.json, { headers: { 'cache-control': 'no-store' } })
}
