export default function manifest() {
  return {
    id: '/',
    name: 'Banca La Placeta',
    short_name: 'La Placeta',
    description: 'Cuentas, tarjetas, recibos y transferencias de La Placeta',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F2FA',
    theme_color: '#5B2FD9',
    categories: ['finance'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Transferir', url: '/#/transferencias', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Movimientos', url: '/#/movimientos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Tarjetas', url: '/#/tarjetas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
