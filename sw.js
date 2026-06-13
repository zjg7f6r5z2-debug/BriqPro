/* BRIQ PRO — Service Worker (PWA) */
const VERSION = 'briqpro-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Never cache Supabase API / auth / storage — always go to network.
  if (url.hostname.endsWith('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // CDN libs & fonts: stale-while-revalidate.
  if (url.hostname.includes('cdn') || url.hostname.includes('fonts') || url.hostname.includes('jsdelivr')) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(e.request);
        const net = fetch(e.request).then((r) => { cache.put(e.request, r.clone()); return r; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // App shell: cache-first, fall back to network, then to index.html (SPA).
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
