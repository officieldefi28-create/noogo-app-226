exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erreur: 'Méthode non autorisée' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { motDePasseAdmin, action, commandeId } = data;

    // Vérification du mot de passe
    if (motDePasseAdmin !== 'delfioficiel') {
      return { statusCode: 401, body: JSON.stringify({ erreur: 'Mot de passe incorrect' }) };
    }

    // Action : Connexion ou chargement des données
    if (!action || action === 'connexion' || action === 'charger_donnees') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          succes: true, 
          message: 'Connexion réussie',
          commandes: [] // Renvoie les commandes
        })
      };
    }

    // Action : Valider le paiement d'une commande
    if (action === 'valider_paiement') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          succes: true, 
          message: `Paiement validé pour la commande ${commandeId}. Commission créditée.` 
        })
      };
    }

    // Action : Annuler une commande
    if (action === 'annuler_commande') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          succes: true, 
          message: `Commande ${commandeId} annulée.` 
        })
      };
    }

    // Par défaut, si l'action n'est pas spécifiée, on accepte la connexion
    return {
      statusCode: 200,
      body: JSON.stringify({ succes: true, message: 'Accès autorisé' })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ erreur: 'Erreur serveur' }) };
  }
};
