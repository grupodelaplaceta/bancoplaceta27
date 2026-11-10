'use client'
import { play } from '../../lib/sfx'
import { useEffect, useRef, useState } from 'react'
import { api, newKey, useRes } from '../../lib/client'
import { list, pick, eur, parseAmount } from '../../lib/shape'
import { useApp, Sheet, Icon, Spin } from './kit'

const REPE = [['', 'Una sola vez'], ['7', 'Cada 7 días'], ['30', 'Cada 30 días']]
const localInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Transferir({ preset, onClose }) {
  const { accounts, iban: actual, tick, refreshAll, can } = useApp()
  const ben = useRes('beneficiaries', tick)
  const benef = list(ben.data, 'beneficiarios')

  const [step, setStep] = useState(1)
  const [from, setFrom] = useState(preset?.from || actual || accounts[0]?.iban || '')
  const [to, setTo] = useState(preset?.to || '')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [sched, setSched] = useState(!!preset?.schedule)
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 864e5)))
  const [every, setEvery] = useState('')
  const [saveB, setSaveB] = useState(false), [alias, setAlias] = useState('')
  const [look, setLook] = useState(null), [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null), [done, setDone] = useState(null)
  const key = useRef({ sig: '', k: '' })

  const dest = to.trim().toUpperCase()
  const origin = accounts.find((a) => a.iban === from)
  const n = parseAmount(amount)
  const whenDate = new Date(when)

  // Comprobación del IBAN de destino (con una breve espera mientras se escribe).
  useEffect(() => {
    setLook(null)
    if (!/^[A-Z0-9][A-Z0-9-]{5,39}$/.test(dest)) { setChecking(false); return }
    let dead = false
    setChecking(true)
    const t = setTimeout(() => {
      api('lookup?iban=' + encodeURIComponent(dest))
        .then((d) => { if (!dead) { setLook(d); setChecking(false) } })
        .catch(() => { if (!dead) { setLook({ error: true }); setChecking(false) } })
    }, 450)
    return () => { dead = true; clearTimeout(t) }
  }, [dest])

  const paso1 =
    !dest ? 'Escribe el IBAN de destino.' :
    dest === from ? 'El destino no puede ser la misma cuenta.' :
    checking ? '' :
    look?.error ? 'No hemos podido comprobar el IBAN. Inténtalo de nuevo.' :
    look && !look.existe ? 'No existe ninguna cuenta con ese IBAN.' :
    !look ? '' : ''
  const ok1 = !!dest && dest !== from && !!look && look.existe === true

  const paso2 =
    !(n > 0) ? 'Escribe un importe mayor que 0.' :
    !sched && origin && n > origin.available ? `Saldo insuficiente. Disponible: ${eur(origin.available)}.` :
    sched && (isNaN(whenDate) || whenDate < new Date()) ? 'Elige una fecha y hora futuras.' :
    ''
  const ok2 = !paso2

  const send = async () => {
    setBusy(true); setErr(null)
    const payload = {
      desde_iban: from, hacia_iban: dest, importe: n, concepto: memo.trim(),
      ...(sched && { fecha: whenDate.toISOString(), ...(every && { periodicidad_dias: Number(every) }) }),
    }
    const sig = JSON.stringify(payload)
    if (key.current.sig !== sig) key.current = { sig, k: newKey() } // mismo envío, misma clave: nunca se duplica
    try {
      const d = await api(sched ? 'transfers/scheduled' : 'transfers', { method: 'POST', body: payload, idem: key.current.k })
      if (saveB && !benef.some((b) => b.iban === dest)) {
        api('beneficiaries', { method: 'POST', body: { alias: alias.trim() || dest, iban: dest }, idem: newKey() }).catch(() => {})
      }
      play('ok'); setDone({ ref: String(pick(d, ['transaccion', 'programada', 'id'], '')), sched })
      refreshAll()
    } catch (e) {
      if (e.definitive) key.current = { sig: '', k: '' }
      setErr(e)
    } finally { setBusy(false) }
  }

  const title = done ? 'Confirmación' : sched ? 'Programar envío' : 'Enviar dinero'
  const mine = accounts.filter((a) => a.iban !== from)

  if (!can('me:transfer')) {
    return <Sheet title="Transferir" onClose={onClose}><div className="banner bad">Tu sesión no tiene permiso para transferir.</div></Sheet>
  }

  if (done) {
    return (
      <Sheet title={title} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <span className="okmark"><Icon n="check" size={40} stroke={2.8} /></span>
          <h2 style={{ marginTop: 16 }}>{done.sched ? 'Transferencia programada' : 'Transferencia enviada'}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{eur(n)} para <b style={{ color: 'var(--ink)' }}>{dest}</b></p>
          {done.ref && <p className="tiny muted" style={{ marginTop: 10 }}>Referencia <span className="mono">{done.ref}</span></p>}
        </div>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="steps" aria-label={`Paso ${step} de 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <p className="tiny muted" style={{ fontWeight: 700 }}>Paso {step} de 3</p>

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); if (ok1) setStep(2) }}>
          <h3 style={{ marginTop: 10 }}>¿A quién envías?</h3>
          <label className="field"><span>Desde</span>
            <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map((a) => <option key={a.iban} value={a.iban}>{a.name}</option>)}
            </select>
          </label>
          {origin && <p className="tiny muted" style={{ marginTop: 8 }}>Disponible: <b className="sens" style={{ color: 'var(--ink)' }}>{eur(origin.available)}</b></p>}
          <label className="field"><span>IBAN de destino</span>
            <input className="input mono" value={to} onChange={(e) => setTo(e.target.value)} placeholder="PZ-0000-0000" autoComplete="off" spellCheck="false" autoFocus />
          </label>
          {checking && <p className="hint info" style={{ marginTop: 10 }}>Comprobando cuenta…</p>}
          {!checking && look && look.existe && <p className="hint ok" style={{ marginTop: 10 }}>✓ Cuenta encontrada{look.titular ? ' · ' + look.titular : ''}{look.entidad ? ' · ' + look.entidad : ''}</p>}
          {!checking && paso1 && dest && <p className="hint bad" style={{ marginTop: 10 }}>{paso1}</p>}

          {!to && (!!benef.length || !!mine.length) && (
            <>
              <p className="tiny muted" style={{ fontWeight: 700, marginTop: 18 }}>Destinos frecuentes</p>
              <div className="chips" style={{ marginTop: 8 }}>
                {[...mine.map((x) => ['Mi cuenta · ' + x.name, x.iban]), ...benef.map((b) => [b.alias || 'Contacto', b.iban])].slice(0, 8).map(([t, i]) => (
                  <button type="button" className="chip" key={i} onClick={() => setTo(i)}>{t}</button>
                ))}
              </div>
            </>
          )}
          <button type="submit" className="btn primary" style={{ marginTop: 22 }} disabled={!ok1}>Continuar</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); if (ok2) setStep(3) }}>
          <h3 style={{ marginTop: 10 }}>¿Cuánto?</h3>
          <p className="muted small">Disponible en {origin?.name || 'la cuenta'}: <b className="sens" style={{ color: 'var(--ink)' }}>{eur(origin?.available || 0)}</b></p>
          <label className="field" style={{ marginTop: 14 }}><span>Importe</span>
            <input className="input big" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00 Pz" autoFocus aria-label="Importe" />
          </label>
          <label className="field"><span>Concepto <small>(opcional)</small></span>
            <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={140} placeholder="Ej. Para la cena" />
          </label>

          <div className="seg" role="tablist" aria-label="Cuándo" style={{ marginTop: 20 }}>
            <button type="button" role="tab" aria-selected={!sched} className={!sched ? 'on' : ''} onClick={() => setSched(false)}>Enviar ahora</button>
            <button type="button" role="tab" aria-selected={sched} className={sched ? 'on' : ''} onClick={() => setSched(true)}>Programar</button>
          </div>

          {sched && (
            <>
              <label className="field"><span>Fecha y hora</span>
                <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="field"><span>Repetir</span>
                <select className="select" value={every} onChange={(e) => setEvery(e.target.value)}>
                  {REPE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </>
          )}

          {paso2 && <p className="hint bad" style={{ marginTop: 14 }}>{paso2}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 22 }}>
            <button type="button" className="btn" onClick={() => setStep(1)}>Atrás</button>
            <button type="submit" className="btn primary" disabled={!ok2}>Continuar</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ marginTop: 10 }}>Revisa antes de confirmar</h3>
          <div className="summary" style={{ marginTop: 14 }}>
            <Row k="Desde" v={origin?.name || from} />
            <Row k="Para" v={look?.titular || dest} />
            <Row k="IBAN" v={dest} />
            {memo && <Row k="Concepto" v={memo} />}
            <Row k="Cuándo" v={sched ? whenDate.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (every ? ` · cada ${every} días` : '') : 'Ahora'} />
          </div>
          <div className="big-amt sens" style={{ textAlign: 'center', fontSize: 40, margin: '22px 0 6px' }}>{eur(n)}</div>
          <p className="muted small" style={{ textAlign: 'center' }}>{sched ? 'Se enviará en la fecha elegida.' : 'Se envía de inmediato y no se puede deshacer.'}</p>

          {!benef.some((b) => b.iban === dest) && (
            <div style={{ marginTop: 18 }}>
              <label className="check"><input type="checkbox" checked={saveB} onChange={(e) => setSaveB(e.target.checked)} />Guardar como destinatario</label>
              {saveB && <input className="input" style={{ marginTop: 10 }} value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Nombre para reconocerlo" />}
            </div>
          )}

          {err && <div className="banner bad" role="alert">{err.message}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 22 }}>
            <button className="btn" onClick={() => setStep(2)} disabled={busy}>Atrás</button>
            <button className="btn primary" onClick={send} disabled={busy}>{busy ? <Spin /> : sched ? 'Programar envío' : 'Confirmar envío'}</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Row({ k, v }) {
  return <div className="row"><span>{k}</span><span>{v}</span></div>
}
