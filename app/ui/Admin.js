'use client'
import { useState, useMemo } from 'react'
import Module from './Engine'
import { visible, KINDS } from '../../lib/catalog'

// Consola de gestión de la entidad: los módulos cambian según el tipo de la cuenta seleccionada.
export default function Admin({ iban, kind }) {
  const [all, setAll] = useState(false), [sel, setSel] = useState('')
  const mods = useMemo(() => visible('admin', iban ? kind : null, all), [iban, kind, all])
  const cur = mods.find((m) => m.id === sel) || mods[0]
  return (
    <div className="admin">
      <nav className="anav" aria-label="Módulos de gestión">
        <p className="muted s">{iban ? <>Mostrando funciones para cuentas <b>{KINDS[kind]}</b></> : 'Sin cuenta seleccionada: se muestran todas las funciones.'}</p>
        {mods.map((m) => <button key={m.id} className={cur?.id === m.id ? 'on' : ''} onClick={() => setSel(m.id)}>{m.title}</button>)}
        {iban && <label className="chk-l all"><input type="checkbox" className="chk" checked={all} onChange={(e) => setAll(e.target.checked)} />Ver todos los módulos</label>}
      </nav>
      <div className="amain">{cur && <Module key={cur.id + iban} mod={cur} ctx={{ iban, kind }} />}</div>
    </div>
  )
}
