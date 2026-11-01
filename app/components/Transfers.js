'use client'
import { useState } from 'react'
import { api, store } from '../../lib/client'
import { unwrap, pick, eur, fmtDateTime, facts, statusText } from '../../lib/shape'
import { useApp, Icon, Badge, ErrorBox, Empty, CopyBtn, KV, Spinner } from './ui'

export function TransferStatus({ data, refId }) {
  const t = unwrap(data, 'transfer')
  const status = pick(t, ['status', 'state'])
  const cur = t.currency || 'EUR'
  return (
    <div className="status-card">
      <div className="status-top">
        <div><small className="muted">Referencia</small><b className="mono">{pick(t, ['reference', 'ref', 'id'], refId)}</b></div>
        <Badge s={status} />
      </div>
      {t.amount !== undefined && <div className="status-amt sens">{eur(t.amount, cur)}</div>}
      <div className="route">
        <div><small>Origen</small><b className="mono">{pick(t, ['from_iban'], pick(t.from, ['iban'], '—'))}</b></div>
        <Icon n="send" size={18} />
        <div><small>Destino</small><b className="mono">{pick(t, ['to_iban'], pick(t.to, ['iban'], '—'))}</b></div>
      </div>
      <KV rows={facts(t, ['reference', 'ref', 'id', 'status', 'state', 'amount', 'from_iban', 'to_iban', 'currency'], cur)} />
    </div>
  )
}

export default function Transfers() {
  const { iban, openTransfer, benef, setBenef, recent, tick, ibans } = useApp()
  const [ref, setRef] = useState(''), [res, setRes] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const look = async (v = ref) => {
    const r = v.trim(); if (!r) return
    setBusy(true); setErr(null); setRes(null)
    try { setRes({ ref: r, data: await api('transfers/' + encodeURIComponent(r)) }) } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  const mine = recent.filter((x) => x.from === iban)
  return (
    <div className="stack">
      <div className="two">
        <section className="panel">
          <div className="sec-h"><h2>Enviar dinero</h2></div>
          <p className="muted">Mueve dinero a otra cuenta de La Placeta al instante. Si algo falla y reintentas, nunca se cobra dos veces.</p>
          <button className="btn primary big" onClick={() => openTransfer()}><Icon n="send" />Nueva transferencia</button>
          {!!benef.length && (
            <>
              <h4 className="mt">Destinatarios guardados</h4>
              <ul className="rows">
                {benef.map((b) => (
                  <li key={b.iban}><div className="row static">
                    <span className="avatar">{(b.name || b.iban).slice(0, 1).toUpperCase()}</span>
                    <span className="row-m"><b>{b.name || b.iban}</b><small className="mono">{b.iban}</small></span>
                    <button className="chipbtn" onClick={() => openTransfer({ to: b.iban })}>Enviar</button>
                    <button className="icon-btn" aria-label={'Quitar ' + b.iban} onClick={() => setBenef(benef.filter((x) => x.iban !== b.iban))}><Icon n="trash" size={16} /></button>
                  </div></li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="panel">
          <div className="sec-h"><h2>Seguir una transferencia</h2></div>
          <form className="inline" onSubmit={(e) => { e.preventDefault(); look() }}>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Referencia de la transferencia" aria-label="Referencia" />
            <button className="btn primary" disabled={busy || !ref.trim()}>{busy ? <Spinner /> : 'Consultar'}</button>
          </form>
          <ErrorBox error={err} />
          {res && <TransferStatus data={res.data} refId={res.ref} />}
          {!res && !err && !busy && !mine.length && <Empty icon="swap" title="Consulta el estado" text="Pega la referencia que recibiste al enviar el dinero." />}
          {!res && !!mine.length && (
            <>
              <h4 className="mt">Enviadas desde esta cuenta</h4>
              <ul className="rows">
                {mine.slice(0, 6).map((x) => (
                  <li key={x.ref}><button className="row" onClick={() => { setRef(x.ref); look(x.ref) }}>
                    <span className="dot out"><Icon n="up" size={18} /></span>
                    <span className="row-m"><b>{eur(x.amount)} → {x.to}</b><small>{fmtDateTime(x.at)} · <span className="mono">{x.ref}</span></small></span>
                    <span className="chipbtn">Ver estado</span>
                  </button></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
