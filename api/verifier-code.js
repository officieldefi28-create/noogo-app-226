const { getPartenaires } = require("./_store");

function jourValide(partenaire) {
  if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) return true;
  return partenaire.joursActifs.includes(new Date().getDay());
}

function calculerRemise(partenaire, montantTotal) {
  let remise =
    partenaire.remiseType === "pourcentage"
      ? Math.round(montantTotal * (partenaire.remiseValeur / 100))
      : partenaire.remiseValeur;
  if (remise > montantTotal) remise = montantTotal;
  return remise;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  try {
    const { code, montantTotal } = req.body || {};

    if (!code || String(code).trim() === "") {
      return res.status(200).json({ valide: false });
    }

    const partenaires = await getPartenaires();
    const codeNormalise = String(code).trim().toUpperCase();
    const partenaire = partenaires.find(
      (p) => (p.code || "").toUpperCase() === codeNormalise && p.actif
    );

    if (!partenaire) {
      return res.status(200).json({ valide: false, message: "Code promo invalide" });
    }

    if (!jourValide(partenaire)) {
      return res.status(200).json({ valide: false, message: "Ce code n'est pas valable aujourd'hui" });
    }

    const remise = calculerRemise(partenaire, montantTotal || 0);

    return res.status(200).json({
      valide: true,
      remise,
      montantFinal: (montantTotal || 0) - remise
    });
  } catch (erreur) {
    return res.status(500).json({ erreur: "Erreur serveur", details: erreur.message });
  }
};
