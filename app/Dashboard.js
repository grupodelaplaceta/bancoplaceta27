'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, store } from '../lib/client'
import { account, tone, list } from '../lib/shape'
import { useInstall, useOnline, usePullToRefresh } from '../lib/pwa'
import { AppCtx, useApp, Icon, Modal, Spinner, ErrorBox } from './components/ui'
import Overview from './components/Overview'
import Movements from './components/Movements'
import Transfers from './components/Transfers'
import Cards from './components/Cards'
import Receipts from './components/Receipts'
import Plans from './components/Plans'
import Notifications from './components/Notifications'
import Security from './components/Security'
import { TransferModal, OpenAccountModal, DetailModal } from './components/Modals'

const VIEWS = {
  overview:      { slug: 'inicio',         label: 'Inicio',         icon: 'home',    C: Overview },
  movements:     { slug: 'movimientos',    label: 'Movimientos',    icon: 'list',    C: Movements },
  transfers:     { slug: 'transferencias', label: 'Transferencias', icon: 'swap',    C: Transfers },
  cards:         { slug: 'tarjetas',       label: 'Tarjetas',       icon: 'card',    C: Cards },
  receipts:      { slug: 'recibos',        label: 'Recibos',        icon: 'receipt', C: Receipts },
  plans:         { slug: 'planes',         label: 'Planes y ayudas', icon: 'gift',   C: Plans },
  notifications: { slug: 'avisos',         label: 'Avisos',         icon: 'bell',    C: Notifications },
  security:      { slug: 'seguridad',      label: 'Seguridad',      icon: 'lock',    C: Security },
}
const fromHash = () => { const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, ''); return Object.keys(VIEWS).find((k) => VIEWS[k].slug === h) || 'overview' }

