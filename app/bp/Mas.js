'use client'
import { useState } from 'react'
import { api, useRes, store } from '../../lib/client'
import { play } from '../../lib/sfx'
import { kindOf, isAdminRole } from '../../lib/kinds'
import { list, sortTx, txTitle, txDate, pick, eur, fmtDate, fmtDateTime, isRead } from '../../lib/shape'
import { useApp, Icon, Skeleton, ErrBox, Empty, Spin, Sheet } from './kit'
import Detalle from './Detalle'
import Empresa from './Empresa'

const OPCIONES = [
  { k: 'recibos', label: 'Recibos fiscales', icon: 'receipt', text: 'Consulta tus recibos y su detalle.' },
  { k: 'avisos', label: 'Avisos', icon: 'bell', text: 'Ingresos y cargos de tus cuentas.' },
  { k: 'seguridad', label: 'Seguridad', icon: 'lock', text: 'Sesiones abiertas y permisos.' },
  { k: 'ajustes', label: 'Ajustes', icon: 'sun', text: 'Tema, sonidos y privacidad.' },
]

export default function Mas({ sub }) {
  const { name, unread, cur } = useApp()
  const kind = cur ? kindOf(cur.raw) : 'personal'
  const ent = (kind === 'empresa' || kind === 'institucional') && isAdminRole(cur?.role)
  const OPS_ = ent ? [{ k: 'empresa', label: kind === 'institucional' ? 'Entidad' : 'Empresa', icon: 'building', text: 'Organigrama, personas y ficha.' }, ...OPCIONES] : OPCIONES
  if (!sub) {
    return (
      <>
        <div className="page-head"><h1>Más</h1></div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          <span className="avatar-b" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>{String(name).slice(0, 1).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{name}</b><span className="small muted">Cliente de La Placeta</span></div>
        </div>
        <div className="list" style={{ marginTop: 16 }}>
          {OPS_.map((o) => (
            <a key={o.k} href={'#/mas/' + o.k} className="item" onClick={(e) => { e.preventDefault(); location.hash = '#/mas/' + o.k }}>
              <span className="i-ico"><Icon n={o.icon} size={18} /></span>
              <span className="i-main"><span className="i-title" style={{ display: 'block' }}>{o.label}</span><span className="i-sub">{o.text}</span></span>
              {o.k === 'avisos' && unread > 0 && <span className="badge bad">{unread}</span>}
              <Icon n="chev" size={18} />
            </a>
          ))}
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          <a href="/api/auth/logout" className="item"><span className="i-ico"><Icon n="logout" size={18} /></span><span className="i-main"><span className="i-title" style={{ display: 'block' }}>Salir</span></span></a>
        </div>
      </>
    )
  }
  const titles = { empresa: kind === 'institucional' ? 'Entidad' : 'Empresa', recibos: 'Recibos fiscales', avisos: 'Avisos', seguridad: 'Seguridad', ajustes: 'Ajustes' }
  const back = (
    <div className="page-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="round-btn" aria-label="Volver" onClick={() => { location.hash = '#/mas' }}><span style={{ display: 'grid', transform: 'rotate(180deg)' }}><Icon n="chev" size={18} /></span></button>
        <h1>{titles[sub] || 'Más'}</h1>
      </div>
    </div>
  )
  return (
    <>
      {back}
      {sub === 'empresa' && ent && <Empresa />}
      {sub === 'recibos' && <Recibos />}
      {sub === 'avisos' && <Avisos />}
      {sub === 'seguridad' && <Seguridad />}
      {sub === 'ajustes' && <Ajustes />}
    </>
  )
}

function Recibos() {
  const { iban, tick } = useApp()
  const r = useRes(iban ? `accounts/${iban}/receipts` : null, tick)
  const [open, setOpen] = useState(null)
  const items = sortTx(list(r.data, 'recibos'))
  return (
    <>
      <ErrBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skeleton n={3} />}
      {r.data && !items.length && <Empty icon="receipt" title="Sin recibos" text="Los recibos fiscales de tus operaciones aparecerán aquí." />}
      {!!items.length && (
        <div className="list">
          {items.map((t, i) => {
            const amt = pick(t, ['importe', 'total', 'amount'])
            return (
              <button key={i} className="item" onClick={() => setOpen({ kind: 'cuenta', raw: t })}>
                <span className="i-ico"><Icon n="receipt" size={18} /></span>
                <span className="i-main">
                  <span className="i-title" style={{ display: 'block' }}>{pick(t, ['numero', 'referencia', 'codigo'], txTitle(t))}</span>
                  <span className="i-sub">{fmtDate(txDate(t))}</span>
                </span>
                {amt !== undefined && <span className="i-amt">{eur(amt)}</span>}
              </button>
            )
          })}
        </div>
      )}
      {open && <Detalle data={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Avisos() {
  const { tick, refreshAll, toast, setUnread } = useApp()
  const [onlyNew, setOnlyNew] = useState(false), [busy, setBusy] = useState(false)
  const r = useRes(`notifications?limite=100${onlyNew ? '&solo_nuevas=1' : ''}`, tick)
  const items = list(r.data, 'notificaciones')
  const fresh = items.filter((n) => !isRead(n) && n.id !== undefined)
  const markAll = async () => {
    setBusy(true)
    try {
      await api('notifications/read', { method: 'POST', body: { ids: fresh.map((n) => n.id) } })
      toast('Avisos marcados como leídos'); setUnread(0); refreshAll()
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="seg" style={{ gridAutoColumns: 'auto', display: 'inline-grid' }}>
          <button className={!onlyNew ? 'on' : ''} onClick={() => setOnlyNew(false)}>Todos</button>
          <button className={onlyNew ? 'on' : ''} onClick={() => setOnlyNew(true)}>Sin leer</button>
        </div>
        <button className="btn sm" onClick={markAll} disabled={busy || !fresh.length}>{busy ? <Spin /> : `Marcar leídos (${fresh.length})`}</button>
      </div>
      <ErrBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skeleton n={3} />}
      {r.data && !items.length && <Empty icon="bell" title={onlyNew ? 'Todo al día' : 'Sin avisos'} text="Aquí verás los ingresos y cargos de tus cuentas." />}
      {!!items.length && (
        <div className="list">
          {items.map((n, i) => {
            const read = isRead(n)
            // Sin importe en el aviso: el sentido se deduce de su texto (cargo = sale dinero).
            const out = /cargo|salid|debit|retir|pago|envi/i.test(txTitle(n) + ' ' + String(pick(n, ['tipo', 'sentido', 'direccion'], '')))
            const amt = out ? -1 : 1
            return (
              <div key={n.id ?? i} className="item" style={{ alignItems: 'flex-start' }}>
                <span className={'i-ico ' + (amt >= 0 ? 'in' : 'out')} style={{ opacity: read ? .55 : 1 }}><Icon n={amt >= 0 ? 'down' : 'up'} size={18} /></span>
                <span className="i-main" style={{ opacity: read ? .6 : 1 }}>
                  <span className="i-title" style={{ display: 'block', whiteSpace: 'normal' }}>{txTitle(n)}</span>
                  <span className="i-sub">{fmtDateTime(txDate(n))}{!read && <span className="badge bad" style={{ marginLeft: 8 }}>Nuevo</span>}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Seguridad() {
  const { info, tick, bump, toast, can, name } = useApp()
  const r = useRes('sessions', tick)
  const items = list(r.data, 'sesiones').filter((s) => !s.revocada)
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false)
  const PERM = { 'me:read': 'Consultar cuentas', 'me:transfer': 'Mover dinero', 'me:contratar': 'Abrir productos', 'me:seguridad': 'Gestionar seguridad' }
  const cerrar = async () => {
    setBusy(true)
    try { const d = await api('sessions', { method: 'DELETE' }); toast(`Sesiones cerradas: ${d?.cerradas ?? 0}`); setConfirm(false); bump() }
    catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const permisos = Array.isArray(info?.permisos) ? info.permisos : Object.keys(PERM)
  return (
    <>
      <section className="card">
        <h3>Tus permisos</h3>
        <p className="muted small" style={{ marginTop: 4 }}>Lo que puedes hacer en la app con tu acceso actual.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {Object.entries(PERM).map(([k, l]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
              <span>{l}</span>
              <span className={'badge ' + (permisos.includes(k) ? 'ok' : 'mut')}>{permisos.includes(k) ? 'Permitido' : 'No'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Sesiones abiertas</h3>
        <ErrBox error={r.error} onRetry={r.reload} />
        {r.loading && !r.data && <Skeleton n={2} />}
        {!!items.length && (
          <div className="list" style={{ marginTop: 12, boxShadow: 'none' }}>
            {items.map((s, i) => (
              <div key={s.id ?? i} className="item">
                <span className="i-ico"><Icon n="shield" size={18} /></span>
                <span className="i-main"><span className="i-title" style={{ display: 'block' }}>{s.cliente || s.dispositivo || 'Sesión en la app'}</span><span className="i-sub">Desde {fmtDateTime(s.creada || s.inicio || s.fecha)}</span></span>
              </div>
            ))}
          </div>
        )}
        {!confirm
          ? <button className="btn danger" style={{ marginTop: 14 }} onClick={() => setConfirm(true)} disabled={!can('me:seguridad') || !items.length}>Cerrar las demás sesiones</button>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={() => setConfirm(false)}>No</button>
              <button className="btn danger" onClick={cerrar} disabled={busy}>{busy ? <Spin /> : 'Sí, cerrarlas'}</button>
            </div>
          )}
      </section>
    </>
  )
}

function Ajustes() {
  const { theme, setTheme, hideAmounts, setHideAmounts } = useApp()
  const [snd, setSnd] = useState(() => store.get('pz:sound', true)), [hap, setHap] = useState(() => store.get('pz:haptic', true))
  const tog = (k, v, set) => { store.set(k, v); set(v); if (v) setTimeout(() => play('ok'), 30) }
  return (
    <>
      <section className="card">
        <label className="check" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon n={snd ? 'volume' : 'mute'} size={20} />Sonidos</span>
          <input type="checkbox" checked={snd} onChange={(e) => tog('pz:sound', e.target.checked, setSnd)} aria-label="Sonidos" />
        </label>
        <label className="check" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon n="vibrate" size={20} />Vibración</span>
          <input type="checkbox" checked={hap} onChange={(e) => tog('pz:haptic', e.target.checked, setHap)} aria-label="Vibración" />
        </label>
      </section>
      <section className="card">
        <h3>Apariencia</h3>
        <p className="muted small" style={{ marginTop: 4 }}>Elige el tema que prefieras.</p>
        <div className="seg" style={{ marginTop: 14 }} role="radiogroup" aria-label="Tema">
          {[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}>{l}</button>
          ))}
        </div>
      </section>
      <section className="card">
        <label className="check" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <span>Ocultar importes</span>
          <input type="checkbox" checked={hideAmounts} onChange={(e) => setHideAmounts(e.target.checked)} aria-label="Ocultar importes" />
        </label>
        <p className="muted small" style={{ marginTop: 8 }}>Útil si alguien puede ver tu pantalla. Se muestran al pasar el dedo o el ratón.</p>
      </section>
    </>
  )
}
