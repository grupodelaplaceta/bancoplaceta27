'use client'
import { useEffect, useRef, useState } from 'react'
import { api, request, newKey } from '../../lib/client'
import { account, unwrap, pick, eur, facts, buildOpenAccountBody, signed, txTitle, parseAmount } from '../../lib/shape'
import { useApp, Modal, Icon, ErrorBox, Spinner, CopyBtn, KV } from './ui'
import { TransferStatus } from './Transfers'

/* ---------- Transferencia: formulario → confirmar → resultado ---------- */
export function TransferModal({ preset, onClose }) {
  const { ibans, accs, iban: cur, toast, bumpAll, benef, setBenef, pushRecent } = useApp()
  const [from, setFrom] = useState(preset?.from || cur || ibans[0])
  const [to, setTo] = useState(preset?.to || '')
  const [amount, setAmount] = useState(''), [memo, setMemo] = useState(''), [save, setSave] = useState(true), [alias, setAlias] = useState('')
  const [step, setStep] = useState('form'), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [res, setRes] = useState(null)
  const key = useRef({ sig: '', k: '' })

  const a = account(accs[from]?.data)
  const n = parseAmount(amount)
  const dest = to.trim().toUpperCase()
  const problem =
    !dest ? 'Indica el IBAN de destino.' :
    dest === from ? 'El destino no puede ser la misma cuenta.' :
    !(n > 0) ? 'Escribe un importe mayor que 0.' :
    a.iban && n > a.balance ? `Saldo insuficiente: disponible ${eur(a.balance, a.currency)}.` : ''

  const send = async () => {
    setBusy(true); setErr(null)
    const payload = { from_iban: from, to_iban: dest, amount: n, memo: memo.trim() }
    const sig = JSON.stringify(payload)
    if (key.current.sig !== sig) key.current = { sig, k: newKey() } // mismo envío → misma clave → nunca se duplica
    try {
      const d = await api('transfers', { method: 'POST', body: payload, idem: key.current.k })
      const t = unwrap(d, 'transfer')
      const ref = String(pick(t, ['reference', 'ref', 'id', 'transfer_id'], ''))
      setRes({ d, ref })
      if (save && !benef.some((b) => b.iban === dest)) setBenef([...benef, { iban: dest, name: alias.trim() || undefined }])
      if (ref) pushRecent({ ref, from, to: dest, amount: n, at: new Date().toISOString() })
      bumpAll(); setStep('done')
    } catch (e) { if (e.definitive) key.current = { sig: '', k: '' }; setErr(e); setStep('form') } finally { setBusy(false) } // un rechazo definitivo no debe reutilizar la clave
  }

  // Si queda pendiente, consultamos el estado unas veces.
  const [live, setLive] = useState(null)
  useEffect(() => {
    if (step !== 'done' || !res?.ref) return
    const st = String(pick(unwrap(res.d, 'transfer'), ['status', 'state'], '')).toLowerCase()
    if (!/pend|process/.test(st)) return
    let tries = 0, dead = false
    const t = setInterval(async () => {
      tries++
      try { const d = await api('transfers/' + encodeURIComponent(res.ref)); if (!dead) { setLive(d); if (!/pend|process/.test(String(pick(unwrap(d, 'transfer'), ['status', 'state'], '')).toLowerCase())) { clearInterval(t); bumpAll() } } } catch {}
      if (tries >= 6) clearInterval(t)
    }, 2500)
    return () => { dead = true; clearInterval(t) }
  }, [step, res])

  const mine = ibans.filter((i) => i !== from)
  return (
    <Modal title={step === 'done' ? 'Transferencia enviada' : step === 'confirm' ? 'Confirma los datos' : 'Nueva transferencia'} onClose={onClose}>
      {step === 'form' && (
        <form onSubmit={(e) => { e.preventDefault(); if (!problem) setStep('confirm') }}>
          <label>Desde
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{ibans.map((i) => { const x = account(accs[i]?.data); return <option key={i} value={i}>{i} · {x.iban ? eur(x.balance, x.currency) : '…'}</option> })}</select>
          </label>
          <label>IBAN de destino
            <input value={to} onChange={(e) => setTo(e.target.value)} list="dest-list" placeholder="PZ-0001-0003" autoComplete="off" spellCheck="false" className="mono" />
            <datalist id="dest-list">{[...benef.map((b) => b.iban), ...mine].map((i) => <option key={i} value={i} />)}</datalist>
          </label>
          {(!!benef.length || !!mine.length) && !to && <div className="chips">{[...mine.map((i) => ['Mía', i]), ...benef.map((b) => ['', b.iban])].slice(0, 6).map(([t, i]) => <button type="button" className="chipbtn" key={i} onClick={() => setTo(i)}>{t && <b>{t}</b>}{i}</button>)}</div>}
          <label>Importe ({a.currency || 'EUR'})
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="big-in" />
          </label>
          <label>Concepto <small className="muted">(opcional)</small>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={140} placeholder="Ej. Para el viaje" />
          </label>
          <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />Guardar este destinatario</label>
          {save && !benef.some((b) => b.iban === dest) && <label>Nombre <small className="muted">(opcional)</small><input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Ej. Ana" /></label>}
          <ErrorBox error={err} />
          {problem && (to || amount) && <p className="hint">{problem}</p>}
          <div className="sheet-f"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!!problem}>Revisar</button></div>
        </form>
      )}
      {step === 'confirm' && (
        <>
          <div className="confirm">
            <div className="confirm-amt">{eur(n, a.currency)}</div>
            <KV rows={[['Desde', from], ['Para', dest], ['Concepto', memo.trim() || 'Sin concepto'], ['Saldo después', eur(a.balance - n, a.currency)]]} />
          </div>
          <p className="hint ok"><Icon n="info" size={14} /> Si se corta la conexión puedes volver a pulsar enviar: el banco no duplicará el pago.</p>
          <ErrorBox error={err} />
          <div className="sheet-f"><button className="btn" onClick={() => setStep('form')} disabled={busy}>Volver</button><button className="btn primary" onClick={send} disabled={busy}>{busy ? <Spinner /> : 'Enviar ' + eur(n, a.currency)}</button></div>
        </>
      )}
      {step === 'done' && (
        <>
          <div className="done"><span className="done-i"><Icon n="check" size={30} /></span><b>{eur(n, a.currency)}</b><span className="muted">enviados a <span className="mono">{dest}</span></span></div>
          <TransferStatus data={live || res.d} refId={res.ref} />
          <div className="sheet-f">{res.ref && <CopyBtn text={res.ref} label="Copiar referencia" />}<button className="btn primary" onClick={onClose}>Listo</button></div>
        </>
      )}
    </Modal>
  )
}

