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

console.log('Pasarela de pago y catálogo')
r = await call('GET', '/api/catalog'); t('catálogo de productos (llamada firmada)', r.status === 200 && r.json.productos?.length > 0, JSON.stringify(r.json))
r = await call('GET', '/api/catalog', { noCookie: true }); t('catálogo sin sesión → 401', r.status === 401)

console.log('Gestión de la entidad (titular o cotitular de la cuenta activa)')
const ops = (iban) => call('GET', '/api/ops' + (iban ? '?iban=' + iban : ''))
r = await ops(); t('sin cuenta → 400', r.status === 400, r.status)
r = await ops('PZ-0001-0005'); t('titular de cuenta institucional → catálogo', r.status === 200 && r.json.kind === 'institucional' && r.json.ops.length > 80, r.status)
r = await ops('PZ-0001-0006'); t('cotitular → catálogo', r.status === 200, r.status)
r = await ops('PZ-0001-0007'); t('solo autorizado → 403', r.status === 403, r.status)
r = await ops('PZ-0001-0001'); t('cuenta personal → 403', r.status === 403, r.status)
r = await ops('PZ-9999-0001'); t('cuenta ajena → 403', r.status === 403, r.status)
r = await ops('PZ-0001-0004'); t('empresa: sus funciones (cargos, pasarela en su web, marca)', r.status === 200 && ['cargo_crear', 'checkout_crear', 'origen_pedir', 'comercio_branding'].every((id) => r.json.ops.some((o) => o.id === id)) && !r.json.ops.some((o) => o.id === 'org_unidad' || o.id === 'clientes_ver'), JSON.stringify(r.json).slice(0, 200))
r = await ops('PZ-0001-0002'); t('junior: membresía', r.status === 200 && r.json.label === 'Membresía', JSON.stringify(r.json).slice(0, 200))
const op = (id, iban, valores, idem) => call('POST', '/api/ops', { body: { op: id, iban, valores }, idem })
r = await op('org_unidad', 'PZ-0001-0005', { nombre: 'Hacienda' }); t('crear unidad (institucional)', r.status === 200 && r.json.cuerpo?.accion === 'unidad' && !!r.json.cuerpo?.dip_actor, JSON.stringify(r.json))
r = await op('org_unidad', 'PZ-0001-0007', { nombre: 'X' }); t('autorizado no puede operar → 403', r.status === 403, r.status)
r = await op('org_unidad', 'PZ-0001-0004', { nombre: 'X' }); t('empresa no tiene organigrama → 404', r.status === 404, r.status)
r = await op('prog_crear', 'PZ-0001-0001', { nombre: 'X', tipo: 'bono' }); t('personal no gestiona subvenciones → 404', r.status === 404, r.status)
r = await op('cargo_crear', 'PZ-0001-0004', { card_ref: 'TRJ-0001-000123', importe: 5, iban_comercio: 'PZ-0001-0001' }, uid()); t('empresa: el comercio se fuerza a su propia cuenta', r.status === 200 && r.json.cuerpo?.iban_comercio === 'PZ-0001-0004', JSON.stringify(r.json))
r = await op('membresia_ren', 'PZ-0001-0002', { iban: 'PZ-0001-0001', user_id: 'u1' }, uid()); t('junior: no puede renovar la membresía de otra cuenta', r.json.ruta === 'accounts/PZ-0001-0002/membership/renew', JSON.stringify(r.json))
r = await op('cargo_crear', 'PZ-0001-0004', { card_ref: 'TRJ-0001-000123', importe: 5 }); t('operación con dinero sin Idempotency-Key → 400', r.status === 400, r.status)
console.log('Pasarela integrada en tu web (empresa) y marca')
r = await op('checkout_crear', 'PZ-0001-0004', { origen: 'https://app.tubanco.es', client_ref: 'P-1', importe: 25, iban_destino: 'PZ-0001-0001', url_retorno: 'https://app.tubanco.es/gracias' }, uid())
t('empresa crea un pago: la cuenta que cobra se fuerza a la suya', r.status === 200 || r.status === 201, JSON.stringify(r.json))
t('  …y no puede cobrar en la de otro', r.json.eco?.iban_destino === 'PZ-0001-0004', JSON.stringify(r.json))
r = await op('checkout_crear', 'PZ-0001-0004', { origen: 'http://inseguro.example', client_ref: 'P-2', importe: 25 }, uid()); t('origen no https → 422', r.status === 422, r.status)
r = await op('checkout_crear', 'PZ-0001-0004', { origen: 'https://app.tubanco.es', client_ref: 'P-3', importe: 25, url_retorno: 'javascript:alert(1)' }, uid()); t('URL de retorno no https → 400', r.status === 400, r.status)
r = await op('origen_pedir', 'PZ-0001-0004', { origen: 'https://mi-web.example', entorno: 'produccion' }); t('empresa solicita su dominio (queda pendiente)', r.status === 200 || r.status === 201, r.status)
r = await op('origen_pedir', 'PZ-0001-0004', { origen: 'no-es-url', entorno: 'produccion' }); t('dominio no válido → 400', r.status === 400, r.status)
r = await op('origen_retirar', 'PZ-0001-0004', { origen: 'https://app.tubanco.es' }); t('empresa no puede retirar dominios → 404', r.status === 404, r.status)
r = await op('comercio_branding', 'PZ-0001-0004', { nombre: 'Mi Tienda', color: '#12ab34', iban_comercio: 'PZ-0001-0001' }); t('marca del comercio: se fuerza a su cuenta', r.status === 200 && r.json.cuerpo?.iban_comercio === 'PZ-0001-0004', JSON.stringify(r.json))
r = await op('comercio_branding', 'PZ-0001-0004', { nombre: 'Mi Tienda', color: 'rojo' }); t('color no válido → 400', r.status === 400, r.status)
r = await op('branding_fijar', 'PZ-0001-0004', { nombre: 'X' }); t('empresa no cambia la marca de la entidad → 404', r.status === 404, r.status)
r = await op('branding_fijar', 'PZ-0001-0005', { nombre: 'Banco 27', color: '#5B2FD9', logo: 'http://x.example/l.png' }); t('logo por URL no https → 400', r.status === 400, r.status)
r = await op('branding_fijar', 'PZ-0001-0005', { nombre: 'Banco 27', color: '#5B2FD9', logo: 'https://x.example/l.png', texto_legal: 'Pago seguro' }); t('entidad fija su marca', r.status === 200 && r.json.cuerpo?.color === '#5B2FD9', JSON.stringify(r.json))
const up = async (iban, destino, name = 'logo.svg', type = 'image/svg+xml', content = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#5B2FD9"/></svg>') => {
  const fd = new FormData(); fd.set('iban', iban); fd.set('destino', destino); fd.set('logo', new Blob([content], { type }), name)
  const x = await fetch(BASE + '/api/ops/logo', { method: 'POST', headers: { cookie: jar() }, body: fd }); return { status: x.status, json: await x.json().catch(() => ({})) }
}
r = await up('PZ-0001-0004', 'comercio'); t('empresa sube el logo de su comercio (multipart firmado)', r.status === 201 && r.json.tiene_logo === true, JSON.stringify(r.json))
r = await up('PZ-0001-0004', 'entidad'); t('empresa no sube el logo de la entidad → 404', r.status === 404, r.status)
r = await up('PZ-0001-0005', 'entidad'); t('entidad sube su logo', r.status === 201, JSON.stringify(r.json))
r = await up('PZ-0001-0007', 'entidad'); t('solo autorizado no sube logos → 403', r.status === 403, r.status)
r = await up('PZ-0001-0004', 'comercio', 'x.svg', 'image/svg+xml', '<svg><script>alert(1)</script></svg>'); t('SVG con script → 422', r.status === 422, r.status)
r = await up('PZ-0001-0004', 'comercio', 'x.gif', 'image/gif', 'GIF89a'); t('formato no admitido → 422', r.status === 422, r.status)
r = await op('checkouts_ver', 'PZ-0001-0005', {}); t('entidad ve los pagos recibidos', r.status === 200, r.status)
r = await op('checkouts_ver', 'PZ-0001-0004', {}); t('empresa no ve los pagos de toda la entidad → 404', r.status === 404, r.status)
r = await op('cliente_crear', 'PZ-0001-0005', { nombre: 'Web', permisos: 'checkout:crear' }); t('entidad crea clave de API (permisos como lista)', r.status === 200 && Array.isArray(r.json.cuerpo?.permisos), JSON.stringify(r.json))
r = await call('GET', '/api/ops?iban=PZ-0001-0005'); t('el catálogo indica la URL base de la API', typeof r.json.api === 'string' && /^https?:\/\//.test(r.json.api), r.json.api)
r = await call('GET', '/api/gateway'); t('la pasarela antigua (cobro con DIP del pagador) ya no existe', r.status === 404, r.status)

r = await call('POST', '/api/ops', { body: { op: 'org_unidad', iban: 'PZ-0001-0005', valores: { nombre: 'X' } }, origin: 'https://evil.example' }); t('origen ajeno → 403', r.status === 403, r.status)

console.log('Sesiones')
r = await call('GET', '/api/bank/sessions'); t('mis sesiones', r.status === 200 && Array.isArray(r.json.sesiones))
r = await call('DELETE', '/api/bank/sessions'); t('cerrar el resto de sesiones', r.status === 200 && r.json.cerradas !== undefined)
const out = await fetch(BASE + '/api/auth/logout', { headers: { cookie: jar() }, redirect: 'manual' }); keep(out)
t('logout revoca y borra la cookie', out.status === 303 && !cookies.sess)

console.log(fails ? `\n${fails} comprobación(es) fallida(s)` : '\nTodo correcto ✔')
process.exit(fails ? 1 : 0)
