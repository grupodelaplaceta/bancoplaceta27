'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/client'
import { list, sortTx, signed, txTitle, fold } from '../../lib/shape'
import { useApp, Icon, Skeleton, ErrBox, Empty, Spin } from './kit'
import { groupByDay, TxRow } from './parts'
import Detalle from './Detalle'

const FILTROS = [['all', 'Todos'], ['in', 'Ingresos'], ['out', 'Gastos']]

export default function Movimientos() {
  const { iban, accounts, setIban, tick } = useApp()
  const [items, setItems] = useState([]), [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true), [more, setMore] = useState(false), [error, setError] = useState(null)
  const [q, setQ] = useState(''), [f, setF] = useState('all'), [open, setOpen] = useState(null)

  const load = useCallback(async (cursor) => {
    if (cursor) setMore(true); else setLoading(true)
    setError(null)
    try {
      const d = await api(`accounts/${iban}/transactions?limite=40` + (cursor ? '&antes=' + encodeURIComponent(cursor) : ''))
      const l = list(d, 'movimientos')
      setItems((x) => (cursor ? [...x, ...l] : l))
      setNext(d?.siguiente || null)
    } catch (e) { setError(e) } finally { setLoading(false); setMore(false) }
  }, [iban])

  useEffect(() => { load(null) }, [load, tick])

  const shown = useMemo(() => {
    const s = fold(q.trim())
    return sortTx(items).filter((t) => {
      const n = signed(t, iban)
      if (f === 'in' && n < 0) return false
      if (f === 'out' && n >= 0) return false
      if (s && !fold(txTitle(t)).includes(s)) return false
      return true
    })
  }, [items, q, f, iban])

  const groups = useMemo(() => groupByDay(shown), [shown])
  const acc = accounts.find((a) => a.iban === iban)

  return (
    <>
      <div className="page-head">
        <h1>Movimientos</h1>
      </div>

      <label className="field" style={{ marginTop: 0 }}>
        <span className="sr">Cuenta</span>
        <select className="select" value={iban} onChange={(e) => setIban(e.target.value)} aria-label="Cuenta">
          {accounts.map((a) => <option key={a.iban} value={a.iban}>{a.name} · {a.iban}</option>)}
        </select>
      </label>

      <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '0 14px' }}>
        <span className="muted"><Icon n="search" size={18} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un movimiento" aria-label="Buscar movimiento"
          style={{ border: 0, padding: 0, background: 'transparent', flex: 1, minHeight: 50, outline: 'none' }} />
      </div>

      <div className="chips" role="tablist" aria-label="Filtrar" style={{ marginTop: 12 }}>
        {FILTROS.map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}</button>)}
      </div>

      <ErrBox error={error} onRetry={() => load(null)} />
      {loading && !items.length && <div style={{ marginTop: 16 }}><Skeleton n={5} /></div>}

      {!loading && !error && !shown.length && (
        <Empty icon="list" title={q || f !== 'all' ? 'Nada con ese filtro' : 'Sin movimientos todavía'} text={q || f !== 'all' ? 'Prueba con otra búsqueda o quita el filtro.' : `Los movimientos de ${acc?.name || 'tu cuenta'} aparecerán aquí.`} />
      )}

      {groups.map((g) => (
        <section key={g.k + g.label}>
          <div className="day-h">{g.label}</div>
          <div className="list">
            {g.items.map((t, i) => <TxRow key={(t.id ?? '') + '-' + i} t={t} iban={iban} onClick={(x) => setOpen({ kind: 'mov', t: x })} />)}
          </div>
        </section>
      ))}

      {next && !q && (
        <div style={{ marginTop: 18 }}>
          <button className="btn" disabled={more} onClick={() => load(next)}>{more ? <Spin /> : 'Cargar más movimientos'}</button>
        </div>
      )}

      {open && <Detalle data={open} onClose={() => setOpen(null)} />}
    </>
  )
}
