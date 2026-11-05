import { Bricolage_Grotesque, Figtree } from 'next/font/google'
import './globals.css'
import PwaRegister from './PwaRegister'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--f-display', display: 'swap' })
const body = Figtree({ subsets: ['latin'], variable: '--f-body', display: 'swap' })

export const metadata = {
  title: 'Banca La Placeta', description: 'Cuentas, tarjetas, recibos y transferencias de La Placeta',
  applicationName: 'La Placeta',
  appleWebApp: { capable: true, title: 'La Placeta', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false }, // que el móvil no convierta IBAN en enlaces
}
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F4F2FA' }, { media: '(prefers-color-scheme: dark)', color: '#0F0A1E' }] }

// Aplica el tema guardado antes de pintar para evitar el parpadeo claro/oscuro.
const themeScript = `try{var t=JSON.parse(localStorage.getItem('pz:theme')||'null');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

export default function Layout({ children }) {
  return (
    <html lang="es" className={display.variable + ' ' + body.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<PwaRegister /></body>
    </html>
  )
}
