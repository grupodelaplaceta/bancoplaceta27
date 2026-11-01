import { cookies } from 'next/headers'
import { readSession } from '../lib/session'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }) {
  const s = readSession((n) => cookies().get(n)?.value)
  if (s) return <Dashboard name={s.name} />
  const dev = process.env.DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production'
  const err = typeof searchParams?.error === 'string' ? searchParams.error.slice(0, 200) : ''
  return (
    <main className="login">
      <div className="login-art">
        <div className="stackcards" aria-hidden="true">
          <div className="pcard tone-teal c3"><span className="pcard-top"><span className="pcard-type">Cuenta Ahorro</span><span className="pcard-chip" /></span><span className="pcard-bal">4.200,00 €</span></div>
          <div className="pcard tone-coral c2"><span className="pcard-top"><span className="pcard-type">Cuenta Junior</span><span className="pcard-chip" /></span><span className="pcard-bal">85,00 €</span></div>
          <div className="pcard tone-violet c1"><span className="pcard-top"><span className="pcard-type">Cuenta Corriente</span><span className="pcard-chip" /></span><span className="pcard-bal">1.250,40 €</span><span className="pcard-bot"><span className="pcard-iban">PZ-0001-0001</span></span></div>
        </div>
        <h1>Tu dinero, a la vista y a tu ritmo.</h1>
        <p>Cuentas, tarjetas, recibos y transferencias de La Placeta en un único sitio.</p>
      </div>
      <section className="login-card">
        <div className="logo">P</div>
        <h2>Banca La Placeta</h2>
        <p className="muted">Entra con tu PlacetaID. No guardamos tu contraseña.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <a className="btn primary big" href="/api/auth/login">{dev ? 'Entrar (modo pruebas)' : 'Entrar con PlacetaID'}</a>
        <p className="muted s fine">Conexión cifrada. La sesión caduca a las 8 horas y las operaciones que mueven dinero nunca se duplican.</p>
      </section>
    </main>
  )
}
