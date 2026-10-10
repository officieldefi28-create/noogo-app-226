// Réglages du site modifiables depuis l'admin (onglet « Site ») : textes, paiement, galerie photos.
const DEFAUT_REGLAGES = {
  annonce: "Commandez 24h/24 · Livraison à Karpala et alentours",
  delai: "Livraison en général dans l'heure qui suit la confirmation, à Karpala et alentours.",
  adresse: "Karpala, derrière la mairie",
  lienMaps: "https://maps.google.com/?q=12.336911,-1.474793",
  infoPaiement: "Espèces : vous payez au livreur ou au local. Orange Money / Wave : nous vous confirmons la commande sur WhatsApp, puis vous envoyez le montant au numéro indiqué.",
  orangeMoney: "65 12 09 02",
  wave: "65 12 09 02"
};

const DEFAUT_GALERIE = [
  { url: "/galerie/mix-vanille-baobab-250.jpg", legende: "Vanille et baobab, grands pots" },
  { url: "/galerie/baobab-125.jpg", legende: "Baobab — pain de singe" },
  { url: "/galerie/fraise-250.jpg", legende: "Fraise" },
  { url: "/galerie/vanille-125.jpg", legende: "Vanille" },
  { url: "/galerie/banane-250.jpg", legende: "Banane" },
  { url: "/galerie/chocolat-250.jpg", legende: "Chocolat cacao au lait" },
  { url: "/galerie/nere-250.jpg", legende: "Néré" },
  { url: "/galerie/karite-250.jpg", legende: "Karité" },
  { url: "/galerie/fraise-125.jpg", legende: "Fraise, petits pots" },
  { url: "/galerie/chocolat-125.jpg", legende: "Chocolat, petits pots" },
  { url: "/galerie/mix-125.jpg", legende: "Pack découverte" },
  { url: "/galerie/congelateur.jpg", legende: "Nos pots, prêts à être servis" }
];

const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

function fusionner(stocke) {
  const r = { ...DEFAUT_REGLAGES };
  if (stocke && typeof stocke === "object") {
    for (const k of Object.keys(DEFAUT_REGLAGES)) if (typeof stocke[k] === "string" && stocke[k].trim()) r[k] = stocke[k];
  }
  const galerie = stocke && Array.isArray(stocke.galerie) ? stocke.galerie : DEFAUT_GALERIE;
  return { reglages: r, galerie };
}

function valider(d) {
  const r = {};
  for (const [k, max] of [["annonce", 140], ["delai", 200], ["adresse", 120], ["infoPaiement", 400], ["orangeMoney", 30], ["wave", 30]]) {
    r[k] = txt(d && d.reglages && d.reglages[k], max) || DEFAUT_REGLAGES[k];
  }
  const maps = txt(d && d.reglages && d.reglages.lienMaps, 300);
  r.lienMaps = /^https:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(maps) ? maps : DEFAUT_REGLAGES.lienMaps;
  const g = Array.isArray(d && d.galerie) ? d.galerie.slice(0, 60) : [];
  r.galerie = g
    .map((x) => ({ url: txt(x && x.url, 200), legende: txt(x && x.legende, 80) }))
    .filter((x) => /^\/(galerie|produits|assets)\/[\w.\-]+$/.test(x.url) || /^\/api\/photo\?id=[a-f0-9]{16,40}$/.test(x.url));
  return r;
}

module.exports = { DEFAUT_REGLAGES, DEFAUT_GALERIE, fusionner, valider };
