import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
const f = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })
export const metadata = { title: 'Banca La Placeta', description: 'Tu banca online' }
export default function L({ children }) { return <html lang="es"><body className={f.className}>{children}</body></html> }
