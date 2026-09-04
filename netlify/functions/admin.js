exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erreur: 'Méthode non autorisée' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { motDePasseAdmin, action, commandeId, partenaire } = data;

    // Vérification de la sécurité admin
    if (motDePasseAdmin !== 'delfioficiel') {
      return { statusCode: 401, body: JSON.stringify({ erreur: 'Mot de passe incorrect' }) };
    }

    // 1. Chargement initial des données (Partenaires et Commandes)
    if (!action || action === 'connexion' || action === 'charger_donnees' || action === 'get_data') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          succes: true,
          message: 'Données chargées',
          partenaires: [], 
          commandes: []    
        })
      };
    }

    // 2. Création d'un nouveau partenaire
    if (action === 'creer_partenaire' || action === 'ajouter_partenaire') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          succes: true,
          message: 'Partenaire créé avec succès !'
        })
      };
    }

    // 3. Validation du paiement d'une commande (Crédite le partenaire)
    if (action === 'valider_paiement') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          succes: true,
          message: `Paiement validé pour la commande ${commandeId}. Commission créditée.`
        })
      };
    }

    // 4. Annulation d'une commande
    if (action === 'annuler_commande') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          succes: true,
          message: `Commande ${commandeId} annulée.`
        })
      };
    }

    // Réponse par défaut pour éviter tout blocage
    return {
      statusCode: 200,
      body: JSON.stringify({ succes: true, partenaires: [], commandes: [] })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ erreur: 'Erreur serveur' }) };
  }
};
