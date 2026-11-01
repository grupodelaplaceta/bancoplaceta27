'use client'
import { useMemo } from 'react'
import { useRes } from '../../lib/client'
import { list, sortTx, signed, txDate, toDate, eur, account, greeting } from '../../lib/shape'
import { useApp, AccountCard, TxRow, FlowChart, Skel, ErrorBox, Empty, Icon, CopyBtn, KV } from './ui'

export default function Overview() {
  const { name, accounts, iban, setIban, tick, go, openTransfer, openAccount, openDetail, unread, can } = useApp()
  const cur = accounts.find((a) => a.iban === iban) || accounts[0]
  const tx = useRes(iban ? `accounts/${iban}/transactions?limite=100` : null, tick)
  const det = useRes(iban ? `accounts/${iban}` : null, tick)
  const prev = useRes('previsiones', tick)
  const txs = useMemo(() => sortTx(list(tx.data, 'movimientos')), [tx.data])
  const next = useMemo(() => list(prev.data, 'previsiones').slice(0, 3), [prev.data])

  const month = useMemo(() => {
    const since = Date.now() - 30 * 864e5
    let inn = 0, out = 0
    for (const t of txs) { const d = toDate(txDate(t)); if (!d || d < since) continue; const n = signed(t, iban); if (n < 0) out += -n; else inn += n }
    return { inn, out }
  }, [txs, iban])

  const totals = useMemo(() => {
    const m = {}
    for (const a of accounts) m[a.currency] = (m[a.currency] || 0) + a.balance
    return Object.entries(m)
  }, [accounts])

  const d = det.data ? account(det.data) : null

  return (
    <div className="stack">
      <section className="hello">
        <div>
          <p className="muted">{greeting()}, {String(name).split(' ')[0]}</p>
          <div className="net sens">{totals.length ? totals.map(([c, v]) => eur(v, c)).join(' + ') : '—'}</div>
          <small className="muted">Saldo total en {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}</small>
        </div>
        {can('me:transfer') && <button className="btn primary" onClick={() => openTransfer()}><Icon n="send" size={18} />Transferir</button>}
      </section>

      {unread > 0 && (
        <button className="notice warn" onClick={() => go('notifications')}>
          <Icon n="bell" size={20} />
          <span><b>Tienes {unread} {unread === 1 ? 'aviso nuevo' : 'avisos nuevos'}</b><small>Ingresos y cargos recientes en tus cuentas.</small></span>
          <Icon n="right" size={18} />
        </button>
      )}

      <section aria-label="Tus cuentas">
        <div className="sec-h"><h2>Tus cuentas</h2></div>
        <div className="cards-row">
          {accounts.map((a) => <AccountCard key={a.iban} acc={a} active={a.iban === iban} onClick={() => setIban(a.iban)} />)}
          {can('me:contratar') && <button className="pcard add" onClick={openAccount}><Icon n="plus" size={22} /><span>Abrir cuenta nueva</span></button>}
        </div>
      </section>

      <section className="quick" aria-label="Acciones rápidas">
        <button className="qa" onClick={() => go('cards')}><Icon n="card" />Tarjetas</button>
        <button className="qa" onClick={() => go('receipts')}><Icon n="receipt" />Recibos</button>
        <button className="qa" onClick={() => go('plans')}><Icon n="gift" />Planes y ayudas</button>
        {cur && <div className="qa ghostqa"><span className="s muted">IBAN</span><b className="mono">{cur.iban}</b><CopyBtn text={cur.iban} /></div>}
      </section>

      {cur && (
        <section className="panel" aria-label="Detalle de la cuenta">
          <div className="sec-h"><h2>{cur.name}</h2></div>
          <ErrorBox error={det.error} onRetry={det.reload} />
          {det.loading && !det.data ? <Skel n={2} /> : (
            <KV rows={[
              ['Saldo', <span className="sens">{eur(d?.balance ?? cur.balance, cur.currency)}</span>],
              ['Disponible', <span className="sens">{eur(d?.available ?? cur.available, cur.currency)}</span>],
              ...(d?.reserved !== undefined ? [['Reservado', <span className="sens">{eur(d.reserved, cur.currency)}</span>]] : []),
              ...(d?.dailyLimit !== undefined ? [['Límite diario', eur(d.dailyLimit, cur.currency)]] : []),
              ...(d?.overdraft !== undefined ? [['Descubierto', d.overdraft ? 'Sí' : 'No']] : []),
            ]} />
          )}
        </section>
      )}

      <div className="two">
        <section className="panel" aria-label="Actividad reciente">
          <div className="sec-h"><h2>Últimos 14 días</h2></div>
          {tx.loading && !tx.data ? <Skel n={3} /> : <FlowChart txs={txs} iban={iban} />}
          <div className="legend"><span><i className="sw in" />Entradas <b className="sens">{eur(month.inn, cur?.currency)}</b></span><span><i className="sw out" />Salidas <b className="sens">{eur(month.out, cur?.currency)}</b></span><small className="muted">últimos 30 días</small></div>
        </section>

        <section className="panel" aria-label="Últimos movimientos">
          <div className="sec-h"><h2>Últimos movimientos</h2><button className="link" onClick={() => go('movements')}>Ver todos</button></div>
          <ErrorBox error={tx.error} onRetry={tx.reload} />
          {tx.loading && !tx.data && <Skel n={4} />}
          {!tx.loading && !tx.error && !txs.length && <Empty icon="list" title="Aún no hay movimientos" text="Cuando envíes o recibas dinero aparecerá aquí." />}
          <ul className="rows">{txs.slice(0, 6).map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Movimiento', t)} />)}</ul>
        </section>
      </div>

      {!!next.length && (
        <section className="panel" aria-label="Próximos movimientos">
          <div className="sec-h"><h2>Próximos movimientos</h2><button className="link" onClick={() => go('movements')}>Ver previsión</button></div>
          <ul className="rows">{next.map((t, i) => <TxRow key={t.id || i} t={t} iban={iban} onClick={() => openDetail('Previsión', t)} />)}</ul>
        </section>
      )}
    </div>
  )
}
