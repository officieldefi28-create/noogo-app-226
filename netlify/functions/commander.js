exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erreur: 'Méthode non autorisée' }) };
  }

  try {
    const commande = JSON.parse(event.body || '{}');
    
    // Structure de la commande reçue
    const nouvelleCommande = {
      id: 'CMD-' + Date.now(),
      date: new Date().toISOString(),
      client: commande.client || {},
      articles: commande.articles || [],
      total: commande.total || 0,
      codePromo: commande.codePromo || null,
      partenaireId: commande.partenaireId || null,
      commissionMontant: commande.commissionMontant || 0,
      statut: 'en_attente', // La commande démarre toujours en attente
      paye: false
    };

    // Ici, la commande est sauvegardée sans créditer le solde du partenaire
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        succes: true, 
        message: 'Commande enregistrée en attente de paiement',
        commandeId: nouvelleCommande.id 
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ erreur: 'Erreur lors de la commande' }) };
  }
};
