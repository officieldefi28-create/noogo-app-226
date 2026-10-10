// Service worker Noogó — l'application s'ouvre même avec une mauvaise connexion.
const VERSION = "noogo-v6";
const COQUILLE = ["/", "/index.html", "/assets/noogo.css", "/assets/embleme.jpg", "/assets/logo-noogo.jpg", "/catalogue.json", "/manifest.json", "/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;               // polices, Cloudinary… : géré par le navigateur
  if (url.pathname.startsWith("/api/")) return;             // commandes, admin : jamais en cache
  if (url.pathname === "/admin.html" || url.pathname === "/partenaire.html") return;

  // Photos et fichiers statiques : cache d'abord (rapide), mise à jour en arrière-plan
  if (/\.(jpg|jpeg|png|webp|css|ico)$/i.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const connu = await c.match(req);
      const reseau = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => connu);
      return connu || reseau;
    }));
    return;
  }

  // Pages et catalogue : réseau d'abord, copie en cache si hors ligne
  e.respondWith(fetch(req).then((r) => {
    if (r && r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
    return r;
  }).catch(() => caches.match(req).then((r) => r || caches.match("/index.html"))));
});