export default function Dashboard({ name }) {
  const [raw, setRaw] = useState(null), [iban, setIbanS] = useState(''), [info, setInfo] = useState(null), [unread, setUnread] = useState(0)
  const [tick, setTick] = useState(0), [view, setView] = useState('overview'), [modal, setModal] = useState(null)
  const [toastMsg, setToastMsg] = useState(''), [loadErr, setLoadErr] = useState(null)
  const [hide, setHide] = useState(false), [theme, setTheme] = useState('auto')
  const [noInstall, setNoInstall] = useState(true)
  const lastSync = useRef(Date.now()), toastT = useRef(null)

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 3200) }, [])
  const setIban = useCallback((i) => { setIbanS(i); store.set('pz:iban', i) }, [])
  const accounts = (raw || []).map((a) => account(a))

  // Cuentas del usuario (las decide el banco) + datos de la sesión + avisos sin leer.
  const loadAccounts = useCallback(async (prefer) => {
    try {
      const d = await api('accounts'), l = list(d, 'cuentas')
      setRaw(l); setLoadErr(null)
      setIbanS((cur) => { const ok = (i) => l.some((a) => a.iban === i); return prefer && ok(prefer) ? prefer : ok(cur) ? cur : ok(store.get('pz:iban', '')) ? store.get('pz:iban', '') : l[0]?.iban || '' })
    } catch (e) { setLoadErr(e); setRaw((r) => r || []) }
  }, [])
  const loadUnread = useCallback(() => { api('notifications?solo_nuevas=1&limite=200').then((d) => setUnread(list(d, 'notificaciones').length)).catch(() => {}) }, [])

  useEffect(() => {
    setHide(store.get('pz:hide', false)); setTheme(store.get('pz:theme', 'auto'))
    setView(fromHash()); setNoInstall(store.get('pz:noinstall', false))
    const onHash = () => setView(fromHash())
    window.addEventListener('hashchange', onHash)
    loadAccounts(); loadUnread(); api('info').then(setInfo).catch(() => {})
    return () => window.removeEventListener('hashchange', onHash)
  }, [loadAccounts, loadUnread])

  useEffect(() => { document.documentElement.dataset.theme = theme === 'auto' ? '' : theme; store.set('pz:theme', theme) }, [theme])
  useEffect(() => { store.set('pz:hide', hide) }, [hide])

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const bumpAll = useCallback(() => { lastSync.current = Date.now(); setTick((t) => t + 1); loadAccounts(); loadUnread() }, [loadAccounts, loadUnread])

  // Al volver a la pestaña tras un rato, se refresca todo.
  const bumpRef = useRef(bumpAll); bumpRef.current = bumpAll
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && Date.now() - lastSync.current > 60000) bumpRef.current() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const go = useCallback((v) => { setView(v); setModal(null); history.replaceState(null, '', '#/' + VIEWS[v].slug); window.scrollTo({ top: 0 }) }, [])
  const afterOpen = useCallback(async (newIban) => {
    await loadAccounts(newIban); bump(); setModal(null); go('overview'); toast('Cuenta abierta')
  }, [loadAccounts, bump, go, toast])

  const inst = useInstall(), online = useOnline()
  const { pull, busy: pulling } = usePullToRefresh(bumpAll, !!modal)
  const install = async () => { if (!(await inst.prompt())) setModal({ t: 'install' }) }
  const closeModal = useCallback(() => setModal(null), [])
  const cur = accounts.find((a) => a.iban === iban)
  const can = useCallback((p) => !info || !Array.isArray(info.permisos) || info.permisos.includes(p), [info])

  const ctx = {
    name, accounts, ibans: accounts.map((a) => a.iban), iban, setIban, info, can, unread, tick, bump, bumpAll, toast, go, afterOpen,
    openTransfer: (preset) => setModal({ t: 'transfer', preset }),
    openAccount: () => setModal({ t: 'open' }),
    openDetail: (title, item, opts = {}) => setModal({ t: 'detail', title, item, ...opts }),
  }

  const nav = Object.entries(VIEWS)
  const mobileMain = ['overview', 'movements', 'transfers', 'cards']
  const needsAccount = !accounts.length && !['notifications', 'security'].includes(view)
  const V = VIEWS[view] || VIEWS.overview

  if (raw === null) return <div className="boot"><Spinner /></div>

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell" data-hide={hide ? '1' : '0'}>
        {(pull > 0 || pulling) && <div className="ptr" style={{ transform: `translate(-50%, ${pulling ? 14 : pull - 44}px)`, opacity: pulling ? 1 : Math.min(1, pull / 60) }} aria-hidden="true"><span className={pulling ? 'spin' : ''} style={pulling ? undefined : { display: 'inline-block', transform: `rotate(${pull * 4}deg)` }}><Icon n="refresh" size={20} /></span></div>}
        <aside className="rail">
          <div className="brand"><span className="logo sm">P</span>La Placeta</div>
          <nav aria-label="Principal">
            {nav.map(([k, v]) => <button key={k} className={'nav' + (view === k ? ' on' : '')} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}><Icon n={v.icon} size={20} />{v.label}{k === 'notifications' && unread > 0 && <span className="nav-n">{unread}</span>}</button>)}
          </nav>
          <div className="rail-f">
            <button className="nav" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><Icon n={theme === 'dark' ? 'moon' : 'sun'} size={20} />Tema: {theme === 'auto' ? 'automático' : theme === 'dark' ? 'oscuro' : 'claro'}</button>
            <div className="who"><span className="avatar">{String(name).slice(0, 1).toUpperCase()}</span><span className="who-n">{name}</span><a className="icon-btn" href="/api/auth/logout" aria-label="Salir" title="Salir"><Icon n="logout" size={18} /></a></div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1>{V.label}</h1>
            <div className="top-a">
              {!!accounts.length && (
                <label className={'switch tone-' + tone(cur)}>
                  <span className="sr">Cuenta activa</span>
                  <i className="swatch" aria-hidden="true" />
                  <select value={iban} onChange={(e) => setIban(e.target.value)}>
                    {accounts.map((a) => <option key={a.iban} value={a.iban}>{a.name} · {a.iban}</option>)}
                  </select>
                  <Icon n="chev" size={16} />
                </label>
              )}
              <button className="icon-btn round" onClick={() => setHide(!hide)} aria-pressed={hide} aria-label={hide ? 'Mostrar saldos' : 'Ocultar saldos'} title={hide ? 'Mostrar saldos' : 'Ocultar saldos'}><Icon n={hide ? 'eyeoff' : 'eye'} size={19} /></button>
              <button className="icon-btn round" onClick={bumpAll} aria-label="Actualizar" title="Actualizar"><Icon n="refresh" size={19} /></button>
            </div>
          </header>

          {!online && <div className="offline" role="status"><Icon n="alert" size={16} />Sin conexión. Los datos mostrados pueden estar desactualizados y no podrás enviar dinero.</div>}
          {!inst.standalone && !noInstall && (
            <div className="install">
              <span className="install-i"><Icon n="download" size={20} /></span>
              <span><b>Instala la app</b><small>Ábrela a pantalla completa desde tu inicio.</small></span>
              <button className="btn primary" onClick={install}>{inst.can ? 'Instalar' : 'Cómo'}</button>
              <button className="icon-btn" aria-label="No volver a mostrar" onClick={() => { setNoInstall(true); store.set('pz:noinstall', true) }}><Icon n="x" size={18} /></button>
            </div>
          )}
          <main id="content">
            <ErrorBox error={loadErr} />
            {needsAccount ? <Onboarding /> : <V.C key={view} />}
          </main>
        </div>

        <nav className="tabbar" aria-label="Principal">
          {mobileMain.map((k) => <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}><Icon n={VIEWS[k].icon} size={22} /><span>{VIEWS[k].label.replace('Transferencias', 'Enviar')}</span></button>)}
          <button className={!mobileMain.includes(view) ? 'on' : ''} onClick={() => setModal({ t: 'more' })}><Icon n="dots" size={22} /><span>Más</span>{unread > 0 && <span className="nav-n">{unread}</span>}</button>
        </nav>

        {modal?.t === 'transfer' && <TransferModal preset={modal.preset} onClose={closeModal} />}
        {modal?.t === 'open' && <OpenAccountModal onClose={closeModal} />}
        {modal?.t === 'detail' && <DetailModal title={modal.title} item={modal.item} onClose={closeModal} />}
        {modal?.t === 'more' && (
          <Modal title="Más" onClose={closeModal}>
            <ul className="rows">
              {nav.filter(([k]) => !mobileMain.includes(k)).map(([k, v]) => <li key={k}><button className="row" onClick={() => go(k)}><span className="dot in"><Icon n={v.icon} size={18} /></span><span className="row-m"><b>{v.label}</b>{k === 'notifications' && unread > 0 && <small>{unread} sin leer</small>}</span></button></li>)}
              {!inst.standalone && <li><button className="row" onClick={install}><span className="dot in"><Icon n="download" size={18} /></span><span className="row-m"><b>Instalar app</b><small>Pantalla completa, sin barra del navegador</small></span></button></li>}
              <li><button className="row" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><span className="dot in"><Icon n="moon" size={18} /></span><span className="row-m"><b>Tema</b><small>{theme === 'auto' ? 'Automático' : theme === 'dark' ? 'Oscuro' : 'Claro'}</small></span></button></li>
              <li><a className="row" href="/api/auth/logout"><span className="dot out"><Icon n="logout" size={18} /></span><span className="row-m"><b>Salir</b><small>{name}</small></span></a></li>
            </ul>
          </Modal>
        )}
        {modal?.t === 'install' && (
          <Modal title="Instalar La Placeta" onClose={closeModal}>
            {inst.ios ? (
              <ol className="howto"><li>Abre esta página en <b>Safari</b>.</li><li>Pulsa <b>Compartir</b> <Icon n="up" size={16} /> en la barra inferior.</li><li>Elige <b>Añadir a pantalla de inicio</b>.</li><li>Pulsa <b>Añadir</b>. Se abrirá como una app.</li></ol>
            ) : (
              <ol className="howto"><li>Abre el menú del navegador (<b>⋮</b> o <b>Compartir</b>).</li><li>Pulsa <b>Instalar aplicación</b> o <b>Añadir a la pantalla de inicio</b>.</li><li>Confirma. Se abrirá a pantalla completa.</li></ol>
            )}
            <div className="sheet-f"><button className="btn primary" onClick={closeModal}>Entendido</button></div>
          </Modal>
        )}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  )
}

function Onboarding() {
  const { openAccount, can } = useApp()
  return (
    <section className="panel onboard">
      <div className="onboard-i"><Icon n="card" size={30} /></div>
      <h2>Aún no tienes cuentas en esta entidad</h2>
      <p className="muted">Abre tu primera cuenta personal en un paso. Después podrás enviar dinero, pedir tarjetas y mucho más.</p>
      {can('me:contratar') ? <button className="btn primary big" onClick={openAccount}><Icon n="plus" size={18} />Abrir mi primera cuenta</button> : <ErrorBox error={{ message: 'Tu sesión no puede contratar productos.' }} />}
    </section>
  )
}
