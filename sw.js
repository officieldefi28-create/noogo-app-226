const CACHE_NAME = "papous-cache-v1";

const FICHIERS_A_METTRE_EN_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Installation : on met en cache les fichiers essentiels du site
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FICHIERS_A_METTRE_EN_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation : on supprime les anciens caches si le site est mis à jour
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) => {
      return Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      );
    })
  );
  self.clients.claim();
});

// Récupération : on sert le cache en priorité, puis le réseau, avec repli hors-ligne
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      if (reponseEnCache) {
        return reponseEnCache;
      }

      return fetch(event.request)
        .then((reponseReseau) => {
          // On met aussi en cache les nouvelles requêtes réussies (même origine)
          if (
            event.request.method === "GET" &&
            reponseReseau &&
            reponseReseau.status === 200 &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copie);
            });
          }
          return reponseReseau;
        })
        .catch(() => {
          // Hors-ligne et pas en cache : on retombe sur la page principale
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
