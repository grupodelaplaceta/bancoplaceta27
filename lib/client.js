'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export class ApiError extends Error {
  constructor(message, status, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter }
  /** Rechazo definitivo (reglas de negocio, permisos…): reintentar igual no cambiará nada. */
  get definitive() { return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429 }
}

const FALLBACK = {
  400: 'La petición no es válida.',
  401: 'Tu sesión ha caducado. Vuelve a entrar con PlacetaID.',
  403: 'No tienes permiso para esta operación.',
  404: 'No se ha encontrado lo que buscas.',
  422: 'El banco ha rechazado la operación por sus reglas (saldo, límites…).',
  429: 'Has hecho demasiadas peticiones. Espera un momento y vuelve a intentarlo.',
  502: 'No se ha podido contactar con el banco.',
}

export const newKey = () => (globalThis.crypto?.randomUUID?.() || 'k' + Date.now() + Math.random().toString(36).slice(2))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let leaving = false

export async function request(url, { method = 'GET', body, idem, _try = 0 } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (idem) headers['Idempotency-Key'] = idem
  let r
  try { r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }) }
  catch { throw new ApiError('Sin conexión. Comprueba tu red e inténtalo de nuevo.', 0) }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const ra = Number(r.headers.get('retry-after')) || 0
    // Lectura limitada por el banco (429): esperamos lo que pide y reintentamos solos, hasta 2 veces.
    if (r.status === 429 && method === 'GET' && ra > 0 && ra <= 8 && _try < 2) { await sleep(ra * 1000 + 100); return request(url, { method, body, idem, _try: _try + 1 }) }
    const msg = d?.error?.message || d?.message || d?.error?.detail || (typeof d?.error === 'string' ? d.error : '') || FALLBACK[r.status] || 'Error ' + r.status
    if (r.status === 401 && !leaving) { leaving = true; setTimeout(() => { location.href = '/?error=' + encodeURIComponent(FALLBACK[401]) }, 1200) }
    throw new ApiError(r.status === 429 && ra ? `${msg} (reintenta en ${ra} s)` : msg, r.status, ra)
  }
  return d
}

export const api = (path, opts) => request('/api/bank/' + path, opts)

/** Carga un recurso GET. `bump` fuerza recarga cuando cambia. */
export function useRes(path, bump = 0) {
  const [st, setSt] = useState({ data: null, error: null, loading: !!path })
  const [n, setN] = useState(0)
  const last = useRef(null)
  useEffect(() => {
    if (!path) { setSt({ data: null, error: null, loading: false }); last.current = null; return }
    let dead = false
    setSt((s) => (last.current === path ? { ...s, loading: true, error: null } : { data: null, error: null, loading: true }))
    last.current = path
    api(path).then((d) => !dead && setSt({ data: d, error: null, loading: false }))
      .catch((e) => !dead && setSt({ data: null, error: e, loading: false }))
    return () => { dead = true }
  }, [path, bump, n])
  const reload = useCallback(() => setN((x) => x + 1), [])
  return { ...st, reload }
}

export const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  del: (k) => { try { localStorage.removeItem(k) } catch {} },
}
