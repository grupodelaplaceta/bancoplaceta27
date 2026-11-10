import { NextResponse } from 'next/server'
import { readSession, sameOrigin } from '../../../../lib/session'
import { upstream } from '../../../../lib/upstream'
import { matchRule, ALLOWED_QS } from '../../../../lib/routes'
import { SANITIZE } from '../../../../lib/body'
import { isIdemKey, isSegment } from '../../../../lib/validate'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

const J = (status, body, headers = {}) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } })
const bad = (status, message, headers) => J(status, { error: { message } }, headers)

// El navegador llama a /api/bank/<ruta>; aquí se valida y se reenvía a /api/v1/me/<ruta> con el token del usuario.
// El banco decide qué cuentas son suyas: aquí no hace falta (ni se puede) tocar datos de otros.
async function handle(req, { params }) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return bad(401, 'Tu sesión ha caducado. Vuelve a entrar con PlacetaID.')
  const method = req.method
  if (method !== 'GET' && !sameOrigin(req)) return bad(403, 'Origen no permitido.')

  // 1) Ruta: solo segmentos seguros y solo endpoints de la lista blanca.
  const segs = (params.path || []).map((x) => { try { return decodeURIComponent(x) } catch { return '' } })
  if (!segs.length || !segs.every(isSegment)) return bad(404, 'Ruta no encontrada.')
  if (segs[0] === 'accounts' && segs[1]) segs[1] = segs[1].toUpperCase()
  const path = segs.join('/')
  const found = matchRule(method, path)
  if (!found) return bad(404, 'Operación no disponible.')
  const { rule, m } = found

  // 2) Límite de peticiones por usuario.
  const rl = hit('r:' + s.uid, 150, 60_000)
  const wl = method !== 'GET' ? hit('w:' + s.uid, Number(process.env.WRITE_LIMIT) || 30, 60_000) : { ok: true }
  if (!rl.ok || !wl.ok) {
    const retry = Math.max(rl.ok ? 0 : rl.retry, wl.ok ? 0 : wl.retry)
    return bad(429, 'Demasiadas peticiones.', { 'retry-after': String(retry) })
  }

  // 3) Idempotencia y cuerpo saneado.
  let body, idem
  if (rule.idem) {
    idem = req.headers.get('idempotency-key')
    if (!isIdemKey(idem)) return bad(400, 'Falta una clave de idempotencia válida (Idempotency-Key).')
  }
  if (rule.body) {
    const raw = await req.json().catch(() => ({}))
    const r = SANITIZE[rule.body](raw && typeof raw === 'object' ? raw : {}, m)
    if (r.error) return bad(422, r.error)
    body = r.body
  } else if (method === 'POST') body = {}

  // 4) Consulta al banco. Solo se reenvían los parámetros permitidos.
  const qs = new URLSearchParams()
  for (const k of ALLOWED_QS) { const v = req.nextUrl.searchParams.get(k); if (v && v.length <= 64) qs.set(k, v) }
  const up = rule.up === '' ? 'me' : 'me/' + path
  const r = await upstream(up, { method, body, idem, token: s.tok, search: qs.size ? '?' + qs : '' })
  const headers = r.retryAfter ? { 'retry-after': r.retryAfter } : {}
  if (r.replay) headers['idempotent-replay'] = r.replay
  const res = J(r.status, r.json, headers)
  if (r.status === 401) res.cookies.delete('sess') // token caducado o revocado: que el cliente vuelva a entrar
  return res
}

export { handle as GET, handle as POST, handle as DELETE }
