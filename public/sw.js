// Pages are network-first (you always get the newest site). Built assets are cache-first (instant repeat loads).
// Only good responses are ever stored, and /api is never cached, so book data is not kept by the service worker.
const CACHE = 'varuns-library-v3'; // changing this name wipes older caches (including any bad copy) on the next visit
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const store = (req, r) => { if (r && r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; };
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => store(e.request, r))));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => store(e.request, r)).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});
