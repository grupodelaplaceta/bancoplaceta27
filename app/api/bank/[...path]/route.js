import crypto from 'crypto'
import { verify } from '../../../../lib/session'
import { authorize } from '../../../../lib/policy'
import { access } from '../../../../lib/access'

const IDEM = /^[A-Za-z0-9_-]{8,80}$/
const NULL_BODY = [204, 205, 304]

async function proxy(req, { params }) {
  const s = verify(req.cookies.get('sess')?.value)
  if (!s || s.exp < Date.now()) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const segs = params.path
  // Solo se consulta la titularidad cuando la ruta lo necesita (gestión de la entidad / apertura de cuentas)
  const needsAdmin = segs[0] === 'bk' || (segs[0] === 'accounts' && req.method === 'POST' && segs.length === 1)
  const deny = authorize(req.method, segs, { admin: needsAdmin ? (await access(s.dip)).admin : false })
  if (deny) return Response.json({ error: deny.message }, { status: deny.status })

  const url = 'https://placetaone.vercel.app/api/v1/' + segs.map(encodeURIComponent).join('/') + req.nextUrl.search
  const h = { 'x-api-key': process.env.PLACETA_API_KEY }
  const init = { method: req.method, headers: h }

  if (req.method !== 'GET') {
    const ct = req.headers.get('content-type') || ''
    if (ct.startsWith('multipart/form-data')) {
      h['content-type'] = ct // subida de logos
      init.body = Buffer.from(await req.arrayBuffer())
    } else {
      const text = await req.text()
      if (text) { h['content-type'] = 'application/json'; init.body = text }
    }
  }
  if (req.method === 'POST') {
    // La clave la genera el navegador una vez por formulario, así un reintento no duplica el movimiento.
    const given = req.headers.get('idempotency-key')
    h['Idempotency-Key'] = given && IDEM.test(given) ? given : crypto.randomUUID()
  }

  const r = await fetch(url, init)
  const text = await r.text()
  return new Response(NULL_BODY.includes(r.status) ? null : text, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
  })
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE }
