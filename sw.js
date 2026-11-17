// Generated at build time. Precaches the app so it works offline.
const CACHE = 'app-7e24eb09368a';
const OCR_CACHE = 'ocr-274bd0f24abb';
const ASSETS = ["./","./assets/index-VfKU7EHc.js","./assets/sheetReader-aju_vRVg.js","./assets/atkinson-hyperlegible-next-latin-400-normal-FfmJh7DR.woff2","./assets/atkinson-hyperlegible-next-latin-700-normal-Dpiyiu63.woff2","./assets/atkinson-hyperlegible-next-latin-ext-400-normal-BalHKn7d.woff2","./assets/atkinson-hyperlegible-next-latin-ext-700-normal-CBw-mJf_.woff2","./assets/index-Dea3VtVX.css","./assets/literata-latin-600-normal-A9sHopYh.woff2","./assets/literata-latin-ext-600-normal-iLkdh2tW.woff2","./manifest.webmanifest","./icon.svg","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a release never stores the previous
  // start page (GitHub Pages sends max-age=600; whole-app test U1).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }
  const path = new URL(req.url).pathname;
  if (path.includes('/ocr/') || path.includes('/assets/')) {
    const keep = path.includes('/ocr/') ? OCR_CACHE : CACHE;
    e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(keep).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
