import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { readSession, sameOrigin, seal } from '../../../../lib/session'
import { upstream } from '../../../../lib/upstream'
import { list } from '../../../../lib/shape'
import { normIban } from '../../../../lib/validate'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const J = (status, body) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const TTL = 60 // segundos de validez del token NFC

const isOff = (st) => /susp|block|bloq|cancel|expir|caduc/i.test(String(st || ''))

// Emite un token NFC de un solo uso para una tarjeta del usuario (solo si es suya y está activa).
// El móvil lo entrega al terminal por NFC (ver NfcPayService en la app Android); el terminal lo valida en /api/nfc/verify.
export async function POST(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return J(401, { error: { message: 'Sesión caducada.' } })
  if (!sameOrigin(req)) return J(403, { error: { message: 'Origen no permitido.' } })
  if (!hit('nfc:' + s.uid, 20, 60_000).ok) return J(429, { error: { message: 'Demasiados intentos. Espera un momento.' } })

  const b = await req.json().catch(() => ({}))
  const iban = normIban(b?.iban), ref = String(b?.ref ?? '')
  if (!iban || !/^[A-Za-z0-9_.-]{1,80}$/.test(ref)) return J(400, { error: { message: 'Tarjeta no válida.' } })

  // Es el banco quien dice qué tarjetas son del usuario (con su propio token).
  const r = await upstream(`me/accounts/${encodeURIComponent(iban)}/cards`, { token: s.tok })
  if (r.status >= 300) return J(r.status === 401 ? 401 : 502, { error: { message: 'No se han podido leer tus tarjetas.' } })
  const card = list(r.json, 'tarjetas').find((c) => String(c.ref) === ref)
  if (!card) return J(404, { error: { message: 'Esa tarjeta no es tuya.' } })
  if (isOff(card.estado)) return J(422, { error: { message: 'La tarjeta está suspendida.' } })

  const exp = Date.now() + TTL * 1000
  // Token compacto (≤ 240 bytes para caber en una sola respuesta APDU): cifrado y con caducidad.
  const token = 'PZ1.' + seal({ k: 'nfc', ref, iban, n: crypto.randomBytes(6).toString('hex'), exp })
  return J(200, { token, ttl: TTL, last4: card.ultimos4 || card.ultimos_4 || card.last4 || '' })
}
