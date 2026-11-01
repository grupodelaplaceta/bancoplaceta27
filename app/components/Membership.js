'use client'
import { useState } from 'react'
import { useRes, api, newKey } from '../../lib/client'
import { unwrap, pick, eur, fmtDate, daysUntil, toDate, facts, statusTone } from '../../lib/shape'
import { useApp, Badge, Skel, ErrorBox, Empty, Icon, Modal, KV, Spinner } from './ui'

export default function Membership() {
  const { iban, tick, bump, toast, accOf } = useApp()
  const r = useRes(iban ? `accounts/${iban}/membership` : null, tick)
  const [ask, setAsk] = useState(false)
  const m = unwrap(r.data, 'membership')
  const status = pick(m, ['status', 'state'])
  const expires = pick(m, ['expires_at', 'valid_until', 'renews_at', 'next_renewal', 'end_date', 'expiry', 'ends_at'])
  const started = pick(m, ['started_at', 'starts_at', 'start_date', 'created_at'])
  const price = pick(m, ['price', 'fee', 'renewal_price', 'amount', 'cost', 'monthly_fee'])
  const plan = pick(m, ['plan', 'tier', 'name', 'product_name', 'product'], 'Membresía Junior')
  const left = daysUntil(expires)
  const total = started && expires ? Math.max(1, (toDate(expires) - toDate(started)) / 864e5) : null
  const pct = left !== null && total ? Math.min(100, Math.max(0, 100 - (left / total) * 100)) : null
  const none = r.error && [403, 404, 422].includes(r.error.status)
  const cur = accOf(iban)?.currency || 'EUR'

  return (
    <div className="stack">
      {none && <Empty icon="crown" title="Esta cuenta no tiene membresía" text="La membresía solo existe en cuentas Junior. Cambia de cuenta arriba o abre una cuenta Junior en Productos."><small className="muted">{r.error.message}</small></Empty>}
      {!none && <ErrorBox error={r.error} onRetry={r.reload} />}
      {r.loading && !r.data && <Skel n={4} />}
      {r.data && !r.error && (
        <section className="member">
          <div className="member-h">
            <span className="crown"><Icon n="crown" size={26} /></span>
            <div><h2>{String(plan)}</h2><p className="mono">{iban}</p></div>
            <Badge s={status} />
          </div>
          <div className="member-b">
            {left !== null ? (
              <div className="left"><b>{left > 0 ? left : 0}</b><span>{left > 0 ? (left === 1 ? 'día restante' : 'días restantes') : 'Caducada'}</span></div>
            ) : <div className="left"><b>—</b><span>sin fecha de caducidad</span></div>}
            {pct !== null && <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + '%' }} /></div>}
            <div className="member-d">
              {started && <div><small>Desde</small><b>{fmtDate(started)}</b></div>}
              {expires && <div><small>Válida hasta</small><b>{fmtDate(expires)}</b></div>}
              {price !== undefined && <div><small>Renovación</small><b>{typeof price === 'number' ? eur(price, cur) : String(price)}</b></div>}
            </div>
          </div>
          <div className="member-a">
            <button className="btn primary" onClick={() => setAsk(true)}><Icon n="refresh" size={18} />Renovar membresía</button>
            <button className="btn" onClick={r.reload}>Actualizar estado</button>
          </div>
          <details className="more"><summary>Ver todos los datos</summary>
            <KV rows={facts(m, [], cur)} />
          </details>
        </section>
      )}
      {ask && <RenewModal iban={iban} price={price} cur={cur} onClose={() => setAsk(false)} onDone={() => { setAsk(false); toast('Membresía renovada'); bump() }} />}
    </div>
  )
}

function RenewModal({ iban, price, cur, onClose, onDone }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const [key, setKey] = useState(newKey)
  const go = async () => {
    setBusy(true); setErr(null)
    try { await api(`accounts/${iban}/membership/renew`, { method: 'POST', body: {}, idem: key }); onDone() }
    catch (e) { if (e.definitive) setKey(newKey()); setErr(e); setBusy(false) }
  }
  return (
    <Modal title="Renovar membresía" onClose={onClose}>
      <p>Vas a renovar la membresía Junior de <b className="mono">{iban}</b>{typeof price === 'number' ? <> por <b>{eur(price, cur)}</b>, que se cobrará de la propia cuenta</> : ''}.</p>
      <ErrorBox error={err} />
      <div className="sheet-f"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={go} disabled={busy}>{busy ? <Spinner /> : 'Confirmar renovación'}</button></div>
    </Modal>
  )
}
