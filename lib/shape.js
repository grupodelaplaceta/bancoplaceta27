// Utilidades para leer las respuestas de la API de forma tolerante (los campos pueden variar).
// La API de Placeta usa nombres en español (saldo, importe, concepto…); se aceptan también equivalentes en inglés.

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

/** Saca el objeto útil de { data: {...} } o de { clave: {...} }. */
export const unwrap = (d, key) => {
  if (!d || typeof d !== 'object') return {}
  let x = d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : d
  if (key && x[key] && typeof x[key] === 'object') x = x[key]
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

export const txDate = (t) => pick(t, ['fecha', 'creado', 'created_at', 'date', 'timestamp', 'booked_at'])
export const txTitle = (t) => pick(t, ['concepto', 'descripcion', 'memo', 'concept', 'description', 'titulo', 'contraparte', 'nombre', 'name'], 'Movimiento')
export const txRef = (t) => pick(t, ['referencia', 'ref', 'id', 'transaccion', 'reference'])

/** Importe con signo (negativo = sale dinero) según los campos disponibles. */
export const signed = (t, iban) => {
  const n = Number(pick(t, ['importe', 'amount', 'cantidad', 'value', 'total'], 0)) || 0
  const dir = String(pick(t, ['direccion', 'sentido', 'tipo', 'direction', 'kind', 'type', 'side'], '')).toLowerCase()
  if (/^(sal|out|cargo|adeud|d[eé]bit|retir|pago|gasto|env)/.test(dir)) return -Math.abs(n)
  if (/^(ent|in\b|incoming|abono|ingres|cr[eé]dit|dep[oó]s|cobro|recib|income|refund)/.test(dir)) return Math.abs(n)
  const f = String(t.desde_iban || t.from_iban || '').toUpperCase(), o = String(t.hacia_iban || t.to_iban || '').toUpperCase()
  if (iban && f && o) { if (f === iban && o !== iban) return -Math.abs(n); if (o === iban && f !== iban) return Math.abs(n) }
  return n
}

/** Cuenta de GET /me/accounts (o de /me/accounts/{iban}, que añade reservado y límites). */
export const account = (raw) => {
  const a = unwrap(raw)
  return {
    raw: a,
    iban: pick(a, ['iban']),
    name: pick(a, ['nombre', 'name'], 'Cuenta'),
    type: pick(a, ['tipo', 'type'], ''),
    role: pick(a, ['rol', 'role']),
    status: pick(a, ['estado', 'status']),
    balance: Number(pick(a, ['saldo', 'balance'], 0)) || 0,
    available: Number(pick(a, ['disponible', 'available'], pick(a, ['saldo', 'balance'], 0))) || 0,
    reserved: pick(a, ['reservado', 'reserved']),
    dailyLimit: pick(a, ['limite_diario', 'daily_limit']),
    overdraft: pick(a, ['descubierto', 'overdraft']),
    currency: pick(a, ['moneda', 'currency'], 'EUR'),
  }
}

export const tone = (acc) => {
  const x = (String(acc?.name || '') + ' ' + String(acc?.type || '')).toLowerCase()
  return /junior|joven/.test(x) ? 'coral' : /ahorro|saving|dep[oó]sito/.test(x) ? 'teal' : /empresa|business|negocio|corporat|comercio/.test(x) ? 'slate' : 'violet'
}

export const greeting = () => { const h = new Date().getHours(); return h < 7 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches' }

const LABELS = {
  id: 'ID', iban: 'IBAN', estado: 'Estado', status: 'Estado', tipo: 'Tipo', type: 'Tipo', rol: 'Rol', moneda: 'Moneda',
  saldo: 'Saldo', disponible: 'Disponible', reservado: 'Reservado', limite_diario: 'Límite diario', descubierto: 'Descubierto',
  fecha: 'Fecha', creado: 'Creado', created_at: 'Creado', comprado: 'Comprado', expira: 'Caduca', caducidad: 'Caduca',
  concepto: 'Concepto', descripcion: 'Descripción', referencia: 'Referencia', ref: 'Referencia', transaccion: 'Transacción',
  desde_iban: 'Origen', hacia_iban: 'Destino', cuenta_iban: 'Cuenta', importe: 'Importe', titular: 'Titular', nombre: 'Nombre',
  ultimos4: 'Últimos 4', cuotas: 'Cuotas', cuotas_pendientes: 'Cuotas pendientes', principal: 'Principal', proximo: 'Próximo',
  periodicidad_dias: 'Cada (días)', motivo: 'Motivo', norma: 'Norma', base: 'Base', hash: 'Huella', rareza: 'Rareza', nivel: 'Nivel',
  precio: 'Precio', licencia: 'Licencia', imagen_url: 'Imagen', animacion_url: 'Animación', stock_disponible: 'Stock', ya_adquirido: 'Adquirido',
  tarjetas_con_diseno: 'Tarjetas con este diseño', entidad: 'Entidad', existe: 'Existe', codigo: 'Código', alias: 'Alias',
}
export const label = (k) => LABELS[k] || (k.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()))

const MONEY = /(importe|saldo|disponible|reservado|limite|precio|base|principal|total|amount|balance|price)/i
export const fmtVal = (k, v, cur = 'EUR') => {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number' && MONEY.test(k)) return eur(v, cur)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && toDate(v)) return fmtDateTime(v)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toDate(v)) return fmtDate(v)
  if (/^(estado|status)$/.test(k)) return statusText(v) || String(v)
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
  if (/(activ|active|ok|complet|success|settled|done|paid|pagad|emitid|issued|vigente|aprobad|disponible|reclamad|ejecutad)/.test(x)) return 'ok'
  if (/(pend|process|wait|review|trial|prueba|autoriz|program)/.test(x)) return 'warn'
  if (/(expir|venc|caduc|suspend|inactiv|block|bloque|fail|fallid|error|reject|rechaz|cancel|cerrad|closed)/.test(x)) return 'bad'
  return 'mut'
}
const STATUS_ES = { active: 'Activa', completed: 'Completada', complete: 'Completada', pending: 'Pendiente', pendiente: 'Pendiente', processing: 'En proceso', failed: 'Fallida', expired: 'Caducada', suspended: 'Suspendida', blocked: 'Bloqueada', cancelled: 'Cancelada', canceled: 'Cancelada', settled: 'Liquidada', rejected: 'Rechazada', inactive: 'Inactiva', closed: 'Cerrada', frozen: 'Congelada', issued: 'Emitido', authorized: 'Autorizado', released: 'Liberado' }
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

export const sortTx = (a) => [...a].sort((x, y) => (toDate(txDate(y)) || 0) - (toDate(txDate(x)) || 0))
export const isRead = (n) => !!pick(n, ['leida', 'leido', 'read'], false)
export { parseAmount } from './validate'
