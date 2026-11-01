// Simulador local de la API v1 de Banca Placeta. Úsalo así:
//   node scripts/mock-api.mjs            (escucha en :4010)
//   PLACETA_API_URL=http://localhost:4010/api/v1 PLACETA_API_KEY=plk_demo DEV_LOGIN=1 npm run dev
import http from 'node:http'
import crypto from 'node:crypto'

const KEY = 'plk_demo'
const now = Date.now(), day = 864e5
const accounts = {
  'PZ-0001-0001': { iban: 'PZ-0001-0001', product_name: 'Cuenta Corriente', balance: 1250.4, currency: 'EUR', status: 'active', created_at: new Date(now - 200 * day).toISOString() },
  'PZ-0001-0002': { iban: 'PZ-0001-0002', product_name: 'Cuenta Junior', balance: 85, currency: 'EUR', status: 'active', created_at: new Date(now - 40 * day).toISOString() },
  'PZ-0001-0003': { iban: 'PZ-0001-0003', product_name: 'Cuenta Ahorro', balance: 4200, currency: 'EUR', status: 'active', created_at: new Date(now - 90 * day).toISOString() },
}
const tx = { 'PZ-0001-0001': [], 'PZ-0001-0002': [], 'PZ-0001-0003': [] }
const memos = ['Nómina', 'Mercadillo', 'Paga semanal', 'Pizza del viernes', 'Entradas cine', 'Regalo cumple', 'Devolución', 'Material colegio']
for (let i = 0; i < 26; i++) {
  const out = i % 3 !== 0, amt = Math.round((Math.random() * 90 + 3) * 100) / 100
  tx['PZ-0001-0001'].push({ id: 't' + i, memo: memos[i % memos.length], amount: out ? -amt : amt, currency: 'EUR', created_at: new Date(now - i * 0.9 * day - Math.random() * day / 2).toISOString(), status: 'completed', reference: 'TR-' + (1000 + i) })
}
tx['PZ-0001-0002'].push({ id: 'j1', memo: 'Paga semanal', amount: 10, currency: 'EUR', created_at: new Date(now - 2 * day).toISOString(), status: 'completed' })
const cards = { 'PZ-0001-0001': [{ id: 'c1', last4: '4821', holder: 'Cliente de prueba', type: 'Débito', status: 'active', expires_at: '2028-09-30' }, { id: 'c2', last4: '1190', holder: 'Cliente de prueba', type: 'Virtual', status: 'blocked', expires_at: '2027-03-31' }], 'PZ-0001-0002': [], 'PZ-0001-0003': [] }
const receipts = { 'PZ-0001-0001': [{ id: 'r1', number: 'REC-2026-0042', created_at: new Date(now - 3 * day).toISOString(), total: 12.5, tax: 2.17, net_amount: 10.33, currency: 'EUR', concept: 'Cuota de servicio', status: 'issued' }], 'PZ-0001-0002': [], 'PZ-0001-0003': [] }
const members = { 'PZ-0001-0002': { status: 'active', plan: 'Junior', started_at: new Date(now - 20 * day).toISOString(), expires_at: new Date(now + 10 * day).toISOString(), price: 5 } }
const products = [
  { id: 'prod_corriente', code: 'CORRIENTE', name: 'Cuenta Corriente', type: 'checking', description: 'Para el día a día, con tarjeta de débito incluida.', monthly_fee: 0, min_balance: 0, currency: 'EUR', features: ['Tarjeta de débito', 'Transferencias ilimitadas'] },
  { id: 'prod_junior', code: 'JUNIOR', name: 'Cuenta Junior', type: 'junior', description: 'Para los más jóvenes, con membresía renovable.', monthly_fee: 5, currency: 'EUR', features: ['Membresía renovable', 'Límites reducidos'] },
  { id: 'prod_ahorro', code: 'AHORRO', name: 'Cuenta Ahorro', type: 'savings', description: 'Haz crecer tus ahorros.', interest_rate: 2.5, min_balance: 100, currency: 'EUR' },
]
const transfers = {}, idem = new Map()
let seq = 4

