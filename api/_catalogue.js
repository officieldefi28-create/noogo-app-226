const defaut = require("../catalogue.json");
const { getCatalogue } = require("./_store");

// Anciennes photos d'origine (avant les nouvelles photos propres) : si un article enregistré
// utilise encore l'ancienne photo d'origine, on lui donne la nouvelle. Les photos choisies par
// l'admin ne sont jamais touchées.
const ANCIENNES = {"vanille-p": "vanille-125ml.jpg", "baobab-p": "baobab-125ml.jpg", "banane-p": "banane-125ml.jpg", "choco-p": "Creme_Glacee_Chocolat_Cacao_au_Lait_600F.jpg", "fraise-p": "", "vanille-g": "vanille-250ml.jpg", "baobab-g": "baobab-250ml.jpg", "banane-g": "banane-250ml.jpg", "choco-g": "Chocolat_Cacao_au_Lait_1200F.jpg", "fraise-g": "", "pk-van-p": "vanille-125ml.jpg", "pk-bao-p": "baobab-125ml.jpg", "pk-ban-p": "banane-125ml.jpg", "pk-cho-p": "Creme_Glacee_Chocolat_Cacao_au_Lait_600F.jpg", "pk-fra-p": "", "pk-mix-p": "baobab-125ml.jpg", "pk-van-g": "vanille-250ml.jpg", "pk-bao-g": "baobab-250ml.jpg", "pk-ban-g": "banane-250ml.jpg", "pk-cho-g": "Chocolat_Cacao_au_Lait_1200F.jpg", "pk-fra-g": "", "pk-mix-g": "banane-250ml.jpg"};

function majPhotos(liste) {
  return liste.map((p) => {
    if (!p || !(p.id in ANCIENNES) || String(p.img || "") !== ANCIENNES[p.id]) return p;
    const d = defaut.produits.find((x) => x.id === p.id);
    return d && d.img ? { ...p, img: d.img } : p;
  });
}

async function chargerCatalogue() {
  try {
    const perso = await getCatalogue();
    if (Array.isArray(perso) && perso.length) return majPhotos(perso);
  } catch (e) { /* base absente : on retombe sur le catalogue par défaut */ }
  return defaut.produits;
}

// Recalcule TOUT côté serveur à partir des identifiants et quantités :
// les prix envoyés par le navigateur ne sont jamais utilisés.
const BASES_PACK = { van: "vanille", bao: "baobab", ban: "banane", cho: "choco", fra: "fraise" };
function enRupture(b) { return !!b && (b.actif === false || b.dispo === "rupture" || b.statut === "rupture"); }
// Un pack est arrêté si un parfum qu'il contient est fini (ou, pour un pack au choix, si plus aucun parfum n'est disponible)
function packBloque(p, catalogue) {
  if (!p || p.type !== "pack") return false;
  const m = /^pk-(van|bao|ban|cho|fra)-(p|g)$/.exec(p.id);
  if (m) return enRupture(catalogue.find((x) => x.id === BASES_PACK[m[1]] + "-" + m[2]));
  if (p.packCompo && typeof p.packCompo === "object") return Object.keys(p.packCompo).some((k) => enRupture(catalogue.find((x) => x.id === k)));
  if (/^pk-mix-/.test(p.id) || p.packChoix) { const grand = p.gr === "grand" || /-g$/.test(p.id); return !catalogue.some((x) => x.cat === "cremes" && x.type === "produit" && !enRupture(x) && (x.gr === "grand") === grand); }
  return false;
}
function calculerPanier(articles, catalogue) {
  const lignes = [];
  let produits = 0, packs = 0, packsSans = 0;
  for (const a of Array.isArray(articles) ? articles.slice(0, 60) : []) {
    if (!a || typeof a !== "object") continue;
    const p = catalogue.find((x) => x.id === a.id && x.actif !== false);
    const qte = Math.max(1, Math.min(50, parseInt(a.qte, 10) || 0));
    if (!p || !a.qte || p.dispo === "rupture" || p.statut === "rupture" || packBloque(p, catalogue)) continue;
    const total = Number(p.prix) * qte;
    const ligne = { id: p.id, nom: p.nom, type: p.type, qte, prix: Number(p.prix), total, surCommande: !!p.surCommande || p.statut === "surcommande" || p.statut === "date" };
    // Pack « au choix » : saveurs choisies par le client (validées contre le catalogue)
    if (p.type === "pack" && a.compo && typeof a.compo === "object") {
      const compo = [];
      for (const k of Object.keys(a.compo).slice(0, 20)) {
        const q = Math.max(0, Math.min(200, parseInt(a.compo[k], 10) || 0));
        const base = catalogue.find((x) => x.id === k && x.type !== "pack" && !enRupture(x));
        if (q > 0 && base) compo.push({ id: base.id, nom: base.nom, qte: q });
      }
      if (compo.length) ligne.compo = compo;
    }
    if (p.type === "pack" && p.packCompo && typeof p.packCompo === "object") {   // pack à contenu fixe : le serveur impose la composition
      const compo = [];
      for (const k of Object.keys(p.packCompo)) { const base = catalogue.find((x) => x.id === k && x.type !== "pack"); if (base) compo.push({ id: base.id, nom: base.nom, qte: (parseInt(p.packCompo[k], 10) || 0) * qte }); }
      if (compo.length) ligne.compo = compo;
    }
    lignes.push(ligne);
    if (p.type === "pack" && p.packLiv !== "sans") packs += total;
    else { if (p.type === "pack") packsSans += total; produits += total; }
  }
  return { lignes, produits, packs, packsSans, total: produits + packs, aPack: packs > 0 };
}

