'use client'
export default function Error({ reset }) {
  return (
    <main className="login-card" style={{ minHeight: '100vh' }}>
      <div className="logo">P</div>
      <h2>Algo no ha ido bien</h2>
      <p className="muted">No hemos podido cargar la página. Tu dinero no se ha tocado.</p>
      <button className="btn primary" onClick={reset}>Reintentar</button>
    </main>
  )
}
