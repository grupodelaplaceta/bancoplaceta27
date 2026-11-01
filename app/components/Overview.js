'use client'
import { useMemo } from 'react'
import { useRes } from '../../lib/client'
import { list, sortTx, signed, txDate, toDate, eur, account, isJunior, unwrap, pick, daysUntil, greeting } from '../../lib/shape'
import { useApp, AccountCard, TxRow, FlowChart, Skel, ErrorBox, Empty, Icon, CopyBtn } from './ui'

export default function Overview() {
  const { name, ibans, iban, setIban, accs, tick, go, openTransfer, manage, openDetail } = useApp()
  const tx = useRes(iban ? `accounts/${iban}/transactions` : null, tick)
  const txs = useMemo(() => sortTx(list(tx.data, 'transactions')), [tx.data])

  const month = useMemo(() => {
    const since = Date.now() - 30 * 864e5
    let inn = 0, out = 0
    for (const t of txs) { const d = toDate(txDate(t)); if (!d || d < since) continue; const n = signed(t, iban); if (n < 0) out += -n; else inn += n }
    return { inn, out }
  }, [txs, iban])

  const totals = useMemo(() => {
    const m = {}
    for (const i of ibans) { const d = accs[i]?.data; if (!d) continue; const a = account(d); m[a.currency] = (m[a.currency] || 0) + a.balance }
    return Object.entries(m)
  }, [ibans, accs])

  const cur = account(accs[iban]?.data)

  // Aviso de membresía Junior a punto de caducar (usa memberships:read).
  const jr = isJunior(cur)
  const mem = useRes(jr ? `accounts/${iban}/membership` : null, tick)
  const mLeft = jr && mem.data ? daysUntil(pick(unwrap(mem.data, 'membership'), ['expires_at', 'valid_until', 'renews_at', 'next_renewal', 'end_date', 'expiry', 'ends_at'])) : null

  return (
    <div className="stack">
      <section className="hello">
        <div>
          <p className="muted">{greeting()}, {String(name).split(' ')[0]}</p>
          <div className="net sens">{totals.length ? totals.map(([c, v]) => eur(v, c)).join(' + ') : '—'}</div>
          <small className="muted">Saldo total en {ibans.length} {ibans.length === 1 ? 'cuenta' : 'cuentas'}</small>
        </div>
        <button className="btn primary" onClick={() => openTransfer()}><Icon n="send" size={18} />Transferir</button>
      </section>

      {mLeft !== null && mLeft <= 7 && (
        <button className={'notice ' + (mLeft <= 0 ? 'bad' : 'warn')} onClick={() => go('membership')}>
          <Icon n="crown" size={20} />
          <span><b>{mLeft <= 0 ? 'La membresía de ' + iban + ' ha caducado' : `La membresía de ${iban} caduca en ${mLeft} ${mLeft === 1 ? 'día' : 'días'}`}</b><small>Renuévala para no perder las ventajas de la cuenta Junior.</small></span>
          <Icon n="right" size={18} />
        </button>
      )}

      <section aria-label="Tus cuentas">
        <div className="sec-h">
          <h2>Tus cuentas</h2>
          <div className="sec-a">
            <button className="chipbtn" onClick={manage}><Icon n="link" size={14} />Gestionar</button>
          </div>
        </div>
        <div className="cards-row">
          {ibans.map((i) => <AccountCard key={i} iban={i} state={accs[i]} acc={account(accs[i]?.data)} active={i === iban} onClick={() => setIban(i)} />)}
          <button className="pcard add" onClick={() => go('products')}><Icon n="plus" size={22} /><span>Abrir cuenta nueva</span></button>
        </div>
        {accs[iban]?.error && <ErrorBox error={accs[iban].error} />}
      </section>

      <section className="quick" aria-label="Acciones rápidas">
        <button className="qa" onClick={() => go('cards')}><Icon n="card" />Tarjetas</button>
        <button className="qa" onClick={() => go('receipts')}><Icon n="receipt" />Recibos</button>
        <button className="qa" onClick={() => go('products')}><Icon n="bag" />Productos</button>
        {cur.iban && <div className="qa ghostqa"><span className="s muted">IBAN</span><b className="mono">{cur.iban}</b><CopyBtn text={cur.iban} /></div>}
      </section>

      <div className="two">
        <section className="panel" aria-label="Actividad reciente">
          <div className="sec-h"><h2>Últimos 14 días</h2></div>
          {tx.loading && !tx.data ? <Skel n={3} /> : <FlowChart txs={txs} iban={iban} />}
          <div className="legend"><span><i className="sw in" />Entradas <b className="sens">{eur(month.inn, cur.currency)}</b></span><span><i className="sw out" />Salidas <b className="sens">{eur(month.out, cur.currency)}</b></span><small className="muted">últimos 30 días</small></div>
        </section>

        <section className="panel" aria-label="Últimos movimientos">
          <div className="sec-h"><h2>Últimos movimientos</h2><button className="link" onClick={() => go('movements')}>Ver todos</button></div>
          <ErrorBox error={tx.error} onRetry={tx.reload} />
          {tx.loading && !tx.data && <Skel n={4} />}
          {!tx.loading && !tx.error && !txs.length && <Empty icon="list" title="Aún no hay movimientos" text="Cuando envíes o recibas dinero aparecerá aquí." />}
          <ul className="rows">{txs.slice(0, 6).map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Movimiento', t)} />)}</ul>
        </section>
      </div>
    </div>
  )
}