// Une offre client (code sans commission) ne sert qu'une fois par personne, repérée par son numéro de téléphone.
// Un code de partenaire avec commission reste utilisable plusieurs fois, sauf si "unParClient" est mis à true.
function codeUnique(p) { return p.unParClient === true || (p.unParClient === undefined && !(Number(p.commissionValeur) > 0)); }
function chiffres8(t) { return String(t || "").replace(/\D/g, "").slice(-8); }
function dejaUtilise(p, tel, commandes) {
  const n = chiffres8(tel); if (!codeUnique(p) || n.length < 8) return false;
  const code = String(p.code || "").toUpperCase();
  return (commandes || []).some((c) => c && String(c.code || "").toUpperCase() === code && c.statutLivraison !== "annulee" && chiffres8(c.telClient) === n);
}
// Limites d'un code : date de fin et nombre maximum d'utilisations (0 = sans limite)
function codeExpire(p) { return !!p.dateFin && new Date().toISOString().slice(0, 10) > String(p.dateFin).slice(0, 10); }
function limiteAtteinte(p, commandes) {
  const max = Number(p.maxUtilisations) || 0; if (!max) return false;
  const code = String(p.code || "").toUpperCase();
  return (commandes || []).filter((c) => c && String(c.code || "").toUpperCase() === code && c.statutLivraison !== "annulee").length >= max;
}
// Parrainage : chaque client a un code AMI + 6 derniers chiffres de son numéro. Le filleul (nouveau client) a une remise fixe.
function codeAmi(tel) { return "AMI" + chiffres8(tel).slice(-6); }
function resoudreAmi(codeN, tel, commandes, rgl) {
  const m = /^AMI(\d{6})$/.exec(String(codeN || "").toUpperCase()); if (!m) return null;
  const remise = parseInt(rgl && rgl.parrainRemise, 10) || 0;
  if (remise <= 0) return { erreur: "Le parrainage n'est pas actif pour le moment" };
  const n = chiffres8(tel), liste = (commandes || []).filter((c) => c && c.statutLivraison !== "annulee");
  const parrains = [...new Set(liste.filter((c) => c.statutLivraison === "livree" && chiffres8(c.telClient).endsWith(m[1])).map((c) => chiffres8(c.telClient)))];
  if (!parrains.length) return { erreur: "Code ami inconnu" };
  if (parrains.length > 1) return { erreur: "Code ami ambigu, demandez-en un autre à votre ami" };
  if (parrains[0] === n) return { erreur: "Vous ne pouvez pas utiliser votre propre code ami" };
  if (n.length >= 8 && liste.some((c) => chiffres8(c.telClient) === n)) return { erreur: "Le code ami est réservé aux nouveaux clients" };
  return { p: { id: null, code: String(codeN).toUpperCase(), remiseType: "fixe", remiseValeur: remise, commissionType: "fixe", commissionValeur: 0, parrain: parrains[0] } };
}
function jourValide(partenaire) {
  if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) return true;
  // Jour local Ouagadougou (UTC+0)
  return partenaire.joursActifs.includes(new Date().getUTCDay());
}

function calculerMontant(type, valeur, base) {
  const v = Number(valeur) || 0;
  return type === "pourcentage" ? Math.round(base * (v / 100)) : v;
}

module.exports = { dejaUtilise, codeUnique, codeExpire, limiteAtteinte, codeAmi, resoudreAmi, chiffres8, majPhotos, chargerCatalogue, calculerPanier, jourValide, calculerMontant };
