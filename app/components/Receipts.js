'use client'
import { useRes } from '../../lib/client'
import { list, pick, eur, fmtDate, txTitle, txDate, sortTx, toDate } from '../../lib/shape'
import { useApp, Skel, ErrorBox, Empty, Icon, Badge } from './ui'

export default function Receipts() {
  const { iban, tick, openDetail } = useApp()
  const r = useRes(iban ? `accounts/${iban}/receipts` : null, tick)
  const items = sortTx(list(r.data, 'receipts'))
  return (
    <section className="panel">
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {!r.loading && !r.error && !items.length && <Empty icon="receipt" title="Sin recibos" text="Los recibos fiscales de tus operaciones aparecerán aquí." />}
      {!!items.length && <p className="muted s lead">Pulsa un recibo para ver el detalle fiscal e imprimirlo.</p>}
      <ul className="rows">
        {items.map((t, i) => {
          const amt = pick(t, ['total', 'amount', 'net_amount'])
          return (
            <li key={t.id || i}>
              <button className="row" onClick={() => openDetail('Recibo', t, { print: true })}>
                <span className="dot in"><Icon n="receipt" size={18} /></span>
                <span className="row-m"><b>{pick(t, ['number', 'reference', 'ref', 'code'], txTitle(t) === 'Movimiento' ? 'Recibo' : txTitle(t))}</b><small>{fmtDate(txDate(t))} {t.status && <Badge s={t.status} />}</small></span>
                {amt !== undefined && <strong className="amt sens">{eur(amt, t.currency)}</strong>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
