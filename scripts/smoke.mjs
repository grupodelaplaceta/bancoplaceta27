// Prueba de humo: sesión firmada, proxy /me/*, lista blanca, permisos e idempotencia. Requiere:
//   npm run mock        (terminal 1)
//   npm run dev:mock    (terminal 2)
//   npm run smoke       (terminal 3)
const BASE = process.env.BASE || 'http://localhost:3000'
let cookies = {}, fails = 0
const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
const keep = (r) => { for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === '' || /Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k]; else cookies[k] = v } }
const call = async (method, path, { body, idem, noCookie, origin } = {}) => {
  const h = { 'content-type': 'application/json' }
  if (!noCookie) h.cookie = jar()
  if (idem) h['Idempotency-Key'] = idem
  if (origin) h.origin = origin
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  keep(r)
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const t = (name, ok, extra = '') => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  ' + extra)) }
const uid = () => crypto.randomUUID()

console.log('Sesión')
let r = await call('GET', '/api/bank/accounts', { noCookie: true }); t('sin sesión → 401', r.status === 401, r.status)
let l = await fetch(BASE + '/api/auth/login', { redirect: 'manual' }); keep(l)
t('login crea sesión cifrada (POST /sessions firmado)', !!cookies.sess && !String(cookies.sess).includes('pus_'), 'activa DEV_LOGIN=1 y el simulador')
t('el token no viaja en claro en la cookie', !Buffer.from(String(cookies.sess).split('.')[0] || '', 'base64url').toString().includes('pus_'))
r = await call('GET', '/api/bank/info'); t('GET /me → entidad y permisos', r.status === 200 && r.json.permisos?.includes('me:read'), JSON.stringify(r.json))

console.log('Cuentas y consulta')
r = await call('GET', '/api/bank/accounts'); const ibans = (r.json.cuentas || []).map((c) => c.iban)
t('mis cuentas', r.status === 200 && ibans.length >= 1, JSON.stringify(r.json))
const A = ibans[0]
r = await call('GET', `/api/bank/accounts/${A.toLowerCase()}`); t('ficha (normaliza mayúsculas)', r.status === 200 && r.json.limite_diario !== undefined, r.status)
r = await call('GET', `/api/bank/accounts/PZ-9999-9999`); t('cuenta ajena → 404 del banco', r.status === 404, r.status)
r = await call('GET', `/api/bank/accounts/${A}/transactions?limite=20`); const first = r.json
t('movimientos paginados', r.status === 200 && first.movimientos.length === 20 && !!first.siguiente, JSON.stringify(first).slice(0, 120))
r = await call('GET', `/api/bank/accounts/${A}/transactions?limite=20&antes=${first.siguiente}`); t('segunda página por cursor', r.status === 200 && r.json.movimientos[0].id !== first.movimientos[0].id)
r = await call('GET', `/api/bank/accounts/${A}/statement?desde=2020-01-01&hasta=2030-01-01`); t('extracto con saldo inicial/final', r.status === 200 && r.json.saldo_final !== undefined)
r = await call('GET', `/api/bank/accounts/${A}/cards`); t('tarjetas', r.status === 200 && Array.isArray(r.json.tarjetas))
r = await call('GET', `/api/bank/accounts/${A}/receipts`); const rec = r.json.recibos?.[0]; t('recibos', r.status === 200)
if (rec) { r = await call('GET', `/api/bank/receipts/${rec.ref}/certificate`); t('certificado de un recibo', r.status === 200 && !!r.json.hash) }
r = await call('GET', '/api/bank/lookup?iban=PZ-0001-0009'); t('lookup de IBAN', r.status === 200 && r.json.existe === true)

console.log('Lista blanca y validación')
r = await call('GET', '/api/bank/bk/personas?dip=1'); t('endpoints /bk no expuestos → 404', r.status === 404)
r = await call('GET', '/api/bank/accounts/..%2F..%2Fsessions'); t('path traversal → 404', r.status === 404, r.status)
r = await call('GET', '/api/bank/transfers/TR-1'); t('GET transfers/{ref} (de servidor) no disponible → 404', r.status === 404)
r = await call('POST', '/api/bank/transfers', { body: { desde_iban: A, hacia_iban: 'PZ-0001-0009', importe: 5 }, origin: 'https://evil.example', idem: uid() }); t('origen ajeno → 403', r.status === 403, r.status)

console.log('Transferencias e idempotencia')
const body = { desde_iban: A, hacia_iban: 'PZ-0001-0009', importe: 10.5, concepto: 'Prueba' }
r = await call('POST', '/api/bank/transfers', { body }); t('sin Idempotency-Key → 400', r.status === 400)
r = await call('POST', '/api/bank/transfers', { body: { ...body, importe: 1.234 }, idem: uid() }); t('3 decimales → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers', { body: { ...body, importe: -5 }, idem: uid() }); t('importe negativo → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers', { body: { ...body, hacia_iban: A }, idem: uid() }); t('mismo origen y destino → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers', { body: { ...body, desde_iban: 'x' }, idem: uid() }); t('IBAN inválido → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers', { body: { ...body, desde_iban: 'PZ-7777-0001' }, idem: uid() }); t('cuenta de origen ajena → la rechaza el banco', r.status === 404 || r.status === 403, r.status)
r = await call('POST', '/api/bank/transfers', { body: { ...body, importe: 999999 }, idem: uid() }); t('saldo insuficiente → 422', r.status === 422, r.status)
const k = uid()
const a = await call('POST', '/api/bank/transfers', { body, idem: k }), b = await call('POST', '/api/bank/transfers', { body, idem: k })
t('transferencia creada', a.status === 201 && !!a.json.transaccion, JSON.stringify(a.json))
t('reintento con la misma clave = misma transacción', b.json.transaccion === a.json.transaccion)
r = await call('POST', '/api/bank/transfers/scheduled', { body: { ...body, fecha: new Date(Date.now() - 864e5).toISOString() }, idem: uid() }); t('programada en el pasado → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers/scheduled', { body: { ...body, fecha: new Date(Date.now() + 864e5).toISOString(), periodicidad_dias: 30 }, idem: uid() }); const sid = r.json.programada
t('programar transferencia periódica', r.status === 201 && !!sid, JSON.stringify(r.json))
r = await call('GET', '/api/bank/transfers/scheduled'); t('listar programadas', r.status === 200 && r.json.programadas.some((x) => x.id === sid))
r = await call('DELETE', `/api/bank/transfers/scheduled/${sid}`); t('cancelar programada', r.status === 200 && r.json.cancelada === true)

console.log('Destinatarios, avisos y previsión')
r = await call('POST', '/api/bank/beneficiaries', { body: { alias: 'Ana', iban: 'PZ-0002-0100' }, idem: uid() }); const bid = r.json.beneficiario; t('guardar beneficiario', r.status === 201 && !!bid)
r = await call('DELETE', `/api/bank/beneficiaries/${bid}`); t('borrar beneficiario', r.status === 200)
r = await call('GET', '/api/bank/notifications?solo_nuevas=1'); const nn = r.json.notificaciones || []; t('avisos no leídos', r.status === 200 && nn.length > 0)
r = await call('POST', '/api/bank/notifications/read', { body: { ids: nn.map((x) => x.id) } }); t('marcar como leídos', r.status === 200 && r.json.marcadas === nn.length)
r = await call('POST', '/api/bank/notifications/read', { body: { ids: [] } }); t('marcar sin ids → 422', r.status === 422)
r = await call('GET', '/api/bank/previsiones?desde=2026-11-01&hasta=2027-01-31'); t('previsiones', r.status === 200 && r.json.previsiones.length > 0)

console.log('Tarjetas y diseños')
r = await call('GET', `/api/bank/accounts/${A}/cards`); const card = r.json.tarjetas?.[0]
if (card) {
  r = await call('POST', `/api/bank/cards/${card.ref}`, { body: { estado: 'suspended' } }); t('suspender tarjeta', r.status === 200 && r.json.estado === 'suspended')
  r = await call('POST', `/api/bank/cards/${card.ref}`, { body: { estado: 'hackeado' } }); t('estado inválido → 422', r.status === 422)
  r = await call('POST', `/api/bank/cards/${card.ref}`, { body: { estado: 'active' } }); t('reactivar tarjeta', r.status === 200)
}
r = await call('GET', '/api/bank/designs'); t('catálogo de diseños', r.status === 200 && r.json.disenos.length > 0)
r = await call('POST', '/api/bank/designs/DIS-00001/buy', { body: { iban: A } }); t('comprar diseño sin Idempotency-Key → 400', r.status === 400)
r = await call('POST', '/api/bank/designs/DIS-00002/buy', { body: { iban: A }, idem: uid() }); t('diseño sin stock → 422', r.status === 422)
const kb = uid()
r = await call('POST', '/api/bank/designs/DIS-00001/buy', { body: { iban: A }, idem: kb }); t('comprar diseño', r.status === 201 && !!r.json.transaccion, JSON.stringify(r.json))
const r2 = await call('POST', '/api/bank/designs/DIS-00001/buy', { body: { iban: A }, idem: kb }); t('reintento de compra = misma transacción (no cobra dos veces)', r2.json.transaccion === r.json.transaccion)
r = await call('GET', '/api/bank/designs/comprados'); t('diseños comprados', r.status === 200 && r.json.disenos.length === 1)
if (card) { r = await call('POST', `/api/bank/cards/${card.ref}/diseno`, { body: { codigo: 'DIS-00001' } }); t('aplicar diseño a la tarjeta', r.status === 200 && r.json.diseno === 'DIS-00001')
  r = await call('POST', `/api/bank/cards/${card.ref}/diseno`, { body: { codigo: 'DIS-00002' } }); t('diseño no comprado → 422 del banco', r.status === 422) }

console.log('RBU, planes y solicitudes')
r = await call('GET', '/api/bank/rbu'); const bono = r.json.bonos?.[0]; t('bonos RBU', r.status === 200 && !!bono)
r = await call('POST', `/api/bank/rbu/${bono.id}/claim`, { body: {}, idem: uid() }); t('reclamar bono', r.status === 201)
r = await call('POST', `/api/bank/rbu/${bono.id}/claim`, { body: {}, idem: uid() }); t('reclamar otra vez → 422', r.status === 422)
r = await call('GET', '/api/bank/plans'); t('planes a plazos', r.status === 200 && r.json.planes.length > 0)
r = await call('POST', '/api/bank/requests', { body: { tipo: 'prestamo', importe: 3000, cuotas: 12, motivo: 'Reforma' }, idem: uid() }); t('solicitar préstamo', r.status === 201)
r = await call('POST', '/api/bank/requests', { body: { tipo: 'prestamo', importe: 3000, cuotas: 0 }, idem: uid() }); t('préstamo con 0 cuotas → 422', r.status === 422)
r = await call('GET', '/api/bank/requests'); t('mis solicitudes', r.status === 200 && r.json.solicitudes.length === 1)

console.log('Abrir cuenta')
r = await call('POST', '/api/bank/accounts', { body: {}, idem: uid() }); t('abrir sin nombre → 422', r.status === 422)
r = await call('POST', '/api/bank/accounts', { body: { nombre: 'Ahorro' }, idem: uid() }); t('abrir cuenta personal', r.status === 201 && !!r.json.cuenta, JSON.stringify(r.json))
r = await call('GET', '/api/bank/accounts'); t('la cuenta nueva aparece sola (sin vincular)', r.json.cuentas.length === ibans.length + 1)

console.log('Sesiones')
r = await call('GET', '/api/bank/sessions'); t('mis sesiones', r.status === 200 && Array.isArray(r.json.sesiones))
r = await call('DELETE', '/api/bank/sessions'); t('cerrar el resto de sesiones', r.status === 200 && r.json.cerradas !== undefined)
const out = await fetch(BASE + '/api/auth/logout', { headers: { cookie: jar() }, redirect: 'manual' }); keep(out)
t('logout revoca y borra la cookie', out.status === 303 && !cookies.sess)

console.log(fails ? `\n${fails} comprobación(es) fallida(s)` : '\nTodo correcto ✔')
process.exit(fails ? 1 : 0)
