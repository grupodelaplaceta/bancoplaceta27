// Simulador local de la API v1 de Placeta One (solo los endpoints de usuario /me/* y /sessions).
//   node scripts/mock-api.mjs            (escucha en :4010)
//   npm run dev:mock                     (la app apuntando al simulador)
// Comprueba la firma HMAC con el formato por defecto de lib/sign.js (clave plk_demo, secreto demo_secret).
import http from 'node:http'
import crypto from 'node:crypto'

const KEY = 'plk_demo', SECRET = 'demo_secret', DIP = '12345678Z'
const now = Date.now(), day = 864e5
const iso = (t) => new Date(t).toISOString()
const accounts = {
  'PZ-0001-0001': { iban: 'PZ-0001-0001', nombre: 'Cuenta corriente', tipo: 'personal', rol: 'holder', saldo: 1250.4, reservado: 20, limite_diario: 3000, descubierto: false },
  'PZ-0001-0002': { iban: 'PZ-0001-0002', nombre: 'Cuenta Junior', tipo: 'personal', rol: 'holder', saldo: 85, reservado: 0, limite_diario: 100, descubierto: false },
}
const others = { 'PZ-0002-0100': 'Tienda Demo', 'PZ-0001-0009': 'María García' }
const tx = { 'PZ-0001-0001': [], 'PZ-0001-0002': [] }
const memos = ['Nómina', 'Mercadillo', 'Paga semanal', 'Pizza del viernes', 'Entradas cine', 'Regalo cumple', 'Devolución', 'Material colegio']
for (let i = 0; i < 120; i++) {
  const out = i % 3 !== 0, amt = Math.round((Math.random() * 90 + 3) * 100) / 100
  tx['PZ-0001-0001'].push({ id: 't' + String(i).padStart(4, '0'), concepto: memos[i % memos.length], importe: amt, direccion: out ? 'salida' : 'entrada', fecha: iso(now - i * 0.7 * day - Math.random() * day / 3), estado: 'completed', referencia: 'TR-' + (1000 + i) })
}
tx['PZ-0001-0002'].push({ id: 'j1', concepto: 'Paga semanal', importe: 10, direccion: 'entrada', fecha: iso(now - 2 * day), estado: 'completed' })
const cards = { 'PZ-0001-0001': [{ ref: 'TRJ-0001-000123', tipo: 'digital', ultimos4: '4821', estado: 'active', diseno: null }, { ref: 'TRJ-0001-000124', tipo: 'física', ultimos4: '1190', estado: 'suspended', diseno: null }], 'PZ-0001-0002': [] }
const receipts = { 'PZ-0001-0001': [{ ref: 'REC-2026-0042', numero: 'REC-2026-0042', fecha: iso(now - 3 * day), importe: 12.5, concepto: 'Cuota de servicio', estado: 'issued' }], 'PZ-0001-0002': [] }
const designs = [
  { codigo: 'DIS-00001', nombre: 'Aurora', nivel: 'premium', rareza: 'epica', precio: 12.5, licencia: 2, descripcion: 'Diseño con aurora boreal animada', imagen_url: null, stock_disponible: 48 },
  { codigo: 'DIS-00002', nombre: 'Minimal', nivel: 'basico', rareza: 'comun', precio: 2, licencia: 1, descripcion: 'Líneas limpias', imagen_url: null, stock_disponible: 0 },
]
const bought = []
const benef = [{ id: 'b1', alias: 'Casa de mamá', iban: 'PZ-0001-0009' }]
const scheduled = []
const notifs = [
  { id: 9001, titulo: 'Ingreso recibido', importe: 120, fecha: iso(now - day), leida: false },
  { id: 9002, titulo: 'Cargo en tarjeta', importe: 18.9, fecha: iso(now - 2 * day), leida: false },
  { id: 9003, titulo: 'Recibo emitido', importe: 12.5, fecha: iso(now - 5 * day), leida: true },
]
const rbu = [{ id: 'rbu1', concepto: 'RBU octubre', importe: 100, estado: 'available', fecha: iso(now - 3 * day) }]
const plans = [{ id: 'a1d4', tipo: 'installment', principal: 1200, cuotas: 12, estado: 'active', proximo: '2026-11-05', cuotas_pendientes: 9 }]
const requests = []
const sessions = new Map()   // token → { dip, exp, perms }
const idem = new Map()
let seq = 2
const hits = []

