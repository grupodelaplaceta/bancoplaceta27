'use client'
import { useState } from 'react'
import { useRes, api } from '../../lib/client'
import { list, fmtDateTime, pick } from '../../lib/shape'
import { useApp, Skel, ErrorBox, Empty, Icon, Spinner, KV } from './ui'

export default function Security() {
  const { info, tick, bump, toast, can, name } = useApp()
  const r = useRes('sessions', tick)
  const items = list(r.data, 'sesiones')
  const [sure, setSure] = useState(false), [busy, setBusy] = useState(false)
  const closeOthers = async () => {
    setBusy(true)
    try { const d = await api('sessions', { method: 'DELETE' }); toast(`Sesiones cerradas: ${d?.cerradas ?? 0}`); setSure(false); bump() } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const PERM = { 'me:read': 'Consultar', 'me:transfer': 'Mover dinero', 'me:contratar': 'Contratar', 'me:seguridad': 'Seguridad' }
  return (
    <div className="stack">
      <section className="panel">
        <div className="sec-h"><h2>Tu acceso</h2></div>
        <KV rows={[['Cliente', name], ...(info?.banco ? [['Entidad', `${info.banco.nombre || ''} ${info.banco.codigo ? '(' + info.banco.codigo + ')' : ''}`.trim()]] : []), ['Permisos de esta sesión', (info?.permisos || []).map((p) => PERM[p] || p).join(', ') || '—']]} />
        <p className="muted s">Por seguridad tu sesión bancaria dura pocos minutos y se renueva sola al volver a entrar con PlacetaID.</p>
      </section>
      <section className="panel">
        <div className="sec-h"><h2>Sesiones abiertas</h2></div>
        <ErrorBox error={r.error} onRetry={r.reload} />
        {r.loading && !r.data && <Skel n={3} />}
        {r.data && !items.length && <Empty icon="lock" title="Solo esta sesión" text="No hay otras sesiones abiertas." />}
        <ul className="rows">
          {items.map((s, i) => (
            <li key={s.id || i}><div className="row static"><span className="dot in"><Icon n="lock" size={18} /></span>
              <span className="row-m"><b>{pick(s, ['dispositivo', 'origen', 'descripcion'], 'Sesión ' + (i + 1))}</b><small>{[s.creada && 'desde ' + fmtDateTime(s.creada), s.expira && 'caduca ' + fmtDateTime(s.expira)].filter(Boolean).join(' · ') || ' '}</small></span></div></li>
          ))}
        </ul>
        {can('me:seguridad') && items.length > 1 && (
          <div className="sheet-f" style={{ justifyContent: 'flex-start' }}>
            {sure ? <><button className="btn" onClick={() => setSure(false)}>No</button><button className="btn primary" onClick={closeOthers} disabled={busy}>{busy ? <Spinner /> : 'Sí, cerrar las demás'}</button></>
              : <button className="btn" onClick={() => setSure(true)}>Cerrar todas las demás sesiones</button>}
          </div>
        )}
      </section>
    </div>
  )
}
