'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { eur, fmtDate, statusTone, statusText, signed, txTitle, txDate, dayKey, tone } from '../../lib/shape'

export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20',
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M20 6 9 17l-5-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  up: 'M7 17 17 7M7 7h10v10',
  down: 'M17 7 7 17M17 17H7V7',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chev: 'M6 9l6 6 6-6',
  right: 'M5 12h14M13 6l6 6-6 6',
}
export const Icon = ({ n, size = 20, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>
)

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null), close = useRef(onClose)
  close.current = onClose // el efecto no depende de onClose: escribir en un formulario no le quita el foco
  useEffect(() => {
    const prev = document.activeElement
    const focusables = () => [...(ref.current?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea') || [])].filter((el) => el.offsetParent !== null)
    const k = (e) => {
      if (e.key === 'Escape') return close.current()
      if (e.key !== 'Tab') return
      const f = focusables(); if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    ;(ref.current?.querySelector('input:not([type=checkbox]),select') || ref.current?.querySelector('button.primary'))?.focus()
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; prev?.focus?.() }
  }, [])
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-h"><h3>{title}</h3><button className="icon-btn no-print" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button></div>
        {children}
      </div>
    </div>
  )
}

export const Badge = ({ s, children }) => s || children ? <span className={'badge ' + statusTone(s)}>{children || statusText(s)}</span> : null
export const Spinner = () => <span className="spin" aria-label="Cargando" />
export const Skel = ({ n = 3 }) => <div className="skels" aria-busy="true">{Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ width: 100 - i * 9 + '%' }} />)}</div>

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="err" role="alert"><Icon n="alert" size={18} /><span>{error.message || String(error)}</span>
      {onRetry && <button className="link" onClick={onRetry}>Reintentar</button>}</div>
  )
}
export const Empty = ({ icon = 'info', title, text, children }) => (
  <div className="empty"><div className="empty-i"><Icon n={icon} size={26} /></div><b>{title}</b>{text && <p>{text}</p>}{children}</div>
)

export function CopyBtn({ text, label = 'Copiar', done = 'Copiado' }) {
  const [ok, setOk] = useState(false)
  return (
    <button className="chipbtn" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1600) }).catch(() => {}) }}>
      <Icon n={ok ? 'check' : 'copy'} size={14} />{ok ? done : label}
    </button>
  )
}

export const KV = ({ rows }) => rows.length ? (
  <dl className="kv">{rows.map(([k, v], i) => <div key={k + i}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
) : null

/** La cuenta como un objeto físico: lo memorable de la interfaz. El color indica el tipo de cuenta. */
export function AccountCard({ iban, acc, state, active, onClick }) {
  const loading = state?.loading && !state?.data
  return (
    <button className={'pcard tone-' + tone(acc) + (active ? ' on' : '')} onClick={onClick} aria-pressed={!!active} aria-label={'Cuenta ' + iban}>
      <span className="pcard-top"><span className="pcard-type">{acc?.iban ? acc.type : loading ? 'Cargando…' : 'Cuenta'}</span><span className="pcard-chip" aria-hidden="true" /></span>
      <span className="pcard-bal sens">{state?.error && !state?.data ? 'No disponible' : loading ? '···' : eur(acc?.balance, acc?.currency)}</span>
      <span className="pcard-bot"><span className="pcard-iban">{iban}</span>{acc?.status && <span className="pcard-st">{statusText(acc.status)}</span>}</span>
    </button>
  )
}

export function TxRow({ t, iban, onClick }) {
  const n = signed(t, iban), out = n < 0
  return (
    <li>
      <button className="row" onClick={onClick}>
        <span className={'dot ' + (out ? 'out' : 'in')}><Icon n={out ? 'up' : 'down'} size={18} /></span>
        <span className="row-m"><b>{txTitle(t)}</b><small>{fmtDate(txDate(t), { day: 'numeric', month: 'short' })}{t.status ? ' · ' + statusText(t.status) : ''}</small></span>
        <strong className={'amt sens ' + (out ? 'neg' : 'pos')}>{out ? '' : '+'}{eur(n, t.currency)}</strong>
      </button>
    </li>
  )
}

/** Entradas y salidas de los últimos 14 días. */
export function FlowChart({ txs, iban, days = 14 }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: days }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i)); return { d, k: dayKey(d), in: 0, out: 0 } })
  const idx = Object.fromEntries(buckets.map((b, i) => [b.k, i]))
  for (const t of txs) { const i = idx[dayKey(txDate(t))]; if (i === undefined) continue; const n = signed(t, iban); if (n < 0) buckets[i].out += -n; else buckets[i].in += n }
  const max = Math.max(1, ...buckets.flatMap((b) => [b.in, b.out]))
  const W = 560, H = 150, bw = W / days, g = 3
  const total = buckets.reduce((s, b) => s + b.in + b.out, 0)
  if (!total) return <div className="chart-empty">Sin movimientos en los últimos {days} días</div>
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Entradas y salidas de los últimos ${days} días`}>
      <line x1="0" x2={W} y1={H} y2={H} className="axis" />
      {buckets.map((b, i) => {
        const x = i * bw + g, w = (bw - g * 2) / 2
        const hi = (b.in / max) * (H - 8), ho = (b.out / max) * (H - 8)
        return (
          <g key={b.k}>
            <title>{fmtDate(b.d, { day: 'numeric', month: 'long' })}: +{eur(b.in)} / −{eur(b.out)}</title>
            <rect x={x} y={H - hi} width={w} height={hi} rx="3" className="bar-in" />
            <rect x={x + w} y={H - ho} width={w} height={ho} rx="3" className="bar-out" />
            {(i === 0 || i === days - 1 || i === Math.floor(days / 2)) && <text x={x + w} y={H + 16} textAnchor="middle" className="axis-t">{b.d.getDate()}/{b.d.getMonth() + 1}</text>}
          </g>
        )
      })}
    </svg>
  )
}
