'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { runOp } from '../../lib/opsclient'
import { normOrg, countPeople } from '../../lib/org'
import { kindOf } from '../../lib/kinds'
import { list, pick, eur, fmtDate } from '../../lib/shape'
import { useApp, Icon, Sheet, Skeleton, ErrBox, Empty } from './kit'

/** Lanza una operación de lectura de /api/ops para la cuenta activa. */
function useOp(iban, op, valores, on = true) {
  const [st, setSt] = useState({ data: null, error: null, loading: on })
  const [n, setN] = useState(0)
  const key = JSON.stringify(valores || {})
  useEffect(() => {
    if (!on || !iban) return
    let dead = false
    setSt((s) => ({ ...s, loading: true, error: null }))
    runOp(iban, op, valores || {})
      .then((d) => !dead && setSt({ data: d, error: null, loading: false }))
      .catch((e) => !dead && setSt({ data: null, error: e, loading: false }))
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iban, op, key, on, n])
  return { ...st, reload: useCallback(() => setN((x) => x + 1), []) }
}

const PALETTE = ['#0B2E59', '#0E7C7B', '#C4553A', '#6B4FBB', '#B54708', '#2F6FD6', '#3A4453']
const colorOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length] }
const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function Empresa() {
  const { cur } = useApp()
  const kind = cur ? kindOf(cur.raw) : 'personal'
  const [tab, setTab] = useState('org')
  if (!cur) return null
  return (
    <>
      <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={tab === 'org'} className={tab === 'org' ? 'on' : ''} onClick={() => setTab('org')}>Organigrama</button>
        <button role="tab" aria-selected={tab === 'ficha'} className={tab === 'ficha' ? 'on' : ''} onClick={() => setTab('ficha')}>{kind === 'institucional' ? 'Empresas' : 'Ficha'}</button>
      </div>
      {tab === 'org' ? <Org iban={cur.iban} /> : kind === 'institucional' ? <Empresas iban={cur.iban} /> : <Propia cur={cur} />}
    </>
  )
}

/* ───────────────────────────── Organigrama ───────────────────────────── */

const countUnits = (ns) => ns.reduce((a, n) => a + 1 + countUnits(n.children), 0)
const countPosts = (ns) => ns.reduce((a, n) => a + n.posts.length + countPosts(n.children), 0)
const countVacant = (ns) => ns.reduce((a, n) => a + n.posts.filter((p) => !p.people.length).length + countVacant(n.children), 0)
const allIds = (ns) => ns.flatMap((n) => [n.id, ...allIds(n.children)])

/** Filtra el árbol: se queda lo que coincide (unidad, puesto o persona) y sus ancestros. */
function filterTree(ns, q) {
  if (!q) return ns
  return ns.flatMap((n) => {
    if (norm(n.name).includes(q)) return [n]
    const posts = n.posts.filter((p) => norm(p.name).includes(q) || p.people.some((x) => norm(x.name).includes(q) || norm(x.dip).includes(q)))
    const children = filterTree(n.children, q)
    return posts.length || children.length ? [{ ...n, posts, children }] : []
  })
}

