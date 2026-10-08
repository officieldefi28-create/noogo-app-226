const defaut = require("../catalogue.json");
const { getCatalogue } = require("./_store");

async function chargerCatalogue() {
  try {
    const perso = await getCatalogue();
    if (Array.isArray(perso) && perso.length) return perso;
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
    lignes.push({ id: p.id, nom: p.nom, type: p.type, qte, prix: Number(p.prix), total, surCommande: !!p.surCommande });
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

module.exports = { chargerCatalogue, calculerPanier, jourValide, calculerMontant };
