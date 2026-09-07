const { getPartenaires, getCommandes, setCommandes } = require("./_store");

// Vérifie si le partenaire est actif le jour même
function jourValide(partenaire) {
  if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) return true;
  return partenaire.joursActifs.includes(new Date().getDay());
}

// Calcule la remise ou la commission (pourcentage ou montant fixe)
function calculerMontant(type, valeur, montantTotal) {
  return type === "pourcentage" ? Math.round(montantTotal * (valeur / 100)) : valeur;
}

module.exports = async (req, res) => {
  // Autoriser uniquement les requêtes POST
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  try {
    const data = req.body || {};
    const montantTotal = Number(data.montantTotal) || 0;
    let remise = 0;
    let commission = 0;
    let partenaireId = null;
    let codeFinal = "";

    // Traitement du code promo / partenaire
    if (data.code) {
      const partenaires = await getPartenaires();
      const codeNormalise = String(data.code).trim().toUpperCase();
      const partenaire = partenaires.find(
        (p) => (p.code || "").toUpperCase() === codeNormalise && p.actif && jourValide(p)
      );

      if (partenaire) {
        remise = calculerMontant(partenaire.remiseType, partenaire.remiseValeur, montantTotal);
        if (remise > montantTotal) remise = montantTotal;
        commission = calculerMontant(partenaire.commissionType, partenaire.commissionValeur, montantTotal);
        partenaireId = partenaire.id;
        codeFinal = partenaire.code;
      }
    }
        const commandes = await getCommandes();

    // Création de l'objet commande enrichi
    const nouvelleCommande = {
      id: "CMD-" + Date.now(),
      date: new Date().toISOString(),
      nomClient: data.nomClient || "Non renseigné",
      telClient: data.telClient || "Non renseigné",
      localisation: data.localisation || "Non renseignée",
      modePaiement: data.modePaiement || "especes",
      modeReception: data.modeReception || "livraison",
      articles: data.articles || [], // Liste détaillée des pots/packs commandés
      montantTotal,
      code: codeFinal,
      remise,
      montantApresRemise: Math.max(0, montantTotal - remise),
      commission,
      partenaireId,
      statutLivraison: "en_attente",
      statutCommission: "impaye",
      source: data.source || "direct"
    };

    // Sauvegarde dans le store
    commandes.push(nouvelleCommande);
    await setCommandes(commandes);

    return res.status(200).json({
      succes: true,
      message: "Commande enregistrée avec succès",
      commandeId: nouvelleCommande.id,
      remise,
      totalFinal: nouvelleCommande.montantApresRemise
    });
  } catch (err) {
    return res.status(500).json({ 
      erreur: "Erreur lors de l'enregistrement de la commande", 
      details: err.message 
    });
  }
};
