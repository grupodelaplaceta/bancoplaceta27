'use client'
import { useState } from 'react'
import { useRes, api, newKey } from '../../lib/client'
import { list, pick, eur, fmtDate, facts } from '../../lib/shape'
import { useApp, Badge, Skel, ErrorBox, Empty, Icon, Spinner, Tabs, KV } from './ui'

export default function Plans() {
  const [tab, setTab] = useState('plans')
  const { can } = useApp()
  return (
    <section className="panel">
      <Tabs value={tab} onChange={setTab} items={[['plans', 'Planes y suscripciones'], ['rbu', 'RBU'], ...(can('me:contratar') ? [['req', 'Solicitudes']] : [])]} />
      {tab === 'plans' && <PlanList />}
      {tab === 'rbu' && <Rbu />}
      {tab === 'req' && <Requests />}
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
      <KV rows={facts(item, exclude, 'EUR')} />
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
            sub={[p.cuotas_pendientes !== undefined && `${p.cuotas_pendientes} cuotas pendientes`, p.proximo && 'próximo ' + fmtDate(p.proximo)].filter(Boolean).join(' · ') || ' '}
            amount={p.principal !== undefined ? eur(p.principal) : undefined} extra={<Badge s={p.estado} />} exclude={['id']} />
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
            <Generic key={id} item={b} icon="gift" title={pick(b, ['nombre', 'concepto', 'periodo'], 'Bono RBU')} sub={pick(b, ['fecha', 'periodo', 'expira'], ' ')} amount={amt !== undefined ? eur(amt) : undefined} exclude={['id']}
              extra={<>{<Badge s={pick(b, ['estado', 'status'])} />}{!done(b) && can('me:transfer') && <button className="chipbtn" disabled={busy === id} onClick={(e) => { e.preventDefault(); claim(id) }}>{busy === id ? <Spinner /> : 'Reclamar'}</button>}</>} />
          )
        })}
      </ul>
    </>
  )
}

function Requests() {
  const { tick, bump, toast } = useApp()
  const r = useRes('requests', tick)
  const items = list(r.data, 'solicitudes')
  const [tipo, setTipo] = useState('prestamo'), [importe, setImporte] = useState(''), [cuotas, setCuotas] = useState('12'), [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null), [key, setKey] = useState(newKey)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const body = tipo === 'prestamo' ? { tipo, importe: Number(String(importe).replace(',', '.')), cuotas: Number(cuotas), motivo } : { tipo, motivo }
    try { await api('requests', { method: 'POST', body, idem: key }); setKey(newKey()); setImporte(''); setMotivo(''); toast('Solicitud enviada: queda pendiente'); bump() }
    catch (x) { if (x.definitive) setKey(newKey()); setErr(x) } finally { setBusy(false) }
  }
  return (
    <>
      <form onSubmit={submit}>
        <div className="field-row">
          <label>Qué quieres solicitar<select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="prestamo">Un préstamo</option><option value="cuenta">Una cuenta</option></select></label>
          {tipo === 'prestamo' && <label>Importe (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="3000" /></label>}
        </div>
        {tipo === 'prestamo' && <label>Cuotas<input type="number" min="1" max="360" value={cuotas} onChange={(e) => setCuotas(e.target.value)} /></label>}
        <label>Motivo <small className="muted">(opcional)</small><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej. Reforma" /></label>
        <ErrorBox error={err} />
        <div className="sheet-f" style={{ justifyContent: 'flex-start' }}><button className="btn primary" disabled={busy || (tipo === 'prestamo' && !importe.trim())}>{busy ? <Spinner /> : 'Enviar solicitud'}</button></div>
      </form>
      <h4 className="mt">Mis solicitudes</h4>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={2} />}
      {r.data && !items.length && <Empty icon="doc" title="Sin solicitudes" text="Las solicitudes quedan pendientes hasta que la entidad las resuelva." />}
      <ul className="rows">
        {items.map((s, i) => <Generic key={s.id || i} item={s} icon="doc" title={s.tipo === 'prestamo' ? 'Préstamo' : s.tipo === 'cuenta' ? 'Cuenta' : 'Solicitud'} sub={pick(s, ['motivo', 'creado', 'fecha'], ' ')} amount={s.importe !== undefined ? eur(s.importe) : undefined} extra={<Badge s={s.estado} />} exclude={['id']} />)}
      </ul>
    </>
  )
}
