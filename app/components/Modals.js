'use client'
import { useEffect, useRef, useState } from 'react'
import { api, useRes, newKey } from '../../lib/client'
import { list, pick, eur, facts, signed, txTitle, parseAmount } from '../../lib/shape'
import { useApp, Modal, Icon, ErrorBox, Spinner, CopyBtn, KV } from './ui'

const localInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

/* ---------- Transferencia: formulario → confirmar → resultado (inmediata o programada) ---------- */
export function TransferModal({ preset, onClose }) {
  const { accounts, iban: cur, bumpAll } = useApp()
  const ben = useRes('beneficiaries', 0)
  const benef = list(ben.data, 'beneficiarios')
  const [from, setFrom] = useState(preset?.from || cur || accounts[0]?.iban)
  const [to, setTo] = useState(preset?.to || '')
  const [amount, setAmount] = useState(''), [memo, setMemo] = useState(''), [save, setSave] = useState(false), [alias, setAlias] = useState('')
  const [sched, setSched] = useState(!!preset?.schedule)
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 864e5))), [every, setEvery] = useState('')
  const [step, setStep] = useState('form'), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [res, setRes] = useState(null)
  const key = useRef({ sig: '', k: '' })

  const a = accounts.find((x) => x.iban === from)
  const n = parseAmount(amount)
  const dest = to.trim().toUpperCase()
  const when_ = new Date(when)
  const problem =
    !dest ? 'Indica el IBAN de destino.' :
    dest === from ? 'El destino no puede ser la misma cuenta.' :
    !(n > 0) ? 'Escribe un importe mayor que 0.' :
    sched && (isNaN(when_) || when_ < new Date()) ? 'Elige una fecha futura.' :
    sched && every && !(Number(every) >= 1 && Number(every) <= 366) ? 'La repetición debe ser de 1 a 366 días.' :
    !sched && a && n > a.available ? `Saldo insuficiente: disponible ${eur(a.available, a.currency)}.` : ''

  // Comprobación del IBAN de destino antes de enviar (GET /me/lookup), con una pequeña espera al escribir.
  const [look, setLook] = useState(null)
  useEffect(() => {
    setLook(null)
    if (!/^[A-Z0-9][A-Z0-9-]{5,39}$/.test(dest)) return
    let dead = false
    const t = setTimeout(() => { api('lookup?iban=' + encodeURIComponent(dest)).then((d) => !dead && setLook(d)).catch(() => !dead && setLook({ error: true })) }, 450)
    return () => { dead = true; clearTimeout(t) }
  }, [dest])

  const send = async () => {
    setBusy(true); setErr(null)
    const payload = { desde_iban: from, hacia_iban: dest, importe: n, concepto: memo.trim(), ...(sched && { fecha: when_.toISOString(), ...(every && { periodicidad_dias: Number(every) }) }) }
    const sig = JSON.stringify(payload)
    if (key.current.sig !== sig) key.current = { sig, k: newKey() } // mismo envío → misma clave → nunca se duplica
    try {
      const d = await api(sched ? 'transfers/scheduled' : 'transfers', { method: 'POST', body: payload, idem: key.current.k })
      setRes(d)
      if (save && !benef.some((b) => b.iban === dest)) api('beneficiaries', { method: 'POST', body: { alias: alias.trim() || dest, iban: dest }, idem: newKey() }).catch(() => {})
      bumpAll(); setStep('done')
    } catch (e) { if (e.definitive) key.current = { sig: '', k: '' }; setErr(e); setStep('form') } finally { setBusy(false) }
  }

  const mine = accounts.filter((x) => x.iban !== from)
  const id = res && String(pick(res, ['transaccion', 'programada', 'id'], ''))
  return (
    <Modal title={step === 'done' ? (sched ? 'Transferencia programada' : 'Transferencia enviada') : step === 'confirm' ? 'Confirma los datos' : sched ? 'Programar transferencia' : 'Nueva transferencia'} onClose={onClose}>
      {step === 'form' && (
        <form onSubmit={(e) => { e.preventDefault(); if (!problem) setStep('confirm') }}>
          <div className="seg" role="tablist" aria-label="Cuándo">
            <button type="button" role="tab" aria-selected={!sched} className={!sched ? 'on' : ''} onClick={() => setSched(false)}>Ahora</button>
            <button type="button" role="tab" aria-selected={sched} className={sched ? 'on' : ''} onClick={() => setSched(true)}>Programar</button>
          </div>
          <label>Desde
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{accounts.map((x) => <option key={x.iban} value={x.iban}>{x.name} · {x.iban} · {eur(x.available, x.currency)}</option>)}</select>
          </label>
          <label>IBAN de destino
            <input value={to} onChange={(e) => setTo(e.target.value)} list="dest-list" placeholder="PZ-0001-0003" autoComplete="off" spellCheck="false" className="mono" />
            <datalist id="dest-list">{[...benef.map((b) => b.iban), ...mine.map((x) => x.iban)].map((i) => <option key={i} value={i} />)}</datalist>
          </label>
          {look && !look.error && <p className={'lookup ' + (look.existe ? 'ok' : 'no')}>{look.existe ? `✓ Cuenta encontrada${look.titular ? ' · titular ' + look.titular : ''}${look.entidad ? ' · entidad ' + look.entidad : ''}` : 'No existe ninguna cuenta con ese IBAN.'}</p>}
          {(!!benef.length || !!mine.length) && !to && <div className="chips">{[...mine.map((x) => ['Mía', x.iban]), ...benef.map((b) => [b.alias || '', b.iban])].slice(0, 6).map(([t, i]) => <button type="button" className="chipbtn" key={i} onClick={() => setTo(i)}>{t && <b>{t}</b>}{i}</button>)}</div>}
          <label>Importe ({a?.currency || 'EUR'})
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="big-in" />
          </label>
          <label>Concepto <small className="muted">(opcional)</small>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={140} placeholder="Ej. Para el viaje" />
          </label>
          {sched && (
            <div className="field-row">
              <label>Fecha y hora<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
              <label>Repetir cada (días) <small className="muted">(vacío = una vez)</small><input type="number" min="1" max="366" value={every} onChange={(e) => setEvery(e.target.value)} placeholder="30" /></label>
            </div>
          )}
          {!benef.some((b) => b.iban === dest) && <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />Guardar este destinatario</label>}
          {save && <label>Nombre <small className="muted">(opcional)</small><input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Ej. Ana" /></label>}
          <ErrorBox error={err} />
          {problem && (to || amount) && <p className="hint">{problem}</p>}
          <div className="sheet-f"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!!problem}>Revisar</button></div>
        </form>
      )}
      {step === 'confirm' && (
        <>
          <div className="confirm">
            <div className="confirm-amt">{eur(n, a?.currency)}</div>
            <KV rows={[['Desde', from], ['Para', dest + (look?.titular ? ` (${look.titular})` : '')], ['Concepto', memo.trim() || 'Sin concepto'], ...(sched ? [['Cuándo', when_.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) + (every ? ` y cada ${every} días` : '')]] : [['Disponible después', eur((a?.available || 0) - n, a?.currency)]])]} />
          </div>
          <p className="hint ok"><Icon n="info" size={14} /> Si se corta la conexión puedes volver a pulsar enviar: el banco no duplicará el pago.</p>
          <ErrorBox error={err} />
          <div className="sheet-f"><button className="btn" onClick={() => setStep('form')} disabled={busy}>Volver</button><button className="btn primary" onClick={send} disabled={busy}>{busy ? <Spinner /> : (sched ? 'Programar ' : 'Enviar ') + eur(n, a?.currency)}</button></div>
        </>
      )}
      {step === 'done' && (
        <>
          <div className="done"><span className="done-i"><Icon n="check" size={30} /></span><b>{eur(n, a?.currency)}</b><span className="muted">{sched ? 'programados para' : 'enviados a'} <span className="mono">{sched ? when_.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : dest}</span></span></div>
          {id && <KV rows={[[sched ? 'Programación' : 'Transacción', <span className="mono">{id}</span>]]} />}
          <div className="sheet-f">{id && <CopyBtn text={id} label="Copiar referencia" />}<button className="btn primary" onClick={onClose}>Listo</button></div>
        </>
      )}
    </Modal>
  )
}

