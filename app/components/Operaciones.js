'use client'
import { useEffect, useMemo, useState } from 'react'
import { request, newKey } from '../../lib/client'
import { useApp, Modal, Spinner, ErrorBox, Icon } from './ui'

// Operaciones de entidad para operadores. El servidor valida todo (lib/ops.js); aquí solo se piden los datos
// y se confirman las acciones que mueven dinero o cambian permisos.
export default function Operaciones() {
  const { toast } = useApp()
  const [cat, setCat] = useState(null), [err, setErr] = useState(null)
  const [sel, setSel] = useState(''), [vals, setVals] = useState({})
  const [confirming, setConfirming] = useState(false), [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null)

  useEffect(() => {
    request('/api/ops').then((d) => { setCat(d.ops); setSel(d.ops[0]?.id || '') }).catch((e) => setErr(e))
  }, [])

  const op = useMemo(() => (cat || []).find((o) => o.id === sel), [cat, sel])
  const groups = useMemo(() => {
    const m = {}; for (const o of cat || []) (m[o.g] ||= []).push(o); return m
  }, [cat])

  const pick = (id) => { setSel(id); setVals({}); setResult(null); setConfirming(false); setTyped('') }
  const set = (k, v) => setVals((x) => ({ ...x, [k]: v }))

  // Comprueba en el navegador lo obvio; la validación real está en el servidor.
  const missing = op ? op.f.filter((f) => f.req && !String(vals[f.k] ?? '').trim()) : []

  const run = async () => {
    setBusy(true)
    try {
      const d = await request('/api/ops', { method: 'POST', body: { op: op.id, valores: vals }, idem: op.idem ? newKey() : undefined })
      setResult(d); toast('Operación realizada'); setConfirming(false); setTyped('')
    } catch (e) { toast(e.message || 'No se ha podido completar la operación.') }
    finally { setBusy(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!op || missing.length) return
    if (op.m === 'GET') { setBusy(true); request('/api/ops', { method: 'POST', body: { op: op.id, valores: vals } }).then(setResult).catch((x) => toast(x.message)).finally(() => setBusy(false)); return }
    setConfirming(true)
  }

  if (err) return <ErrorBox error={err} />
  if (!cat) return <div className="boot"><Spinner /></div>

  return (
    <section aria-labelledby="ops-h">
      <h2 id="ops-h">Operaciones de entidad</h2>
      <p className="muted">Solo visible para operadores. El banco aplica sus propias reglas (permisos, doble firma, presupuesto) con tu DIP de operador.</p>

      <div className="panel">
        <label className="field-row">
          <span>Operación</span>
          <select value={sel} onChange={(e) => pick(e.target.value)}>
            {Object.entries(groups).map(([g, ops]) => (
              <optgroup key={g} label={g}>{ops.map((o) => <option key={o.id} value={o.id}>{o.l}</option>)}</optgroup>
            ))}
          </select>
        </label>

        {op && (
          <form onSubmit={submit} className="stack">
            <p className="hint">{op.m === 'GET' ? 'Consulta' : op.confirm ? 'Acción con confirmación' : 'Acción'} · {op.m} · {op.id}</p>
            {op.f.map((f) => (
              <label key={f.k} className="field-row">
                <span>{f.l}{f.req ? ' *' : ''}</span>
                {f.t === 'sel' ? (
                  <select value={vals[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} required={f.req}>
                    <option value="">Elige…</option>
                    {f.opts.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                ) : f.t === 'json' ? (
                  <textarea rows={3} placeholder='{"campo":"valor"}' value={vals[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />
                ) : (
                  <input
                    type={f.t === 'date' ? 'date' : 'text'}
                    inputMode={f.t === 'num' ? 'decimal' : undefined}
                    placeholder={f.t === 'period' ? 'AAAA-MM' : f.t === 'iban' ? 'PZ-0001-0002' : undefined}
                    maxLength={f.max || undefined}
                    value={vals[f.k] ?? ''}
                    onChange={(e) => set(f.k, f.t === 'iban' ? e.target.value.toUpperCase() : e.target.value)}
                  />
                )}
              </label>
            ))}
            <button className="btn btn-primary" disabled={busy || missing.length > 0}>
              {busy ? <Spinner /> : op.m === 'GET' ? 'Consultar' : 'Revisar y confirmar'}
            </button>
          </form>
        )}
      </div>

      {result && (
        <div className="panel" aria-live="polite">
          <p className="hint"><Icon n="check" size={14} /> Respuesta del banco</p>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {confirming && op && (
        <Modal title="Confirma la operación" onClose={() => { setConfirming(false); setTyped('') }}>
          <p>Vas a ejecutar <b>{op.l}</b>:</p>
          <ul>{op.f.filter((f) => String(vals[f.k] ?? '').trim()).map((f) => <li key={f.k}>{f.l}: <b>{String(vals[f.k])}</b></li>)}</ul>
          <p className="notice">Esta acción tiene efectos reales en la entidad y no se puede deshacer desde esta pantalla.</p>
          {op.typed && (
            <label className="field-row"><span>Escribe {op.typed} para confirmar</span><input value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
          )}
          <div className="toolbar">
            <button className="btn" onClick={() => { setConfirming(false); setTyped('') }}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || (op.typed && typed !== op.typed)} onClick={run}>{busy ? <Spinner /> : 'Confirmar'}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
