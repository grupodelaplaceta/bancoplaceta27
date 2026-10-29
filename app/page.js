import { cookies } from 'next/headers'
import { verify, missingEnv } from '../lib/session'
import Dashboard from './Dashboard'
export const dynamic = 'force-dynamic'
export default function Page({ searchParams }) {
  const s = verify(cookies().get('sess')?.value)
  if (s && s.exp > Date.now()) return <Dashboard name={s.name} hasDip={!!s.dip} />
  const miss = missingEnv()
  return (
    <main className="login">
      <div className="login-art"><div className="orb o1" /><div className="orb o2" />
        <h1>Tu dinero,<br />a la vista<br />y a tu ritmo.</h1>
        <p>Cuentas, tarjetas, recibos y transferencias de La Placeta en un único sitio.</p></div>
      <section className="login-card">
        <div className="logo">P</div>
        <h2>Banca La Placeta</h2>
        <p className="muted">Entra con tu PlacetaID. No guardamos tu contraseña.</p>
        {miss.length > 0 && <div className="err">Configuración incompleta en Vercel. Faltan: <b>{miss.join(', ')}</b></div>}
        {searchParams?.error && <div className="err">{searchParams.error}</div>}
        <a className="btn big" href="/api/auth/login" aria-disabled={miss.includes("SESSION_SECRET")}>Entrar con PlacetaID</a>
      </section>
    </main>
  )
}
