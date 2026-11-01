'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Registra el service worker (solo en producción, para no cachear nada mientras desarrollas). */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])
}

/** Estado de instalación: ya instalada, evento nativo (Android/Chrome) o instrucciones (iOS/otros). */
export function useInstall() {
  const [standalone, setStandalone] = useState(true) // true hasta comprobar: evita parpadeo del aviso
  const [ios, setIos] = useState(false)
  const ev = useRef(null), [can, setCan] = useState(false)
  useEffect(() => {
    const st = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setStandalone(st()); setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const before = (e) => { e.preventDefault(); ev.current = e; setCan(true) }
    const done = () => { ev.current = null; setCan(false); setStandalone(true) }
    window.addEventListener('beforeinstallprompt', before); window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done) }
  }, [])
  /** Devuelve true si lanzó el diálogo nativo; false si hay que mostrar instrucciones manuales. */
  const prompt = useCallback(async () => {
    if (!ev.current) return false
    ev.current.prompt(); await ev.current.userChoice.catch(() => {}); ev.current = null; setCan(false); return true
  }, [])
  return { standalone, ios, can, prompt }
}

export function useOnline() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const f = () => setOn(navigator.onLine); f()
    window.addEventListener('online', f); window.addEventListener('offline', f)
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) }
  }, [])
  return on
}

/** Deslizar hacia abajo desde arriba para actualizar (en modo app no existe el gesto nativo). */
export function usePullToRefresh(onRefresh, disabled) {
  const [pull, setPull] = useState(0), [busy, setBusy] = useState(false)
  const cb = useRef(onRefresh); cb.current = onRefresh
  const off = useRef(disabled); off.current = disabled
  useEffect(() => {
    if (!('ontouchstart' in window)) return
    let y0 = null, d = 0
    const start = (e) => { y0 = window.scrollY <= 0 && !off.current && e.touches.length === 1 ? e.touches[0].clientY : null; d = 0 }
    const move = (e) => {
      if (y0 === null) return
      d = e.touches[0].clientY - y0
      if (d > 0 && window.scrollY <= 0) setPull(Math.min(d * 0.5, 80)); else if (d <= 0) setPull(0)
    }
    const end = async () => {
      if (y0 === null) return
      const go = d * 0.5 >= 64; y0 = null; d = 0; setPull(0)
      if (go) { setBusy(true); try { await cb.current() } finally { setTimeout(() => setBusy(false), 600) } }
    }
    window.addEventListener('touchstart', start, { passive: true }); window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end)
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end) }
  }, [])
  return { pull, busy }
}
