// Sonidos y vibración de la app, sintetizados con WebAudio (sin archivos). Se pueden desactivar en Más → Ajustes.
let ctx = null
const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v) } catch { return d } }
export const soundOn = () => get('pz:sound', true)
export const hapticOn = () => get('pz:haptic', true)

function ac() {
  if (typeof window === 'undefined') return null
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C() }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
// Cada sonido es una lista de notas [frecuencia Hz, inicio s, duración s, volumen, forma]
const SOUNDS = {
  tap:   [[1100, 0, .035, .05, 'sine']],
  nav:   [[760, 0, .05, .06, 'sine']],
  open:  [[520, 0, .07, .06, 'sine'], [780, .05, .08, .05, 'sine']],
  ok:    [[660, 0, .11, .09, 'sine'], [880, .09, .11, .09, 'sine'], [1320, .18, .22, .08, 'sine']],
  err:   [[220, 0, .13, .1, 'triangle'], [165, .11, .2, .1, 'triangle']],
  notif: [[988, 0, .09, .08, 'sine'], [1318, .1, .16, .07, 'sine']],
  nfc:   [[1480, 0, .08, .09, 'sine'], [1976, .09, .12, .08, 'sine']],
}
const VIB = { tap: 6, nav: 8, open: 10, ok: [14, 40, 14], err: [30, 50, 30], notif: [10, 30, 10], nfc: [20, 30, 20] }

export function play(name) {
  try {
    if (hapticOn() && navigator.vibrate) navigator.vibrate(VIB[name] || 6)
    if (!soundOn()) return
    const a = ac(), notes = SOUNDS[name]
    if (!a || !notes) return
    const t0 = a.currentTime
    for (const [f, at, d, v, type] of notes) {
      const o = a.createOscillator(), g = a.createGain()
      o.type = type; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + at)
      g.gain.exponentialRampToValueAtTime(v, t0 + at + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d)
      o.connect(g); g.connect(a.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02)
    }
  } catch {}
}
