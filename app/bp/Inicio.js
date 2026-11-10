'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { kindOf, isAdminRole } from '../../lib/kinds'
import { useRes, api, newKey } from '../../lib/client'
import { list, sortTx, eur, account, greeting, pick, txDate, txTitle, fmtDate } from '../../lib/shape'
import { useApp, Icon, TONES, Skeleton, ErrBox, Empty, Sheet, Spin } from './kit'
import { TxRow, groupByDay } from './parts'
import Detalle from './Detalle'

/** El saldo «sube» hasta su valor al cargar (animación corta). */
function useCount(target) {
  const [v, setV] = useState(0), from = useRef(0)
  useEffect(() => {
    const a = from.current, t0 = performance.now(), D = 700
    let raf
    const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = target }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

export default function Inicio() {
  const { name, accounts, cur, iban, setIban, tick, go, openTransfer, can, unread, toast, refreshAll, hideAmounts, setHideAmounts } = useApp()
  const det = useRes(iban ? `accounts/${iban}` : null, tick)
  const tx = useRes(iban ? `accounts/${iban}/transactions?limite=6` : null, tick)
  const prev = useRes('previsiones', tick)
  const [open, setOpen] = useState(null)
  const [alta, setAlta] = useState(false), [nombre, setNombre] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const altaKey = useState(() => newKey())[0]

  const crearCuenta = async () => {
    setBusy(true); setErr(null)
    try {
      await api('accounts', { method: 'POST', body: { nombre: nombre.trim() }, idem: altaKey })
      setAlta(false); setNombre(''); toast('Cuenta abierta'); refreshAll()
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }

  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0)
  const d = det.data ? account(det.data) : cur
  const recent = useMemo(() => sortTx(list(tx.data, 'movimientos')).slice(0, 5), [tx.data])
  const next = useMemo(() => list(prev.data, 'previsiones').slice(0, 3), [prev.data])
  const first = String(name || '').split(' ')[0]
  const shown = useCount(total)
  const ent = d && ['empresa', 'institucional'].includes(kindOf(d.raw)) && isAdminRole(d.role)

  return (
    <>
      <section className="hero-card" aria-label="Saldo">
        <div className="hero-top">
          <span className="avatar" aria-hidden="true">{(first[0] || 'C').toUpperCase()}</span>
          <span className="hero-hi"><span>{greeting()}</span><b>{first}</b></span>
          <button className="hero-eye" onClick={() => setHideAmounts((h) => !h)} aria-label={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}>
            <Icon n={hideAmounts ? 'eyeoff' : 'eye'} size={20} />
          </button>
        </div>
        <p className="hero-label">Saldo total</p>
        <div className="big-amt sens">{eur(Math.round(shown * 100) / 100)}</div>
        <p className="hero-sub">{accounts.length === 1 ? 'En tu cuenta' : `Entre tus ${accounts.length} cuentas`}</p>
      </section>

      {unread > 0 && (
        <button className="banner info" onClick={() => go('mas', 'avisos')}>
          <Icon n="bell" size={20} />
          <span style={{ flex: 1 }}>Tienes {unread} {unread === 1 ? 'aviso nuevo' : 'avisos nuevos'}</span>
          <Icon n="chev" size={18} />
        </button>
      )}

      <div className="accounts" role="list" aria-label="Tus cuentas" style={{ marginTop: 18 }}>
        {accounts.map((a) => (
          <button key={a.iban} role="listitem" className={'acc ' + (TONES[toneKey(a)])} aria-pressed={a.iban === iban}
            onClick={() => setIban(a.iban)} aria-label={`${a.name}, ${eur(a.balance)}`}>
            <span className="a-name">{a.name}</span>
            <span className="a-bal sens">{eur(a.balance)}</span>
            <span className="a-iban">{a.iban}</span>
          </button>
        ))}
        {can('me:contratar') && (
          <button className="acc add" onClick={() => setAlta(true)}>
            <Icon n="plus" size={22} /><span style={{ marginTop: 6 }}>Abrir cuenta</span>
          </button>
        )}
      </div>

      <div className="actions" role="group" aria-label="Acciones rápidas">
        {can('me:transfer') && <Act icon="send" label="Transferir" onClick={() => openTransfer()} />}
        <Act icon="list" label="Movimientos" onClick={() => go('movimientos')} />
        <Act icon="card" label="Tarjetas" onClick={() => go('tarjetas')} />
        {ent
          ? <Act icon="tree" label="Organigrama" onClick={() => go('mas', 'empresa')} />
          : <Act icon="receipt" label="Recibos" onClick={() => go('mas', 'recibos')} />}
      </div>

      {d && (
        <section className="card" style={{ marginTop: 18 }} aria-label="Resumen de la cuenta">
          <div className="small muted" style={{ fontWeight: 700 }}>{d.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Stat label="Disponible" value={eur(d.available)} />
            <Stat label="Reservado" value={d.reserved != null ? eur(d.reserved) : '—'} />
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            {d.iban} · <button className="link" style={{ fontSize: 13 }} onClick={() => setOpen({ kind: 'cuenta', raw: d.raw })}>Ver datos de la cuenta</button>
          </p>
        </section>
      )}

      {det.error && <ErrBox error={det.error} onRetry={det.reload} />}

      <section className="section" aria-label="Últimos movimientos">
        <div className="section-h"><h2>Últimos movimientos</h2><button className="link" onClick={() => go('movimientos')}>Ver todos</button></div>
        {tx.loading && !tx.data && <Skeleton n={3} />}
        <ErrBox error={tx.error} onRetry={tx.reload} />
        {tx.data && !recent.length && <Empty icon="list" title="Sin movimientos" text="Cuando hagas o recibas un pago, aparecerá aquí." />}
        {!!recent.length && (
          <div className="list">
            {groupByDay(recent).flatMap((g) => g.items).map((t, i) => <TxRow key={(t.id ?? '') + i} t={t} iban={iban} onClick={(x) => setOpen({ kind: 'mov', t: x })} />)}
          </div>
        )}
      </section>

      {!!next.length && (
        <section className="section" aria-label="Próximos pagos">
          <div className="section-h"><h2>Próximos pagos</h2></div>
          <div className="list">
            {next.map((p, i) => {
              const amt = Math.abs(Number(pick(p, ['importe', 'cantidad', 'amount'], 0)) || 0)
              return (
                <div key={i} className="item">
                  <span className="i-ico"><Icon n="clock" size={18} /></span>
                  <span className="i-main"><span className="i-title" style={{ display: 'block' }}>{txTitle(p)}</span><span className="i-sub">{fmtDate(txDate(p) || pick(p, ['proxima', 'vence']))}</span></span>
                  <span className="i-amt">{eur(amt)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {open && <Detalle data={open} onClose={() => setOpen(null)} />}

      {alta && (
        <Sheet title="Abrir cuenta" onClose={() => setAlta(false)}>
          <p className="muted small">Una cuenta personal propia, lista al instante. Elige un nombre para reconocerla.</p>
          <label className="field"><span>Nombre de la cuenta</span>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ej. Gastos de casa" />
          </label>
          {err && <div className="banner bad" role="alert">{err.message}</div>}
          <div style={{ marginTop: 18 }}>
            <button className="btn primary" disabled={busy || !nombre.trim()} onClick={crearCuenta}>{busy ? <Spin /> : 'Abrir cuenta'}</button>
          </div>
        </Sheet>
      )}
    </>
  )
}

function toneKey(a) {
  const t = a.tone || (String(a.name) + String(a.type)).toLowerCase()
  return /junior|joven/.test(t) ? 'terra' : /ahorro|saving/.test(t) ? 'teal' : /empresa|negocio|comercio|instituc/.test(t) ? 'slate' : 'navy'
}

function Act({ icon, label, onClick }) {
  return (
    <button className="action" onClick={onClick}>
      <span className="ico-c"><Icon n={icon} size={20} /></span>
      {label}
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="tiny muted" style={{ fontWeight: 600 }}>{label}</div>
      <div className="sens" style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>{value}</div>
    </div>
  )
}
