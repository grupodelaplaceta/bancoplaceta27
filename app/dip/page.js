import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readPending } from '../../lib/session'
import { Mark } from '../bp/kit'

export const dynamic = 'force-dynamic'

export default function Dip({ searchParams }) {
  const p = readPending((n) => cookies().get(n)?.value)
  if (!p) redirect('/?error=' + encodeURIComponent('Tu acceso ha caducado. Inténtalo de nuevo.'))
  const err = typeof searchParams?.error === 'string' ? searchParams.error.slice(0, 200) : ''
  return (
    <main className="login">
      <div className="login-top">
        <Mark large />
        <h1>Un último paso, {String(p.name).split(' ')[0]}.</h1>
        <p>PlacetaID no nos ha facilitado tu DIP. Escríbelo para localizar tus cuentas. Solo te lo pediremos esta vez.</p>
      </div>
      <section className="login-panel">
        <div className="wrap">
          {err && <div className="banner bad" role="alert">{err}</div>}
          <form method="post" action="/api/auth/dip">
            <label className="field"><span>Tu DIP</span>
              <input className="input mono" name="dip" placeholder="12345678Z" autoComplete="off" spellCheck="false" autoFocus required maxLength={20} />
            </label>
            <button className="btn primary" style={{ marginTop: 20 }}>Continuar</button>
          </form>
          <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}><a href="/" style={{ color: 'var(--navy)', fontWeight: 700 }}>Cancelar</a></p>
        </div>
      </section>
    </main>
  )
}
