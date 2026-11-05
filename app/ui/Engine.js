'use client'
import { useState, useEffect } from 'react'
import { call } from './api'
import Result from './Result'

const pathVars = (p) => [...p.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
const newKey = () => globalThis.crypto?.randomUUID?.() || 'k' + Date.now() + Math.random().toString(36).slice(2)
const LABELS = { iban: 'IBAN', id: 'Identificador', ref: 'Referencia' }

function Input({ f, v, set }) {
  const common = { id: undefined, required: !!f.r, value: v ?? '', onChange: (e) => set(e.target.value), placeholder: f.ph }
  if (f.t === 'select') return <select className="sel" {...common}><option value="">—</option>{f.opts.map((o) => <option key={o}>{o}</option>)}</select>
  if (f.t === 'checkbox') return <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} className="chk" />
  if (f.t === 'textarea') return <textarea rows={3} {...common} />
  if (f.t === 'file') return <input type="file" accept="image/*" required={!!f.r} onChange={(e) => set(e.target.files?.[0] || null)} />
  const type = f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : 'text'
  return <input type={type} step={f.step} min={f.min} max={f.max} {...common} />
}

function body(fields, vals) {
  const o = {}
  for (const f of fields) {
    const v = vals[f.k]
    if (f.t === 'checkbox') { o[f.k] = !!v; continue }
    if (v === undefined || v === '' || v === null) continue
    if (f.t === 'number') o[f.k] = Number(v)
    else if (f.t === 'list') o[f.k] = String(v).split(',').map((x) => x.trim()).filter(Boolean)
    else if (f.t === 'file') continue
    else o[f.k] = typeof v === 'string' ? v.trim() : v
  }
  return o
}

function Section({ s, ctx, first }) {
  const vars = pathVars(s.path)
  const inputs = [...vars.map((k) => ({ k, l: LABELS[k] || k, t: 'text', r: true, path: true })), ...s.fields]
  const init = () => Object.fromEntries(inputs.filter((x) => x.d === 'iban' || x.k === 'iban').map((x) => [x.k, ctx.iban || '']))
  const [open, setOpen] = useState(first), [vals, setVals] = useState(init), [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [res, setRes] = useState(null), [idem, setIdem] = useState(newKey)
  const set = (k) => (v) => setVals((p) => ({ ...p, [k]: v }))
  const isGet = s.method === 'GET'

  const run = async (ev) => {
    ev?.preventDefault()
    if (s.danger && !window.confirm(s.confirm || '¿Confirmas esta operación?')) return
    setBusy(true); setErr(''); setRes(null)
    try {
      let adv = {}
      if (extra.trim()) { try { adv = JSON.parse(extra) } catch { throw new Error('Las opciones avanzadas no son un JSON válido') } }
      const path = s.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(vals[k] ?? '').trim()))
      const fields = s.fields
      let opts
      if (isGet) opts = { query: Object.fromEntries(Object.entries({ ...body(fields, vals), ...adv }).map(([k, v]) => [k, String(v)])) }
      else if (fields.some((x) => x.t === 'file')) {
        const fd = new FormData()
        Object.entries({ ...s.fixed, ...body(fields, vals), ...adv }).forEach(([k, v]) => fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)))
        fields.filter((x) => x.t === 'file').forEach((x) => vals[x.k] && fd.append(x.k, vals[x.k]))
        opts = { form: fd, idem }
      } else opts = { body: { ...s.fixed, ...body(fields, vals), ...adv }, idem }
      setRes(await call(s.method, path, opts))
      setIdem(newKey()) // un reintento tras un fallo reutiliza la clave; tras un éxito, se renueva
    } catch (e) {
      setErr(e.status === 403 ? `${e.message}. La clave de API necesita el permiso «${s.scope}».` : e.message)
    }
    setBusy(false)
  }
  // Consultas sin parámetros obligatorios: se cargan al abrir
  const auto = isGet && inputs.every((x) => !x.r || vals[x.k])
  useEffect(() => { if (open && auto && !res && !err) run() }, [open]) // eslint-disable-line

  return (
    <section className={'sec' + (open ? ' open' : '')}>
      <button type="button" className="sec-h" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={'verb ' + s.method}>{s.method}</span><b>{s.title}</b><code className="scope">{s.scope}</code><span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && <form className="sec-b" onSubmit={run}>
        {inputs.length > 0 && <div className="fields">{inputs.map((x) => (
          <label key={x.k} className={x.t === 'checkbox' ? 'chk-l' : ''}>{x.l}{x.r && ' *'}<Input f={x} v={vals[x.k]} set={set(x.k)} /></label>))}</div>}
        {!isGet && <details className="adv"><summary>Opciones avanzadas (JSON)</summary>
          <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder='{"campo": "valor"}' /></details>}
        <button className={'btn' + (s.danger ? ' warnb' : '')} disabled={busy}>{busy ? 'Enviando…' : isGet ? 'Consultar' : 'Ejecutar'}</button>
        {err && <div className="err">{err}</div>}
        {res !== null && !err && <div className="okm">{isGet ? 'Resultado' : 'Hecho'}</div>}
        {res !== null && <Result data={res} />}
      </form>}
    </section>
  )
}

export default function Module({ mod, ctx }) {
  return (
    <div className="mod">
      <h2>{mod.title}</h2>{mod.desc && <p className="muted">{mod.desc}</p>}
      {mod.sections.map((s, i) => <Section key={mod.id + i} s={s} ctx={ctx} first={mod.sections.length === 1 || (i === 0 && s.t === 'list')} />)}
    </div>
  )
}
