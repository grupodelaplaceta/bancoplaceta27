// Utilidades para leer las respuestas de la API de forma tolerante (los campos pueden variar).

export const eur = (n, c = 'EUR') => {
  const v = Number(n) || 0
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c || 'EUR', useGrouping: 'always' }).format(v) }
  catch { return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + c }
}

export const pick = (o, keys, fallback) => {
  if (!o || typeof o !== 'object') return fallback
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]
  return fallback
}

/** Saca el objeto útil de { data: {...} } o { account: {...} } / { membership: {...} } */
export const unwrap = (d, key) => {
  if (!d || typeof d !== 'object') return {}
  let x = d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : d
  if (key && x[key] && typeof x[key] === 'object') x = x[key]
  else if (!key && x.account && typeof x.account === 'object') x = x.account
  return x
}

export const list = (d, ...keys) => {
  if (Array.isArray(d)) return d
  if (!d || typeof d !== 'object') return []
  for (const k of [...keys, 'data', 'items', 'results']) {
    if (Array.isArray(d[k])) return d[k]
    if (d[k] && typeof d[k] === 'object') for (const kk of keys) if (Array.isArray(d[k][kk])) return d[k][kk]
  }
  return []
}

export const toDate = (v) => { const d = new Date(v); return isNaN(d) ? null : d }
export const fmtDate = (v, o = { day: 'numeric', month: 'short', year: 'numeric' }) => { const d = toDate(v); return d ? d.toLocaleDateString('es-ES', o) : '—' }
export const fmtDateTime = (v) => { const d = toDate(v); return d ? d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
export const dayKey = (v) => { const d = toDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '' }
export const daysUntil = (v) => { const d = toDate(v); return d ? Math.ceil((d - Date.now()) / 864e5) : null }

export const txDate = (t) => pick(t, ['created_at', 'date', 'timestamp', 'booked_at', 'processed_at'])
export const txTitle = (t) => pick(t, ['memo', 'concept', 'description', 'title', 'counterparty_name', 'name'], 'Movimiento')

/** Importe con signo (negativo = sale dinero) según los campos disponibles. */
export const signed = (t, iban) => {
  const n = Number(pick(t, ['amount', 'value', 'total'], 0)) || 0
  const dir = String(pick(t, ['direction', 'kind', 'type', 'side'], '')).toLowerCase()
  if (/^(out|outgoing|debit|withdraw|sent|expense|charge)/.test(dir)) return -Math.abs(n)
  if (/^(in\b|incoming|credit|deposit|received|income|refund)/.test(dir)) return Math.abs(n)
  const f = String(t.from_iban || '').toUpperCase(), o = String(t.to_iban || '').toUpperCase()
  if (iban && f && o) { if (f === iban && o !== iban) return -Math.abs(n); if (o === iban && f !== iban) return Math.abs(n) }
  return n
}

export const account = (raw) => {
  const a = unwrap(raw)
  return {
    raw: a,
    iban: pick(a, ['iban', 'account_iban']),
    balance: Number(pick(a, ['balance', 'available_balance', 'current_balance'], 0)) || 0,
    currency: pick(a, ['currency', 'currency_code'], 'EUR'),
    type: pick(a, ['product_name', 'type', 'product', 'name', 'account_type'], 'Cuenta'),
    status: pick(a, ['status', 'state']),
    holder: pick(a, ['holder', 'owner', 'owner_name', 'holder_name', 'name']),
    opened: pick(a, ['created_at', 'opened_at']),
  }
}

export const tone = (acc) => isJunior(acc) ? 'coral' : /ahorro|saving|dep[oó]sito/i.test(String(acc?.type || '')) ? 'teal' : /empresa|business|negocio|corporat/i.test(String(acc?.type || '')) ? 'slate' : 'violet'

export const greeting = () => { const h = new Date().getHours(); return h < 7 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches' }

export const isJunior = (acc) => /junior/i.test(JSON.stringify([acc?.type, acc?.raw?.product, acc?.raw?.plan, acc?.raw?.product_code, acc?.raw?.code]))

const LABELS = {
  id: 'ID', iban: 'IBAN', status: 'Estado', state: 'Estado', type: 'Tipo', kind: 'Tipo', currency: 'Moneda', balance: 'Saldo',
  created_at: 'Creado', updated_at: 'Actualizado', expires_at: 'Caduca', valid_until: 'Válida hasta', renews_at: 'Se renueva',
  next_renewal: 'Próxima renovación', started_at: 'Desde', starts_at: 'Desde', monthly_fee: 'Cuota mensual', fee: 'Cuota', price: 'Precio',
  min_balance: 'Saldo mínimo', minimum_balance: 'Saldo mínimo', memo: 'Concepto', concept: 'Concepto', reference: 'Referencia',
  ref: 'Referencia', from_iban: 'Origen', to_iban: 'Destino', amount: 'Importe', holder: 'Titular', name: 'Nombre', description: 'Descripción',
  code: 'Código', plan: 'Plan', tier: 'Nivel', daily_limit: 'Límite diario', limit: 'Límite', interest_rate: 'Interés', rate: 'Interés',
  last4: 'Últimos 4', expiry: 'Caduca', expires: 'Caduca', number: 'Número', tax: 'Impuestos', net_amount: 'Neto', total: 'Total',
}
export const label = (k) => LABELS[k] || (k.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()))

export const fmtVal = (k, v, cur = 'EUR') => {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number' && /(fee|price|balance|amount|limit|cost|total|tax|net)/i.test(k)) return eur(v, cur)
  if (typeof v === 'string' && /(_at|date|until|expir|renew)/i.test(k) && toDate(v) && /\d{4}-\d{2}-\d{2}/.test(v)) return fmtDateTime(v)
  return String(v)
}

/** Pares clave/valor de los campos simples de un objeto (para mostrar detalles genéricos). */
export const facts = (o, exclude = [], cur = 'EUR') => {
  if (!o || typeof o !== 'object') return []
  return Object.entries(o)
    .filter(([k, v]) => !exclude.includes(k) && v !== null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => [label(k), fmtVal(k, v, cur), k])
}

export const statusTone = (s) => {
  const x = String(s || '').toLowerCase()
  if (/(activ|ok|complet|success|settled|done|paid|emitid|vigente)/.test(x)) return 'ok'
  if (/(pend|process|wait|review|trial|prueba)/.test(x)) return 'warn'
  if (/(expir|venc|suspend|inactiv|block|bloque|fail|error|reject|rechaz|cancel|cerrad|closed)/.test(x)) return 'bad'
  return 'mut'
}
const STATUS_ES = { active: 'Activa', completed: 'Completada', complete: 'Completada', pending: 'Pendiente', processing: 'En proceso', failed: 'Fallida', expired: 'Caducada', suspended: 'Suspendida', blocked: 'Bloqueada', cancelled: 'Cancelada', canceled: 'Cancelada', settled: 'Liquidada', rejected: 'Rechazada', inactive: 'Inactiva', closed: 'Cerrada', frozen: 'Congelada' }
export const statusText = (s) => (s ? STATUS_ES[String(s).toLowerCase()] || String(s) : '')

export const toCSV = (rows) => {
  const esc = (v) => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\n')
}
export const download = (name, text, type = 'text/csv;charset=utf-8') => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Cuerpo para POST /accounts. Si la API pide otros campos, se ajusta aquí en un único sitio. */
export const buildOpenAccountBody = (p) => {
  const b = {}
  const id = pick(p, ['id', 'product_id']), code = pick(p, ['code', 'product_code', 'slug'])
  if (id !== undefined) b.product_id = id
  if (code !== undefined) b.product_code = code
  return b
}

export const sortTx = (a) => [...a].sort((x, y) => (toDate(txDate(y)) || 0) - (toDate(txDate(x)) || 0))
export { parseAmount } from './validate'
