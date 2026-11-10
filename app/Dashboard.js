'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, store } from '../lib/client'
import { play } from '../lib/sfx'
import { list, account } from '../lib/shape'
import { AppCtx, Icon, Mark, Spin, ErrBox } from './bp/kit'
import Inicio from './bp/Inicio'
import Movimientos from './bp/Movimientos'
import Tarjetas from './bp/Tarjetas'
import Mas from './bp/Mas'
import Transferir from './bp/Transferir'

const TABS = [
  { k: 'inicio', label: 'Inicio', icon: 'home', C: Inicio },
  { k: 'movimientos', label: 'Movimientos', icon: 'list', C: Movimientos },
  { k: 'transferir', label: 'Transferir', icon: 'send', main: true },
  { k: 'tarjetas', label: 'Tarjetas', icon: 'card', C: Tarjetas },
  { k: 'mas', label: 'Más', icon: 'more', C: Mas },
]
const VIEWS = Object.fromEntries(TABS.map((t) => [t.k, t]))

const fromHash = () => {
  const [h] = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '').split('/')
  return VIEWS[h] && !VIEWS[h].main ? h : 'inicio'
}
const subFromHash = () => {
  const [, s] = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '').split('/')
  return s || null
}

export default function Dashboard({ name }) {
  const [raw, setRaw] = useState(null)
  const [iban, setIbanS] = useState('')
  const [view, setView] = useState('inicio')
  const [sub, setSub] = useState(null)           // subpantalla dentro de «Más» (recibos, avisos, seguridad, ajustes)
  const [sheet, setSheet] = useState(null)       // 'transferir' | null
  const [preset, setPreset] = useState(null)
  const [unread, setUnread] = useState(0)
  const [info, setInfo] = useState(null)
  const [tick, setTick] = useState(0)
  const [loadErr, setLoadErr] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [hideAmounts, setHideAmounts] = useState(false)
  const [theme, setTheme] = useState('auto')
  const toastT = useRef(null)
  const lastSync = useRef(Date.now())

  const toast = useCallback((m) => {
    setToastMsg(m); play('ok'); clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToastMsg(''), 3000)
  }, [])

  const setIban = useCallback((i) => { setIbanS(i); store.set('pz:iban', i) }, [])

  const loadAccounts = useCallback(async (prefer) => {
    try {
      const d = await api('accounts'), l = list(d, 'cuentas')
      setRaw(l); setLoadErr(null)
      setIbanS((cur) => {
        const ok = (i) => l.some((a) => a.iban === i)
        const saved = store.get('pz:iban', '')
        if (prefer && ok(prefer)) return prefer
        if (ok(cur)) return cur
        if (ok(saved)) return saved
        return l[0]?.iban || ''
      })
    } catch (e) { setLoadErr(e); setRaw((r) => r || []) }
  }, [])

  const loadUnread = useCallback(() => {
    api('notifications?solo_nuevas=1&limite=200').then((d) => { const n = list(d, 'notificaciones').length; setUnread((p) => { if (n > p) play('notif'); return n }) }).catch(() => {})
  }, [])

  useEffect(() => {
    setHideAmounts(store.get('pz:hide', false))
    setTheme(store.get('pz:theme', 'auto'))
    setView(fromHash()); setSub(subFromHash())
    const onHash = () => { setView(fromHash()); setSub(subFromHash()) }
    window.addEventListener('hashchange', onHash)
    loadAccounts(); loadUnread()
    api('info').then(setInfo).catch(() => {})
    return () => window.removeEventListener('hashchange', onHash)
  }, [loadAccounts, loadUnread])

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'auto' ? '' : theme
    store.set('pz:theme', theme)
    try {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      window.PlacetaApp && window.PlacetaApp.setBars && window.PlacetaApp.setBars(dark)
    } catch {}
  }, [theme])

  // Sonido suave al tocar botones y enlaces (se puede quitar en Ajustes)
  useEffect(() => {
    const f = (e) => { const t = e.target.closest && e.target.closest('button, a, .item, .tab, .action, .chip'); if (t && !t.disabled) play('tap') }
    document.addEventListener('pointerdown', f, true)
    return () => document.removeEventListener('pointerdown', f, true)
  }, [])
  useEffect(() => { store.set('pz:hide', hideAmounts) }, [hideAmounts])

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const refreshAll = useCallback(() => { lastSync.current = Date.now(); setTick((t) => t + 1); loadAccounts(); loadUnread() }, [loadAccounts, loadUnread])

  // Al volver a la app tras un rato, se actualiza todo.
  const refreshRef = useRef(refreshAll); refreshRef.current = refreshAll
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && Date.now() - lastSync.current > 60000) refreshRef.current() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const go = useCallback((k, s = null) => {
    setView(k); setSub(s); setSheet(null)
    play('nav')
    history.replaceState(null, '', '#/' + k + (s ? '/' + s : ''))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openTransfer = useCallback((p = null) => { setPreset(p); setSheet('transferir') }, [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const accounts = useMemo(() => (raw || []).map((a) => account(a)), [raw])
  const cur = accounts.find((a) => a.iban === iban) || accounts[0]
  const can = useCallback((p) => !info || !Array.isArray(info.permisos) || info.permisos.includes(p), [info])

  const ctx = {
    name, accounts, cur, iban, setIban, info, can, unread, tick, bump, toast, go, hideAmounts,
    openTransfer, refreshAll, setUnread, sub, setHideAmounts, theme, setTheme,
  }

  if (raw === null) return <div className="app" style={{ display: 'grid', placeItems: 'center' }}><Spin /></div>

  const Current = VIEWS[view]?.C || Inicio

  return (
    <AppCtx.Provider value={ctx}>
      <div className={'app' + (hideAmounts ? ' hidden-amounts' : '')}>
        <aside className="side" aria-label="Menú">
          <div className="side-brand"><Mark />Banco de La Placeta</div>
          {TABS.map((t) => (
            t.main
              ? <button key={t.k} className="btn primary" style={{ marginBottom: 10 }} onClick={() => openTransfer()}><Icon n="send" size={18} />Transferir</button>
              : <a key={t.k} href={'#/' + t.k} className={'side-link' + (view === t.k ? ' on' : '')} aria-current={view === t.k ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(t.k) }}>
                  <Icon n={t.icon} size={20} />{t.label}
                  {t.k === 'mas' && unread > 0 && <span className="badge bad" style={{ marginLeft: 'auto' }}>{unread}</span>}
                </a>
          ))}
          <div className="side-foot">
            <button className="side-link" onClick={() => setHideAmounts((h) => !h)}><Icon n={hideAmounts ? 'eyeoff' : 'eye'} size={20} />{hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}</button>
            <button className="side-link" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><Icon n={theme === 'dark' ? 'moon' : 'sun'} size={20} />Tema: {theme === 'auto' ? 'automático' : theme === 'dark' ? 'oscuro' : 'claro'}</button>
            <a className="side-link" href="/api/auth/logout"><Icon n="logout" size={20} />Salir</a>
          </div>
        </aside>

        <main className="content" key={view}>
          <ErrBox error={loadErr} onRetry={() => loadAccounts()} />
          {!accounts.length && view !== 'mas' && !loadErr && (
            <div className="card" style={{ textAlign: 'center', padding: 30 }}>
              <h2>Aún no tienes cuentas</h2>
              <p className="muted small" style={{ marginTop: 6 }}>Cuando tengas una cuenta aparecerá aquí.</p>
            </div>
          )}
          <Current key={iban} sub={sub} />
        </main>

        <nav className="tabbar" aria-label="Principal">
          {TABS.map((t) => (
            t.main
              ? <button key={t.k} className="tab main" onClick={() => openTransfer()} aria-label="Transferir">
                  <span className="ico"><Icon n="send" size={22} /></span><span>{t.label}</span>
                </button>
              : <button key={t.k} className={'tab' + (view === t.k ? ' on' : '')} aria-current={view === t.k ? 'page' : undefined} onClick={() => go(t.k)}>
                  <span className="ico" style={{ position: 'relative' }}>
                    <Icon n={t.icon} size={22} />
                    {t.k === 'mas' && unread > 0 && <span className="badge bad" style={{ position: 'absolute', top: -4, right: 2, padding: '1px 6px' }}>{unread}</span>}
                  </span>
                  <span>{t.label}</span>
                </button>
          ))}
        </nav>

        {sheet === 'transferir' && <Transferir preset={preset} onClose={closeSheet} />}
        <div className="toast" role="status" aria-live="polite" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 50, pointerEvents: 'none', display: toastMsg ? 'block' : 'none' }}>
          <div style={{ maxWidth: 420, margin: '0 auto', background: 'var(--ink)', color: 'var(--bg)', padding: '14px 18px', borderRadius: 14, fontWeight: 700, textAlign: 'center' }}>{toastMsg}</div>
        </div>
      </div>
    </AppCtx.Provider>
  )
}
