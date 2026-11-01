'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { request, api, store } from '../lib/client'
import { account, isJunior, tone } from '../lib/shape'
import { useInstall, useOnline, usePullToRefresh } from '../lib/pwa'
import { AppCtx, useApp, Icon, Modal, Spinner, ErrorBox } from './components/ui'
import Overview from './components/Overview'
import Movements from './components/Movements'
import Transfers from './components/Transfers'
import Cards from './components/Cards'
import Receipts from './components/Receipts'
import Membership from './components/Membership'
import Products from './components/Products'
import { TransferModal, OpenAccountModal, ManageModal, DetailModal } from './components/Modals'

const VIEWS = {
  overview:   { slug: 'inicio',         label: 'Inicio',         icon: 'home',    C: Overview },
  movements:  { slug: 'movimientos',    label: 'Movimientos',    icon: 'list',    C: Movements },
  transfers:  { slug: 'transferencias', label: 'Transferencias', icon: 'swap',    C: Transfers },
  cards:      { slug: 'tarjetas',       label: 'Tarjetas',       icon: 'card',    C: Cards },
  receipts:   { slug: 'recibos',        label: 'Recibos',        icon: 'receipt', C: Receipts },
  membership: { slug: 'membresia',      label: 'Membresía',      icon: 'crown',   C: Membership },
  products:   { slug: 'productos',      label: 'Productos',      icon: 'bag',     C: Products },
}
const fromHash = () => { const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, ''); return Object.keys(VIEWS).find((k) => VIEWS[k].slug === h) || 'overview' }