const send = (res, status, body, h = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(body)) }
const E = (res, s, m) => send(res, s, { error: { message: m } })
const view = (a) => ({ iban: a.iban, nombre: a.nombre, tipo: a.tipo, rol: a.rol, saldo: a.saldo, disponible: Math.round((a.saldo - a.reservado) * 100) / 100 })
const round = (n) => Math.round(n * 100) / 100

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname.replace(/^\/api\/v1\//, '').replace(/\/$/, '')
  const raw = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)) })
  const t0 = Date.now(); while (hits.length && hits[0] < t0 - 60000) hits.shift(); hits.push(t0)
  if (hits.length > 200) return send(res, 429, { error: { message: 'Límite de peticiones por minuto superado' } }, { 'retry-after': '3' })

  // --- Servidor: crear sesión (clave + firma HMAC) ---
  if (req.method === 'POST' && p === 'sessions') {
    if (req.headers['x-api-key'] !== KEY) return E(res, 401, 'Clave de API ausente o inválida')
    const ts = req.headers['x-timestamp'], sig = req.headers['x-signature']
    const want = crypto.createHmac('sha256', SECRET).update(`${ts}.POST.${u.pathname}${u.search}.${raw}`).digest('hex')
    if (!ts || sig !== want) return E(res, 401, 'Firma no válida')
    const b = JSON.parse(raw || '{}')
    if (b.dip !== DIP) return E(res, 404, 'No hay ninguna cuenta para ese DIP')
    const mins = Math.min(60, Number(b.minutos) || 15), token = 'pus_' + crypto.randomBytes(16).toString('hex')
    const exp = Date.now() + mins * 60000
    sessions.set(token, { dip: b.dip, exp, perms: b.permisos || ['me:read'] })
    return send(res, 201, { token, expira: iso(exp), permisos: b.permisos })
  }

  // --- Usuario: Bearer pus_… ---
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  const S = sessions.get(token)
  if (!S || S.exp < Date.now()) return E(res, 401, 'Sesión no válida o caducada')
  const need = (perm) => S.perms.includes(perm) || (E(res, 403, 'Permiso insuficiente: ' + perm), false)

  let body = {}
  if (req.method === 'POST') { try { body = raw ? JSON.parse(raw) : {} } catch { return E(res, 400, 'JSON no válido') } }
  const ik = req.headers['idempotency-key']
  const done = (s, b) => { if (ik) idem.set(req.method + p + ik, [s, b]); send(res, s, b) }
  if (req.method === 'POST' && ik && idem.has(req.method + p + ik)) return send(res, ...idem.get(req.method + p + ik), { 'idempotent-replay': 'true' })
  await new Promise((r) => setTimeout(r, 60))

  let m
  if (p === 'me' && req.method === 'GET') return send(res, 200, { banco: { codigo: '0001', nombre: 'Banco Demo' }, permisos: S.perms })
  if (p === 'me/sessions' && req.method === 'GET') return send(res, 200, { sesiones: [...sessions.entries()].filter(([, v]) => v.dip === S.dip && v.exp > Date.now()).map(([k, v], i) => ({ id: k.slice(-6), creada: iso(v.exp - 3e5), expira: iso(v.exp), actual: k === token })) })
  if (p === 'me/sessions' && req.method === 'DELETE') { if (!need('me:seguridad')) return; let n = 0; for (const k of [...sessions.keys()]) if (k !== token) { sessions.delete(k); n++ } return send(res, 200, { cerradas: n }) }
  if (p === 'sessions' && req.method === 'DELETE') { sessions.delete(token); return send(res, 200, { revocada: true }) }

  if (p === 'me/accounts' && req.method === 'GET') return send(res, 200, { cuentas: Object.values(accounts).map(view) })
  if (p === 'me/accounts' && req.method === 'POST') {
    if (!need('me:contratar')) return
    if (Object.keys(accounts).length >= 3) return done(422, { error: { message: 'Máximo 3 cuentas por entidad' } })
    const iban = 'PZ-0001-' + String(++seq).padStart(4, '0')
    accounts[iban] = { iban, nombre: body.nombre, tipo: 'personal', rol: 'holder', saldo: 0, reservado: 0, limite_diario: 1000, descubierto: false }; tx[iban] = []; cards[iban] = []; receipts[iban] = []
    return done(201, { cuenta: iban })
  }
  if ((m = p.match(/^me\/accounts\/([^/]+)(?:\/(\w+))?$/)) && req.method === 'GET') {
    const a = accounts[m[1]]; if (!a) return E(res, 404, 'No encontrado')
    if (!m[2]) return send(res, 200, { ...view(a), reservado: a.reservado, limite_diario: a.limite_diario, descubierto: a.descubierto })
    if (m[2] === 'transactions') {
      const lim = Math.min(100, Number(u.searchParams.get('limite')) || 50), before = u.searchParams.get('antes')
      const all = tx[a.iban], start = before ? all.findIndex((t) => t.id === before) + 1 : 0
      const page = all.slice(start, start + lim)
      return send(res, 200, { movimientos: page, siguiente: start + lim < all.length ? page[page.length - 1].id : null })
    }
    if (m[2] === 'statement') {
      const d = u.searchParams.get('desde'), h = u.searchParams.get('hasta')
      if (!d || !h) return E(res, 400, 'Faltan desde/hasta')
      const rows = tx[a.iban].filter((t) => t.fecha.slice(0, 10) >= d && t.fecha.slice(0, 10) <= h)
      const net = rows.reduce((s, t) => s + (t.direccion === 'salida' ? -t.importe : t.importe), 0)
      return send(res, 200, { saldo_inicial: round(a.saldo - net), movimientos: rows, saldo_final: a.saldo })
    }
    if (m[2] === 'receipts') return send(res, 200, { recibos: receipts[a.iban] })
    if (m[2] === 'cards') return send(res, 200, { tarjetas: cards[a.iban] })
  }
  if ((m = p.match(/^me\/receipts\/([^/]+)\/certificate$/))) return send(res, 200, { norma: 'IVA', base: 10.33, importe: 2.17, hash: crypto.createHash('sha1').update(m[1]).digest('hex') })
  if (p === 'me/lookup') { const i = (u.searchParams.get('iban') || '').toUpperCase(); return send(res, 200, accounts[i] ? { existe: true, entidad: '0001', titular: 'Cl***' } : others[i] ? { existe: true, entidad: i.split('-')[1], titular: others[i].slice(0, 2) + '***' } : { existe: false }) }

  if (p === 'me/transfers' && req.method === 'POST') {
    if (!need('me:transfer')) return
    const f = accounts[body.desde_iban]; if (!f) return done(404, { error: { message: 'Cuenta de origen no encontrada' } })
    const toA = accounts[body.hacia_iban]; if (!toA && !others[body.hacia_iban]) return done(404, { error: { message: 'Cuenta de destino no encontrada' } })
    if (!(body.importe > 0)) return done(422, { error: { message: 'Importe no válido' } })
    if (f.saldo - f.reservado < body.importe) return done(422, { error: { message: 'Saldo insuficiente' } })
    f.saldo = round(f.saldo - body.importe); if (toA) toA.saldo = round(toA.saldo + body.importe)
    const id = crypto.randomUUID(), fecha = iso(Date.now())
    tx[f.iban].unshift({ id, concepto: body.concepto || 'Transferencia', importe: body.importe, direccion: 'salida', fecha, estado: 'completed', referencia: id.slice(0, 8), desde_iban: f.iban, hacia_iban: body.hacia_iban })
    if (toA) tx[toA.iban].unshift({ id: id + 'i', concepto: body.concepto || 'Transferencia', importe: body.importe, direccion: 'entrada', fecha, estado: 'completed', desde_iban: f.iban, hacia_iban: toA.iban })
    notifs.unshift({ id: 9100 + notifs.length, titulo: 'Cargo en tu cuenta', importe: body.importe, fecha, leida: false })
    return done(201, { transaccion: id })
  }
  if (p === 'me/transfers/scheduled' && req.method === 'GET') return send(res, 200, { programadas: scheduled })
  if (p === 'me/transfers/scheduled' && req.method === 'POST') {
    if (!need('me:transfer')) return
    if (!accounts[body.desde_iban]) return done(404, { error: { message: 'Cuenta de origen no encontrada' } })
    const id = crypto.randomUUID(); scheduled.push({ id, ...body }); return done(201, { programada: id })
  }
  if ((m = p.match(/^me\/transfers\/scheduled\/([^/]+)$/)) && req.method === 'DELETE') { if (!need('me:transfer')) return; const i = scheduled.findIndex((x) => x.id === m[1]); if (i < 0) return E(res, 404, 'No encontrado'); scheduled.splice(i, 1); return send(res, 200, { cancelada: true }) }

  if (p === 'me/beneficiaries' && req.method === 'GET') return send(res, 200, { beneficiarios: benef })
  if (p === 'me/beneficiaries' && req.method === 'POST') { if (!need('me:transfer')) return; const id = 'b' + (benef.length + 1); benef.push({ id, ...body }); return done(201, { beneficiario: id }) }
  if ((m = p.match(/^me\/beneficiaries\/([^/]+)$/)) && req.method === 'DELETE') { if (!need('me:transfer')) return; const i = benef.findIndex((x) => x.id === m[1]); if (i < 0) return E(res, 404, 'No encontrado'); benef.splice(i, 1); return send(res, 200, { borrado: true }) }

  if ((m = p.match(/^me\/cards\/([^/]+)$/)) && req.method === 'POST') {
    if (!need('me:seguridad')) return
    const c = Object.values(cards).flat().find((x) => x.ref === m[1]); if (!c) return E(res, 404, 'No encontrado')
    c.estado = body.estado; return send(res, 200, { estado: c.estado })
  }
  if ((m = p.match(/^me\/cards\/([^/]+)\/diseno$/)) && req.method === 'POST') {
    if (!need('me:seguridad')) return
    const entry = Object.entries(cards).find(([, l]) => l.some((x) => x.ref === m[1])); if (!entry) return E(res, 404, 'No encontrado')
    const c = entry[1].find((x) => x.ref === m[1])
    if (body.codigo && !bought.some((b) => b.codigo === body.codigo && b.cuenta_iban === entry[0])) return E(res, 422, 'No has comprado este diseño para la cuenta de esta tarjeta')
    c.diseno = body.codigo; return send(res, 200, { diseno: body.codigo })
  }

  if (p === 'me/notifications' && req.method === 'GET') { const only = u.searchParams.get('solo_nuevas') === '1'; return send(res, 200, { notificaciones: notifs.filter((n) => !only || !n.leida) }) }
  if (p === 'me/notifications/read' && req.method === 'POST') { let n = 0; for (const x of notifs) if (body.ids?.includes(x.id) && !x.leida) { x.leida = true; n++ } return send(res, 200, { marcadas: n }) }
  if (p === 'me/previsiones') return send(res, 200, { previsiones: [{ id: 'p1', concepto: 'Alquiler', importe: 200, direccion: 'salida', fecha: iso(now + 5 * day) }, { id: 'p2', concepto: 'Nómina', importe: 1800, direccion: 'entrada', fecha: iso(now + 12 * day) }] })
  if (p === 'me/rbu' && req.method === 'GET') return send(res, 200, { bonos: rbu })
  if ((m = p.match(/^me\/rbu\/([^/]+)\/claim$/)) && req.method === 'POST') {
    if (!need('me:transfer')) return
    const b = rbu.find((x) => x.id === m[1]); if (!b || b.estado !== 'available') return done(422, { error: { message: 'Bono no disponible' } })
    b.estado = 'reclamado'; accounts['PZ-0001-0001'].saldo = round(accounts['PZ-0001-0001'].saldo + b.importe); return done(201, { transaccion: crypto.randomUUID() })
  }
  if (p === 'me/plans') return send(res, 200, { planes: plans })
  if (p === 'me/requests' && req.method === 'GET') { if (!need('me:contratar')) return; return send(res, 200, { solicitudes: requests }) }
  if (p === 'me/requests' && req.method === 'POST') { if (!need('me:contratar')) return; const id = crypto.randomUUID(); requests.push({ id, ...body, estado: 'pendiente', creado: iso(Date.now()) }); return done(201, { solicitud: id }) }

  if (p === 'me/designs' && req.method === 'GET') return send(res, 200, { disenos: designs.map((d) => ({ ...d, ya_adquirido: bought.some((b) => b.codigo === d.codigo) })) })
  if (p === 'me/designs/comprados') return send(res, 200, { disenos: bought })
  if ((m = p.match(/^me\/designs\/([^/]+)\/buy$/)) && req.method === 'POST') {
    if (!need('me:transfer')) return
    const d = designs.find((x) => x.codigo === m[1]), a = accounts[body.iban]
    if (!d || !a) return done(404, { error: { message: 'No encontrado' } })
    if (!d.stock_disponible) return done(422, { error: { message: 'Sin stock' } })
    if (a.saldo - a.reservado < d.precio) return done(422, { error: { message: 'Saldo insuficiente' } })
    a.saldo = round(a.saldo - d.precio); d.stock_disponible--
    const id = crypto.randomUUID(); bought.push({ ...d, comprado: iso(Date.now()), cuenta_iban: a.iban, transaccion: id, tarjetas_con_diseno: 0 })
    return done(201, { transaccion: id })
  }
  E(res, 404, 'No encontrado')
}).listen(4010, () => console.log('Mock API en http://localhost:4010/api/v1  (clave plk_demo, secreto demo_secret, DIP 12345678Z)'))
