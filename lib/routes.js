// Lista blanca de endpoints de la API v1 que el navegador puede usar a través del proxy.
// Todo lo que no esté aquí se rechaza. "own" indica qué grupo de la regex es un IBAN que debe estar vinculado.
export const RULES = [
  { id: 'products',      m: 'GET',  re: /^products$/ },
  { id: 'open-account',  m: 'POST', re: /^accounts$/, create: true },
  { id: 'account',       m: 'GET',  re: /^accounts\/([^/]+)$/, own: 1 },
  { id: 'account-sub',   m: 'GET',  re: /^accounts\/([^/]+)\/(transactions|receipts|cards|membership)$/, own: 1 },
  { id: 'renew',         m: 'POST', re: /^accounts\/([^/]+)\/membership\/renew$/, own: 1 },
  { id: 'transfer-new',  m: 'POST', re: /^transfers$/, transfer: true },
  { id: 'transfer-get',  m: 'GET',  re: /^transfers\/([A-Za-z0-9_.-]{3,80})$/, ref: true },
]
export const matchRule = (method, path) => {
  for (const r of RULES) { if (r.m !== method) continue; const m = path.match(r.re); if (m) return { rule: r, m } }
  return null
}

/** Parámetros de consulta que se reenvían al banco (paginación y filtros de fecha). */
export const ALLOWED_QS = ['limit', 'offset', 'page', 'cursor', 'from', 'to', 'status']
