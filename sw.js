const CACHE_NAME = "papous-cache-v2";

const FICHIERS_A_METTRE_EN_CACHE = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Installation : on met en cache uniquement les fichiers statiques (icônes, manifest)
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

// Récupération :
// - Pour les pages HTML et les appels API : toujours essayer le réseau en premier
//   (garantit d'avoir toujours la dernière version), avec repli sur le cache hors-ligne
// - Pour le reste (images, icônes, manifest) : cache en priorité (plus rapide)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const estPage = event.request.mode === "navigate" || url.pathname.endsWith(".html");
  const estApi = url.pathname.startsWith("/api/");

  if (estApi) {
    // Les appels API ne doivent jamais être mis en cache ni interceptés
    return;
  }

  if (estPage) {
    // Stratégie réseau-en-premier pour toujours avoir la dernière version des pages
    event.respondWith(
      fetch(event.request)
        .then((reponseReseau) => {
          if (reponseReseau && reponseReseau.status === 200) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copie);
            });
          }
          return reponseReseau;
        })
        .catch(() => {
          return caches.match(event.request).then((reponseEnCache) => {
            return reponseEnCache || caches.match("/index.html");
          });
        })
    );
    return;
  }

  // Stratégie cache-en-premier pour les fichiers statiques (images, icônes, manifest)
  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      if (reponseEnCache) {
        return reponseEnCache;
      }
      return fetch(event.request).then((reponseReseau) => {
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
      });
    })
  );
});
