'use client'
import { useState } from 'react'
import { useRes, api, newKey } from '../../lib/client'
import { list, pick, eur, fmtDate } from '../../lib/shape'
import { useApp, Badge, Skel, ErrorBox, Empty, Icon, Modal, Spinner, Tabs, KV } from './ui'

const isOff = (st) => /susp|block|bloq|cancel|expir|caduc/i.test(st || '')

export default function Cards() {
  const [tab, setTab] = useState('cards')
  return (
    <section className="stack">
      <Tabs value={tab} onChange={setTab} items={[['cards', 'Mis tarjetas'], ['shop', 'Tienda de diseños'], ['mine', 'Mis diseños']]} />
      {tab === 'cards' && <MyCards />}
      {tab === 'shop' && <Shop />}
      {tab === 'mine' && <Owned />}
    </section>
  )
}

function MyCards() {
  const { iban, tick, bump, toast, can } = useApp()
  const r = useRes(iban ? `accounts/${iban}/cards` : null, tick)
  const cards = list(r.data, 'tarjetas')
  const [paint, setPaint] = useState(null), [busy, setBusy] = useState('')
  const toggle = async (c) => {
    const ref = String(c.ref), next = isOff(c.estado) ? 'active' : 'suspended'
    setBusy(ref)
    try { await api('cards/' + encodeURIComponent(ref), { method: 'POST', body: { estado: next } }); toast(next === 'suspended' ? 'Tarjeta suspendida' : 'Tarjeta reactivada'); bump() } catch (e) { toast(e.message) } finally { setBusy('') }
  }
  return (
    <>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {!r.loading && !r.error && !cards.length && <Empty icon="card" title="Sin tarjetas" text="Esta cuenta no tiene tarjetas asociadas." />}
      <div className="cards-grid">
        {cards.map((c, i) => {
          const off = isOff(c.estado), ref = String(c.ref ?? i)
          return (
            <div key={ref} className="stack" style={{ gap: 8 }}>
              <div className={'plastic ' + (off ? 'off' : '')}>
                <span className="plastic-top"><b>La Placeta</b><Badge s={c.estado} /></span>
                <span className="plastic-num mono">••••&nbsp;••••&nbsp;••••&nbsp;{c.ultimos4 || '••••'}</span>
                <span className="plastic-bot">
                  <span><small>Tipo</small><b>{pick(c, ['tipo'], 'Tarjeta')}</b></span>
                  {c.diseno && <span><small>Diseño</small><b>{c.diseno}</b></span>}
                </span>
              </div>
              {can('me:seguridad') && (
                <div className="sheet-f" style={{ justifyContent: 'flex-start', margin: 0 }}>
                  <button className={'chipbtn' + (off ? '' : ' danger')} disabled={busy === ref} onClick={() => toggle(c)}>{busy === ref ? <Spinner /> : <><Icon n="lock" size={14} />{off ? 'Reactivar' : 'Suspender'}</>}</button>
                  <button className="chipbtn" onClick={() => setPaint(c)}><Icon n="gift" size={14} />Diseño</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {paint && <PaintModal card={paint} iban={iban} onClose={() => setPaint(null)} onDone={() => { setPaint(null); toast('Diseño actualizado'); bump() }} />}
    </>
  )
}

function PaintModal({ card, iban, onClose, onDone }) {
  const { tick } = useApp()
  const r = useRes('designs/comprados', tick)
  const mine = list(r.data, 'disenos').filter((d) => !d.cuenta_iban || d.cuenta_iban === iban)
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const apply = async (codigo) => { setBusy(true); setErr(null); try { await api('cards/' + encodeURIComponent(card.ref) + '/diseno', { method: 'POST', body: { codigo } }); onDone() } catch (e) { setErr(e); setBusy(false) } }
  return (
    <Modal title={'Diseño de la tarjeta •••• ' + (card.ultimos4 || '')} onClose={onClose}>
      <ErrorBox error={r.error} />
      {r.loading && <Skel n={2} />}
      {r.data && !mine.length && <Empty icon="gift" title="No tienes diseños para esta cuenta" text="Compra uno en la tienda de diseños y vuelve aquí." />}
      <ul className="rows">
        {mine.map((d) => (
          <li key={d.codigo}><div className="row static"><span className="dot in"><Icon n="gift" size={18} /></span>
            <span className="row-m"><b>{d.nombre}</b><small>{d.codigo} · {d.rareza}</small></span>
            <button className="chipbtn" disabled={busy} onClick={() => apply(d.codigo)}>Aplicar</button></div></li>
        ))}
      </ul>
      <ErrorBox error={err} />
      <div className="sheet-f">{card.diseno && <button className="btn" disabled={busy} onClick={() => apply(null)}>Quitar diseño</button>}<button className="btn primary" onClick={onClose}>Cerrar</button></div>
    </Modal>
  )
}

const Thumb = ({ d }) => <div className="dimg" style={d.imagen_url ? { backgroundImage: `url("${String(d.imagen_url).replace(/"/g, '%22')}")` } : undefined} role="img" aria-label={d.nombre}>{!d.imagen_url && <Icon n="gift" size={28} />}</div>

function Shop() {
  const { tick } = useApp()
  const r = useRes('designs', tick)
  const items = list(r.data, 'disenos')
  const [buy, setBuy] = useState(null)
  return (
    <>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {r.data && !items.length && <Empty icon="gift" title="Sin diseños disponibles" text="Tu entidad no tiene diseños a la venta ahora mismo." />}
      <div className="dgrid">
        {items.map((d) => (
          <article key={d.codigo} className="dcard">
            <Thumb d={d} />
            <div className="dbody">
              <h3>{d.nombre}</h3>
              <small className="muted">{[d.nivel, d.rareza].filter(Boolean).join(' · ')}</small>
              {d.descripcion && <p className="muted s" style={{ margin: 0 }}>{d.descripcion}</p>}
              <div className="dact">
                <b>{eur(d.precio)}</b>
                {d.ya_adquirido ? <Badge s="active">Adquirido</Badge> : d.stock_disponible === 0 ? <Badge s="expired">Agotado</Badge> : <button className="chipbtn" onClick={() => setBuy(d)}>Comprar</button>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {buy && <BuyModal design={buy} onClose={() => setBuy(null)} />}
    </>
  )
}

function BuyModal({ design: d, onClose }) {
  const { accounts, iban, bumpAll, toast, can } = useApp()
  const [from, setFrom] = useState(iban || accounts[0]?.iban), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [key, setKey] = useState(newKey)
  const a = accounts.find((x) => x.iban === from)
  const short = a && Number(d.precio) > a.available
  const go = async () => {
    setBusy(true); setErr(null)
    try { await api('designs/' + encodeURIComponent(d.codigo) + '/buy', { method: 'POST', body: { iban: from }, idem: key }); toast('Diseño comprado'); bumpAll(); onClose() }
    catch (e) { if (e.definitive) setKey(newKey()); setErr(e); setBusy(false) }
  }
  return (
    <Modal title={'Comprar ' + d.nombre} onClose={onClose}>
      <Thumb d={d} />
      <KV rows={[['Precio', eur(d.precio)], ['Código', d.codigo], ...(d.licencia ? [['Licencia', d.licencia]] : []), ...(d.stock_disponible !== undefined ? [['Stock', d.stock_disponible]] : [])]} />
      <label>Pagar con
        <select value={from} onChange={(e) => setFrom(e.target.value)}>{accounts.map((x) => <option key={x.iban} value={x.iban}>{x.name} · {x.iban} · {eur(x.available, x.currency)}</option>)}</select>
      </label>
      {short && <p className="hint">Saldo insuficiente en esa cuenta.</p>}
      <ErrorBox error={err} />
      {!can('me:transfer') && <ErrorBox error={{ message: 'Tu sesión no tiene permiso para pagar.' }} />}
      <div className="sheet-f"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={go} disabled={busy || short || !can('me:transfer')}>{busy ? <Spinner /> : 'Pagar ' + eur(d.precio)}</button></div>
    </Modal>
  )
}

function Owned() {
  const { tick } = useApp()
  const r = useRes('designs/comprados', tick)
  const items = list(r.data, 'disenos')
  return (
    <>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={3} />}
      {r.data && !items.length && <Empty icon="gift" title="Aún no has comprado diseños" text="Personaliza tus tarjetas desde la tienda." />}
      <div className="dgrid">
        {items.map((d) => (
          <article key={d.codigo + (d.transaccion || '')} className="dcard">
            <Thumb d={d} />
            <div className="dbody">
              <h3>{d.nombre}</h3>
              <small className="muted">{[d.nivel, d.rareza].filter(Boolean).join(' · ')}</small>
              <small className="muted">Comprado {fmtDate(d.comprado)} · <span className="mono">{d.cuenta_iban}</span></small>
              <small>{d.tarjetas_con_diseno ? `En ${d.tarjetas_con_diseno} ${d.tarjetas_con_diseno === 1 ? 'tarjeta' : 'tarjetas'}` : 'Sin aplicar a ninguna tarjeta'}</small>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
