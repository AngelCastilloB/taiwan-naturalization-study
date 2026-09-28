// Offline support: load from the network when possible, fall back to the cached app shell.
const VERSION = 'v2';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'data.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open('shell-' + VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== 'shell-' + VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first so updates arrive right away; cache when offline
    e.respondWith(caches.open('shell-' + VERSION).then(async cache => {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, {ignoreSearch: true})) || (await cache.match('index.html'));
      }
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open('fonts').then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    }).catch(() => fetch(req)));
  }
});
