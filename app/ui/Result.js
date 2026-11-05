'use client'
import { useState } from 'react'

const cell = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
const rowsOf = (d) => {
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') { const arrs = Object.values(d).filter(Array.isArray); if (arrs.length === 1) return arrs[0] }
  return null
}
// Valores que la API enseña una sola vez (claves, secretos de webhook…)
const secrets = (d, out = [], k = '') => {
  if (typeof d === 'string') { if (d.length >= 12 && /(clave|secret|key|token|plk_)/i.test(k + d.slice(0, 4))) out.push([k, d]) }
  else if (d && typeof d === 'object') Object.entries(d).forEach(([kk, v]) => secrets(v, out, kk))
  return out
}

function Copy({ v }) {
  const [ok, setOk] = useState(false)
  return <button type="button" className="mini" onClick={() => { navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1500) }}>{ok ? 'Copiado' : 'Copiar'}</button>
}

export default function Result({ data }) {
  const rows = rowsOf(data)
  const sec = secrets(data)
  const isObj = data && typeof data === 'object' && !Array.isArray(data)
  const cols = rows?.length && typeof rows[0] === 'object' ? [...new Set(rows.slice(0, 20).flatMap((r) => Object.keys(r)))].slice(0, 8) : null
  return (
    <div className="res">
      {sec.length > 0 && <div className="warn"><b>Cópialo ahora: no se volverá a mostrar.</b>
        {sec.map(([k, v]) => <div key={k + v} className="secret"><code>{v}</code><Copy v={v} /></div>)}</div>}
      {rows && !rows.length && <div className="empty s">Sin resultados.</div>}
      {cols && <div className="tbl"><table><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id || i}>{cols.map((c) => <td key={c}>{cell(r[c])}</td>)}</tr>)}</tbody></table></div>}
      {!rows && isObj && <dl className="kv">{Object.entries(data).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{cell(v)}</dd></div>)}</dl>}
      <details><summary>Ver JSON</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>
    </div>
  )
}