/* ---------- Abrir cuenta desde un producto ---------- */
export function OpenAccountModal({ product: p, onClose }) {
  const { afterOpen } = useApp()
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null)
  const [key, setKey] = useState(newKey)
  const name = pick(p, ['name', 'title', 'code'], 'Producto')
  const go = async () => {
    setBusy(true); setErr(null)
    try {
      const d = await api('accounts', { method: 'POST', body: buildOpenAccountBody(p), idem: key })
      const a = account(d)
      await afterOpen(a.iban)
    } catch (e) { if (e.definitive) setKey(newKey()); setErr(e); setBusy(false) }
  }
  return (
    <Modal title={'Abrir ' + name} onClose={onClose}>
      <p className="muted">{pick(p, ['description'], '')}</p>
      <KV rows={facts(p, ['id', 'product_id', 'code', 'slug', 'name', 'title', 'description', 'active', 'features', 'perks'], p.currency || 'EUR')} />
      <ErrorBox error={err} />
      <div className="sheet-f"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={go} disabled={busy}>{busy ? <Spinner /> : 'Abrir cuenta'}</button></div>
    </Modal>
  )
}

/* ---------- Gestionar cuentas vinculadas ---------- */
export function ManageModal({ onClose }) {
  const { ibans, accs, link, unlink } = useApp()
  const [v, setV] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [sure, setSure] = useState('')
  const add = async (e) => { e.preventDefault(); if (!v.trim()) return; setBusy(true); setErr(null); try { await link(v); setV('') } catch (x) { setErr(x) } finally { setBusy(false) } }
  return (
    <Modal title="Cuentas vinculadas" onClose={onClose}>
      <ul className="rows">
        {ibans.map((i) => { const a = account(accs[i]?.data); return (
          <li key={i}><div className="row static"><span className="dot in"><Icon n="card" size={18} /></span>
            <span className="row-m"><b className="mono">{i}</b><small>{a.iban ? `${a.type} · ${eur(a.balance, a.currency)}` : 'Sin datos'}</small></span>
            {sure === i
              ? <><button className="chipbtn danger" onClick={() => { unlink(i); setSure('') }}>Quitar</button><button className="chipbtn" onClick={() => setSure('')}>No</button></>
              : <button className="icon-btn" aria-label={'Desvincular ' + i} onClick={() => setSure(i)}><Icon n="trash" size={16} /></button>}</div></li>
        ) })}
        {!ibans.length && <li><div className="row static muted">Todavía no has vinculado ninguna cuenta.</div></li>}
      </ul>
      <form className="inline mt" onSubmit={add}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="PZ-0001-0002" aria-label="IBAN a vincular" className="mono" spellCheck="false" />
        <button className="btn primary" disabled={busy || !v.trim()}>{busy ? <Spinner /> : 'Vincular'}</button>
      </form>
      <ErrorBox error={err} />
      <p className="muted s">Comprobamos el IBAN con el banco antes de vincularlo. Desvincular no cierra la cuenta, solo la quita de tu panel.</p>
    </Modal>
  )
}

/* ---------- Detalle genérico (movimiento, tarjeta, recibo) ---------- */
export function DetailModal({ title, item, print, onClose }) {
  const { iban } = useApp()
  const isTx = title === 'Movimiento'
  const n = isTx ? signed(item, iban) : null
  const ref = pick(item, ['reference', 'ref', 'transfer_ref', 'transfer_id'])
  const [track, setTrack] = useState(null), [err, setErr] = useState(null)
  const look = async () => { setErr(null); try { setTrack(await api('transfers/' + encodeURIComponent(ref))) } catch (e) { setErr(e) } }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="print-area">
        <div className="print-head"><b>Banca La Placeta</b><span>{title} · {iban}</span></div>
        {isTx && <div className="confirm-amt">{n < 0 ? '' : '+'}{eur(n, item.currency)}<small>{txTitle(item)}</small></div>}
        <KV rows={facts(item, isTx ? ['amount', 'memo', 'concept', 'description'] : [], item.currency || 'EUR')} />
      </div>
      <ErrorBox error={err} />
      {track && <TransferStatus data={track} refId={ref} />}
      <div className="sheet-f no-print">
        {isTx && ref && !track && <button className="btn" onClick={look}>Ver estado de la transferencia</button>}
        {print && <button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir</button>}
        <button className="btn primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