function Org({ iban }) {
  const r = useOp(iban, 'org_ver')
  const nodes = useMemo(() => normOrg(r.data), [r.data])
  const [q, setQ] = useState(''), [open, setOpen] = useState({}), [who, setWho] = useState(null)
  const term = norm(q.trim())
  const shown = useMemo(() => (nodes ? filterTree(nodes, term) : []), [nodes, term])
  const isOpen = (id, depth) => (term ? true : id in open ? open[id] : depth < 1)
  const toggle = (id, depth) => setOpen((o) => ({ ...o, [id]: !(id in o ? o[id] : depth < 1) }))

  if (r.loading && !r.data) return <Skeleton n={4} />
  if (r.error) return <ErrBox error={r.error} onRetry={r.reload} />
  if (!nodes) {
    return r.data && Object.keys(r.data).length
      ? <><p className="muted small" style={{ marginBottom: 12 }}>El organigrama llegó con un formato que no reconozco; esto es lo que hay:</p><DataView data={r.data} /></>
      : <Empty icon="tree" title="Sin organigrama" text="Todavía no hay unidades ni puestos creados." />
  }
  return (
    <>
      <div className="org-sum">
        <div><b>{countUnits(nodes)}</b><span>Unidades</span></div>
        <div><b>{nodes.reduce((a, n) => a + countPeople(n), 0)}</b><span>Personas</span></div>
        <div><b>{countVacant(nodes)}</b><span>Vacantes</span></div>
      </div>
      <div className="org-tools">
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad, puesto o persona" aria-label="Buscar en el organigrama" />
        <button className="round-btn" aria-label="Expandir todo" onClick={() => setOpen(Object.fromEntries(allIds(nodes).map((i) => [i, true])))}><Icon n="down" size={18} /></button>
        <button className="round-btn" aria-label="Contraer todo" onClick={() => setOpen(Object.fromEntries(allIds(nodes).map((i) => [i, false])))}><Icon n="up" size={18} /></button>
      </div>
      {!shown.length && <Empty icon="search" title="Sin resultados" text="Prueba con otro nombre o puesto." />}
      {shown.map((n) => <Unit key={n.id} n={n} depth={0} isOpen={isOpen} toggle={toggle} onWho={setWho} />)}
      {who && (
        <Sheet title={who.person.name} onClose={() => setWho(null)}>
          <div className="co-head" style={{ marginTop: 6 }}>
            <span className="co-logo" style={{ background: colorOf(who.person.name), borderRadius: '50%' }}>{initials(who.person.name)}</span>
            <div><b style={{ display: 'block', fontSize: 17 }}>{who.post.name}</b><span className="muted small">{who.unit.name}</span></div>
          </div>
          <div className="card"><div className="kv">
            <div className="row"><span>Puesto</span><span>{who.post.name}</span></div>
            <div className="row"><span>Unidad</span><span>{who.unit.name}</span></div>
            {who.person.dip && <div className="row"><span>DIP</span><span>{who.person.dip}</span></div>}
            {who.person.since && <div className="row"><span>Desde</span><span>{fmtDate(who.person.since)}</span></div>}
          </div></div>
        </Sheet>
      )}
    </>
  )
}

