import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readPending } from '../../lib/session'

export const dynamic = 'force-dynamic'

export default function Dip({ searchParams }) {
  const p = readPending((n) => cookies().get(n)?.value)
  if (!p) redirect('/?error=' + encodeURIComponent('Tu acceso ha caducado. Inténtalo de nuevo.'))
  const err = typeof searchParams?.error === 'string' ? searchParams.error.slice(0, 200) : ''
  return (
    <main className="login">
      <section className="login-card">
        <div className="logo">P</div>
        <h2>Un último paso, {String(p.name).split(' ')[0]}</h2>
        <p className="muted">PlacetaID no nos ha facilitado tu DIP. Escríbelo para localizar tus cuentas; solo te lo pediremos esta vez.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <form method="post" action="/api/auth/dip">
          <label>Tu DIP<input name="dip" placeholder="12345678Z" autoComplete="off" spellCheck="false" autoFocus required maxLength={20} /></label>
          <button className="btn primary big" style={{ width: '100%' }}>Continuar</button>
        </form>
        <p className="muted s fine"><a href="/">Cancelar</a></p>
      </section>
    </main>
  )
}
