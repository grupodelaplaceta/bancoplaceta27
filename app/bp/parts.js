'use client'
import { eur, signed, txTitle, txDate, toDate, dayKey, pick, statusText, statusTone } from '../../lib/shape'
import { Icon } from './kit'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «Hoy», «Ayer» o «12 nov» para agrupar movimientos. */
export function dayLabel(v) {
  const d = toDate(v)
  if (!d) return 'Sin fecha'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : ''}`
}

export const timeLabel = (v) => {
  const d = toDate(v)
  return d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
}

/** Agrupa una lista ya ordenada por fecha descendente. */
export function groupByDay(items) {
  const out = []
  for (const t of items) {
    const k = dayKey(txDate(t)) || 'x'
    const last = out[out.length - 1]
    if (last && last.k === k) last.items.push(t)
    else out.push({ k, label: dayLabel(txDate(t)), items: [t] })
  }
  return out
}

/** Fila de movimiento: icono, concepto, hora e importe con signo. */
export function TxRow({ t, iban, onClick }) {
  const n = signed(t, iban)
  const inc = n >= 0
  const st = pick(t, ['estado', 'status'], '')
  const body = (
    <>
      <span className={'i-ico ' + (inc ? 'in' : 'out')}><Icon n={inc ? 'down' : 'up'} size={18} /></span>
      <span className="i-main">
        <span className="i-title" style={{ display: 'block' }}>{txTitle(t)}</span>
        <span className="i-sub">{timeLabel(txDate(t))}{st && statusTone(st) !== 'ok' ? ' · ' + statusText(st) : ''}</span>
      </span>
      <span className={'i-amt amt' + (inc ? ' in' : '')}>{inc ? '+' : '−'}{eur(Math.abs(n))}</span>
    </>
  )
  return onClick
    ? <button className="item" onClick={() => onClick(t)}>{body}</button>
    : <div className="item">{body}</div>
}
