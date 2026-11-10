import './globals.css'
import PwaRegister from './PwaRegister'

export const metadata = {
  title: 'Banco de La Placeta',
  description: 'Tu banco de La Placeta: cuentas, tarjetas y transferencias en el móvil.',
  applicationName: 'Banco de La Placeta',
  appleWebApp: { capable: true, title: 'Banco La Placeta', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
}
export const viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#0B2E59' }, { media: '(prefers-color-scheme: dark)', color: '#0B1220' }],
}

// Aplica el tema guardado antes de pintar, para evitar parpadeos.
const themeScript = `try{if(/BancoPlacetaApp/.test(navigator.userAgent))document.documentElement.dataset.app='1'}catch(e){}try{var t=JSON.parse(localStorage.getItem('pz:theme')||'null');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

export default function Layout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<PwaRegister /></body>
    </html>
  )
}
