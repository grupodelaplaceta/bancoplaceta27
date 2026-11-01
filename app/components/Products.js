'use client'
import { useRes } from '../../lib/client'
import { list, pick, eur, facts, label, fmtVal } from '../../lib/shape'
import { useApp, Skel, ErrorBox, Empty, Icon, Badge } from './ui'

const USED = ['id', 'product_id', 'code', 'slug', 'name', 'title', 'description', 'type', 'kind', 'active', 'features', 'perks', 'benefits', 'created_at', 'updated_at']

export default function Products() {
  const { tick, openAccount } = useApp()
  const r = useRes('products', tick)
  const items = list(r.data, 'products')
  return (
    <div className="stack">
      <p className="muted lead">Elige el producto que mejor encaja y ábrelo en un paso. La cuenta se vincula a tu usuario automáticamente.</p>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {!r.loading && !r.error && !items.length && <Empty icon="bag" title="Sin productos disponibles" text="Ahora mismo no hay productos activos en el catálogo." />}
      <div className="prod-grid">
        {items.map((p, i) => {
          const name = pick(p, ['name', 'title', 'code'], 'Producto')
          const feats = [].concat(pick(p, ['features', 'perks', 'benefits'], [])).filter((x) => typeof x === 'string')
          const f = facts(p, USED, p.currency || 'EUR').slice(0, 4)
          const isJr = /junior/i.test(name)
          return (
            <article key={p.id || p.code || i} className={'prod' + (isJr ? ' jr' : '')}>
              <div className="prod-h"><h3>{name}</h3>{pick(p, ['type', 'kind']) && <span className="tag">{String(pick(p, ['type', 'kind']))}</span>}</div>
              <p className="muted">{pick(p, ['description'], 'Cuenta de La Placeta.')}</p>
              {!!f.length && <dl className="kv tight">{f.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
              {!!feats.length && <ul className="feats">{feats.map((x) => <li key={x}><Icon n="check" size={16} />{x}</li>)}</ul>}
              <button className="btn primary" onClick={() => openAccount(p)}><Icon n="plus" size={18} />Abrir cuenta</button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
