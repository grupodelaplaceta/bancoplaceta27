'use client'
import { useEffect, useRef, useState } from 'react'
import { request, api, newKey, store } from '../../lib/client'
import { list, pick, eur, facts, parseAmount } from '../../lib/shape'
import { buildContract, sha256, fold } from '../../lib/contract'
import { useApp, Modal, Icon, ErrorBox, Spinner, KV, Skel } from './ui'

const PERSONAL = { std: true, nombre: 'Cuenta personal estándar', descripcion: 'Cuenta corriente a tu nombre. Se abre al momento.' }

/** Contrato imprimible (también se reutiliza en Documentos). */
export function ContractView({ c }) {
  return (
    <div className="print-area contract">
      <div className="print-head"><b>Banca La Placeta</b><span>{c.title}</span></div>
      <KV rows={c.rows} />
      {c.clauses.map(([h, t]) => <div key={h}><h4 className="mt">{h}</h4><p className="muted" style={{ margin: 0 }}>{t}</p></div>)}
      {c.hash && <p className="muted s mono" style={{ wordBreak: 'break-all' }}>Aceptado el {c.at} · SHA-256 {c.hash}</p>}
    </div>
  )
}

/** Asistente de alta: elegir producto → datos → leer y aceptar el contrato → enviar. mode: 'cuenta' | 'prestamo'. */
export default function Alta({ mode, onClose }) {
  const { name, info, afterOpen, bumpAll, toast, accounts } = useApp()
  const [step, setStep] = useState(mode === 'prestamo' ? 'data' : 'choose')
  const [cat, setCat] = useState({ loading: mode === 'cuenta', items: [], error: null })
  const [product, setProduct] = useState(null)
  const [nombre, setNombre] = useState(''), [importe, setImporte] = useState(''), [cuotas, setCuotas] = useState('12'), [motivo, setMotivo] = useState('')
  const [read, setRead] = useState(false), [ok, setOk] = useState(false), [sign, setSign] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null), [done, setDone] = useState(null)
  const key = useRef(newKey()), box = useRef(null)

  useEffect(() => {
    if (mode !== 'cuenta') return
    request('/api/catalog').then((d) => setCat({ loading: false, items: list(d, 'productos'), error: null })).catch((e) => setCat({ loading: false, items: [], error: e }))
  }, [mode])

  const n = parseAmount(importe), q = Number(cuotas)
  const dataBad = mode === 'prestamo' ? (!(n > 0) ? 'Indica el importe.' : !(Number.isInteger(q) && q >= 1 && q <= 360) ? 'Las cuotas deben ser de 1 a 360.' : '') : !nombre.trim() ? 'Ponle un nombre a la cuenta.' : ''
  const contract = step === 'contract' ? buildContract({ kind: mode, bank: info?.banco, client: name, product: product?.std ? null : product, data: { nombre: nombre.trim(), importe: n, cuotas: q, motivo: motivo.trim() } }) : null
  const signed = fold(sign) === fold(name)

  const onScroll = (e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true) }
  useEffect(() => { if (step === 'contract' && box.current && box.current.scrollHeight <= box.current.clientHeight + 8) setRead(true) }, [step])

  const pname = (p) => pick(p, ['nombre', 'name', 'titulo'], 'Producto')
  const pickProduct = (p) => { setProduct(p); setNombre(p.std ? '' : pname(p)); setStep('data') }

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const hash = await sha256(contract.text), at = new Date().toISOString()
      const proof = `Contrato SHA-256:${hash.slice(0, 16)} aceptado ${at.slice(0, 16)}Z`
      let msg
      if (mode === 'cuenta' && product?.std) {
        const d = await api('accounts', { method: 'POST', body: { nombre: nombre.trim() }, idem: key.current })
        msg = { open: pick(d, ['cuenta', 'iban']) }
      } else {
        const body = mode === 'prestamo' ? { tipo: 'prestamo', importe: n, cuotas: q, motivo: `${motivo.trim().slice(0, 90)} · ${proof}` } : { tipo: 'cuenta', product_id: product.id, motivo: `Producto: ${pname(product).slice(0, 50)} (${product.codigo || product.code || product.id || '-'}) · ${proof}` }
        await api('requests', { method: 'POST', body, idem: key.current }); msg = { pending: true }
      }
      // Copia del contrato aceptado, disponible en Documentos.
      store.set('pz:contracts', [{ id: key.current, title: contract.title, rows: contract.rows, clauses: contract.clauses, hash, at, client: name }, ...store.get('pz:contracts', [])].slice(0, 30))
      bumpAll(); setDone(msg); setStep('done')
      if (msg.open) { await afterOpen(msg.open) }
    } catch (e) { if (e.definitive) key.current = newKey(); setErr(e) } finally { setBusy(false) }
  }

  const title = { choose: 'Elige un producto', data: mode === 'prestamo' ? 'Solicitar un préstamo' : 'Datos de la contratación', contract: 'Contrato', done: 'Todo listo' }[step]
  return (
    <Modal title={title} onClose={onClose} wide>
      {step === 'choose' && (
        <>
          <p className="muted">Elige qué quieres contratar. Antes de nada verás todos los datos y el contrato.{accounts.length ? ` Ahora tienes ${accounts.length} ${accounts.length === 1 ? 'cuenta' : 'cuentas'}.` : ''}</p>
          <ul className="rows">
            {[PERSONAL, ...cat.items].map((p, i) => (
              <li key={p.id || p.codigo || i}><button className="row" onClick={() => pickProduct(p)}>
                <span className="dot in"><Icon n={p.std ? 'card' : 'bag'} size={18} /></span>
                <span className="row-m"><b>{pname(p)}</b><small>{pick(p, ['descripcion', 'description'], p.std ? '' : 'Requiere aprobación de la entidad')}</small></span>
                <span className="chipbtn">{p.std ? 'Abrir ya' : 'Solicitar'}</span>
              </button></li>
            ))}
          </ul>
          {cat.loading && <Skel n={2} />}
          <ErrorBox error={cat.error} />
        </>
      )}
      {step === 'data' && (
        <form onSubmit={(e) => { e.preventDefault(); if (!dataBad) { setRead(false); setOk(false); setSign(''); setStep('contract') } }}>
          {mode === 'cuenta' && product && !product.std && <KV rows={facts(product, ['id', 'activo', 'active'], 'PZ')} />}
          {mode === 'cuenta'
            ? <label>Nombre de la cuenta<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Cuenta de ahorro" autoFocus /></label>
            : <>
                <div className="field-row">
                  <label>Importe (Pz)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="3000" autoFocus /></label>
                  <label>Cuotas<input type="number" min="1" max="360" value={cuotas} onChange={(e) => setCuotas(e.target.value)} /></label>
                </div>
                <label>Finalidad <small className="muted">(opcional)</small><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={90} placeholder="Ej. Reforma" /></label>
              </>}
          {dataBad && (nombre || importe) && <p className="hint">{dataBad}</p>}
          <div className="sheet-f">{mode === 'cuenta' && <button type="button" className="btn" onClick={() => setStep('choose')}>Volver</button>}<button className="btn primary" disabled={!!dataBad}>Ver contrato</button></div>
        </form>
      )}
      {step === 'contract' && contract && (
        <>
          <div ref={box} onScroll={onScroll} style={{ maxHeight: '46vh', overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            <ContractView c={contract} />
          </div>
          {!read && <p className="hint ok"><Icon n="info" size={14} /> Baja hasta el final del contrato para poder aceptarlo.</p>}
          <label className="check"><input type="checkbox" disabled={!read} checked={ok} onChange={(e) => setOk(e.target.checked)} />He leído el contrato y acepto sus condiciones</label>
          <label>Firma: escribe tu nombre completo <small className="muted">({name})</small><input value={sign} onChange={(e) => setSign(e.target.value)} disabled={!ok} autoComplete="off" /></label>
          <ErrorBox error={err} />
          <div className="sheet-f no-print"><button className="btn" onClick={() => setStep('data')} disabled={busy}>Volver</button><button className="btn" onClick={() => window.print()}><Icon n="print" size={18} />Imprimir</button><button className="btn primary" disabled={!ok || !signed || busy} onClick={submit}>{busy ? <Spinner /> : 'Aceptar y contratar'}</button></div>
        </>
      )}
      {step === 'done' && (
        <>
          <div className="done"><span className="done-i"><Icon n="check" size={30} /></span><b>{done?.pending ? 'Solicitud enviada' : 'Cuenta abierta'}</b><span className="muted">{done?.pending ? 'Queda pendiente hasta que la entidad la resuelva. Tienes una copia del contrato en Documentos.' : 'Ya puedes usarla. Tienes una copia del contrato en Documentos.'}</span></div>
          <div className="sheet-f"><button className="btn primary" onClick={onClose}>Listo</button></div>
        </>
      )}
    </Modal>
  )
}
