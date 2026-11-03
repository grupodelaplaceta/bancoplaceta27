'use client'
import { useEffect, useState } from 'react'
import { request, store } from '../../lib/client'
import { eur, fmtDateTime, facts } from '../../lib/shape'
import { useApp, Badge, Skel, ErrorBox, Empty, Icon, Spinner, Tabs, CopyBtn, KV } from './ui'

export default function Gateway() { return <GatewayInner /> }

function useGw(tick) {
  const [st, setSt] = useState({ data: null, error: null, loading: true }), [n, setN] = useState(0)
  useEffect(() => {
    let dead = false
    request('/api/gateway').then((d) => !dead && setSt({ data: d, error: null, loading: false })).catch((e) => !dead && setSt({ data: null, error: e, loading: false }))
    return () => { dead = true }
  }, [tick, n])
  return { ...st, reload: () => setN((x) => x + 1), set: setSt }
}

function GatewayInner() {
  const { tick } = useApp()
  const g = useGw(tick)
  const [tab, setTab] = useState('charge')
  const d = g.data
  return (
    <section className="panel">
      <ErrorBox error={g.error} onRetry={g.reload} />
      {g.loading && !d && <Skel n={4} />}
      {d && !d.enabled && <Empty icon="bag" title="Pasarela no disponible" text="Tu entidad no tiene activa la pasarela de pago, o no tienes una cuenta de empresa de la que seas titular." />}
      {d?.enabled && (
        <>
          <Tabs value={tab} onChange={setTab} items={[['charge', 'Cobrar'], ['list', 'Mis cobros', d.items.length], ['cfg', 'Configuración']]} />
          {tab === 'charge' && <Charge d={d} onCreated={(it) => { g.set((s) => ({ ...s, data: { ...s.data, items: [it, ...s.data.items] } })) }} />}
          {tab === 'list' && <Charges items={d.items} />}
          {tab === 'cfg' && <Config d={d} reload={g.reload} />}
        </>
      )}
    </section>
  )
}

function Charge({ d, onCreated }) {
  const { toast } = useApp()
  const c = d.config, prefs = store.get('pz:gw', {})
  const [f, setF] = useState({ iban_destino: d.accounts[0]?.iban || '', dip: '', iban_pagador: '', importe: '', concepto: ((prefs.prefix || '') + '').trim(), minutos: String(prefs.minutos || c.defaultMinutes), origen: prefs.origen || '' })
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null), [res, setRes] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null); setRes(null)
    try {
      const it = await request('/api/gateway', { method: 'POST', body: { ...f, importe: Number(String(f.importe).replace(',', '.')), minutos: Number(f.minutos) } })
      setRes(it); onCreated(it); toast('Cobro creado'); setF({ ...f, dip: '', iban_pagador: '', importe: '', concepto: ((prefs.prefix || '') + '').trim() })
    } catch (x) { setErr(x) } finally { setBusy(false) }
  }
  return (
    <>
      <p className="muted">Crea un cobro para un cliente. Le llega un enlace de pago y el código de verificación lo recibe por el canal de la entidad (nunca se muestra aquí).</p>
      <form onSubmit={submit}>
        <label>Cobrar en<select value={f.iban_destino} onChange={set('iban_destino')}>{d.accounts.map((a) => <option key={a.iban} value={a.iban}>{a.nombre} · {a.iban}</option>)}</select></label>
        <div className="field-row">
          <label>DIP del pagador<input value={f.dip} onChange={set('dip')} placeholder="12345678Z" autoComplete="off" spellCheck="false" /></label>
          <label>IBAN del pagador<input value={f.iban_pagador} onChange={set('iban_pagador')} className="mono" placeholder="PZ-0001-0002" spellCheck="false" /></label>
        </div>
        <div className="field-row">
          <label>Importe (Pz) <small className="muted">{c.min}–{c.max}</small><input inputMode="decimal" value={f.importe} onChange={set('importe')} placeholder="42" /></label>
          {c.allow.minutos && <label>Caduca en (minutos) <small className="muted">máx. {c.maxMinutes}</small><input type="number" min="1" max={c.maxMinutes} value={f.minutos} onChange={set('minutos')} /></label>}
        </div>
        {c.allow.concepto && <label>Concepto{c.requireConcept ? '' : <small className="muted"> (opcional)</small>}<input value={f.concepto} onChange={set('concepto')} maxLength={140} placeholder="Pedido 1001" /></label>}
        {c.allow.origen && d.origins.length > 1 && <label>Origen<select value={f.origen} onChange={set('origen')}><option value="">Predeterminado</option>{d.origins.map((o) => <option key={o.origin} value={o.origin}>{o.origin}</option>)}</select></label>}
        <ErrorBox error={err} />
        <div className="sheet-f" style={{ justifyContent: 'flex-start' }}><button className="btn primary" disabled={busy || !f.dip || !f.iban_pagador || !f.importe}>{busy ? <Spinner /> : 'Crear cobro'}</button></div>
      </form>
      {res && (
        <div className="status-card">
          <div className="status-top"><div><small className="muted">Enlace de pago</small><b className="mono" style={{ wordBreak: 'break-all' }}>{res.url}</b></div><Badge s="pending">Pendiente</Badge></div>
          <div className="sheet-f" style={{ justifyContent: 'flex-start' }}><CopyBtn text={res.url} label="Copiar enlace" /><a className="chipbtn" href={res.url} target="_blank" rel="noopener noreferrer">Abrir</a></div>
          <small className="muted">Caduca {fmtDateTime(res.expira)}</small>
        </div>
      )}
    </>
  )
}

