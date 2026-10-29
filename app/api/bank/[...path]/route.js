import crypto from 'crypto'
import { verify } from '../../../../lib/session'
async function proxy(req, { params }) {
  const s = verify(req.cookies.get('sess')?.value)
  if (!s || s.exp < Date.now()) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const url = 'https://placetaone.vercel.app/api/v1/' + params.path.map(encodeURIComponent).join('/') + req.nextUrl.search
  const h = { 'x-api-key': process.env.PLACETA_API_KEY }
  const init = { method: req.method, headers: h }
  if (req.method === 'POST') { h['content-type'] = 'application/json'; h['Idempotency-Key'] = crypto.randomUUID(); init.body = await req.text() }
  const r = await fetch(url, init)
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
}
export { proxy as GET, proxy as POST }
