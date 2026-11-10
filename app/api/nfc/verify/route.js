import { NextResponse } from 'next/server'
import { open } from '../../../../lib/session'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'
const used = new Map() // token -> caducidad (un solo uso; en memoria de esta instancia)

// Para el terminal / tu servidor: comprueba un token leído por NFC. Devuelve la tarjeta y la cuenta, y lo invalida.
// Protegido con NFC_VERIFY_KEY (cabecera x-nfc-key). No expone datos del titular.
export async function POST(req) {
  const key = process.env.NFC_VERIFY_KEY
  if (!key || req.headers.get('x-nfc-key') !== key) return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  if (!hit('nfcv:' + (req.headers.get('x-forwarded-for') || 'x'), 120, 60_000).ok) return NextResponse.json({ ok: false, error: 'Demasiadas peticiones.' }, { status: 429 })
  const { token } = await req.json().catch(() => ({}))
  const t = typeof token === 'string' && token.startsWith('PZ1.') ? open(token.slice(4)) : null
  if (!t || t.k !== 'nfc') return NextResponse.json({ ok: false, error: 'Token no válido o caducado.' }, { status: 422 })
  if (used.has(token)) return NextResponse.json({ ok: false, error: 'Token ya usado.' }, { status: 409 })
  used.set(token, t.exp)
  for (const [k, e] of used) if (e < Date.now()) used.delete(k)
  return NextResponse.json({ ok: true, ref: t.ref, iban: t.iban })
}
