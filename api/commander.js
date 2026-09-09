const { getCommandes, setCommandes, getPartenaires } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  try {
    const {
      nomClient, telClient, localisation, modePaiement, modeReception,
      articles, montantTotal, montantProduits, montantPacks,
      fraisLivraison, remise, codePromo, partenaireCode
    } = req.body || {};

    if (!telClient) return res.status(400).json({ erreur: "Téléphone requis" });

    // Trouver le partenaire si code promo utilisé
    let partenaireId = null;
    let commission = 0;
    if (codePromo) {
      const partenaires = await getPartenaires();
      const partenaire = partenaires.find(p => (p.code || "").toUpperCase() === (codePromo || "").toUpperCase() && p.actif);
      if (partenaire) {
        partenaireId = partenaire.id;
        commission = partenaire.commission || 0;
      }
    }

    const commandes = await getCommandes();
    const nouvelleCommande = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      nomClient: nomClient || "Client Noogo",
      telClient,
      localisation: localisation || "Non précisé",
      modePaiement: modePaiement || "especes",
      modeReception: modeReception || "livraison",
      articles: articles || [],
      montantTotal: montantTotal || 0,
      montantProduits: montantProduits || 0,
      montantPacks: montantPacks || 0,
      fraisLivraison: fraisLivraison || 0,
      remise: remise || 0,
      codePromo: codePromo || null,
      partenaireId,
      commission,
      statutLivraison: "en_attente",
      statutCommission: "en_attente"
    };

    commandes.push(nouvelleCommande);
    await setCommandes(commandes);

    return res.status(200).json({ succes: true, id: nouvelleCommande.id });
  } catch (erreur) {
    return res.status(500).json({ erreur: "Erreur serveur", details: erreur.message });
  }
};
                                 
