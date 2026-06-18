const CACHE_NAME = 'invoicemate-local-v0.2.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css?v=0.2.0',
  './styles/mobile-fix.css?v=0.2.0',
  './styles/print.css?v=0.2.0',
  './src/app.js?v=0.2.0',
  './src/db.js',
  './src/invoice.js',
  './src/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? undefined : caches.delete(key)))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('/invoice-local-pwa/') || url.pathname.endsWith('/invoice-local-pwa/index.html');
  const isFreshAsset = url.searchParams.has('v');

  if (isNavigation || isFreshAsset) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
