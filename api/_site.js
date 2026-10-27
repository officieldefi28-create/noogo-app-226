// Réglages du site modifiables depuis l'admin (onglet « Site ») : textes, paiement, galerie photos.
const DEFAUT_REGLAGES = {
  annonce: "Commandez 24h/24 · Livraison à Karpala et alentours",
  livraisonTarifs: "0 à 15 km : 1 000 FCFA\n16 à 20 km : 1 500 FCFA\n21 à 25 km : 2 000 FCFA\n26 à 30 km : 2 500 FCFA",
  delai: "Livraison en général dans l'heure qui suit la confirmation, à Karpala et alentours.",
  adresse: "Karpala, derrière la mairie",
  lienMaps: "https://maps.google.com/?q=12.336911,-1.474793",
  infoPaiement: "Espèces : vous payez au livreur ou au local. Orange Money / Wave : nous vous confirmons la commande sur WhatsApp, puis vous envoyez le montant au numéro indiqué.",
  orangeMoney: "65 12 09 02",
  wave: "65 12 09 02",
  whatsapp: "22661682706",
  ferme: "",
  messageFerme: "Nous ne prenons plus de commandes pour le moment. Revenez bientôt 🍦",
  commandeMin: "",
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
  imageFond: "",
  histoireTitre: "Notre histoire",
  histoireTexte: "Noogó est né à Karpala d'une idée simple : faire des glaces vraiment naturelles, avec les saveurs d'ici, sans colorant ni conservateur. Chaque pot est préparé localement, avec soin, pour que vous retrouviez le goût authentique de chez nous.",
  fondateurNom: "",
  fondateurPhoto: "",
  chiffre1Valeur: "", chiffre1Texte: "",
  chiffre2Valeur: "", chiffre2Texte: "",
  chiffre3Valeur: "", chiffre3Texte: "",
  chiffre4Valeur: "", chiffre4Texte: ""
};
// Champs que l'admin peut vider volontairement (pour masquer la section sur le site)
const VIDABLES = ["ferme", "commandeMin", "livraisonTarifs", "histoireTitre", "histoireTexte", "fondateurNom", "fondateurPhoto", "chiffre1Valeur", "chiffre1Texte", "chiffre2Valeur", "chiffre2Texte", "chiffre3Valeur", "chiffre3Texte", "chiffre4Valeur", "chiffre4Texte"];

