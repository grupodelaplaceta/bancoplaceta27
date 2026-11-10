'use client'
import { Mark } from './bp/kit'

export default function Error({ reset }) {
  return (
    <main className="login" style={{ minHeight: '100vh' }}>
      <div className="login-top">
        <Mark large />
        <h1>Algo no ha ido bien.</h1>
        <p>No hemos podido cargar la página. Tu dinero no se ha movido.</p>
      </div>
      <section className="login-panel">
        <div className="wrap">
          <button className="btn primary" onClick={reset}>Volver a intentarlo</button>
        </div>
      </section>
    </main>
  )
}
