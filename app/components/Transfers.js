'use client'
import { useState } from 'react'
import { useRes, api, newKey } from '../../lib/client'
import { list, pick, eur, fmtDateTime } from '../../lib/shape'
import { useApp, Icon, ErrorBox, Empty, Skel, Spinner, Tabs } from './ui'

export default function Transfers() {
  const [tab, setTab] = useState('send')
  const { can, openTransfer } = useApp()
  return (
    <section className="panel">
      <Tabs value={tab} onChange={setTab} items={[['send', 'Enviar'], ['sched', 'Programadas'], ['benef', 'Destinatarios']]} />
      {tab === 'send' && (
        <>
          <p className="muted">Mueve dinero a otra cuenta al instante, o prográmalo para más adelante. Si algo falla y reintentas, nunca se cobra dos veces.</p>
          {can('me:transfer')
            ? <div className="sheet-f" style={{ justifyContent: 'flex-start' }}><button className="btn primary big" onClick={() => openTransfer()}><Icon n="send" />Nueva transferencia</button><button className="btn big" onClick={() => openTransfer({ schedule: true })}><Icon n="cal" />Programar</button></div>
            : <ErrorBox error={{ message: 'Tu sesión no tiene permiso para transferir.' }} />}
          <Quick />
        </>
      )}
      {tab === 'sched' && <Scheduled />}
      {tab === 'benef' && <Beneficiaries />}
    </section>
  )
}

function Quick() {
  const { tick, openTransfer, can } = useApp()
  const r = useRes('beneficiaries', tick)
  const items = list(r.data, 'beneficiarios')
  if (!items.length || !can('me:transfer')) return null
  return (
    <>
      <h4 className="mt">Enviar a un destinatario guardado</h4>
      <ul className="rows">
        {items.slice(0, 6).map((b) => (
          <li key={b.id || b.iban}><div className="row static">
            <span className="avatar">{String(b.alias || b.iban).slice(0, 1).toUpperCase()}</span>
            <span className="row-m"><b>{b.alias || b.iban}</b><small className="mono">{b.iban}</small></span>
            <button className="chipbtn" onClick={() => openTransfer({ to: b.iban })}>Enviar</button>
          </div></li>
        ))}
      </ul>
    </>
  )
}

function Scheduled() {
  const { tick, bump, toast, openTransfer, can } = useApp()
  const r = useRes('transfers/scheduled', tick)
  const items = list(r.data, 'programadas')
  const [sure, setSure] = useState(''), [busy, setBusy] = useState('')
  const cancel = async (id) => {
    setBusy(id)
    try { await api('transfers/scheduled/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Transferencia cancelada'); setSure(''); bump() } catch (e) { toast(e.message) } finally { setBusy('') }
  }
  return (
    <>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {r.data && !items.length && <Empty icon="cal" title="Sin transferencias programadas" text="Programa una transferencia única o periódica (alquiler, ahorro mensual…).">{can('me:transfer') && <button className="btn primary" onClick={() => openTransfer({ schedule: true })}>Programar una</button>}</Empty>}
      <ul className="rows">
        {items.map((p, i) => {
          const id = String(p.id ?? p.ref ?? i), every = pick(p, ['periodicidad_dias'])
          return (
            <li key={id}><div className="row static">
              <span className="dot out"><Icon n="cal" size={18} /></span>
              <span className="row-m">
                <b>{eur(pick(p, ['importe', 'amount'], 0))} → <span className="mono">{pick(p, ['hacia_iban'], '—')}</span></b>
                <small>{fmtDateTime(pick(p, ['fecha', 'proxima', 'proximo']))}{every ? ` · cada ${every} días` : ' · una vez'}{pick(p, ['concepto']) ? ' · ' + p.concepto : ''}</small>
              </span>
              {can('me:transfer') && (sure === id
                ? <><button className="chipbtn danger" disabled={busy === id} onClick={() => cancel(id)}>{busy === id ? <Spinner /> : 'Cancelar envío'}</button><button className="chipbtn" onClick={() => setSure('')}>No</button></>
                : <button className="icon-btn" aria-label="Cancelar transferencia programada" onClick={() => setSure(id)}><Icon n="trash" size={16} /></button>)}
            </div></li>
          )
        })}
      </ul>
    </>
  )
}

function Beneficiaries() {
  const { tick, bump, toast, openTransfer, can } = useApp()
  const r = useRes('beneficiaries', tick)
  const items = list(r.data, 'beneficiarios')
  const [alias, setAlias] = useState(''), [iban, setIban] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [sure, setSure] = useState('')
  const [key, setKey] = useState(newKey)
  const add = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { await api('beneficiaries', { method: 'POST', body: { alias, iban }, idem: key }); setAlias(''); setIban(''); setKey(newKey()); toast('Destinatario guardado'); bump() }
    catch (x) { if (x.definitive) setKey(newKey()); setErr(x) } finally { setBusy(false) }
  }
  const del = async (id) => { try { await api('beneficiaries/' + encodeURIComponent(id), { method: 'DELETE' }); setSure(''); toast('Destinatario borrado'); bump() } catch (e) { toast(e.message) } }
  return (
    <>
      {can('me:transfer') && (
        <form className="field-row" onSubmit={add}>
          <label>Nombre<input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Casa de mamá" /></label>
          <label>IBAN<input value={iban} onChange={(e) => setIban(e.target.value)} className="mono" placeholder="PZ-0001-0009" spellCheck="false" /></label>
          <button className="btn primary" disabled={busy || !alias.trim() || !iban.trim()}>{busy ? <Spinner /> : 'Guardar destinatario'}</button>
        </form>
      )}
      <ErrorBox error={err} />
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {r.data && !items.length && <Empty icon="users" title="Aún no tienes destinatarios" text="Guarda las cuentas a las que envías dinero con frecuencia." />}
      <ul className="rows">
        {items.map((b) => {
          const id = String(b.id ?? b.iban)
          return (
            <li key={id}><div className="row static">
              <span className="avatar">{String(b.alias || b.iban).slice(0, 1).toUpperCase()}</span>
              <span className="row-m"><b>{b.alias || b.iban}</b><small className="mono">{b.iban}</small></span>
              {can('me:transfer') && <button className="chipbtn" onClick={() => openTransfer({ to: b.iban })}>Enviar</button>}
              {can('me:transfer') && (sure === id
                ? <><button className="chipbtn danger" onClick={() => del(id)}>Borrar</button><button className="chipbtn" onClick={() => setSure('')}>No</button></>
                : <button className="icon-btn" aria-label={'Borrar ' + (b.alias || b.iban)} onClick={() => setSure(id)}><Icon n="trash" size={16} /></button>)}
            </div></li>
          )
        })}
      </ul>
    </>
  )
}
