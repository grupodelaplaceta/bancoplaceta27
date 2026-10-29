'use client'
import { useEffect, useState, useCallback } from 'react'
const arr = (d) => Array.isArray(d) ? d : d?.data || d?.items || d?.transactions || d?.cards || d?.receipts || []
const eur = (n, c = 'EUR') => new Intl.NumberFormat('es-ES', { style: 'currency', currency: c }).format(Number(n) || 0)
const api = async (p, body) => {
  const r = await fetch('/api/bank/' + p, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error?.message || d.message || (typeof d.error === 'string' && d.error) || 'Error ' + r.status)
  return d
}
export default function Dashboard({ name }) {
  const [ibans, setIbans] = useState([]), [iban, setIban] = useState(''), [acc, setAcc] = useState(null)
  const [tab, setTab] = useState('transactions'), [list, setList] = useState([]), [add, setAdd] = useState(''), [err, setErr] = useState('')
  const [tr, setTr] = useState(false), [toast, setToast] = useState('')
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('ibans') || '[]'); setIbans(v); setIban(v[0] || '') } catch {} }, [])
  const load = useCallback(async () => {
    if (!iban) return setAcc(null)
    setErr('')
    try { setAcc(await api('accounts/' + iban)); setList(arr(await api(`accounts/${iban}/${tab}`))) } catch (e) { setErr(e.message); setList([]) }
  }, [iban, tab])
  useEffect(() => { load() }, [load])
  const link = async (e) => {
    e.preventDefault(); const v = add.trim().toUpperCase(); if (!v) return
    try { await api('accounts/' + v); const n = [...new Set([...ibans, v])]; localStorage.setItem('ibans', JSON.stringify(n)); setIbans(n); setIban(v); setAdd('') } catch (x) { setErr(x.message) }
  }
  const a = acc?.account || acc || {}
  return (
    <div className="app">
      <header><div className="brand"><span className="logo sm">P</span>La Placeta</div>
        <div className="who">Hola, {name.split(' ')[0]}<a href="/api/auth/logout" className="ghost">Salir</a></div></header>
      <main className="grid">
        <section className="hero">
          <div className="orb o1" /><div className="orb o2" />
          <div className="row"><select value={iban} onChange={(e) => setIban(e.target.value)}>{ibans.length ? ibans.map((i) => <option key={i}>{i}</option>) : <option>Sin cuentas</option>}</select>
            <span className="chip">{a.type || a.product || 'Cuenta'}</span></div>
          <p className="lbl">Saldo disponible</p>
          <div className="bal">{acc ? eur(a.balance ?? a.available_balance, a.currency) : '—'}</div>
          <div className="acts"><button className="btn light" disabled={!iban} onClick={() => setTr(true)}>Transferir</button>
            <button className="btn glass" onClick={() => setTab('cards')} disabled={!iban}>Tarjetas</button></div>
        </section>
        <aside className="side">
          <h3>Vincular una cuenta</h3>
          <form onSubmit={link}><input placeholder="PZ-0001-0002" value={add} onChange={(e) => setAdd(e.target.value)} /><button className="btn">Añadir</button></form>
          <p className="muted s">Se guarda en este navegador. Solo verás cuentas de tu entidad.</p>
        </aside>
        <section className="panel">
          <nav className="tabs">{[['transactions', 'Movimientos'], ['cards', 'Tarjetas'], ['receipts', 'Recibos']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
          {err && <div className="err">{err}</div>}
          {!iban && <div className="empty">Añade tu IBAN para ver tus movimientos.</div>}
          {iban && !err && !list.length && <div className="empty">Aquí aparecerá tu actividad.</div>}
          <ul>{list.map((t, i) => tab === 'transactions' ? (
            <li key={t.id || i}><span className={'dot ' + (Number(t.amount) < 0 ? 'out' : 'in')}>{Number(t.amount) < 0 ? '↗' : '↙'}</span>
              <div><b>{t.memo || t.concept || t.description || 'Movimiento'}</b><small>{new Date(t.created_at || t.date || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</small></div>
              <strong className={Number(t.amount) < 0 ? 'neg' : 'pos'}>{eur(t.amount, t.currency)}</strong></li>
          ) : (
            <li key={t.id || i}><span className="dot in">{tab === 'cards' ? '▭' : '≡'}</span>
              <div><b>{t.name || t.holder || t.number || (t.last4 && '•••• ' + t.last4) || t.reference || 'Elemento'}</b><small>{t.status || t.type || t.date || ''}</small></div></li>))}</ul>
        </section>
      </main>
      {tr && <Transfer from={iban} onClose={() => setTr(false)} onDone={() => { setTr(false); setToast('Transferencia enviada'); load(); setTimeout(() => setToast(''), 3000) }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
function Transfer({ from, onClose, onDone }) {
  const [f, setF] = useState({ to: '', amount: '', memo: '' }), [e, setE] = useState(''), [b, setB] = useState(false)
  const go = async (ev) => {
    ev.preventDefault(); setB(true); setE('')
    try { await api('transfers', { from_iban: from, to_iban: f.to.trim().toUpperCase(), amount: Number(f.amount), memo: f.memo }); onDone() } catch (x) { setE(x.message); setB(false) }
  }
  return (<div className="modal" onClick={onClose}><form className="sheet" onClick={(x) => x.stopPropagation()} onSubmit={go}>
    <h3>Nueva transferencia</h3><p className="muted">Desde {from}</p>
    <label>IBAN de destino<input required value={f.to} onChange={(x) => setF({ ...f, to: x.target.value })} placeholder="PZ-0001-0003" /></label>
    <label>Importe (€)<input required type="number" step="0.01" min="0.01" value={f.amount} onChange={(x) => setF({ ...f, amount: x.target.value })} /></label>
    <label>Concepto<input value={f.memo} onChange={(x) => setF({ ...f, memo: x.target.value })} /></label>
    {e && <div className="err">{e}</div>}
    <button className="btn big" disabled={b}>{b ? 'Enviando…' : 'Enviar transferencia'}</button></form></div>)
}