function Charges({ items }) {
  const [state, setState] = useState({}), [busy, setBusy] = useState('')
  const refresh = async (id) => { setBusy(id); try { const s = await request('/api/gateway/' + encodeURIComponent(id)); setState((x) => ({ ...x, [id]: s })) } catch (e) { setState((x) => ({ ...x, [id]: { error: e.message } })) } finally { setBusy('') } }
  if (!items.length) return <Empty icon="bag" title="Aún no has creado cobros" text="Los cobros que crees desde este navegador aparecerán aquí." />
  return (
    <ul className="rows">
      {items.map((it) => {
        const s = state[it.id]
        return (
          <li key={it.id}><details className="row static" style={{ display: 'block' }}>
            <summary style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', listStyle: 'none' }}>
              <span className="dot in"><Icon n="bag" size={18} /></span>
              <span className="row-m"><b>{it.concepto || it.ref}</b><small>{fmtDateTime(it.creado)} · <span className="mono">{it.iban}</span></small></span>
              <strong className="amt">{eur(it.importe)}</strong>
              {s?.estado && <Badge s={s.estado} />}
            </summary>
            <div className="sheet-f" style={{ justifyContent: 'flex-start' }}>
              <button className="chipbtn" disabled={busy === it.id} onClick={() => refresh(it.id)}>{busy === it.id ? <Spinner /> : <><Icon n="refresh" size={14} />Ver estado</>}</button>
              <CopyBtn text={it.url} label="Copiar enlace" />
            </div>
            {s?.error && <ErrorBox error={{ message: s.error }} />}
            {s?.estado && <KV rows={facts(s, ['id'], 'PZ')} />}
          </details></li>
        )
      })}
    </ul>
  )
}

function Config({ d, reload }) {
  const { toast } = useApp()
  const c = d.config, [p, setP] = useState(() => store.get('pz:gw', {}))
  const save = (k, v) => { const n = { ...p, [k]: v }; setP(n); store.set('pz:gw', n) }
  const none = !c.allow.origen && !c.allow.minutos && !c.allow.concepto
  return (
    <div className="stack">
      <section>
        <h4>Lo que permite tu entidad</h4>
        <KV rows={[['Importe por cobro', `${eur(c.min)} – ${eur(c.max)}`], ['Caducidad máxima', `${c.maxMinutes} min`], ['Concepto obligatorio', c.requireConcept ? 'Sí' : 'No'], ['Puedes elegir caducidad', c.allow.minutos ? 'Sí' : 'No'], ['Puedes elegir origen', c.allow.origen ? 'Sí' : 'No'], ['Puedes personalizar el concepto', c.allow.concepto ? 'Sí' : 'No']]} />
      </section>
      <section>
        <h4>Tus preferencias</h4>
        {none && <p className="muted">La entidad no permite personalizar nada: los cobros usan su configuración.</p>}
        {c.allow.minutos && <label>Caducidad habitual (minutos)<input type="number" min="1" max={c.maxMinutes} value={p.minutos || ''} onChange={(e) => save('minutos', e.target.value)} placeholder={String(c.defaultMinutes)} /></label>}
        {c.allow.concepto && <label>Prefijo del concepto<input value={p.prefix || ''} onChange={(e) => save('prefix', e.target.value)} maxLength={40} placeholder="Pedido " /></label>}
        {c.allow.origen && <label>Origen habitual<select value={p.origen || ''} onChange={(e) => save('origen', e.target.value)}><option value="">Predeterminado de la entidad</option>{d.origins.map((o) => <option key={o.origin} value={o.origin}>{o.origin}</option>)}</select></label>}
        <p className="muted s">Las preferencias se guardan en este navegador.</p>
      </section>
      <section>
        <h4>Orígenes autorizados</h4>
        {d.originsError && <ErrorBox error={{ message: 'No se han podido leer los orígenes.' }} />}
        {!d.origins.length && !d.originsError && <p className="muted">La entidad aún no ha aprobado ningún origen: no se pueden crear cobros.</p>}
        <ul className="rows">{d.origins.map((o) => <li key={o.origin}><div className="row static"><span className="dot in"><Icon n="link" size={18} /></span><span className="row-m"><b className="mono">{o.origin}</b><small>{o.entorno}</small></span></div></li>)}</ul>
        {d.admin && <Origins reload={reload} toast={toast} />}
      </section>
      <p className="muted s"><Icon n="info" size={14} /> El código de verificación llega al cliente por el webhook <span className="mono">checkout.codigo</span> de la entidad y el cobro se confirma con <span className="mono">checkout.pagado</span>; esta web no los recibe.</p>
    </div>
  )
}

function Origins({ reload, toast }) {
  const [v, setV] = useState(''), [env, setEnv] = useState('produccion'), [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const add = async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await request('/api/gateway/origins', { method: 'POST', body: { origen: v, entorno: env } }); setV(''); toast('Origen solicitado: queda pendiente de aprobación'); reload() } catch (x) { setErr(x) } finally { setBusy(false) } }
  const del = async () => { const o = prompt('Origen a retirar (URL exacta)'); if (!o) return; try { await request('/api/gateway/origins?origen=' + encodeURIComponent(o), { method: 'DELETE' }); toast('Origen retirado'); reload() } catch (x) { setErr(x) } }
  return (
    <form className="field-row" onSubmit={add}>
      <label>Solicitar origen (administrador)<input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://app.tubanco.es" /></label>
      <label>Entorno<select value={env} onChange={(e) => setEnv(e.target.value)}><option value="produccion">producción</option><option value="pruebas">pruebas</option></select></label>
      <button className="btn primary" disabled={busy || !v}>{busy ? <Spinner /> : 'Solicitar'}</button>
      <button type="button" className="btn" onClick={del}>Retirar uno…</button>
      <ErrorBox error={err} />
    </form>
  )
}
