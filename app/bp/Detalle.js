'use client'
import { eur, signed, txTitle, txDate, txRef, fmtDateTime, facts, pick } from '../../lib/shape'
import { useApp, Sheet, Icon } from './kit'

/** Hoja de detalle: de un movimiento o de los datos de una cuenta. */
export default function Detalle({ data, onClose }) {
  const { iban, toast } = useApp()
  if (data.kind === 'mov') {
    const t = data.t, n = signed(t, iban), inc = n >= 0
    const rows = [
      ['Concepto', txTitle(t)],
      ['Fecha', fmtDateTime(txDate(t))],
      ['Referencia', txRef(t) || '—'],
      ['Estado', pick(t, ['estado', 'status'], 'Completado')],
    ]
    const from = pick(t, ['desde_iban']), to = pick(t, ['hacia_iban'])
    if (from) rows.push(['Desde', from])
    if (to) rows.push(['Hacia', to])
    return (
      <Sheet title="Detalle del movimiento" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
          <span className={'i-ico ' + (inc ? 'in' : 'out')} style={{ width: 52, height: 52, borderRadius: 16, display: 'inline-grid', placeItems: 'center' }}>
            <Icon n={inc ? 'down' : 'up'} size={24} />
          </span>
          <div className="big-amt sens" style={{ fontSize: 36, color: inc ? 'var(--pos)' : 'var(--ink)' }}>{inc ? '+' : '−'}{eur(Math.abs(n))}</div>
        </div>
        <Rows rows={rows} />
        <p className="tiny muted" style={{ marginTop: 14 }}>¿Algo no cuadra? Pulsa <button className="link" style={{ fontSize: 13 }} onClick={() => toast('Revisa el movimiento con tu oficina si necesitas ayuda.')}>aquí</button>.</p>
      </Sheet>
    )
  }
  if (data.kind === 'cuenta') {
    const rows = facts(data.raw, ['id', 'rol', 'moneda'])
    return (
      <Sheet title="Datos de la cuenta" onClose={onClose}>
        <Rows rows={rows.map(([k, v]) => [k, v])} />
      </Sheet>
    )
  }
  return null
}

function Rows({ rows }) {
  return (
    <div className="summary">
      {rows.map(([k, v], i) => (
        <div className="row" key={k + i}><span>{k}</span><span className="sens">{String(v)}</span></div>
      ))}
    </div>
  )
}
