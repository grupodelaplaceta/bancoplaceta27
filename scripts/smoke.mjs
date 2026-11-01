// Prueba de humo del proxy y las reglas de seguridad. Requiere:
//   npm run mock           (terminal 1)
//   npm run dev:mock       (terminal 2)
//   npm run smoke          (terminal 3)
const BASE = process.env.BASE || 'http://localhost:3000'
let cookies = {}, fails = 0
const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
const keep = (r) => { for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); cookies[kv.slice(0, i)] = kv.slice(i + 1) } }
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
let r = await call('GET', '/api/bank/products', { noCookie: true }); t('sin sesión → 401', r.status === 401, r.status)
r = await fetch(BASE + '/api/auth/login', { redirect: 'manual' }); keep(r); t('login de pruebas crea sesión', !!cookies.sess, 'activa DEV_LOGIN=1')
r = await call('GET', '/api/me'); t('GET /api/me sin cuentas', r.status === 200 && r.json.ibans.length === 0, JSON.stringify(r.json))

console.log('Vinculación')
r = await call('POST', '/api/me', { body: { iban: 'nope' } }); t('IBAN inválido → 422', r.status === 422)
r = await call('POST', '/api/me', { body: { iban: 'PZ-9999-9999' } }); t('IBAN inexistente → 404', r.status === 404, r.status)
r = await call('POST', '/api/me', { body: { iban: 'pz-0001-0001' } }); t('vincula PZ-0001-0001 (normaliza mayúsculas)', r.status === 200 && r.json.ibans.includes('PZ-0001-0001'))
r = await call('POST', '/api/me', { body: { iban: 'PZ-0001-0001' }, origin: 'https://evil.example' }); t('origen ajeno → 403', r.status === 403, r.status)

console.log('Proxy: lista blanca y propiedad')
r = await call('GET', '/api/bank/products'); t('products → 200', r.status === 200)
r = await call('GET', '/api/bank/accounts/PZ-0001-0001'); t('cuenta propia → 200', r.status === 200)
r = await call('GET', '/api/bank/accounts/PZ-0001-0003'); t('cuenta ajena → 403', r.status === 403, r.status)
r = await call('GET', '/api/bank/accounts/PZ-0001-0003/transactions'); t('movimientos ajenos → 403', r.status === 403)
r = await call('GET', '/api/bank/admin/keys'); t('ruta no listada → 404', r.status === 404)
r = await call('GET', '/api/bank/accounts/..%2F..%2Fkeys'); t('path traversal → 404', r.status === 404, r.status)
r = await call('GET', '/api/bank/accounts/PZ-0001-0001/cards'); t('tarjetas → 200', r.status === 200)

console.log('Transferencias e idempotencia')
const body = { from_iban: 'PZ-0001-0001', to_iban: 'PZ-0001-0003', amount: 10.5, memo: 'Prueba' }
r = await call('POST', '/api/bank/transfers', { body }); t('sin Idempotency-Key → 400', r.status === 400)
r = await call('POST', '/api/bank/transfers', { body: { ...body, from_iban: 'PZ-0001-0003' }, idem: uid() }); t('origen no vinculado → 403', r.status === 403)
r = await call('POST', '/api/bank/transfers', { body: { ...body, amount: 1.234 }, idem: uid() }); t('3 decimales → 422', r.status === 422)
r = await call('POST', '/api/bank/transfers', { body: { ...body, amount: -5 }, idem: uid() }); t('importe negativo → 422', r.status === 422)
const k = uid()
const a = await call('POST', '/api/bank/transfers', { body, idem: k })
const b = await call('POST', '/api/bank/transfers', { body, idem: k })
const ref = a.json?.data?.reference
t('transferencia creada', a.status === 201 && !!ref, JSON.stringify(a.json))
t('reintento con la misma clave = misma referencia (sin duplicar)', b.json?.data?.reference === ref)
r = await call('GET', '/api/bank/transfers/' + ref); t('seguimiento de transferencia propia', r.status === 200)
r = await call('GET', '/api/bank/transfers/TR-NOEXISTE'); t('transferencia inexistente → 404', r.status === 404)

console.log('Abrir cuenta y membresía')
r = await call('POST', '/api/bank/accounts', { body: {}, idem: uid() }); t('abrir sin producto → 422', r.status === 422)
r = await call('POST', '/api/bank/accounts', { body: { product_code: 'JUNIOR' }, idem: uid() })
const nuevo = r.json?.data?.iban
t('abre cuenta Junior', r.status === 201 && !!nuevo, JSON.stringify(r.json))
r = await call('GET', '/api/me'); t('la cuenta nueva queda vinculada sola', r.json.ibans.includes(nuevo))
r = await call('GET', `/api/bank/accounts/${nuevo}/membership`); t('membresía de la cuenta nueva → 200', r.status === 200, r.status)
r = await call('POST', `/api/bank/accounts/${nuevo}/membership/renew`, { body: {}, idem: uid() }); t('renovar sin saldo → 422', r.status === 422, r.status)

console.log(fails ? `\n${fails} comprobación(es) fallida(s)` : '\nTodo correcto ✔')
process.exit(fails ? 1 : 0)