function Unit({ n, depth, isOpen, toggle, onWho }) {
  const open = isOpen(n.id, depth)
  const people = countPeople(n)
  const sub = [`${people} ${people === 1 ? 'persona' : 'personas'}`, n.posts.length ? `${n.posts.length} ${n.posts.length === 1 ? 'puesto' : 'puestos'}` : '', n.children.length ? `${n.children.length} ${n.children.length === 1 ? 'subunidad' : 'subunidades'}` : ''].filter(Boolean).join(' · ')
  return (
    <div className={'org-node d' + Math.min(depth, 3) + (open ? ' open' : '') + (n.closed ? ' closed-u' : '')}>
      <button className="org-unit" onClick={() => toggle(n.id, depth)} aria-expanded={open}>
        <span className="org-ico"><Icon n={depth === 0 ? 'building' : 'users'} size={20} /></span>
        <span className="org-name">{n.name}<small>{sub}</small></span>
        {n.closed && <span className="badge mut">Cerrada</span>}
        <span className="org-chev"><Icon n="chev" size={18} /></span>
      </button>
      {open && (
        <div className="org-body">
          {!n.posts.length && !n.children.length && <p className="muted small" style={{ padding: '8px 4px' }}>Sin puestos todavía.</p>}
          {n.posts.map((p, i) => (
            <div className="org-post" key={p.id + '-' + i}>
              <div className="pt">{p.name}</div>
              <div className="org-people">
                {p.people.length
                  ? p.people.map((x, j) => (
                    <button key={j} className="who" onClick={() => onWho({ person: x, post: p, unit: n })}>
                      <i style={{ background: colorOf(x.name) }}>{initials(x.name)}</i>{x.name}
                    </button>
                  ))
                  : <span className="vacant">Vacante</span>}
              </div>
            </div>
          ))}
          {n.children.map((c) => <Unit key={c.id} n={c} depth={depth + 1} isOpen={isOpen} toggle={toggle} onWho={onWho} />)}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────── Empresas y ficha ───────────────────────────── */

const rowId = (r) => r?.id ?? r?.codigo ?? r?.ref ?? r?.uuid ?? ''
const estadoTone = (s) => (/activ|vigent|ok/i.test(s) ? 'ok' : /suspend|pend/i.test(s) ? 'warn' : /baja|cerrad|inactiv/i.test(s) ? 'bad' : 'mut')

function Logo({ name, url }) {
  return <span className="co-logo" style={url ? { background: 'var(--card)' } : { background: colorOf(name) }}>{url ? <img src={url} alt="" /> : initials(name)}</span>
}

function Empresas({ iban }) {
  const r = useOp(iban, 'empresas_ver')
  const rows = list(r.data, 'empresas')
  const [sel, setSel] = useState(null)
  const [q, setQ] = useState('')
  const shown = rows.filter((x) => !q || norm(JSON.stringify([pick(x, ['nombre', 'name'], ''), pick(x, ['cif'], '')])).includes(norm(q)))
  if (r.loading && !r.data) return <Skeleton n={3} />
  if (r.error) return <ErrBox error={r.error} onRetry={r.reload} />
  if (!rows.length) return <Empty icon="building" title="Sin empresas" text="Aún no hay empresas dadas de alta en tu entidad." />
  return (
    <>
      <div className="org-tools"><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa o CIF" aria-label="Buscar empresa" /></div>
      <div className="list">
        {shown.map((x, i) => {
          const name = pick(x, ['nombre', 'name', 'razon_social'], 'Empresa'), st = pick(x, ['estado', 'status'], '')
          return (
            <button key={String(rowId(x)) + i} className="item" onClick={() => setSel(x)}>
              <Logo name={name} url={pick(x, ['logo', 'logo_url'], '')} />
              <span className="i-main"><span className="i-title" style={{ display: 'block' }}>{name}</span><span className="i-sub">{pick(x, ['cif', 'cip'], 'Sin CIF')}</span></span>
              {st && <span className={'badge ' + estadoTone(st)}>{String(st)}</span>}
              <Icon n="chev" size={18} />
            </button>
          )
        })}
      </div>
      {sel && <FichaEmpresa iban={iban} row={sel} onClose={() => setSel(null)} />}
    </>
  )
}

function FichaEmpresa({ iban, row, onClose }) {
  const id = String(rowId(row))
  const r = useOp(iban, 'empresa_ficha', { id }, !!id)
  const name = pick(row, ['nombre', 'name', 'razon_social'], 'Empresa')
  const d = r.data
  const org = d && normOrg(d.organigrama ?? d.organization ?? null)
  const rest = d && typeof d === 'object' && !Array.isArray(d) ? Object.fromEntries(Object.entries(d).filter(([k]) => !/^organigrama$/i.test(k) || !org)) : d
  return (
    <Sheet title="Ficha de empresa" onClose={onClose} wide>
      <div className="co-head" style={{ marginTop: 6 }}>
        <Logo name={name} url={pick(row, ['logo', 'logo_url'], '')} />
        <div style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 19 }}>{name}</b><span className="muted small">{pick(row, ['cif', 'cip'], '')}</span></div>
      </div>
      {r.loading && !d && <Skeleton n={3} />}
      <ErrBox error={r.error} onRetry={r.reload} />
      {rest && <DataView data={rest} />}
      {org && (
        <section className="section"><div className="section-h"><h2>Organigrama</h2></div>
          {org.map((n) => <MiniUnit key={n.id} n={n} depth={0} />)}
        </section>
      )}
    </Sheet>
  )
}

/** Versión compacta y siempre desplegada del organigrama, para la ficha. */
function MiniUnit({ n, depth }) {
  return (
    <div className={'org-node open d' + Math.min(depth, 3)}>
      <div className="org-unit" style={{ cursor: 'default' }}>
        <span className="org-ico"><Icon n={depth === 0 ? 'building' : 'users'} size={18} /></span>
        <span className="org-name">{n.name}<small>{countPeople(n)} personas</small></span>
      </div>
      <div className="org-body">
        {n.posts.map((p, i) => (
          <div className="org-post" key={i}><div className="pt">{p.name}</div>
            <div className="org-people">{p.people.length ? p.people.map((x, j) => <span className="who" key={j}><i style={{ background: colorOf(x.name) }}>{initials(x.name)}</i>{x.name}</span>) : <span className="vacant">Vacante</span>}</div>
          </div>
        ))}
        {n.children.map((c) => <MiniUnit key={c.id} n={c} depth={depth + 1} />)}
      </div>
    </div>
  )
}

function Propia({ cur }) {
  return (
    <>
      <div className="co-head"><Logo name={cur.name} url="" /><div><b style={{ display: 'block', fontSize: 19 }}>{cur.name}</b><span className="muted small">{cur.iban}</span></div></div>
      <DataView data={cur.raw} />
    </>
  )
}

/* ───────────────── Visor genérico de datos (tolerante a cualquier forma) ───────────────── */

const HIDE = /(secret|clave|key|token|firma|hash|password|signature)/i
const label = (k) => { const s = String(k).replace(/[_-]+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1) }
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const isMoney = (k) => /(saldo|importe|presupuesto|monto|total|balance|cantidad|disponible|limite|salario|sueldo|nomina|gasto)/i.test(k)
function fmt(k, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') return isMoney(k) ? eur(v) : String(v)
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDate(s) : s
}

function DataView({ data, depth = 0 }) {
  if (data == null) return null
  if (Array.isArray(data)) return <RecList items={data} />
  if (!isObj(data)) return <p>{String(data)}</p>
  const entries = Object.entries(data).filter(([k]) => !HIDE.test(k))
  const scalars = entries.filter(([, v]) => !isObj(v) && !Array.isArray(v))
  const nested = entries.filter(([, v]) => (Array.isArray(v) ? v.length : isObj(v) && Object.keys(v).length))
  return (
    <>
      {scalars.length > 0 && <section className="card"><div className="kv">{scalars.map(([k, v]) => <div className="row" key={k}><span>{label(k)}</span><span>{fmt(k, v)}</span></div>)}</div></section>}
      {nested.map(([k, v]) => (
        <section className="section" key={k}>
          <div className="section-h"><h2>{label(k)}</h2></div>
          {Array.isArray(v) ? <RecList items={v} /> : depth < 2 ? <DataView data={v} depth={depth + 1} /> : <p className="muted small">{JSON.stringify(v)}</p>}
        </section>
      ))}
    </>
  )
}

function RecList({ items }) {
  if (items.every((x) => !isObj(x))) return <div className="chips" style={{ flexWrap: 'wrap' }}>{items.map((x, i) => <span key={i} className="chip">{String(x)}</span>)}</div>
  return (
    <div className="list">
      {items.filter(isObj).map((it, i) => {
        const title = pick(it, ['nombre', 'name', 'titulo', 'concepto', 'descripcion', 'dip', 'iban', 'id'], 'Elemento')
        const money = Object.entries(it).find(([k, v]) => typeof v === 'number' && isMoney(k))
        const st = pick(it, ['estado', 'status', 'rol', 'role'], '')
        const sub = Object.entries(it).filter(([k, v]) => !HIDE.test(k) && !isObj(v) && !Array.isArray(v) && v !== '' && v != null && String(v) !== String(title) && !(money && k === money[0]) && !/^(estado|status|rol|role)$/.test(k)).slice(0, 3).map(([k, v]) => `${label(k)}: ${fmt(k, v)}`).join(' · ')
        return (
          <div className="item" key={i}>
            <span className="i-main"><span className="i-title" style={{ display: 'block' }}>{String(title)}</span>{sub && <span className="i-sub">{sub}</span>}</span>
            {st && <span className={'badge ' + estadoTone(st)}>{String(st)}</span>}
            {money && <span className="i-amt">{eur(money[1])}</span>}
          </div>
        )
      })}
    </div>
  )
}
