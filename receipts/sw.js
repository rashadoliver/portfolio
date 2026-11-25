/* Receipts service worker: the app shell is cached so the site opens offline and installs as an app.
   Nothing here sends data anywhere; it only stores copies of files the page already downloaded. */
const VERSION = 'receipts-0822ecc9cb';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // App shell: serve from cache, refresh in the background (stale-while-revalidate).
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const cached = await c.match(req, { ignoreSearch: true });
        const fresh = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
        if (cached) { fresh.catch(() => {}); return cached; }
        const res = await fresh;
        if (res) return res;
        if (req.mode === 'navigate') return c.match('./index.html');
        return new Response('', { status: 504 });
      })
    );
    return;
  }
  // Fonts and the PDF reader: cache on first use so imports and typography work offline later.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION + '-runtime').then(async (c) => {
        const cached = await c.match(req);
        if (cached) return cached;
        try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }
        catch (err) { return new Response('', { status: 504 }); }
      })
    );
  }
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
