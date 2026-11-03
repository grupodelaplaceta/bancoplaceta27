'use client'
import { useState } from 'react'
import { useRes, api, newKey } from '../../lib/client'
import { list, pick, eur, fmtDate, facts } from '../../lib/shape'
import { kindOf, HIDE_PLAN_TABS } from '../../lib/kinds'
import { useApp, Badge, Skel, ErrorBox, Empty, Icon, Spinner, Tabs, KV } from './ui'

export default function Plans() {
  const [tab, setTab] = useState('plans')
  const { can, accounts, iban } = useApp()
  const hide = HIDE_PLAN_TABS[kindOf(accounts.find((a) => a.iban === iban)?.raw)] || []
  const items = [['plans', 'Planes y suscripciones'], ['rbu', 'RBU'], ...(can('me:contratar') ? [['req', 'Solicitudes']] : [])].filter(([k]) => !hide.includes(k))
  const shown = items.some(([k]) => k === tab) ? tab : items[0][0]
  return (
    <section className="panel">
      <Tabs value={shown} onChange={setTab} items={items} />
      {shown === 'plans' && <PlanList />}
      {shown === 'rbu' && <Rbu />}
      {shown === 'req' && <Requests />}
    </section>
  )
}

const Generic = ({ item, icon, title, sub, amount, extra, exclude = [] }) => (
  <li>
    <details className="row static" style={{ display: 'block' }}>
      <summary style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', listStyle: 'none' }}>
        <span className="dot in"><Icon n={icon} size={18} /></span>
        <span className="row-m"><b>{title}</b><small>{sub}</small></span>
        {amount !== undefined && <strong className="amt sens">{amount}</strong>}
        {extra}
      </summary>
      <KV rows={facts(item, exclude, 'PZ')} />
    </details>
  </li>
)

function PlanList() {
  const { tick } = useApp()
  const r = useRes('plans', tick)
  const items = list(r.data, 'planes')
  const T = { installment: 'Pago a plazos', subscription: 'Suscripción' }
  return (
    <>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {r.data && !items.length && <Empty icon="cal" title="Sin planes activos" text="Tus pagos a plazos y suscripciones aparecerán aquí." />}
      <ul className="rows">
        {items.map((p, i) => (
          <Generic key={p.id || i} item={p} icon="cal" title={T[p.tipo] || pick(p, ['nombre', 'tipo'], 'Plan')}
            sub={[p.cuotas !== undefined && `${p.cuotas} cuotas`, p.cuotas_pendientes !== undefined && `${p.cuotas_pendientes} pendientes`, (p.proxima || p.proximo) && 'próxima ' + fmtDate(p.proxima || p.proximo)].filter(Boolean).join(' · ') || ' '}
            amount={(p.capital ?? p.principal) !== undefined ? eur(p.capital ?? p.principal) : undefined} extra={<Badge s={p.estado} />} exclude={['id']} />
        ))}
      </ul>
    </>
  )
}

function Rbu() {
  const { tick, bumpAll, toast, can } = useApp()
  const r = useRes('rbu', tick)
  const items = list(r.data, 'bonos')
  const [busy, setBusy] = useState(''), [err, setErr] = useState(null)
  const keys = useState(() => ({}))[0]
  const claim = async (id) => {
    setBusy(id); setErr(null); keys[id] = keys[id] || newKey()
    try { await api(`rbu/${encodeURIComponent(id)}/claim`, { method: 'POST', body: {}, idem: keys[id] }); delete keys[id]; toast('Bono reclamado'); bumpAll() }
    catch (e) { if (e.definitive) delete keys[id]; setErr(e) } finally { setBusy('') }
  }
  const done = (b) => /reclam|claim|cobrad|caduc|expir|cancel/i.test(String(pick(b, ['estado', 'status'], '')))
  return (
    <>
      <ErrorBox error={err} />
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {r.data && !items.length && <Empty icon="gift" title="Sin bonos de la RBU" text="Cuando tengas un bono disponible podrás reclamarlo aquí." />}
      <ul className="rows">
        {items.map((b, i) => {
          const id = String(b.id ?? b.ref ?? i), amt = pick(b, ['importe', 'amount', 'valor'])
          return (
            <Generic key={id} item={b} icon="gift" title={b.semana ? 'Bono RBU · semana del ' + fmtDate(b.semana) : pick(b, ['nombre', 'concepto'], 'Bono RBU')} sub={b.caduca ? 'caduca ' + fmtDate(b.caduca) : ' '} amount={amt !== undefined ? eur(amt) : undefined} exclude={['id']}
              extra={<>{<Badge s={pick(b, ['estado', 'status'])} />}{!done(b) && can('me:transfer') && <button className="chipbtn" disabled={busy === id} onClick={(e) => { e.preventDefault(); claim(id) }}>{busy === id ? <Spinner /> : 'Reclamar'}</button>}</>} />
          )
        })}
      </ul>
    </>
  )
}

function Requests() {
  const { tick, openAlta } = useApp()
  const r = useRes('requests', tick)
  const items = list(r.data, 'solicitudes')
  return (
    <>
      <div className="sheet-f" style={{ justifyContent: 'flex-start' }}>
        <button className="btn primary" onClick={() => openAlta('prestamo')}><Icon n="plus" size={18} />Solicitar un préstamo</button>
        <button className="btn" onClick={() => openAlta('cuenta')}><Icon n="plus" size={18} />Contratar una cuenta</button>
      </div>
      <p className="muted s">Antes de enviar cualquier solicitud verás los datos del producto y el contrato para aceptarlo.</p>
      <h4 className="mt">Mis solicitudes</h4>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={2} />}
      {r.data && !items.length && <Empty icon="doc" title="Sin solicitudes" text="Las solicitudes quedan pendientes hasta que la entidad las resuelva." />}
      <ul className="rows">
        {items.map((s, i) => <Generic key={s.id || i} item={s} icon="doc" title={s.tipo === 'prestamo' ? 'Préstamo' : s.tipo === 'cuenta' ? 'Cuenta' : 'Solicitud'} sub={pick(s, ['motivo'], '') || (s.creada ? fmtDate(s.creada) : ' ')} amount={s.importe !== undefined ? eur(s.importe) : undefined} extra={<Badge s={s.estado} />} exclude={['id']} />)}
      </ul>
    </>
  )
}
