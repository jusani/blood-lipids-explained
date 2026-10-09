// Generated at build time. Precaches the app so it works offline.
const CACHE = 'app-ce4ae8b3063d';
const ASSETS = ["./","./assets/index-ClR_QoO8.js","./assets/atkinson-hyperlegible-next-latin-400-normal-FfmJh7DR.woff2","./assets/atkinson-hyperlegible-next-latin-700-normal-Dpiyiu63.woff2","./assets/atkinson-hyperlegible-next-latin-ext-400-normal-BalHKn7d.woff2","./assets/atkinson-hyperlegible-next-latin-ext-700-normal-CBw-mJf_.woff2","./assets/index-CtKTbDVN.css","./assets/literata-latin-600-normal-A9sHopYh.woff2","./assets/literata-latin-ext-600-normal-iLkdh2tW.woff2","./manifest.webmanifest","./icon.svg","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
