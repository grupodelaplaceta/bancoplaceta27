// Validaciones compartidas (servidor y cliente). Nada aquí toca red ni cookies.

export const normIban = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
export const isIban = (v) => /^[A-Z0-9][A-Z0-9-]{5,39}$/.test(v)

/** Clave de idempotencia aceptada: UUID o similar (8–100 caracteres seguros). */
export const isIdemKey = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(k)

/** Segmento de ruta seguro para reenviar al banco. */
export const isSegment = (s) => typeof s === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(s) && s !== '.' && s !== '..'

/** Importe válido: número finito > 0, máximo 2 decimales y tope razonable. Devuelve null si no vale. */
export const cleanAmount = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1e9) return null
  const r = Math.round(n * 100) / 100
  return Math.abs(r - n) < 1e-9 ? r : null
}

/** Texto del usuario → número ("1.234,56", "12,5", "12.5"). NaN si no se entiende. */
export const parseAmount = (s) => {
  let t = String(s ?? '').trim().replace(/[\s€]/g, '')
  if (!t) return NaN
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}
