'use client'
import { useState } from 'react'
import { useRes, api } from '../../lib/client'
import { list, pick, isRead, txTitle, fmtDateTime, eur, txDate } from '../../lib/shape'
import { useApp, Skel, ErrorBox, Empty, Icon, Spinner } from './ui'

export default function Notifications() {
  const { tick, bumpAll, toast, openDetail } = useApp()
  const [onlyNew, setOnlyNew] = useState(false), [busy, setBusy] = useState(false)
  const r = useRes(`notifications?limite=100${onlyNew ? '&solo_nuevas=1' : ''}`, tick)
  const items = list(r.data, 'notificaciones')
  const fresh = items.filter((n) => !isRead(n) && n.id !== undefined)
  const markAll = async () => {
    setBusy(true)
    try { await api('notifications/read', { method: 'POST', body: { ids: fresh.map((n) => n.id) } }); toast('Avisos marcados como leídos'); bumpAll() } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <section className="panel">
      <div className="toolbar">
        <label className="check"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />Solo no leídas</label>
        <button className="chipbtn" onClick={markAll} disabled={busy || !fresh.length}>{busy ? <Spinner /> : <><Icon n="check" size={14} />Marcar todas como leídas ({fresh.length})</>}</button>
      </div>
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading && !r.data && <Skel n={4} />}
      {r.data && !items.length && <Empty icon="bell" title={onlyNew ? 'No tienes avisos nuevos' : 'Sin avisos'} text="Aquí verás los ingresos y cargos de tus cuentas." />}
      <ul className="rows">
        {items.map((n, i) => {
          const amt = pick(n, ['importe', 'amount'])
          return (
            <li key={n.id ?? i} className={isRead(n) ? '' : 'unread'}>
              <button className="row" onClick={() => openDetail('Aviso', n)}>
                <span className="dot in"><Icon n="bell" size={18} /></span>
                <span className="row-m"><b>{pick(n, ['titulo', 'mensaje', 'texto'], txTitle(n))}</b><small>{fmtDateTime(txDate(n))}</small></span>
                {amt !== undefined && <strong className="amt sens">{eur(amt)}</strong>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
