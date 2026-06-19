const CACHE_NAME = "invoicemate-liquid-v0.4.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/main.css",
  "./styles/print.css",
  "./src/app.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./reset-app-cache.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate" || requestUrl.pathname.endsWith("/invoice-local-pwa/") || requestUrl.pathname.endsWith("/index.html");

  if (isNavigation) {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
