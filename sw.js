const CACHE_NAME = "papous-cache-v3";

const FICHIERS_A_METTRE_EN_CACHE = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FICHIERS_A_METTRE_EN_CACHE);
    })
  );

  self.skipWaiting();
});

// Activation
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

// Récupération
self.addEventListener("fetch", (event) => {

  const url = new URL(event.request.url);

  // =========================================================
  // IMPORTANT :
  // Ne jamais intercepter les requêtes externes.
  //
  // Cela laisse Meta Pixel, WhatsApp, Google Maps, etc.
  // communiquer directement avec leurs serveurs.
  // =========================================================

  if (url.origin !== self.location.origin) {
    return;
  }

  // Les appels API ne doivent pas être interceptés
  const estApi = url.pathname.startsWith("/api/");

  if (estApi) {
    return;
  }

  // Pages HTML : réseau en premier
  const estPage =
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html");

  if (estPage) {

    event.respondWith(
      fetch(event.request)
        .then((reponseReseau) => {

          if (
            reponseReseau &&
            reponseReseau.status === 200
          ) {

            const copie = reponseReseau.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copie);
            });

          }

          return reponseReseau;

        })
        .catch(() => {

          return caches.match(event.request).then(
            (reponseEnCache) => {

              return (
                reponseEnCache ||
                caches.match("/index.html")
              );

            }
          );

        })
    );

    return;
  }

  // Fichiers statiques : cache en priorité
  event.respondWith(

    caches.match(event.request).then(
      (reponseEnCache) => {

        if (reponseEnCache) {
          return reponseEnCache;
        }

        return fetch(event.request).then(
          (reponseReseau) => {

            if (
              event.request.method === "GET" &&
              reponseReseau &&
              reponseReseau.status === 200
            ) {

              const copie = reponseReseau.clone();

              caches.open(CACHE_NAME).then(
                (cache) => {
                  cache.put(event.request, copie);
                }
              );

            }

            return reponseReseau;

          }
        );

      }
    )

  );

});
