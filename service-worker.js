const CACHE_NAME = 'invoicemate-local-v0.1.4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './styles/mobile-fix.css',
  './styles/print.css',
  './src/app.js',
  './src/db.js',
  './src/invoice.js',
  './src/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate' || requestUrl.pathname.endsWith('/invoice-local-pwa/') || requestUrl.pathname.endsWith('/invoice-local-pwa/index.html');

  if (isNavigation) {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
