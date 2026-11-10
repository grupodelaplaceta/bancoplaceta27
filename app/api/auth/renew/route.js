import { NextResponse } from 'next/server'
import { appBase, readRemember, sameOrigin } from '../../../../lib/session'
import { startSession } from '../../../../lib/login'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

// Renueva en silencio la sesión bancaria (el token del banco dura minutos) usando la identidad recordada.
async function renew(req) {
  const rem = readRemember((n) => req.cookies.get(n)?.value)
  if (!rem) return { rem: null }
  const rl = hit('renew:' + rem.uid, 30, 10 * 60_000)
  if (!rl.ok) return { rem, error: 'Demasiadas renovaciones seguidas. Espera un momento.' }
  return { rem }
}

export async function GET(req) {
  const base = appBase(req)
  const { rem, error } = await renew(req)
  const back = (m) => NextResponse.redirect(base + '/?noauto=1' + (m ? '&error=' + encodeURIComponent(m) : ''))
  if (!rem) return back('')
  if (error) return back(error)
  const r = NextResponse.redirect(base + '/')
  const err = await startSession(r, { uid: rem.uid, name: rem.name, dip: rem.dip, remember: true })
  return err ? back(err) : r
}

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
  const { rem, error } = await renew(req)
  if (!rem) return NextResponse.json({ error: 'Sin sesión recordada.' }, { status: 401 })
  if (error) return NextResponse.json({ error }, { status: 429 })
  const r = NextResponse.json({ ok: true })
  const err = await startSession(r, { uid: rem.uid, name: rem.name, dip: rem.dip, remember: true })
  return err ? NextResponse.json({ error: err }, { status: 401 }) : r
}
