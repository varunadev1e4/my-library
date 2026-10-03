// Pages are network-first (you always get the newest site). Built assets are cache-first (instant repeat loads).
// /api is never cached, so your book data is not stored by the service worker.
const CACHE = 'varuns-library-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const store = (req, r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; };
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => store(e.request, r))));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => store(e.request, r)).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});
