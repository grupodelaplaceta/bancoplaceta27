import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readSession, readRemember } from '../lib/session'
import Dashboard from './Dashboard'
import { Mark, Icon } from './bp/kit'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }) {
  const s = readSession((n) => cookies().get(n)?.value)
  if (s) return <Dashboard name={s.name} />
  if (!searchParams?.noauto && !searchParams?.error && readRemember((n) => cookies().get(n)?.value)) redirect('/api/auth/renew')
  const dev = process.env.DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production'
  const err = typeof searchParams?.error === 'string' ? searchParams.error.slice(0, 200) : ''
  return (
    <main className="login">
      <div className="login-top">
        <Mark large />
        <h1>Tu banco, siempre en tu bolsillo.</h1>
        <p>Consulta tus cuentas, envía dinero y controla tus tarjetas desde cualquier lugar.</p>
      </div>
      <section className="login-panel">
        <div className="wrap">
          <h2>Entra en tu banca</h2>
          <div className="login-feats" style={{ marginTop: 16 }}>
            <div><span className="ico-c"><Icon n="lock" size={18} /></span>Acceso con tu PlacetaID. No guardamos tu contraseña.</div>
            <div><span className="ico-c"><Icon n="send" size={18} /></span>Transferencias al instante y programadas.</div>
            <div><span className="ico-c"><Icon n="shield" size={18} /></span>Conexión cifrada y operaciones sin duplicados.</div>
          </div>
          {err && <div className="banner bad" role="alert">{err}</div>}
          <a className="btn primary" href="/api/auth/login">{dev ? 'Entrar (modo pruebas)' : 'Entrar con PlacetaID'}</a>
        </div>
      </section>
    </main>
  )
}
