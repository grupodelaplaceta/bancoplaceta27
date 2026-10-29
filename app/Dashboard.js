'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { api, eur, list, uid, fdate, signed, acct, bal } from '../lib/client'

const TABS = [['transactions', 'Movimientos'], ['cards', 'Tarjetas'], ['receipts', 'Recibos'], ['membership', 'Membresía'], ['products', 'Productos']]
const IBAN_RE = /^[A-Z0-9-]{6,40}$/

export default function Dashboard({ name, hasDip }) {
  const [askDip, setAskDip] = useState(!hasDip)
  const [ibans, setIbans] = useState([]), [iban, setIban] = useState(''), [accs, setAccs] = useState({})
  const [tab, setTab] = useState('transactions'), [modal, setModal] = useState(null), [toast, setToast] = useState('')
  const [rev, setRev] = useState(0), [boot, setBoot] = useState({ loading: true, err: '' })

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200) }

  // Las cuentas las busca el servidor con el DIP de la sesión.
  const loadIbans = useCallback((fresh, pick) => {
    setBoot({ loading: true, err: '' })
    api('../me/accounts' + (fresh ? '?fresh=1' : '')).then((d) => { setIbans(d.ibans); setIban((cur) => pick && d.ibans.includes(pick) ? pick : d.ibans.includes(cur) ? cur : d.ibans[0] || ''); setBoot({ loading: false, err: '' }) }).catch((e) => setBoot({ loading: false, err: e.message }))
  }, [])
  useEffect(() => { loadIbans(false) }, [loadIbans])

  // Saldos de todas las cuentas vinculadas (alimenta el total y el selector).
  useEffect(() => {
    let off = false
    ibans.forEach((i) => api('accounts/' + i).then((d) => !off && setAccs((p) => ({ ...p, [i]: acct(d) }))).catch((e) => !off && setAccs((p) => ({ ...p, [i]: { error: e.message } }))))
    return () => { off = true }
  }, [ibans, rev])

  const refresh = () => setRev((r) => r + 1)

  const a = accs[iban] || {}
  const okAccs = Object.values(accs).filter((x) => !x.error)
  const total = okAccs.reduce((s, x) => s + bal(x), 0)
  const first = (name || 'Cliente').split(' ')[0]

  if (askDip) return <DipPrompt name={name} cancel={hasDip ? () => setAskDip(false) : null} />
  return (
    <div className="app">
      <header>
        <div className="brand"><span className="logo sm">P</span>La Placeta</div>
        <div className="who"><span>Hola, {first}</span><button className="ghost" onClick={() => setAskDip(true)}>Cambiar DIP</button><a href="/api/auth/logout" className="ghost">Salir</a></div>
      </header>

      <main className="grid">
        <section className="hero">
          <div className="orb o1" /><div className="orb o2" />
          <div className="row">
            <select aria-label="Cuenta" value={iban} onChange={(e) => setIban(e.target.value)}>
              {ibans.length ? ibans.map((i) => <option key={i}>{i}</option>) : <option>{boot.loading ? 'Buscando…' : 'Sin cuentas'}</option>}
            </select>
            {(a.type || a.product || a.product_name) && <span className="chip">{a.product_name || a.product || a.type}</span>}
            {a.status && <span className="chip">{a.status}</span>}
            {iban && <button className="chip btnchip" onClick={() => { navigator.clipboard?.writeText(iban); say('IBAN copiado') }}>Copiar IBAN</button>}
          </div>
          <p className="lbl">Saldo disponible</p>
          <div className="bal">{a.error ? '—' : iban && accs[iban] ? eur(bal(a), a.currency) : iban ? <span className="sk" style={{ width: 220, height: 52 }} /> : '—'}</div>
          {a.error && <p className="lbl">{a.error}</p>}
          <div className="acts">
            <button className="btn light" disabled={!iban} onClick={() => setModal('transfer')}>Transferir</button>
            <button className="btn glass" onClick={() => setModal('open')}>Abrir cuenta</button>
            <button className="btn glass" disabled={!iban} onClick={refresh}>Actualizar</button>
          </div>
        </section>

        <aside className="side">
          <h3>Mis cuentas</h3>
          {ibans.length > 1 && <div className="total"><small>Total</small><b>{eur(total)}</b></div>}
          <ul className="mini">
            {ibans.map((i) => (
              <li key={i} className={i === iban ? 'sel' : ''}>
                <button className="rowbtn" onClick={() => setIban(i)}><span>{i}</span><b>{accs[i]?.error ? '⚠' : accs[i] ? eur(bal(accs[i]), accs[i].currency) : '…'}</b></button>
              </li>))}
          </ul>
          {boot.err && <div className="err">{boot.err} <button className="link" onClick={() => loadIbans(true)}>Reintentar</button></div>}
          {!boot.loading && !boot.err && !ibans.length && <p className="muted s">Aún no tienes cuentas. Abre la primera desde «Abrir cuenta».</p>}
          <p className="muted s">Cuentas asociadas a tu PlacetaID.</p>
        </aside>

        <section className="panel">
          <nav className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
          {tab === 'products' ? <Products iban={iban} onOpened={(i) => { loadIbans(true, i); setTab('transactions'); say('Cuenta abierta: ' + i) }} name={name} />
            : !iban ? <div className="empty">{boot.loading ? 'Buscando tus cuentas…' : 'Abre una cuenta para empezar.'}</div>
            : tab === 'transactions' ? <Transactions key={iban + rev} iban={iban} currency={a.currency} />
            : tab === 'cards' ? <Cards key={iban} iban={iban} />
            : tab === 'receipts' ? <Receipts key={iban} iban={iban} />
            : <Membership key={iban} iban={iban} say={say} onRenewed={refresh} />}
        </section>
      </main>

      {modal === 'transfer' && <Transfer from={iban} others={ibans.filter((i) => i !== iban)} balance={bal(a)} currency={a.currency} onClose={() => setModal(null)} onDone={(m) => { setModal(null); say(m); refresh(); setTab('transactions') }} />}
      {modal === 'open' && <Products modal name={name} onClose={() => setModal(null)} onOpened={(i) => { setModal(null); loadIbans(true, i); say('Cuenta abierta: ' + i) }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

/* ---------- hooks / piezas comunes ---------- */
function useLoad(path, pick, deps = []) {
  const [s, set] = useState({ loading: true, data: [], err: '' })
  const run = useCallback(() => {
    set((p) => ({ ...p, loading: true, err: '' }))
    api(path).then((d) => set({ loading: false, data: pick ? pick(d) : d, err: '' })).catch((e) => set({ loading: false, data: pick ? [] : null, err: e.message, status: e.status }))
  }, [path, ...deps]) // eslint-disable-line
  useEffect(run, [run])
  return { ...s, reload: run }
}
const Skeleton = () => <ul>{[0, 1, 2, 3].map((i) => <li key={i}><span className="sk" style={{ width: 42, height: 42 }} /><div><span className="sk" style={{ width: '50%', height: 14 }} /></div></li>)}</ul>
const Fail = ({ e, retry }) => <div className="err">{e} <button className="link" onClick={retry}>Reintentar</button></div>

/* ---------- Movimientos ---------- */
function Transactions({ iban, currency }) {
  const { loading, data, err, reload } = useLoad(`accounts/${iban}/transactions`, (d) => list(d, 'transactions'))
  const [q, setQ] = useState(''), [f, setF] = useState('all')
  const rows = useMemo(() => data.map((t) => ({ ...t, _a: signed(t), _d: t.created_at || t.date || t.timestamp })).filter((t) => (f === 'all' || (f === 'in' ? t._a >= 0 : t._a < 0)) && (!q || JSON.stringify(t).toLowerCase().includes(q.toLowerCase()))).sort((x, y) => new Date(y._d) - new Date(x._d)), [data, q, f])
  const inc = rows.filter((t) => t._a > 0).reduce((s, t) => s + t._a, 0), out = rows.filter((t) => t._a < 0).reduce((s, t) => s + t._a, 0)
  const groups = rows.reduce((g, t) => { const k = fdate(t._d, { weekday: 'long', day: 'numeric', month: 'long' }) || 'Sin fecha'; (g[k] = g[k] || []).push(t); return g }, {})
  const csv = () => {
    const l = ['fecha;concepto;importe', ...rows.map((t) => [fdate(t._d), `"${(t.memo || t.concept || t.description || '').replace(/"/g, '""')}"`, t._a.toFixed(2).replace('.', ',')].join(';'))]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + l.join('\n')], { type: 'text/csv' })); a.download = `movimientos-${iban}.csv`; a.click()
  }
  return (<>
    <div className="stats"><div><small>Ingresos</small><b className="pos">{eur(inc, currency)}</b></div><div><small>Gastos</small><b>{eur(out, currency)}</b></div><div><small>Movimientos</small><b>{rows.length}</b></div></div>
    <div className="toolbar">
      <input placeholder="Buscar concepto, importe…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
      <div className="seg">{[['all', 'Todo'], ['in', 'Entradas'], ['out', 'Salidas']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      <button className="ghost" disabled={!rows.length} onClick={csv}>Exportar CSV</button>
    </div>
    {err && <Fail e={err} retry={reload} />}
    {loading ? <Skeleton /> : !err && !rows.length ? <div className="empty">{q || f !== 'all' ? 'Sin resultados para este filtro.' : 'Aquí aparecerá tu actividad.'}</div> :
      Object.entries(groups).map(([day, ts]) => (<div key={day}><h4 className="day">{day}</h4><ul>{ts.map((t, i) => (
        <li key={t.id || i}><span className={'dot ' + (t._a < 0 ? 'out' : 'in')}>{t._a < 0 ? '↗' : '↙'}</span>
          <div><b>{t.memo || t.concept || t.description || 'Movimiento'}</b><small>{[t.counterparty || t.counterparty_iban || t.to_iban || t.from_iban, t.reference || t.ref].filter(Boolean).join(' · ')}</small></div>
          <strong className={t._a < 0 ? 'neg' : 'pos'}>{t._a > 0 ? '+' : ''}{eur(t._a, t.currency || currency)}</strong></li>))}</ul></div>))}
  </>)
}

/* ---------- Tarjetas ---------- */
function Cards({ iban }) {
  const { loading, data, err, reload } = useLoad(`accounts/${iban}/cards`, (d) => list(d, 'cards'))
  if (loading) return <Skeleton />
  return (<>{err && <Fail e={err} retry={reload} />}{!err && !data.length && <div className="empty">Esta cuenta no tiene tarjetas.</div>}
    <div className="cards">{data.map((c, i) => (
      <div className={'card3d v' + (i % 3)} key={c.id || i}>
        <div className="top"><b>La Placeta</b><span>{c.network || c.brand || c.type || 'Débito'}</span></div>
        <div className="pan">•••• •••• •••• {c.last4 || String(c.number || c.pan || '').slice(-4) || '••••'}</div>
        <div className="bot"><span>{c.holder || c.name || 'Titular'}</span><span>{c.expiry || c.exp || (c.exp_month && `${String(c.exp_month).padStart(2, '0')}/${String(c.exp_year).slice(-2)}`) || ''}</span></div>
        {c.status && <em className={'st ' + (/active|activa/i.test(c.status) ? 'ok' : '')}>{c.status}</em>}
      </div>))}</div></>)
}

/* ---------- Recibos ---------- */
function Receipts({ iban }) {
  const { loading, data, err, reload } = useLoad(`accounts/${iban}/receipts`, (d) => list(d, 'receipts'))
  if (loading) return <Skeleton />
  return (<>{err && <Fail e={err} retry={reload} />}{!err && !data.length && <div className="empty">Sin recibos fiscales todavía.</div>}
    <ul>{data.map((r, i) => { const url = r.url || r.pdf_url || r.download_url; return (
      <li key={r.id || i}><span className="dot in">≡</span>
        <div><b>{r.number || r.reference || r.concept || r.description || 'Recibo'}</b><small>{[fdate(r.created_at || r.date), r.status].filter(Boolean).join(' · ')}</small></div>
        {r.amount != null && <strong>{eur(r.amount, r.currency)}</strong>}
        {url && /^https:\/\//.test(url) && <a className="ghost" href={url} target="_blank" rel="noopener noreferrer">Ver</a>}</li>) })}</ul></>)
}

/* ---------- Membresía (cuentas Junior) ---------- */
function Membership({ iban, say, onRenewed }) {
  const { loading, data: m, err, status, reload } = useLoad(`accounts/${iban}/membership`, (d) => d?.membership || d)
  const [busy, setBusy] = useState(false), [e, setE] = useState('')
  const idem = useRef(uid())
  if (loading) return <Skeleton />
  if (err) return status === 404 || status === 422 ? <div className="empty">Esta cuenta no tiene membresía. Solo las cuentas Junior la incluyen.</div> : <Fail e={err} retry={reload} />
  const until = m?.expires_at || m?.valid_until || m?.renewal_date || m?.next_renewal
  const active = /active|activa|vigente/i.test(m?.status || '') || (until && new Date(until) > new Date())
  const days = until ? Math.ceil((new Date(until) - Date.now()) / 864e5) : null
  const renew = async () => {
    setBusy(true); setE('')
    try { await api(`accounts/${iban}/membership/renew`, {}, idem.current); idem.current = uid(); say('Membresía renovada'); reload(); onRenewed() } catch (x) { setE(x.message) } finally { setBusy(false) }
  }
  return (<div className="member">
    <div className={'badge ' + (active ? 'ok' : 'warn')}>{active ? 'Activa' : m?.status || 'Caducada'}</div>
    <h3>Membresía Junior</h3>
    <p className="muted">{until ? (days >= 0 ? `Vence el ${fdate(until)} · quedan ${days} días` : `Caducó el ${fdate(until)}`) : 'Sin fecha de vencimiento disponible.'}</p>
    {m?.price != null && <p className="muted s">Cuota: {eur(m.price, m.currency)}</p>}
    {e && <div className="err">{e}</div>}
    <button className="btn" disabled={busy} onClick={renew}>{busy ? 'Renovando…' : 'Renovar membresía'}</button>
    <p className="muted s">La renovación se cobra de la propia cuenta y requiere saldo suficiente.</p>
  </div>)
}

/* ---------- Productos / abrir cuenta ---------- */
function Products({ iban, onOpened, name, modal, onClose }) {
  const { loading, data, err, reload } = useLoad('products', (d) => list(d, 'products'))
  const [busy, setBusy] = useState(''), [e, setE] = useState(''), idem = useRef(uid())
  const open = async (p) => {
    setBusy(p.id || p.code); setE('')
    try {
      const d = await api('accounts', { product_id: p.id, product: p.code || p.slug || p.id, holder_name: name }, idem.current)
      idem.current = uid(); const n = acct(d).iban || d.iban
      n ? onOpened(n) : setE('Cuenta creada, pero la respuesta no incluye IBAN. Vincúlala manualmente.')
    } catch (x) { setE(x.message) } finally { setBusy('') }
  }
  const body = (<>
    {err && <Fail e={err} retry={reload} />}{loading ? <Skeleton /> : !err && !data.length && <div className="empty">No hay productos disponibles.</div>}
    {e && <div className="err">{e}</div>}
    <div className="prods">{data.map((p, i) => (
      <div className="prod" key={p.id || i}>
        <div><b>{p.name || p.title}</b>{p.description && <p className="muted s">{p.description}</p>}
          <div className="tags">{p.type && <span className="chip dark">{p.type}</span>}{p.monthly_fee != null && <span className="chip dark">{eur(p.monthly_fee, p.currency)}/mes</span>}{p.fee != null && p.monthly_fee == null && <span className="chip dark">{eur(p.fee, p.currency)}</span>}{p.interest_rate != null && <span className="chip dark">{p.interest_rate}% TAE</span>}</div></div>
        <button className="btn" disabled={!!busy} onClick={() => open(p)}>{busy === (p.id || p.code) ? 'Abriendo…' : 'Abrir'}</button>
      </div>))}</div></>)
  if (!modal) return body
  return <div className="modal" onClick={onClose}><div className="sheet wide" onClick={(x) => x.stopPropagation()}><h3>Abrir una cuenta</h3><p className="muted">Elige un producto del catálogo.</p>{body}<button className="btn ghost-btn" onClick={onClose}>Cerrar</button></div></div>
}

/* ---------- Transferencia (formulario → revisión → resultado) ---------- */
function Transfer({ from, others, balance, currency, onClose, onDone }) {
  const [f, setF] = useState({ to: '', amount: '', memo: '' }), [step, setStep] = useState(0), [e, setE] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [stat, setStat] = useState('')
  const idem = useRef(uid()) // misma clave durante toda la operación: un doble clic nunca duplica
  const amount = Number(f.amount), to = f.to.trim().toUpperCase()
  const check = (ev) => {
    ev.preventDefault(); setE('')
    if (!IBAN_RE.test(to)) return setE('IBAN de destino no válido')
    if (to === from) return setE('El destino debe ser otra cuenta')
    if (!(amount > 0)) return setE('Introduce un importe válido')
    if (amount > balance) return setE('Saldo insuficiente: dispones de ' + eur(balance, currency))
    setStep(1)
  }
  const send = async () => {
    setBusy(true); setE('')
    try { const d = await api('transfers', { from_iban: from, to_iban: to, amount: Math.round(amount * 100) / 100, memo: f.memo.trim() }, idem.current); setRes(d.transfer || d); setStep(2) } catch (x) { setE(x.message); setStep(0) } finally { setBusy(false) }
  }
  const ref = res && (res.reference || res.ref || res.id)
  const track = async () => { try { const d = await api('transfers/' + encodeURIComponent(ref)); setStat((d.transfer || d).status || 'Registrada') } catch (x) { setStat(x.message) } }
  return (<div className="modal" onClick={step === 2 ? () => onDone('Transferencia enviada') : onClose}><div className="sheet" onClick={(x) => x.stopPropagation()}>
    {step === 0 && <form onSubmit={check}>
      <h3>Nueva transferencia</h3><p className="muted">Desde {from} · disponible {eur(balance, currency)}</p>
      <label>IBAN de destino<input required list="mine" value={f.to} onChange={(x) => setF({ ...f, to: x.target.value })} placeholder="PZ-0001-0003" /></label>
      <datalist id="mine">{others.map((i) => <option key={i} value={i} />)}</datalist>
      <label>Importe (€)<input required type="number" inputMode="decimal" step="0.01" min="0.01" value={f.amount} onChange={(x) => setF({ ...f, amount: x.target.value })} /></label>
      <label>Concepto<input maxLength={80} value={f.memo} onChange={(x) => setF({ ...f, memo: x.target.value })} /></label>
      {e && <div className="err">{e}</div>}<button className="btn big">Revisar</button></form>}
    {step === 1 && <div><h3>Confirma la transferencia</h3>
      <dl className="sum"><dt>Desde</dt><dd>{from}</dd><dt>Para</dt><dd>{to}</dd><dt>Importe</dt><dd className="big">{eur(amount, currency)}</dd>{f.memo && <><dt>Concepto</dt><dd>{f.memo}</dd></>}</dl>
      {e && <div className="err">{e}</div>}
      <button className="btn big" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Confirmar y enviar'}</button>
      <button className="btn big ghost-btn" disabled={busy} onClick={() => setStep(0)}>Editar</button></div>}
    {step === 2 && <div className="done"><div className="check">✓</div><h3>Transferencia enviada</h3><p className="muted">{eur(amount, currency)} a {to}</p>
      {ref && <p className="s">Referencia <code>{ref}</code></p>}
      {ref && <button className="ghost" onClick={track}>Comprobar estado</button>}{stat && <p className="s"><b>Estado:</b> {stat}</p>}
      <button className="btn big" onClick={() => onDone('Transferencia enviada')}>Listo</button></div>}
  </div></div>)
}

/* ---------- DIP temporal ---------- */
function DipPrompt({ name, cancel }) {
  const [v, setV] = useState(''), [e, setE] = useState(''), [b, setB] = useState(false)
  const go = async (ev) => {
    ev.preventDefault(); setB(true); setE('')
    try {
      const r = await fetch('/api/auth/dip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dip: v }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Error ' + r.status)
      location.reload()
    } catch (x) { setE(x.message); setB(false) }
  }
  return (<main className="login"><div className="login-art"><div className="orb o1" /><div className="orb o2" /><h1>Un último<br />paso.</h1><p>Necesitamos tu DIP para buscar tus cuentas.</p></div>
    <form className="login-card" onSubmit={go}><div className="logo">P</div><h2>Hola, {(name || 'Cliente').split(' ')[0]}</h2>
      <p className="muted">Introduce tu DIP. Solo se guarda en esta sesión, nunca en el navegador.</p>
      <label className="s" style={{ marginTop: 16, fontWeight: 600 }}>DIP<input autoFocus required value={v} onChange={(x) => setV(x.target.value)} placeholder="Tu DIP" style={{ marginTop: 6 }} /></label>
      {e && <div className="err">{e}</div>}
      <button className="btn big" disabled={b}>{b ? 'Buscando…' : 'Ver mis cuentas'}</button>
      {cancel && <button type="button" className="btn big ghost-btn" onClick={cancel}>Cancelar</button>}</form></main>)
}
