// Réglages du site modifiables depuis l'admin (onglet « Site ») : textes, paiement, galerie photos.
const DEFAUT_REGLAGES = {
  annonce: "Commandez 24h/24 · Livraison à Karpala et alentours",
  delai: "Livraison en général dans l'heure qui suit la confirmation, à Karpala et alentours.",
  adresse: "Karpala, derrière la mairie",
  lienMaps: "https://maps.google.com/?q=12.336911,-1.474793",
  infoPaiement: "Espèces : vous payez au livreur ou au local. Orange Money / Wave : nous vous confirmons la commande sur WhatsApp, puis vous envoyez le montant au numéro indiqué.",
  orangeMoney: "65 12 09 02",
  wave: "65 12 09 02",
  whatsapp: "22661682706",
  surtitre: "Glaces naturelles · L'excellence africaine",
  titre: "La douceur naturelle,",
  titreAccent: "le goût d'ici",
  intro: "Crèmes glacées 100 % naturelles, faites localement : vanille, baobab, banane… Sans colorant ni conservateur. Commandez en deux minutes, nous vous livrons ou vous passez les récupérer.",
  slogan: "Glaces naturelles — l'excellence africaine. Le goût d'ici, pour le monde.",
  couleurPrincipale: "#14451f",
  couleurAccent: "#c9982b",
  couleurFond: "#fcf8ea",
  logo: "/assets/logo-noogo.jpg",
  logoRond: "/assets/embleme.jpg",
  imageFond: ""
};

const DEFAUT_FAQ = [
  { q: "Comment passer commande ?", a: "Ajoutez vos articles au panier, puis envoyez la commande sur WhatsApp. Votre numéro est facultatif. Nous vous répondons pour confirmer." },
  { q: "Que veut dire « sur commande » ?", a: "L'article n'est pas toujours en stock. Il peut être disponible : nous le confirmons avec vous sur WhatsApp, avec le délai éventuel." },
  { q: "Combien coûte la livraison ?", a: "Elle est incluse pour les packs. Pour les articles à l'unité, elle est à la charge du client ; le tarif dépend de votre quartier et vous est annoncé sur WhatsApp." },
  { q: "Comment conserver mes glaces ?", a: "À −18 °C. Une fois décongelée, une crème glacée ne doit pas être recongelée. La date limite est indiquée sur chaque pot." },
  { q: "Faites-vous des commandes pour les fêtes et cérémonies ?", a: "Oui : packs, seaux familiaux de 6 250 ml et pack Fête / Cérémonie. Écrivez-nous sur WhatsApp pour organiser votre commande." }
];

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
  const faq = stocke && Array.isArray(stocke.faq) ? stocke.faq : DEFAUT_FAQ;
  return { reglages: r, galerie, faq };
}

function valider(d) {
  const r = {};
  for (const [k, max] of [["annonce", 140], ["delai", 200], ["adresse", 120], ["infoPaiement", 400], ["orangeMoney", 30], ["wave", 30], ["surtitre", 80], ["titre", 80], ["titreAccent", 80], ["intro", 400], ["slogan", 160]]) {
    r[k] = txt(d && d.reglages && d.reglages[k], max) || DEFAUT_REGLAGES[k];
  }
  const maps = txt(d && d.reglages && d.reglages.lienMaps, 300);
  r.lienMaps = /^https:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(maps) ? maps : DEFAUT_REGLAGES.lienMaps;
  const rg = (d && d.reglages) || {};
  const wa = String(rg.whatsapp || "").replace(/\D/g, "");
  r.whatsapp = wa.length >= 8 && wa.length <= 15 ? wa : DEFAUT_REGLAGES.whatsapp;
  for (const k of ["couleurPrincipale", "couleurAccent", "couleurFond"]) r[k] = /^#[0-9a-f]{6}$/i.test(String(rg[k] || "")) ? rg[k] : DEFAUT_REGLAGES[k];
  const imgOk = (u) => /^\/(galerie|produits|assets)\/[\w.\-]+$/.test(u) || /^\/api\/photo\?id=[a-f0-9]{16,40}$/.test(u);
  r.logo = imgOk(txt(rg.logo, 200)) ? txt(rg.logo, 200) : DEFAUT_REGLAGES.logo;
  r.logoRond = imgOk(txt(rg.logoRond, 200)) ? txt(rg.logoRond, 200) : DEFAUT_REGLAGES.logoRond;
  r.imageFond = imgOk(txt(rg.imageFond, 200)) ? txt(rg.imageFond, 200) : "";
  r.faq = (Array.isArray(d && d.faq) ? d.faq : DEFAUT_FAQ).slice(0, 30)
    .map((x) => ({ q: txt(x && x.q, 160), a: txt(x && x.a, 700) })).filter((x) => x.q && x.a);
  const g = Array.isArray(d && d.galerie) ? d.galerie.slice(0, 60) : [];
  r.galerie = g
    .map((x) => ({ url: txt(x && x.url, 200), legende: txt(x && x.legende, 80) }))
    .filter((x) => /^\/(galerie|produits|assets)\/[\w.\-]+$/.test(x.url) || /^\/api\/photo\?id=[a-f0-9]{16,40}$/.test(x.url));
  return r;
}

module.exports = { DEFAUT_REGLAGES, DEFAUT_GALERIE, DEFAUT_FAQ, fusionner, valider };
