'use client'
import { createContext, useContext, useEffect } from 'react'
import { play } from '../../lib/sfx'

export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  list: ['M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  receipt: ['M6 2h12v20l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeoff: ['M3 3l18 18', 'M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1', 'M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  plus: ['M12 5v14M5 12h14'],
  down: ['M12 5v14M6 13l6 6 6-6'],
  up: ['M12 19V5M6 11l6-6 6 6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.3-4.3'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  cal: ['M3 6h18v15H3z', 'M3 10h18M8 3v4M16 3v4'],
  chev: ['M9 6l6 6-6 6'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  alert: ['M12 9v4M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  bank: ['M3 9.5 12 4l9 5.5', 'M4 10v9M9 10v9M15 10v9M20 10v9', 'M3 20.5h18'],
  star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2-4.5-4.4 6.2-.9z'],
  tree: ['M12 3v5', 'M5 21v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5', 'M12 8v6', 'M9 3h6v5H9z', 'M2 21h6v-5H2zM16 21h6v-5h-6z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  building: ['M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17', 'M15 9h4a1 1 0 0 1 1 1v11', 'M2 21h20', 'M8 7h3M8 11h3M8 15h3'],
  nfc: ['M6 8.3a6 6 0 0 1 0 7.4', 'M10 5.5a10 10 0 0 1 0 13', 'M14 2.8a14 14 0 0 1 0 18.4', 'M2 11.2v1.6'],
  volume: ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  mute: ['M11 5 6 9H2v6h4l5 4z', 'M22 9l-6 6M16 9l6 6'],
  vibrate: ['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M3 8v8M21 8v8'],
  gift: ['M3 9h18v4H3z', 'M5 13h14v8H5z', 'M12 9v12', 'M12 9c-2-4-6-4-6-1.5S8.5 9 12 9zM12 9c2-4 6-4 6-1.5S15.5 9 12 9z'],
}

export function Icon({ n, size = 22, stroke = 2 }) {
  const d = PATHS[n] || []
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

/** Logo: tejado y columnas en blanco sobre azul marino plano. */
export function Mark({ large = false }) {
  return (
    <span className={'mark' + (large ? ' lg' : '')} aria-hidden="true">
      <svg width={large ? 40 : 24} height={large ? 40 : 24} viewBox="0 0 64 64">
        <path d="M32 12 52 24H12z" fill="#fff" />
        <rect x="16" y="27" width="5" height="18" fill="#fff" />
        <rect x="26" y="27" width="5" height="18" fill="#fff" />
        <rect x="36" y="27" width="5" height="18" fill="#fff" />
        <rect x="46" y="27" width="5" height="18" fill="#fff" />
        <rect x="12" y="48" width="40" height="4" fill="#fff" />
      </svg>
      <span className="sr">Banco de La Placeta</span>
    </span>
  )
}

/** Hoja que sube desde abajo (móvil) o aparece centrada (escritorio). */
export function Sheet({ title, onClose, children, wide }) {
  useEffect(() => { play('open') }, [])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 620 } : undefined}>
        <div className="sheet-grip" />
        <div className="sheet-h">
          <h2>{title}</h2>
          <button className="round-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function Spin() { return <div className="spin" role="status" aria-label="Cargando" /> }

export function Skeleton({ n = 3 }) {
  return <div className="list" aria-hidden="true">{Array.from({ length: n }).map((_, i) => <div key={i} className="skel" />)}</div>
}

export function ErrBox({ error, onRetry }) {
  useEffect(() => { if (error) play('err') }, [error])
  if (!error) return null
  return (
    <div className="banner bad" role="alert" style={{ justifyContent: 'space-between' }}>
      <span>{error.message || 'Algo no ha salido bien.'}</span>
      {onRetry && <button className="btn sm" onClick={onRetry} style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}>Reintentar</button>}
    </div>
  )
}

export function Empty({ icon = 'bell', title, text }) {
  return (
    <div className="empty">
      <div className="ico-c"><Icon n={icon} size={24} /></div>
      <b>{title}</b>
      <span>{text}</span>
    </div>
  )
}

export const TONES = { navy: 'tone-navy', teal: 'tone-teal', terra: 'tone-terra', slate: 'tone-slate' }