const DEFAUT_FAQ = [
  { q: "Comment passer commande ?", a: "Ajoutez vos articles au panier, puis envoyez la commande sur WhatsApp. Votre numéro de téléphone est obligatoire pour la livraison. Nous vous répondons pour confirmer." },
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

// Cases de l'écran d'accueil (modifiables dans l'admin : titre, sous-titre, photo, ordre, affichage)
const CIBLES = ["carte", "dispo", "packs", "promo", "sur", "suivi", "avis", "histoire", "infos", "galerie", "actus", "revendeur", "faq", "contact", "legal", "partenaire"];
const DEFAUT_TUILES = [
  { id: "carte", titre: "Commander", sous: "Toute la carte, en 2 minutes", image: "/galerie/mix-vanille-baobab-250.jpg", visible: true },
  { id: "dispo", titre: "Disponibles aujourd'hui", sous: "Prêtes à être livrées", image: "/galerie/vanille-125.jpg", visible: true },
  { id: "packs", titre: "Packs", sous: "Livraison incluse", image: "/galerie/mix-125.jpg", visible: true },
  { id: "promo", titre: "Promos", sous: "Les bonnes affaires", image: "/galerie/fraise-250.jpg", visible: true },
  { id: "sur", titre: "Sur commande", sous: "Banane, chocolat, fêtes…", image: "/galerie/banane-250.jpg", visible: true },
  { id: "suivi", titre: "Suivre ma commande", sous: "Où en est ma livraison ?", image: "", visible: true },
  { id: "avis", titre: "Avis clients", sous: "Ce qu'ils en pensent", image: "", visible: true },
  { id: "histoire", titre: "Notre histoire", sous: "Qui nous sommes", image: "/galerie/congelateur.jpg", visible: true },
  { id: "infos", titre: "Livraison et paiement", sous: "Comment ça marche", image: "", visible: true },
  { id: "galerie", titre: "Galerie photos", sous: "Nos glaces en images", image: "/galerie/chocolat-250.jpg", visible: true },
  { id: "actus", titre: "Actualités", sous: "Quoi de neuf ?", image: "", visible: true },
  { id: "revendeur", titre: "Devenir revendeur", sous: "Vendez Noogó près de chez vous", image: "", visible: true },
  { id: "faq", titre: "Questions fréquentes", sous: "Toutes les réponses", image: "", visible: true },
  { id: "contact", titre: "Contact et accès", sous: "WhatsApp, appel, itinéraire", image: "", visible: true },
  { id: "legal", titre: "Infos légales", sous: "Confidentialité, remboursement", image: "", visible: true },
  { id: "partenaire", titre: "Espace partenaire", sous: "Suivre mes commissions", image: "", visible: true }
];

const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

function fusionner(stocke) {
  const r = { ...DEFAUT_REGLAGES };
  if (stocke && typeof stocke === "object") {
    for (const k of Object.keys(DEFAUT_REGLAGES)) if (typeof stocke[k] === "string" && (stocke[k].trim() || VIDABLES.includes(k))) r[k] = stocke[k];
  }
  const galerie = stocke && Array.isArray(stocke.galerie) ? stocke.galerie : DEFAUT_GALERIE;
  const faq = stocke && Array.isArray(stocke.faq) ? stocke.faq : DEFAUT_FAQ;
  // cases d'accueil : celles de l'admin + toute nouvelle case par défaut qui n'existait pas encore
  let tuiles = DEFAUT_TUILES.map((t) => ({ ...t }));
  if (stocke && Array.isArray(stocke.tuiles) && stocke.tuiles.length) {
    const vues = stocke.tuiles.filter((t) => t && CIBLES.includes(t.id));
    const ids = new Set(vues.map((t) => t.id));
    tuiles = vues.concat(DEFAUT_TUILES.filter((t) => !ids.has(t.id)).map((t) => ({ ...t })));
  }
  return { reglages: r, galerie, faq, tuiles };
}

function valider(d) {
  const r = {};
  for (const [k, max] of [["annonce", 140], ["delai", 200], ["adresse", 120], ["infoPaiement", 400], ["orangeMoney", 30], ["wave", 30], ["surtitre", 80], ["titre", 80], ["titreAccent", 80], ["intro", 400], ["slogan", 160]]) {
    r[k] = txt(d && d.reglages && d.reglages[k], max) || DEFAUT_REGLAGES[k];
  }
  {
    const brut = d && d.reglages && typeof d.reglages.livraisonTarifs === "string" ? d.reglages.livraisonTarifs : DEFAUT_REGLAGES.livraisonTarifs;
    r.livraisonTarifs = brut.split(/\r?\n/).map((l) => txt(l, 70)).filter(Boolean).slice(0, 8).join("\n");
  }
  const maps = txt(d && d.reglages && d.reglages.lienMaps, 300);
  r.lienMaps = /^https:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)([/?#]|$)/i.test(maps) ? maps : DEFAUT_REGLAGES.lienMaps;
  const rg = (d && d.reglages) || {};
  r.ferme = /^(oui|1|true)$/i.test(txt(rg.ferme, 6)) ? "oui" : "";
  r.messageFerme = txt(rg.messageFerme, 200) || DEFAUT_REGLAGES.messageFerme;
  { const mn = parseInt(String(rg.commandeMin || "").replace(/\D/g, ""), 10); r.commandeMin = mn > 0 && mn <= 1000000 ? String(mn) : ""; }
  const wa = String(rg.whatsapp || "").replace(/\D/g, "");
  r.whatsapp = wa.length >= 8 && wa.length <= 15 ? wa : DEFAUT_REGLAGES.whatsapp;
  for (const k of ["couleurPrincipale", "couleurAccent", "couleurFond"]) r[k] = /^#[0-9a-f]{6}$/i.test(String(rg[k] || "")) ? rg[k] : DEFAUT_REGLAGES[k];
  const imgOk = (u) => /^\/(galerie|produits|assets)\/[\w.\-]+$/.test(u) || /^\/api\/photo\?id=[a-f0-9]{16,40}$/.test(u);
  r.logo = imgOk(txt(rg.logo, 200)) ? txt(rg.logo, 200) : DEFAUT_REGLAGES.logo;
  r.logoRond = imgOk(txt(rg.logoRond, 200)) ? txt(rg.logoRond, 200) : DEFAUT_REGLAGES.logoRond;
  r.imageFond = imgOk(txt(rg.imageFond, 200)) ? txt(rg.imageFond, 200) : "";
  for (const [k, max] of [["histoireTitre", 80], ["histoireTexte", 900], ["fondateurNom", 80], ["chiffre1Valeur", 20], ["chiffre1Texte", 50], ["chiffre2Valeur", 20], ["chiffre2Texte", 50], ["chiffre3Valeur", 20], ["chiffre3Texte", 50], ["chiffre4Valeur", 20], ["chiffre4Texte", 50]]) {
    r[k] = typeof rg[k] === "string" ? txt(rg[k], max) : DEFAUT_REGLAGES[k];
  }
  r.fondateurPhoto = imgOk(txt(rg.fondateurPhoto, 200)) ? txt(rg.fondateurPhoto, 200) : "";
  r.faq = (Array.isArray(d && d.faq) ? d.faq : DEFAUT_FAQ).slice(0, 30)
    .map((x) => ({ q: txt(x && x.q, 160), a: txt(x && x.a, 700) })).filter((x) => x.q && x.a);
  const T = Array.isArray(d && d.tuiles) ? d.tuiles : [];
  const vusT = new Set();
  r.tuiles = T.slice(0, 40).map((x) => {
    const base = DEFAUT_TUILES.find((b) => b.id === (x && x.id));
    if (!base || vusT.has(base.id)) return null;
    vusT.add(base.id);
    const im = txt(x.image, 200);
    return { id: base.id, titre: txt(x.titre, 40) || base.titre, sous: txt(x.sous, 60), image: imgOk(im) ? im : "", visible: x.visible !== false };
  }).filter(Boolean);
  const g = Array.isArray(d && d.galerie) ? d.galerie.slice(0, 60) : [];
  r.galerie = g
    .map((x) => ({ url: txt(x && x.url, 200), legende: txt(x && x.legende, 80) }))
    .filter((x) => /^\/(galerie|produits|assets)\/[\w.\-]+$/.test(x.url) || /^\/api\/photo\?id=[a-f0-9]{16,40}$/.test(x.url));
  return r;
}

module.exports = { DEFAUT_REGLAGES, DEFAUT_GALERIE, DEFAUT_FAQ, DEFAUT_TUILES, fusionner, valider };
