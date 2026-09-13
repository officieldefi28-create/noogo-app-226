// Service Worker pour Noogo PWA - OPTIMISÉ
const CACHE_NAME = "noogo-cache-v3";
const STATIC_CACHE = "noogo-static-v3";
const urlsToCache = [
  "/",
  "/index.html",
  "/admin.html",
  "/manifest.json",
  "/sw.js"
];

// Installation du Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urlsToCache).catch(() => {});
      }),
      caches.open(STATIC_CACHE)
    ])
  );
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache OPTIMISÉE
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  
  // Images & assets statiques: Cache-first
  if (url.pathname.includes("/produits/") || 
      url.pathname.endsWith(".png") || 
      url.pathname.endsWith(".jpg")) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const cache = caches.open(STATIC_CACHE);
            cache.then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      }).catch(() => new Response("Pas en cache", { status: 503 }))
    );
  } 
  // API & HTML: Network-first (avec fallback cache)
  else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            return response || new Response("Hors ligne", {
              status: 503,
              statusText: "Service Unavailable",
              headers: new Headers({
                "Content-Type": "text/plain"
              })
            });
          });
        })
    );
  }
});
