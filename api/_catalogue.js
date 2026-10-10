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
function calculerPanier(articles, catalogue) {
  const lignes = [];
  let produits = 0, packs = 0;
  for (const a of Array.isArray(articles) ? articles.slice(0, 60) : []) {
    const p = catalogue.find((x) => x.id === a.id && x.actif !== false);
    const qte = Math.max(1, Math.min(50, parseInt(a.qte, 10) || 0));
    if (!p || !a.qte) continue;
    const total = Number(p.prix) * qte;
    const ligne = { id: p.id, nom: p.nom, type: p.type, qte, prix: Number(p.prix), total, surCommande: !!p.surCommande };
    // Pack « au choix » : saveurs choisies par le client (validées contre le catalogue)
    if (p.type === "pack" && a.compo && typeof a.compo === "object") {
      const compo = [];
      for (const k of Object.keys(a.compo).slice(0, 20)) {
        const q = Math.max(0, Math.min(200, parseInt(a.compo[k], 10) || 0));
        const base = catalogue.find((x) => x.id === k && x.type !== "pack");
        if (q > 0 && base) compo.push({ id: base.id, nom: base.nom, qte: q });
      }
      if (compo.length) ligne.compo = compo;
    }
    lignes.push(ligne);
    if (p.type === "pack") packs += total; else produits += total;
  }
  return { lignes, produits, packs, total: produits + packs, aPack: packs > 0 };
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

module.exports = { majPhotos, chargerCatalogue, calculerPanier, jourValide, calculerMontant };
