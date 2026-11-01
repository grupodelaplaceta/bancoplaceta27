'use client'
import { useState } from 'react'
import { useRes, api } from '../../lib/client'
import { list, pick, eur, fmtDate, txTitle, txDate, sortTx, txRef, facts } from '../../lib/shape'
import { useApp, Skel, ErrorBox, Empty, Icon, Badge, Modal, KV, Spinner } from './ui'

export default function Receipts() {
  const { iban, tick } = useApp()
  const r = useRes(iban ? `accounts/${iban}/receipts` : null, tick)
  const [open, setOpen] = useState(null)
  const items = sortTx(list(r.data, 'recibos'))
  return (
    <section className="panel">
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {!r.loading && !r.error && !items.length && <Empty icon="receipt" title="Sin recibos" text="Los recibos fiscales de tus operaciones aparecerán aquí." />}
      {!!items.length && <p className="muted s lead">Pulsa un recibo para ver el detalle fiscal, su certificado de cálculo e imprimirlo.</p>}
      <ul className="rows">
        {items.map((t, i) => {
          const amt = pick(t, ['importe', 'total', 'amount'])
          return (
            <li key={t.id || i}>
              <button className="row" onClick={() => setOpen(t)}>
                <span className="dot in"><Icon n="receipt" size={18} /></span>
                <span className="row-m"><b>{pick(t, ['numero', 'referencia', 'ref', 'codigo'], txTitle(t) === 'Movimiento' ? 'Recibo' : txTitle(t))}</b><small>{fmtDate(txDate(t))} {pick(t, ['estado', 'status']) && <Badge s={pick(t, ['estado', 'status'])} />}</small></span>
                {amt !== undefined && <strong className="amt sens">{eur(amt, t.moneda)}</strong>}
              </button>
            </li>
          )
        })}
      </ul>
      {open && <ReceiptModal item={open} iban={iban} onClose={() => setOpen(null)} />}
    </section>
  )
}

function ReceiptModal({ item, iban, onClose }) {
  const ref = txRef(item)
  const [cert, setCert] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const load = async () => { setBusy(true); setErr(null); try { setCert(await api('receipts/' + encodeURIComponent(ref) + '/certificate')) } catch (e) { setErr(e) } finally { setBusy(false) } }
  return (
    <Modal title="Recibo" onClose={onClose}>
      <div className="print-area">
        <div className="print-head"><b>Banca La Placeta</b><span>Recibo · {iban}</span></div>
        <KV rows={facts(item, [], item.moneda || 'EUR')} />
        {cert && (<><h4 className="mt">Certificado de cálculo</h4><KV rows={facts(cert, [], 'EUR')} /></>)}
      </div>
      <ErrorBox error={err} />
      <div className="sheet-f no-print">
        {ref && !cert && <button className="btn" onClick={load} disabled={busy}>{busy ? <Spinner /> : <><Icon n="doc" size={18} />Certificado de cálculo</>}</button>}
        <button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir</button>
        <button className="btn primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
