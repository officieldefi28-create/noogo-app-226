// Service Worker pour Noogo PWA
const CACHE_NAME = "noogo-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/admin.html",
  "/manifest.json"
];

// Installation du Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache: Network first, puis cache
self.addEventListener("fetch", (event) => {
  // Ne mettre en cache que les GET
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Faire une copie pour stocker en cache
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Si la requête échoue, essayer le cache
        return caches.match(event.request).then((response) => {
          return response || new Response("Hors ligne - Reconnectez-vous", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({
              "Content-Type": "text/plain"
            })
          });
        });
      })
  );
});
