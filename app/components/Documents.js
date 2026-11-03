'use client'
import { useState } from 'react'
import { api, store } from '../../lib/client'
import { list, sortTx, eur, fmtDate, toCSV, download, signed, txTitle, txDate, txRef } from '../../lib/shape'
import { useApp, Modal, Icon, ErrorBox, Empty, Tabs, Spinner } from './ui'
import Receipts from './Receipts'
import { ContractView } from './Alta'

const pad = (n) => String(n).padStart(2, '0')
const last12 = () => Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const y = d.getFullYear(), m = d.getMonth(); const end = new Date(y, m + 1, 0).getDate(); return { key: `${y}-${pad(m + 1)}`, label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }), from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(end)}` } })

export default function Documents() {
  const [tab, setTab] = useState('stmt')
  const contracts = store.get('pz:contracts', [])
  return (
    <section className="panel">
      <Tabs value={tab} onChange={setTab} items={[['stmt', 'Extractos'], ['rec', 'Recibos y certificados'], ['con', 'Contratos', contracts.length || 0]]} />
      {tab === 'stmt' && <Statements />}
      {tab === 'rec' && <Receipts />}
      {tab === 'con' && <Contracts items={contracts} />}
    </section>
  )
}

function Statements() {
  const { iban, accounts } = useApp()
  const cur = accounts.find((a) => a.iban === iban)
  const [busy, setBusy] = useState(''), [err, setErr] = useState(null), [open, setOpen] = useState(null)
  const get = async (m) => {
    setBusy(m.key); setErr(null)
    try { const d = await api(`accounts/${iban}/statement?desde=${m.from}&hasta=${m.to}`); setOpen({ m, d }) } catch (e) { setErr(e) } finally { setBusy('') }
  }
  return (
    <>
      <p className="muted">Extracto mensual de <b>{cur?.name}</b> <span className="mono">{iban}</span>. Imprímelo o guárdalo como PDF desde el diálogo de impresión, o descarga el CSV.</p>
      <ErrorBox error={err} />
      <ul className="rows">
        {last12().map((m) => (
          <li key={m.key}><button className="row" onClick={() => get(m)} disabled={!!busy}>
            <span className="dot in"><Icon n="doc" size={18} /></span>
            <span className="row-m"><b style={{ textTransform: 'capitalize' }}>{m.label}</b><small>{fmtDate(m.from)} – {fmtDate(m.to)}</small></span>
            {busy === m.key ? <Spinner /> : <span className="chipbtn">Abrir</span>}
          </button></li>
        ))}
      </ul>
      {open && <StatementModal {...open} iban={iban} cur={cur?.currency || 'PZ'} onClose={() => setOpen(null)} />}
    </>
  )
}

function StatementModal({ m, d, iban, cur, onClose }) {
  const rows = sortTx(list(d, 'movimientos')).reverse()
  const csv = () => download(`extracto-${iban}-${m.key}.csv`, toCSV([['Fecha', 'Concepto', 'Importe', 'Referencia'], ...rows.map((t) => [fmtDate(txDate(t)), txTitle(t), signed(t, iban).toFixed(2).replace('.', ','), txRef(t) || ''])]))
  return (
    <Modal title="Extracto" onClose={onClose} wide>
      <div className="print-area">
        <div className="print-head"><b>Banca La Placeta</b><span>Extracto {m.label} · {iban}</span></div>
        <div className="stmt"><div><small>Saldo inicial</small><b>{eur(d.saldo_inicial, cur)}</b></div><div><small>Saldo final</small><b>{eur(d.saldo_final, cur)}</b></div></div>
        {!rows.length ? <Empty icon="list" title="Sin movimientos en el mes" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Fecha</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
            <tbody>{rows.map((t, i) => <tr key={t.id || i} style={{ borderTop: '1px solid var(--line)' }}><td>{fmtDate(txDate(t), { day: 'numeric', month: 'short' })}</td><td>{txTitle(t)}</td><td style={{ textAlign: 'right' }}>{eur(signed(t, iban), cur)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <div className="sheet-f no-print"><button className="btn" onClick={csv} disabled={!rows.length}><Icon n="download" size={18} />CSV</button><button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir / PDF</button><button className="btn primary" onClick={onClose}>Cerrar</button></div>
    </Modal>
  )
}

function Contracts({ items }) {
  const [open, setOpen] = useState(null)
  if (!items.length) return <Empty icon="doc" title="Aún no has firmado contratos" text="Cuando contrates un producto o solicites un préstamo, la copia firmada aparecerá aquí." />
  return (
    <>
      <p className="muted s">Las copias se guardan en este navegador. La huella (SHA-256) y la fecha de aceptación también quedan registradas en tu solicitud en la entidad.</p>
      <ul className="rows">
        {items.map((c) => <li key={c.id}><button className="row" onClick={() => setOpen(c)}><span className="dot in"><Icon n="doc" size={18} /></span><span className="row-m"><b>{c.title}</b><small>Aceptado {fmtDate(c.at)}</small></span><span className="chipbtn">Ver</span></button></li>)}
      </ul>
      {open && (
        <Modal title="Contrato aceptado" onClose={() => setOpen(null)} wide>
          <ContractView c={{ ...open, at: new Date(open.at).toLocaleString('es-ES') }} />
          <div className="sheet-f no-print"><button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir / PDF</button><button className="btn primary" onClick={() => setOpen(null)}>Cerrar</button></div>
        </Modal>
      )}
    </>
  )
}
