/* BRIQ PRO — Service Worker (PWA) */
const VERSION = 'briqpro-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase API / auth / storage — always network.
  if (url.hostname.endsWith('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // CDN libs & fonts — stale-while-revalidate.
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

  // HTML / navigation (the app itself) — NETWORK FIRST so updates show immediately.
  const isDoc = e.request.mode === 'navigate' || e.request.destination === 'document'
    || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin static assets (icons, logo, manifest) — cache first, refresh in background.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request);
      const net = fetch(e.request).then((r) => { cache.put(e.request, r.clone()); return r; }).catch(() => cached);
      return cached || net;
    })
  );
});