export default function Dashboard({ name }) {
  const [ibans, setIbans] = useState(null), [iban, setIbanS] = useState(''), [accs, setAccs] = useState({})
  const [tick, setTick] = useState(0), [view, setView] = useState('overview'), [modal, setModal] = useState(null)
  const [toastMsg, setToastMsg] = useState(''), [loadErr, setLoadErr] = useState(null)
  const [hide, setHide] = useState(false), [theme, setTheme] = useState('auto')
  const [benef, setBenefS] = useState([]), [recent, setRecentS] = useState([])
  const [noInstall, setNoInstall] = useState(true)
  const asked = useRef(new Set()), lastSync = useRef(Date.now()), toastT = useRef(null)

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 3200) }, [])
  const setIban = useCallback((i) => { setIbanS(i); store.set('pz:iban', i) }, [])

  // Cuenta (saldo y datos) de cada IBAN vinculado.
  const loadAcc = useCallback(async (i) => {
    setAccs((a) => ({ ...a, [i]: { ...a[i], loading: true, error: null } }))
    try { const d = await api('accounts/' + encodeURIComponent(i)); setAccs((a) => ({ ...a, [i]: { data: d, loading: false, error: null } })) }
    catch (e) { setAccs((a) => ({ ...a, [i]: { data: a[i]?.data, loading: false, error: e } })) }
  }, [])

  // Arranque: preferencias locales + cuentas vinculadas (en servidor) + migración de las antiguas (localStorage).
  useEffect(() => {
    setHide(store.get('pz:hide', false)); setTheme(store.get('pz:theme', 'auto'))
    setBenefS(store.get('pz:benef', [])); setRecentS(store.get('pz:recent', []))
    setView(fromHash()); setNoInstall(store.get('pz:noinstall', false))
    const onHash = () => setView(fromHash())
    window.addEventListener('hashchange', onHash)
    ;(async () => {
      try {
        let list = (await request('/api/me')).ibans || []
        const legacy = store.get('ibans', null)
        if (Array.isArray(legacy) && legacy.length) {
          for (const v of legacy) { try { list = (await request('/api/me', { method: 'POST', body: { iban: v } })).ibans } catch {} }
          store.del('ibans')
        }
        setIbans(list)
        const saved = store.get('pz:iban', '')
        setIbanS(list.includes(saved) ? saved : list[0] || '')
      } catch (e) { setLoadErr(e); setIbans([]) }
    })()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => { (ibans || []).forEach((i) => { if (!asked.current.has(i)) { asked.current.add(i); loadAcc(i) } }) }, [ibans, loadAcc])

  useEffect(() => { document.documentElement.dataset.theme = theme === 'auto' ? '' : theme; store.set('pz:theme', theme) }, [theme])
  useEffect(() => { store.set('pz:hide', hide) }, [hide])

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const bumpAll = useCallback(() => { lastSync.current = Date.now(); setTick((t) => t + 1); (ibans || []).forEach(loadAcc) }, [ibans, loadAcc])

  // Al volver a la pestaña tras un rato, se refresca todo.
  const bumpRef = useRef(bumpAll); bumpRef.current = bumpAll
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && Date.now() - lastSync.current > 60000) bumpRef.current() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const go = useCallback((v) => { setView(v); setModal(null); history.replaceState(null, '', '#/' + VIEWS[v].slug); window.scrollTo({ top: 0 }) }, [])

  const link = useCallback(async (v) => {
    const r = await request('/api/me', { method: 'POST', body: { iban: v } })
    setIbans(r.ibans); if (r.linked) { setIban(r.linked); toast('Cuenta vinculada') }
  }, [setIban, toast])
  const unlink = useCallback(async (v) => {
    try {
      const r = await request('/api/me?iban=' + encodeURIComponent(v), { method: 'DELETE' })
      setIbans(r.ibans); if (iban === v) setIban(r.ibans[0] || ''); toast('Cuenta desvinculada')
    } catch (e) { toast(e.message) }
  }, [iban, setIban, toast])
  const afterOpen = useCallback(async (newIban) => {
    const r = await request('/api/me') // el servidor ya ha vinculado la cuenta nueva
    setIbans(r.ibans); if (newIban) setIban(newIban)
    setModal(null); go('overview'); toast(newIban ? 'Cuenta ' + newIban + ' abierta' : 'Cuenta abierta')
  }, [go, setIban, toast])

  const setBenef = useCallback((b) => { setBenefS(b); store.set('pz:benef', b) }, [])
  const pushRecent = useCallback((x) => setRecentS((r) => { const n = [x, ...r.filter((y) => y.ref !== x.ref)].slice(0, 30); store.set('pz:recent', n); return n }), [])

  const inst = useInstall(), online = useOnline()
  const { pull, busy: pulling } = usePullToRefresh(bumpAll, !!modal)
  const install = async () => { if (!(await inst.prompt())) setModal({ t: 'install' }) }
  const closeModal = useCallback(() => setModal(null), [])
  const accOf = (i) => account(accs[i]?.data)
  const cur = accOf(iban)
  const junior = isJunior(cur)

  const ctx = {
    name, ibans: ibans || [], iban, setIban, accs, accOf, tick, bump, bumpAll, toast, go, link, unlink, afterOpen,
    benef, setBenef, recent, pushRecent,
    openTransfer: (preset) => setModal({ t: 'transfer', preset }), manage: () => setModal({ t: 'manage' }),
    openAccount: (product) => setModal({ t: 'open', product }),
    openDetail: (title, item, opts = {}) => setModal({ t: 'detail', title, item, ...opts }),
  }

  const nav = Object.entries(VIEWS).filter(([k]) => k !== 'membership' || junior)
  const mobileMain = ['overview', 'movements', 'transfers', 'cards']
  const refreshing = (ibans || []).some((i) => accs[i]?.loading)
  const needsAccount = !iban && view !== 'products'
  const V = VIEWS[view] || VIEWS.overview

  if (ibans === null) return <div className="boot"><Spinner /></div>

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell" data-hide={hide ? '1' : '0'}>
        {(pull > 0 || pulling) && <div className="ptr" style={{ transform: `translate(-50%, ${pulling ? 14 : pull - 44}px)`, opacity: pulling ? 1 : Math.min(1, pull / 60) }} aria-hidden="true"><span className={pulling ? 'spin' : ''} style={pulling ? undefined : { display: 'inline-block', transform: `rotate(${pull * 4}deg)` }}><Icon n="refresh" size={20} /></span></div>}
        <aside className="rail">
          <div className="brand"><span className="logo sm">P</span>La Placeta</div>
          <nav aria-label="Principal">
            {nav.map(([k, v]) => <button key={k} className={'nav' + (view === k ? ' on' : '')} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}><Icon n={v.icon} size={20} />{v.label}</button>)}
          </nav>
          <div className="rail-f">
            <button className="nav" onClick={ctx.manage}><Icon n="link" size={20} />Cuentas vinculadas</button>
            <button className="nav" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><Icon n={theme === 'dark' ? 'moon' : 'sun'} size={20} />Tema: {theme === 'auto' ? 'automático' : theme === 'dark' ? 'oscuro' : 'claro'}</button>
            <div className="who"><span className="avatar">{String(name).slice(0, 1).toUpperCase()}</span><span className="who-n">{name}</span><a className="icon-btn" href="/api/auth/logout" aria-label="Salir" title="Salir"><Icon n="logout" size={18} /></a></div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1>{V.label}</h1>
            <div className="top-a">
              {!!ibans.length && (
                <label className={'switch tone-' + tone(cur)}>
                  <span className="sr">Cuenta activa</span>
                  <i className="swatch" aria-hidden="true" />
                  <select value={iban} onChange={(e) => setIban(e.target.value)}>
                    {ibans.map((i) => { const a = accOf(i); return <option key={i} value={i}>{a.iban ? a.type + ' · ' : ''}{i}</option> })}
                  </select>
                  <Icon n="chev" size={16} />
                </label>
              )}
              <button className="icon-btn round" onClick={() => setHide(!hide)} aria-pressed={hide} aria-label={hide ? 'Mostrar saldos' : 'Ocultar saldos'} title={hide ? 'Mostrar saldos' : 'Ocultar saldos'}><Icon n={hide ? 'eyeoff' : 'eye'} size={19} /></button>
              <button className={'icon-btn round' + (refreshing ? ' spinning' : '')} onClick={bumpAll} aria-label="Actualizar" title="Actualizar"><Icon n="refresh" size={19} /></button>
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
          <button className={!mobileMain.includes(view) ? 'on' : ''} onClick={() => setModal({ t: 'more' })}><Icon n="dots" size={22} /><span>Más</span></button>
        </nav>

        {modal?.t === 'transfer' && <TransferModal preset={modal.preset} onClose={closeModal} />}
        {modal?.t === 'open' && <OpenAccountModal product={modal.product} onClose={closeModal} />}
        {modal?.t === 'manage' && <ManageModal onClose={closeModal} />}
        {modal?.t === 'detail' && <DetailModal title={modal.title} item={modal.item} print={modal.print} onClose={closeModal} />}
        {modal?.t === 'more' && (
          <Modal title="Más" onClose={closeModal}>
            <ul className="rows">
              {nav.filter(([k]) => !mobileMain.includes(k)).map(([k, v]) => <li key={k}><button className="row" onClick={() => go(k)}><span className="dot in"><Icon n={v.icon} size={18} /></span><span className="row-m"><b>{v.label}</b></span></button></li>)}
              <li><button className="row" onClick={ctx.manage}><span className="dot in"><Icon n="link" size={18} /></span><span className="row-m"><b>Cuentas vinculadas</b></span></button></li>
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
  const { link, go } = useApp()
  const [v, setV] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const add = async (e) => { e.preventDefault(); if (!v.trim()) return; setBusy(true); setErr(null); try { await link(v) } catch (x) { setErr(x); setBusy(false) } }
  return (
    <section className="panel onboard">
      <div className="onboard-i"><Icon n="card" size={30} /></div>
      <h2>Vincula tu primera cuenta</h2>
      <p className="muted">Escribe el IBAN de tu cuenta de La Placeta, por ejemplo <span className="mono">PZ-0001-0002</span>. Lo comprobamos con el banco antes de guardarlo.</p>
      <form className="inline" onSubmit={add}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="PZ-0001-0002" aria-label="IBAN" className="mono" spellCheck="false" autoFocus />
        <button className="btn primary" disabled={busy || !v.trim()}>{busy ? <Spinner /> : 'Vincular'}</button>
      </form>
      <ErrorBox error={err} />
      <p className="muted s">¿Aún no tienes cuenta? <button className="link" onClick={() => go('products')}>Abre una desde el catálogo de productos</button>.</p>
    </section>
  )
}
