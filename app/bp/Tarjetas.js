'use client'
import { useEffect, useRef, useState } from 'react'
import { play } from '../../lib/sfx'
import { api, request, useRes } from '../../lib/client'
import { list, pick } from '../../lib/shape'
import { useApp, Icon, Sheet, Skeleton, ErrBox, Empty, Spin } from './kit'

const isOff = (st) => /susp|block|bloq|cancel|expir|caduc/i.test(String(st || ''))

export default function Tarjetas() {
  const { iban, tick, bump, toast, can } = useApp()
  const r = useRes(iban ? `accounts/${iban}/cards` : null, tick)
  const cards = list(r.data, 'tarjetas')
  const [sel, setSel] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const [nfc, setNfc] = useState(null)

  const cambiar = async () => {
    const ref = String(sel.ref), next = isOff(sel.estado) ? 'active' : 'suspended'
    setBusy(true); setErr(null)
    try {
      await api('cards/' + encodeURIComponent(ref), { method: 'POST', body: { estado: next } })
      toast(next === 'suspended' ? 'Tarjeta suspendida' : 'Tarjeta reactivada')
      setSel(null); bump()
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head"><h1>Tarjetas</h1></div>
      <ErrBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skeleton n={2} />}
      {r.data && !cards.length && !r.error && (
        <Empty icon="card" title="Sin tarjetas" text="Esta cuenta todavía no tiene tarjetas asociadas." />
      )}

      {cards.map((c, i) => {
        const off = isOff(c.estado)
        const name = pick(c, ['nombre', 'tipo', 'alias', 'titular'], 'Tarjeta')
        const last = pick(c, ['ultimos4', 'ultimos_4', 'last4'], '')
        return (
          <article key={String(c.ref ?? i)} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: off ? 'var(--line)' : 'var(--navy)', color: off ? 'var(--ink)' : '#fff', padding: '20px 20px 22px', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, opacity: .95 }}>{name}</span>
                <span className={'badge ' + (off ? 'warn' : 'ok')} style={off ? {} : { background: 'rgba(255,255,255,.18)', color: '#fff' }}>{off ? 'Suspendida' : 'Activa'}</span>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 18, letterSpacing: '.12em', fontWeight: 700 }}>•••• •••• •••• {last || '••••'}</div>
                {c.caduca && <div className="tiny" style={{ opacity: .85, marginTop: 6 }}>Caduca {String(c.caduca)}</div>}
              </div>
            </div>
            {!off && (
              <div style={{ padding: '14px 16px 0' }}>
                <button className="btn primary" onClick={() => setNfc({ card: c, name, last })}><Icon n="nfc" size={20} />Pagar con NFC</button>
              </div>
            )}
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span className="small muted">{off ? 'Reactívala cuando quieras para volver a usarla.' : 'Suspéndela si la pierdes o no la necesitas.'}</span>
              <button className={'btn sm ' + (off ? 'primary' : 'danger')} disabled={!can('me:seguridad')} onClick={() => { setErr(null); setSel(c) }}>
                {off ? 'Reactivar' : 'Suspender'}
              </button>
            </div>
          </article>
        )
      })}

      {nfc && <NfcSheet iban={iban} info={nfc} onClose={() => setNfc(null)} />}

      {sel && (
        <Sheet title={isOff(sel.estado) ? '¿Reactivar tarjeta?' : '¿Suspender tarjeta?'} onClose={() => setSel(null)}>
          <p className="muted" style={{ marginTop: 4 }}>
            {isOff(sel.estado)
              ? 'La tarjeta volverá a poder usarse en cuanto la reactives.'
              : 'Mientras esté suspendida no se podrá usar para pagar. Puedes reactivarla cuando quieras.'}
          </p>
          {err && <div className="banner bad" role="alert" style={{ marginTop: 14 }}>{err.message}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <button className="btn" onClick={() => setSel(null)}>Cancelar</button>
            <button className={'btn ' + (isOff(sel.estado) ? 'primary' : 'danger')} disabled={busy} onClick={cambiar}>
              {busy ? <Spin /> : isOff(sel.estado) ? 'Reactivar' : 'Suspender'}
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

/** Pago por NFC: pide un token de un solo uso al servidor y lo emite por emulación de tarjeta (app Android). */
function NfcSheet({ iban, info, onClose }) {
  const [st, setSt] = useState('start')   // start | none | off | nohce | web | armed | done | err
  const [left, setLeft] = useState(60), [msg, setMsg] = useState('')
  const bridge = typeof window !== 'undefined' ? window.PlacetaApp : null
  const timer = useRef(null)

  const stop = () => { clearInterval(timer.current); try { bridge && bridge.nfcDisarm && bridge.nfcDisarm() } catch {} }
  useEffect(() => () => stop(), [])  // eslint-disable-line react-hooks/exhaustive-deps

  const arm = async () => {
    setMsg('')
    if (!bridge || !bridge.nfcState) { setSt('web'); return }
    const s = bridge.nfcState()
    if (s !== 'ready') { setSt(s); return }
    try {
      const r = await request('/api/nfc/token', { method: 'POST', body: { iban, ref: String(info.card.ref) } })
      bridge.nfcArm(r.token, r.ttl || 60)
      setLeft(r.ttl || 60); setSt('armed'); play('nfc')
      clearInterval(timer.current)
      timer.current = setInterval(() => setLeft((x) => { if (x <= 1) { clearInterval(timer.current); setSt('start'); try { bridge.nfcDisarm() } catch {} ; return 0 } return x - 1 }), 1000)
    } catch (e) { setMsg(e.message); setSt('err') }
  }

  useEffect(() => {
    const onRead = () => { stop(); setSt('done'); play('ok') }
    window.addEventListener('pz-nfc-read', onRead)
    return () => window.removeEventListener('pz-nfc-read', onRead)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { arm() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet title="Pagar con NFC" onClose={() => { stop(); onClose() }}>
      <p className="muted small" style={{ marginTop: 2 }}>{info.name} · •••• {info.last || '••••'}</p>
      {st === 'armed' && (
        <>
          <div className="nfc-pad"><span className="wave" /><span className="wave" /><span className="wave" /><span className="core"><Icon n="nfc" size={38} /></span></div>
          <div className="nfc-count">{left}s</div>
          <p className="muted" style={{ textAlign: 'center', marginTop: 6 }}>Desbloquea el móvil, mantén la app abierta y acércalo al terminal.</p>
          <div style={{ marginTop: 18 }}><button className="btn" onClick={() => { stop(); setSt('start') }}>Cancelar</button></div>
        </>
      )}
      {st === 'done' && (
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <span className="okmark"><Icon n="check" size={40} stroke={2.8} /></span>
          <h2>Enviado al terminal</h2>
          <p className="muted" style={{ marginTop: 6 }}>El pago se ha entregado por NFC.</p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      )}
      {(st === 'start' || st === 'err') && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          {msg && <div className="banner bad" role="alert">{msg}</div>}
          <button className="btn primary" style={{ marginTop: 14 }} onClick={arm}>{st === 'err' ? 'Reintentar' : 'Activar de nuevo'}</button>
        </div>
      )}
      {st === 'off' && <Warn text="El NFC está desactivado en tu móvil." action="Abrir ajustes de NFC" onClick={() => bridge.nfcSettings()} />}
      {st === 'none' && <Warn text="Este móvil no tiene NFC." />}
      {st === 'nohce' && <Warn text="Este móvil no permite emular tarjetas por NFC." />}
      {st === 'web' && <Warn text="El pago por NFC solo funciona en la app Android de La Placeta." />}
    </Sheet>
  )
}

function Warn({ text, action, onClick }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div className="banner warn" role="alert">{text}</div>
      {action && <button className="btn primary" style={{ marginTop: 14 }} onClick={onClick}>{action}</button>}
    </div>
  )
}