const hits = []
const send = (res, status, body, h = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(body)) }
const E = (res, s, m) => send(res, s, { error: { message: m } })

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname.replace(/^\/api\/v1\//, '').replace(/\/$/, '')
  if (req.headers['x-api-key'] !== KEY) return E(res, 401, 'Clave de API ausente o inválida')
  // Límite de 120 peticiones/min para probar el 429
  const t0 = Date.now(); while (hits.length && hits[0] < t0 - 60000) hits.shift(); hits.push(t0)
  if (hits.length > 120) return send(res, 429, { error: { message: 'Límite de peticiones por minuto superado' } }, { 'retry-after': '3' })
  let body = {}
  if (req.method === 'POST') {
    if (!req.headers['idempotency-key']) return E(res, 422, 'Falta la cabecera Idempotency-Key')
    const raw = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)) })
    try { body = raw ? JSON.parse(raw) : {} } catch { return E(res, 400, 'JSON no válido') }
    const k = req.method + p + req.headers['idempotency-key']
    if (idem.has(k)) return send(res, ...idem.get(k), { 'idempotent-replay': 'true' })
    var done = (s, b) => { idem.set(k, [s, b]); send(res, s, b) }
  }
  await new Promise((r) => setTimeout(r, 120)) // latencia realista
  let m
  if (req.method === 'GET' && p === 'products') return send(res, 200, { data: products })
  if (req.method === 'POST' && p === 'accounts') {
    const pr = products.find((x) => x.id === body.product_id || x.code === body.product_code)
    if (!pr) return E(res, 422, 'Producto no válido')
    const iban = 'PZ-0001-' + String(++seq).padStart(4, '0')
    accounts[iban] = { iban, product_name: pr.name, balance: 0, currency: 'EUR', status: 'active', created_at: new Date().toISOString() }
    tx[iban] = []; cards[iban] = []; receipts[iban] = []
    if (pr.type === 'junior') members[iban] = { status: 'active', plan: 'Junior', started_at: new Date().toISOString(), expires_at: new Date(now + 30 * day).toISOString(), price: 5 }
    return done(201, { data: accounts[iban] })
  }
  if ((m = p.match(/^accounts\/([^/]+)(?:\/(\w+))?(?:\/(renew))?$/))) {
    const a = accounts[m[1]]; if (!a) return E(res, 404, 'Cuenta no encontrada')
    if (req.method === 'GET' && !m[2]) return send(res, 200, { data: a })
    if (req.method === 'GET' && m[2] === 'transactions') return send(res, 200, { data: tx[a.iban] })
    if (req.method === 'GET' && m[2] === 'cards') return send(res, 200, { data: cards[a.iban] })
    if (req.method === 'GET' && m[2] === 'receipts') return send(res, 200, { data: receipts[a.iban] })
    if (req.method === 'GET' && m[2] === 'membership') return members[a.iban] ? send(res, 200, { data: members[a.iban] }) : E(res, 422, 'La cuenta no es Junior')
    if (req.method === 'POST' && m[2] === 'membership' && m[3] === 'renew') {
      const ms = members[a.iban]; if (!ms) return E(res, 422, 'La cuenta no es Junior')
      if (a.balance < ms.price) return done(422, { error: { message: 'Saldo insuficiente para renovar' } })
      a.balance -= ms.price; ms.expires_at = new Date(Math.max(Date.parse(ms.expires_at), Date.now()) + 30 * day).toISOString(); ms.status = 'active'
      return done(200, { data: ms })
    }
  }
  if (req.method === 'POST' && p === 'transfers') {
    const f = accounts[body.from_iban], t = accounts[body.to_iban]
    if (!f || !t) return done(404, { error: { message: 'Cuenta no encontrada' } })
    if (!(body.amount > 0)) return done(422, { error: { message: 'Importe no válido' } })
    if (f.balance < body.amount) return done(422, { error: { message: 'Saldo insuficiente' } })
    f.balance = Math.round((f.balance - body.amount) * 100) / 100; t.balance = Math.round((t.balance + body.amount) * 100) / 100
    const ref = 'TR-' + crypto.randomBytes(4).toString('hex').toUpperCase()
    // Importes >= 500 quedan "pending" 4 s para probar el seguimiento del estado
    const tr = { reference: ref, from_iban: f.iban, to_iban: t.iban, amount: body.amount, memo: body.memo, currency: 'EUR', status: body.amount >= 500 ? 'pending' : 'completed', created_at: new Date().toISOString() }
    transfers[ref] = tr
    if (tr.status === 'pending') setTimeout(() => { tr.status = 'completed' }, 4000)
    tx[f.iban].unshift({ id: ref, memo: body.memo || 'Transferencia', amount: -body.amount, currency: 'EUR', created_at: tr.created_at, status: 'completed', reference: ref, from_iban: f.iban, to_iban: t.iban })
    tx[t.iban].unshift({ id: ref + 'i', memo: body.memo || 'Transferencia', amount: body.amount, currency: 'EUR', created_at: tr.created_at, status: 'completed', reference: ref, from_iban: f.iban, to_iban: t.iban })
    return done(201, { data: tr })
  }
  if (req.method === 'GET' && (m = p.match(/^transfers\/(.+)$/))) return transfers[m[1]] ? send(res, 200, { data: transfers[m[1]] }) : E(res, 404, 'Transferencia no encontrada')
  E(res, 404, 'No encontrado')
}).listen(4010, () => console.log('Mock API en http://localhost:4010/api/v1  (clave: plk_demo)'))
