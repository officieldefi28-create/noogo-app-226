const { verifierJeton } = require("./_auth");
const { getPartenaires, getCommandes } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  const secretJeton = process.env.JETON_SECRET;
  if (!secretJeton) {
    return res.status(500).json({ erreur: "Configuration serveur manquante (JETON_SECRET)" });
  }

  try {
    const { jeton } = req.body || {};
    const session = verifierJeton(jeton, secretJeton);

    if (!session) {
      return res.status(401).json({ erreur: "Session expirée, merci de vous reconnecter" });
    }

    const partenaires = await getPartenaires();
    const commandes = await getCommandes();
    const partenaire = partenaires.find((p) => p.id === session.partenaireId);

    if (!partenaire) {
      return res.status(404).json({ erreur: "Compte introuvable" });
    }

    const mesCommandes = commandes.filter((c) => c.partenaireId === partenaire.id);
    const commandesLivrees = mesCommandes.filter((c) => c.statutLivraison === "livree");
    const totalGagne = commandesLivrees.reduce((s, c) => s + c.commission, 0);
    const totalPaye = commandesLivrees
      .filter((c) => c.statutCommission === "paye")
      .reduce((s, c) => s + c.commission, 0);
    const soldeRestant = totalGagne - totalPaye;

    return res.status(200).json({
      nom: partenaire.nom,
      code: partenaire.code,
      nombreCommandesTotal: mesCommandes.length,
      nombreCommandesLivrees: commandesLivrees.length,
      nombreCommandesEnAttente: mesCommandes.filter((c) => c.statutLivraison === "en_attente").length,
      totalGagne,
      totalPaye,
      soldeRestant,
      reclamationEnCours: !!partenaire.reclamationEnCours,
      commandes: mesCommandes
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 30)
        .map((c) => ({
          date: c.date,
          montantTotal: c.montantTotal,
          commission: c.commission,
          statutLivraison: c.statutLivraison,
          statutCommission: c.statutCommission
        }))
    });
  } catch (erreur) {
    return res.status(500).json({ erreur: "Erreur serveur", details: erreur.message });
  }
};
