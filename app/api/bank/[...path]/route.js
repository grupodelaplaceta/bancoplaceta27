import { NextResponse } from 'next/server'
import { readSession, readIbans, setIbans, sameOrigin, MAX_IBANS } from '../../../../lib/session'
import { upstream, unwrapServer } from '../../../../lib/upstream'
import { matchRule, ALLOWED_QS } from '../../../../lib/routes'
import { normIban, isIban, isIdemKey, isSegment, cleanAmount } from '../../../../lib/validate'
import { hit } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

const J = (status, body, headers = {}) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } })
const bad = (status, message, headers) => J(status, { error: { message } }, headers)
const idStr = (v) => (typeof v === 'string' && v.length <= 80) || (typeof v === 'number' && Number.isFinite(v))

async function handle(req, { params }) {
  const get = (n) => req.cookies.get(n)?.value
  const s = readSession(get)
  if (!s) return bad(401, 'Tu sesión ha caducado. Vuelve a entrar con PlacetaID.')
  const method = req.method
  if (method !== 'GET' && !sameOrigin(req)) return bad(403, 'Origen no permitido.')

  // 1) Ruta: solo segmentos seguros y solo endpoints de la lista blanca.
  const segs = (params.path || []).map((x) => { try { return decodeURIComponent(x) } catch { return '' } })
  if (!segs.length || !segs.every(isSegment)) return bad(404, 'Ruta no encontrada.')
  const owned = readIbans(get, s)
  if (segs[0] === 'accounts' && segs[1]) segs[1] = normIban(segs[1])
  const path = segs.join('/')
  const found = matchRule(method, path)
  if (!found) return bad(404, 'Operación no disponible.')
  const { rule, m } = found

  // 2) Límite de peticiones por usuario.
  const rl = hit('r:' + s.uid, 150, 60_000)
  const wl = method === 'POST' ? hit('w:' + s.uid, 20, 60_000) : { ok: true }
  if (!rl.ok || !wl.ok) {
    const retry = Math.max(rl.ok ? 0 : rl.retry, wl.ok ? 0 : wl.retry)
    return bad(429, 'Demasiadas peticiones.', { 'retry-after': String(retry) })
  }

  // 3) Propiedad: solo cuentas vinculadas a este usuario.
  if (rule.own && !owned.includes(normIban(m[rule.own]))) return bad(403, 'Esa cuenta no está vinculada a tu usuario.')

  // 4) Cuerpo saneado: al banco solo llegan los campos esperados.
  let body, idem
  if (method === 'POST') {
    idem = req.headers.get('idempotency-key')
    if (!isIdemKey(idem)) return bad(400, 'Falta una clave de idempotencia válida (Idempotency-Key).')
    const raw = await req.json().catch(() => ({}))
    const b = raw && typeof raw === 'object' ? raw : {}
    if (rule.create) {
      if (owned.length >= MAX_IBANS) return bad(422, `Has alcanzado el máximo de ${MAX_IBANS} cuentas vinculadas.`)
      body = {}
      if (idStr(b.product_id)) body.product_id = b.product_id
      if (idStr(b.product_code)) body.product_code = b.product_code
      if (!Object.keys(body).length) return bad(422, 'Elige un producto.')
    } else if (rule.transfer) {
      const from = normIban(b.from_iban), to = normIban(b.to_iban)
      if (!isIban(from) || !isIban(to)) return bad(422, 'Los IBAN no son válidos.')
      if (!owned.includes(from)) return bad(403, 'La cuenta de origen no está vinculada a tu usuario.')
      if (from === to) return bad(422, 'El destino no puede ser la misma cuenta.')
      const amount = cleanAmount(b.amount)
      if (amount === null) return bad(422, 'El importe no es válido (máximo 2 decimales).')
      const memo = typeof b.memo === 'string' ? b.memo.trim().slice(0, 140) : ''
      body = { from_iban: from, to_iban: to, amount, ...(memo && { memo }) }
    } else body = {}
  }

  // 5) Consulta al banco. Solo se reenvían los parámetros permitidos.
  const qs = new URLSearchParams()
  for (const k of ALLOWED_QS) { const v = req.nextUrl.searchParams.get(k); if (v && v.length <= 64) qs.set(k, v) }
  const r = await upstream(path, { method, body, idem, search: qs.size ? '?' + qs : '' })
  const headers = r.retryAfter ? { 'retry-after': r.retryAfter } : {}
  if (r.replay) headers['idempotent-replay'] = r.replay

  // 401 del banco = nuestra clave es inválida, no la sesión del usuario (que haría cerrar sesión).
  if (r.status === 401) return bad(502, 'El servidor no tiene una clave de API válida para el banco.')

  // 6) Efectos posteriores.
  if (rule.ref && r.status < 300) {
    const t = unwrapServer(r.json)
    const ends = [t.from_iban, t.from?.iban, t.to_iban, t.to?.iban].map(normIban)
    if (!ends.some((i) => owned.includes(i))) return bad(404, 'Transferencia no encontrada.')
  }
  const res = J(r.status, r.json, headers)
  if (rule.create && r.status < 300) {
    const ni = normIban(unwrapServer(r.json).iban)
    if (isIban(ni) && !owned.includes(ni)) setIbans(res, s, [...owned, ni])
  }
  return res
}

export { handle as GET, handle as POST }
