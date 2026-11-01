'use client'
import { useMemo, useState } from 'react'
import { useRes } from '../../lib/client'
import { list, sortTx, signed, txDate, txTitle, fmtDate, eur, toCSV, download, dayKey, toDate, account } from '../../lib/shape'
import { useApp, TxRow, Skel, ErrorBox, Empty, Icon } from './ui'

export default function Movements() {
  const { iban, accs, tick, openDetail } = useApp()
  const tx = useRes(iban ? `accounts/${iban}/transactions` : null, tick)
  const [q, setQ] = useState(''), [f, setF] = useState('all'), [per, setPer] = useState('0'), [max, setMax] = useState(60)
  const cur = account(accs[iban]?.data)
  const all = useMemo(() => sortTx(list(tx.data, 'transactions')), [tx.data])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), since = Number(per) ? Date.now() - Number(per) * 864e5 : 0
    return all.filter((t) => {
      if (since && (toDate(txDate(t)) || 0) < since) return false
      const n = signed(t, iban)
      if (f === 'in' && n < 0) return false
      if (f === 'out' && n >= 0) return false
      return !s || JSON.stringify([txTitle(t), t.reference, t.ref, t.from_iban, t.to_iban, t.amount]).toLowerCase().includes(s)
    })
  }, [all, q, f, per, iban])

  const groups = useMemo(() => {
    const g = new Map()
    for (const t of shown.slice(0, max)) { const k = dayKey(txDate(t)) || 'sin-fecha'; if (!g.has(k)) g.set(k, []); g.get(k).push(t) }
    return [...g.entries()]
  }, [shown, max])

  const sum = shown.reduce((s, t) => s + signed(t, iban), 0)
  const exportCsv = () => download(`movimientos-${iban}.csv`, toCSV([['Fecha', 'Concepto', 'Importe', 'Moneda', 'Referencia', 'Origen', 'Destino'],
    ...shown.map((t) => [fmtDate(txDate(t)), txTitle(t), signed(t, iban).toFixed(2).replace('.', ','), t.currency || cur.currency, t.reference || t.ref || t.id || '', t.from_iban || '', t.to_iban || ''])]))

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="search"><Icon n="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar concepto, referencia o IBAN" aria-label="Buscar movimientos" /></label>
        <div className="seg" role="tablist" aria-label="Filtro">
          {[['all', 'Todos'], ['in', 'Ingresos'], ['out', 'Gastos']].map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <select className="sel" value={per} onChange={(e) => { setPer(e.target.value); setMax(60) }} aria-label="Periodo">
          <option value="0">Todo</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option>
        </select>
        <button className="chipbtn" onClick={exportCsv} disabled={!shown.length}><Icon n="download" size={14} />CSV</button>
      </div>
      <ErrorBox error={tx.error} onRetry={tx.reload} />
      {tx.loading && !tx.data && <Skel n={5} />}
      {!tx.loading && !tx.error && !all.length && <Empty icon="list" title="Sin movimientos" text="Esta cuenta todavía no tiene actividad." />}
      {!!all.length && !shown.length && <Empty icon="search" title="Nada coincide" text="Prueba con otra búsqueda o quita el filtro." />}
      {groups.map(([k, items]) => (
        <div key={k} className="day">
          <h4>{k === 'sin-fecha' ? 'Sin fecha' : fmtDate(toDate(k), { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
          <ul className="rows">{items.map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Movimiento', t)} />)}</ul>
        </div>
      ))}
      {shown.length > max && <button className="btn more-btn" onClick={() => setMax(max + 60)}>Mostrar más ({shown.length - max} restantes)</button>}
      {!!shown.length && <div className="foot-sum"><span>{shown.length} movimientos</span><b className={'sens ' + (sum < 0 ? 'neg' : 'pos')}>{eur(sum, cur.currency)}</b></div>}
    </section>
  )
}
