'use client'
import { useRes } from '../../lib/client'
import { list, pick, fmtDate, facts } from '../../lib/shape'
import { useApp, Badge, Skel, ErrorBox, Empty } from './ui'

const last4 = (c) => { const v = pick(c, ['last4', 'last_four', 'number', 'pan', 'masked_number']); return v ? String(v).replace(/\D/g, '').slice(-4) || '••••' : '••••' }

export default function Cards() {
  const { iban, tick, openDetail } = useApp()
  const r = useRes(iban ? `accounts/${iban}/cards` : null, tick)
  const cards = list(r.data, 'cards')
  return (
    <section className="stack">
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {!r.loading && !r.error && !cards.length && <Empty icon="card" title="Sin tarjetas" text="Esta cuenta no tiene tarjetas asociadas." />}
      <div className="cards-grid">
        {cards.map((c, i) => {
          const st = pick(c, ['status', 'state'])
          const exp = pick(c, ['expiry', 'expires', 'expires_at', 'exp', 'valid_thru'])
          return (
            <button key={c.id || i} className={'plastic ' + (/block|bloq|susp|cancel|expir/i.test(st || '') ? 'off' : '')} onClick={() => openDetail('Tarjeta •••• ' + last4(c), c)}>
              <span className="plastic-top"><b>La Placeta</b><Badge s={st} /></span>
              <span className="plastic-num mono">••••&nbsp;••••&nbsp;••••&nbsp;{last4(c)}</span>
              <span className="plastic-bot">
                <span><small>Titular</small><b>{pick(c, ['holder', 'holder_name', 'name', 'cardholder'], 'Titular')}</b></span>
                <span><small>Caduca</small><b>{exp ? (/^\d{4}-/.test(exp) ? fmtDate(exp, { month: '2-digit', year: '2-digit' }) : exp) : '—'}</b></span>
                <span><small>Tipo</small><b>{pick(c, ['type', 'kind', 'network', 'brand'], 'Débito')}</b></span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
