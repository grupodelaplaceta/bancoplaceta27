'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, useRes } from '../../lib/client'
import { list, sortTx, signed, txDate, txTitle, txRef, fmtDate, eur, toCSV, download, dayKey, toDate, dayKey as dk } from '../../lib/shape'
import { useApp, TxRow, Skel, ErrorBox, Empty, Icon, Tabs, Spinner } from './ui'

const iso = (d) => dk(d)
const csvRows = (rows, iban, cur) => [['Fecha', 'Concepto', 'Importe', 'Moneda', 'Referencia'], ...rows.map((t) => [fmtDate(txDate(t)), txTitle(t), signed(t, iban).toFixed(2).replace('.', ','), t.moneda || t.currency || cur, txRef(t) || ''])]

export default function Movements({ initialTab }) {
  const [tab, setTab] = useState(initialTab || 'movs')
  return (
    <section className="panel">
      <Tabs value={tab} onChange={setTab} items={[['movs', 'Movimientos'], ['extracto', 'Extracto'], ['previsiones', 'Previsiones']]} />
      {tab === 'movs' && <Movs />}
      {tab === 'extracto' && <Statement />}
      {tab === 'previsiones' && <Forecast />}
    </section>
  )
}

/* ---- Movimientos con paginación por cursor ---- */
function Movs() {
  const { iban, accounts, tick, openDetail } = useApp()
  const cur = accounts.find((a) => a.iban === iban)?.currency || 'EUR'
  const [items, setItems] = useState([]), [next, setNext] = useState(null), [loading, setLoading] = useState(true), [more, setMore] = useState(false), [error, setError] = useState(null)
  const [q, setQ] = useState(''), [f, setF] = useState('all'), [per, setPer] = useState('0')

  const load = useCallback(async (cursor) => {
    cursor ? setMore(true) : setLoading(true); setError(null)
    try {
      const d = await api(`accounts/${iban}/transactions?limite=50` + (cursor ? '&antes=' + encodeURIComponent(cursor) : ''))
      setItems((x) => (cursor ? [...x, ...list(d, 'movimientos')] : list(d, 'movimientos'))); setNext(d?.siguiente || null)
    } catch (e) { setError(e) } finally { setLoading(false); setMore(false) }
  }, [iban])
  useEffect(() => { load(null) }, [load, tick])

  const all = useMemo(() => sortTx(items), [items])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), since = Number(per) ? Date.now() - Number(per) * 864e5 : 0
    return all.filter((t) => {
      if (since && (toDate(txDate(t)) || 0) < since) return false
      const n = signed(t, iban)
      if (f === 'in' && n < 0) return false
      if (f === 'out' && n >= 0) return false
      return !s || JSON.stringify([txTitle(t), txRef(t), t.desde_iban, t.hacia_iban, t.importe]).toLowerCase().includes(s)
    })
  }, [all, q, f, per, iban])
  const groups = useMemo(() => {
    const g = new Map()
    for (const t of shown) { const k = dayKey(txDate(t)) || 'sin-fecha'; if (!g.has(k)) g.set(k, []); g.get(k).push(t) }
    return [...g.entries()]
  }, [shown])
  const sum = shown.reduce((s, t) => s + signed(t, iban), 0)

  return (
    <>
      <div className="toolbar">
        <label className="search"><Icon n="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar concepto, referencia o IBAN" aria-label="Buscar movimientos" /></label>
        <div className="seg" role="tablist" aria-label="Filtro">
          {[['all', 'Todos'], ['in', 'Ingresos'], ['out', 'Gastos']].map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <select className="sel" value={per} onChange={(e) => setPer(e.target.value)} aria-label="Periodo">
          <option value="0">Todo</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option>
        </select>
        <button className="chipbtn" onClick={() => download(`movimientos-${iban}.csv`, toCSV(csvRows(shown, iban, cur)))} disabled={!shown.length}><Icon n="download" size={14} />CSV</button>
      </div>
      <ErrorBox error={error} onRetry={() => load(null)} />
      {loading && <Skel n={5} />}
      {!loading && !error && !all.length && <Empty icon="list" title="Sin movimientos" text="Esta cuenta todavía no tiene actividad." />}
      {!!all.length && !shown.length && <Empty icon="search" title="Nada coincide" text="Prueba con otra búsqueda o quita el filtro." />}
      {groups.map(([k, rows]) => (
        <div key={k} className="day">
          <h4>{k === 'sin-fecha' ? 'Sin fecha' : fmtDate(toDate(k), { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
          <ul className="rows">{rows.map((t, i) => <TxRow key={t.id || k + i} t={t} iban={iban} onClick={() => openDetail('Movimiento', t)} />)}</ul>
        </div>
      ))}
      {next && <button className="btn more-btn" onClick={() => load(next)} disabled={more}>{more ? <Spinner /> : 'Cargar movimientos anteriores'}</button>}
      {!!shown.length && <div className="foot-sum"><span>{shown.length} movimientos{next ? ' (hay más)' : ''}</span><b className={'sens ' + (sum < 0 ? 'neg' : 'pos')}>{eur(sum, cur)}</b></div>}
    </>
  )
}

/* ---- Extracto de un periodo ---- */
function Statement() {
  const { iban, accounts, tick, openDetail } = useApp()
  const cur = accounts.find((a) => a.iban === iban)?.currency || 'EUR'
  const today = new Date(), first = new Date(today.getFullYear(), today.getMonth(), 1)
  const [from, setFrom] = useState(iso(first)), [to, setTo] = useState(iso(today))
  const ok = from && to && from <= to
  const r = useRes(ok ? `accounts/${iban}/statement?desde=${from}&hasta=${to}` : null, tick)
  const rows = sortTx(list(r.data, 'movimientos'))
  return (
    <>
      <div className="field-row no-print">
        <label>Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {!ok && <p className="hint">La fecha inicial debe ser anterior a la final.</p>}
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {r.data && (
        <div className="print-area">
          <div className="print-head"><b>Banca La Placeta</b><span>Extracto · {iban} · {fmtDate(from)} – {fmtDate(to)}</span></div>
          <div className="stmt">
            <div><small>Saldo inicial</small><b className="sens">{eur(r.data.saldo_inicial, cur)}</b></div>
            <div><small>Saldo final</small><b className="sens">{eur(r.data.saldo_final, cur)}</b></div>
          </div>
          {!rows.length ? <Empty icon="list" title="Sin movimientos en este periodo" /> : <ul className="rows">{rows.map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Movimiento', t)} />)}</ul>}
        </div>
      )}
      {r.data && (
        <div className="sheet-f no-print">
          <button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir</button>
          <button className="btn" disabled={!rows.length} onClick={() => download(`extracto-${iban}-${from}_${to}.csv`, toCSV(csvRows(rows, iban, cur)))}><Icon n="download" size={18} />CSV</button>
        </div>
      )}
    </>
  )
}

/* ---- Próximos movimientos (máximo 366 días) ---- */
function Forecast() {
  const { iban, tick, openDetail } = useApp()
  const today = new Date(), end = new Date(today.getTime() + 90 * 864e5)
  const [from, setFrom] = useState(iso(today)), [to, setTo] = useState(iso(end))
  const span = (toDate(to) - toDate(from)) / 864e5
  const ok = from && to && span >= 0 && span <= 366
  const r = useRes(ok ? `previsiones?desde=${from}&hasta=${to}` : null, tick)
  const rows = list(r.data, 'previsiones')
  return (
    <>
      <div className="field-row">
        <label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {!ok && <p className="hint">Elige un periodo de entre 0 y 366 días.</p>}
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {r.data && !rows.length && <Empty icon="cal" title="Nada previsto" text="No hay recibos, transferencias programadas ni cuotas en este periodo." />}
      <ul className="rows">{rows.map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Previsión', t)} />)}</ul>
    </>
  )
}
