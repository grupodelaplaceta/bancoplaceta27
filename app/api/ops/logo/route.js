import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { readSession, sameOrigin } from '../../../../lib/session'
import { upstream, errMsg } from '../../../../lib/upstream'
import { contexto } from '../../../../lib/titular'
import { isIban, normIban } from '../../../../lib/validate'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const J = (status, body) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const bad = (status, message) => J(status, { error: { message } })

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
const MAX = 512 * 1024
// Quién puede subir qué logo: la marca de la ENTIDAD, solo la cuenta institucional; la de un COMERCIO, la institucional o una empresa.
const TARGETS = { entidad: { path: 'bk/branding/logo', kinds: ['institucional'] }, comercio: { path: 'bk/comercio/logo', kinds: ['institucional', 'empresa'] } }

// Sube el logo (multipart) con la clave firmada del servidor. Solo titular o cotitular de la cuenta activa.
export async function POST(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return bad(401, 'Sesión caducada.')
  if (!sameOrigin(req)) return bad(403, 'Origen no permitido.')
  if (!hit('logo:' + s.uid, 10, 60_000).ok) return bad(429, 'Demasiadas peticiones.')
  let form
  try { form = await req.formData() } catch { return bad(400, 'Formulario no válido.') }

  const c = await contexto(s, String(form.get('iban') || ''))
  if (!c.ok) return bad(c.status, c.message)
  const t = TARGETS[String(form.get('destino'))]
  if (!t || !t.kinds.includes(c.kind)) return bad(404, 'Operación no disponible para este tipo de cuenta.')

  const file = form.get('logo')
  if (!file || typeof file === 'string' || !file.size) return bad(400, 'Elige una imagen.')
  if (!TYPES[file.type]) return bad(400, 'El logo debe ser PNG, JPG, WebP o SVG.')
  if (file.size > MAX) return bad(400, 'El logo no puede pasar de 512 KB.')
  const bytes = Buffer.from(await file.arrayBuffer())
  if (file.type === 'image/svg+xml' && /<script|\son\w+\s*=|javascript:|<foreignObject/i.test(bytes.toString('utf8'))) return bad(400, 'El SVG no puede llevar scripts.')

  // Una empresa solo puede subir el logo de SU comercio (cuenta activa); la institucional puede indicar otro.
  const comercio = c.kind === 'institucional' ? normIban(form.get('iban_comercio')) : c.iban
  if (t.path === 'bk/comercio/logo' && c.kind === 'institucional' && comercio && !isIban(comercio)) return bad(400, 'El IBAN del comercio no es válido.')

  const boundary = '----pz' + crypto.randomBytes(12).toString('hex')
  const parts = []
  const text = (name, v) => parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${v}\r\n`))
  if (t.path === 'bk/comercio/logo' && comercio) text('iban_comercio', comercio)
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="logo"; filename="logo.${TYPES[file.type]}"\r\nContent-Type: ${file.type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`))

  const r = await upstream(t.path, { method: 'POST', signed: true, raw: { buffer: Buffer.concat(parts), contentType: 'multipart/form-data; boundary=' + boundary } })
  if (r.status === 401) return bad(502, 'El banco no ha aceptado la clave o la firma del servidor para subir el logo.')
  if (r.status >= 300) return bad(r.status === 429 ? 429 : r.status, errMsg(r.json, 'El banco no ha podido guardar el logo.'))
  return J(r.status, r.json ?? { ok: true })
}
