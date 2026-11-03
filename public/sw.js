// Service worker de Banca La Placeta.
// Guarda SOLO recursos estáticos (JS/CSS/fuentes/iconos) para que la app abra rápido.
// Nunca guarda /api/* ni páginas HTML: los datos bancarios siempre vienen en vivo del servidor.
const V = 'placeta-v1'
const SHELL = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/placetaid' || url.pathname === '/sw.js') return // siempre red

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }
  // Recursos con hash (inmutables) e iconos: primero caché.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(V).then((c) => c.put(req, copy)) } return r })))
  }
})
