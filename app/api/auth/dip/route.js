import { NextResponse } from 'next/server'
import { appBase, readPending, setDip, sameOrigin, isApp } from '../../../../lib/session'
import { startSession } from '../../../../lib/login'
import { cleanDip, isDip } from '../../../../lib/validate'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const base = appBase(req)
  const back = (m) => NextResponse.redirect(base + '/dip?error=' + encodeURIComponent(m), 303)
  const p = readPending((n) => req.cookies.get(n)?.value)
  if (!p) return NextResponse.redirect(base + '/?error=' + encodeURIComponent('Tu acceso ha caducado. Inténtalo de nuevo.'), 303)
  if (!sameOrigin(req)) return back('Origen no permitido.')
  const rl = hit('dip:' + p.uid, 5, 10 * 60_000) // frena el probar DIP ajenos
  if (!rl.ok) return back(`Demasiados intentos. Espera ${Math.ceil(rl.retry / 60)} min.`)
  const dip = cleanDip((await req.formData().catch(() => null))?.get('dip'))
  if (!isDip(dip)) return back('El DIP no es válido.')
  const r = NextResponse.redirect(base + '/', 303)
  const err = await startSession(r, { uid: p.uid, name: p.name, dip, verify: true, remember: isApp(req) })
  if (err) return back(err)
  setDip(r, String(p.uid), dip); r.cookies.delete('pid_pending')
  return r
}
