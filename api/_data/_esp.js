// Calcul de l'argent liquide qu'une personne de l'équipe devrait avoir en main.
// attendu = ce qu'elle avait au dernier comptage + espèces encaissées depuis − argent déjà remis (main, Orange, Wave).
// Les crédits, paiements Orange/Wave et reçus supprimés n'entrent jamais dans les espèces.
const S = require("./_store");

const jourAvant = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };

async function calculer(m, jr, estLivreur) {
  const clotures = (await S.suiviListe("comptes_esp")).filter((c) => c && c.vid === m.id && c.date < jr && c.statut !== "supprime").sort((a, b) => (a.date < b.date ? 1 : -1));
  const dern = clotures[0] || null;
  const depuis = dern ? dern.date : jourAvant(jr);          // on compte les jours après le dernier comptage
  const report = dern ? Number(dern.compte) || 0 : 0;       // l'argent réellement trouvé la dernière fois
  const dansPeriode = (d) => d > depuis && d <= jr;
  const recus = (await S.suiviListe("recus")).filter((r) => r && !r.archive && !r.du && r.vid === m.id && dansPeriode(String(r.date || "")) && r.paiement === "Espèces");
  const ventes = recus.reduce((t, r) => t + (Number(r.total) || 0), 0);
  let livraisons = 0;
  if (estLivreur) {
    livraisons = (await S.getCommandes()).filter((c) => c && c.livreurId === m.id && c.statutLivraison === "livree" && c.encaisse && c.encaisse.mode === "Espèces" && dansPeriode(String(c.dateLivraison || "").slice(0, 10)))
      .reduce((t, c) => t + (Number(c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal) || 0), 0);
  }
  const remisesL = (await S.suiviListe("remises")).filter((x) => x && !x.archive && x.vid === m.id && x.statut !== "refuse" && dansPeriode(String(x.date || "")));
  const remises = remisesL.reduce((t, x) => t + (Number(x.montant) || 0), 0);
  return { attendu: Math.max(0, report + ventes + livraisons - remises), report, ventes, livraisons, remises, depuis };
}

module.exports = { calculer };