/* ---------- Abrir una cuenta personal propia (máximo 3 por entidad) ---------- */
export function OpenAccountModal({ onClose }) {
  const { afterOpen, accounts } = useApp()
  const [nombre, setNombre] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [key, setKey] = useState(newKey)
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const d = await api('accounts', { method: 'POST', body: { nombre: nombre.trim() }, idem: key }); await afterOpen(pick(d, ['cuenta', 'iban'])) }
    catch (x) { if (x.definitive) setKey(newKey()); setErr(x); setBusy(false) }
  }
  return (
    <Modal title="Abrir cuenta nueva" onClose={onClose}>
      <form onSubmit={go}>
        <p className="muted">Se abre una cuenta personal a tu nombre. Puedes tener hasta 3 por entidad{accounts.length ? ` (ahora tienes ${accounts.length})` : ''}.</p>
        <label>Nombre de la cuenta<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Cuenta de ahorro" /></label>
        <ErrorBox error={err} />
        <div className="sheet-f"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !nombre.trim()}>{busy ? <Spinner /> : 'Abrir cuenta'}</button></div>
      </form>
    </Modal>
  )
}

/* ---------- Detalle genérico (movimiento, previsión, aviso) ---------- */
export function DetailModal({ title, item, onClose }) {
  const { iban } = useApp()
  const isTx = title === 'Movimiento' || title === 'Previsión'
  const n = isTx ? signed(item, iban) : null
  return (
    <Modal title={title} onClose={onClose}>
      <div className="print-area">
        <div className="print-head"><b>Banca La Placeta</b><span>{title} · {iban}</span></div>
        {isTx && <div className="confirm-amt">{n < 0 ? '' : '+'}{eur(n, item.moneda || item.currency)}<small>{txTitle(item)}</small></div>}
        <KV rows={facts(item, isTx ? ['importe', 'concepto', 'descripcion'] : [], item.moneda || 'EUR')} />
      </div>
      <div className="sheet-f no-print">
        <button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir</button>
        <button className="btn primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
