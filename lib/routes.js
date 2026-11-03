// Lista blanca de endpoints /me/* de la API v1 que el navegador puede usar a través del proxy.
// Todo lo que no esté aquí se rechaza. El navegador llama a /api/bank/<ruta> y el proxy añade /me/.
//  · idem: la operación exige Idempotency-Key       · body: nombre del saneador de cuerpo (lib/body.js)
const ID = '([A-Za-z0-9_.-]{1,80})'
const R = (m, re, o = {}) => ({ m, re: new RegExp('^' + re + '$'), ...o })
export const RULES = [
  R('GET',    'info', { up: '' }),                                   // GET /me
  R('GET',    'accounts'),
  R('POST',   'accounts',                       { idem: true, body: 'openAccount' }),
  R('GET',    `accounts/${ID}`),
  R('GET',    `accounts/${ID}/(transactions|statement|receipts|cards)`),
  R('GET',    `receipts/${ID}/certificate`),
  R('GET',    'lookup'),
  R('POST',   'transfers',                      { idem: true, body: 'transfer', write: true }),
  R('GET',    'transfers/scheduled'),
  R('POST',   'transfers/scheduled',            { idem: true, body: 'scheduled', write: true }),
  R('DELETE', `transfers/scheduled/${ID}`),
  R('GET',    'beneficiaries'),
  R('POST',   'beneficiaries',                  { idem: true, body: 'beneficiary' }),
  R('DELETE', `beneficiaries/${ID}`),
  R('POST',   `cards/${ID}`,                    { body: 'cardState' }),
  R('POST',   `cards/${ID}/diseno`,             { body: 'cardDesign' }),
  R('GET',    'notifications'),
  R('POST',   'notifications/read',             { body: 'markRead' }),
  R('GET',    'previsiones'),
  R('GET',    'rbu'),
  R('POST',   `rbu/${ID}/claim`,                { idem: true, write: true }),
  R('GET',    'plans'),
  R('GET',    'requests'),
  R('POST',   'requests',                       { idem: true, body: 'request' }),
  R('GET',    'sessions'),
  R('DELETE', 'sessions'),
  R('GET',    'designs'),
  R('GET',    'designs/comprados'),
  R('POST',   `designs/${ID}/buy`,              { idem: true, body: 'buyDesign', write: true }),
]
export const matchRule = (method, path) => {
  for (const r of RULES) { if (r.m !== method) continue; const m = path.match(r.re); if (m) return { rule: r, m } }
  return null
}
/** Parámetros de consulta que se reenvían al banco (paginación, fechas y filtros). */
export const ALLOWED_QS = ['antes', 'limite', 'desde', 'hasta', 'solo_nuevas', 'iban']
