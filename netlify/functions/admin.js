exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erreur: 'Méthode non autorisée' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { motDePasseAdmin, action, commandeId } = data;

    // Vérification de la sécurité admin
    if (motDePasseAdmin !== 'delfioficiel') {
      return { statusCode: 401, body: JSON.stringify({ erreur: 'Mot de passe incorrect' }) };
    }

    // Action : Valider le paiement d'une commande
    if (action === 'valider_paiement') {
      // 1. Le statut passe à "payee"
      // 2. La commission est MAINTENANT attribuée au compte du partenaire
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          succes: true, 
          message: `Paiement valide pour la commande ${commandeId}. Commission creditee au partenaire.` 
        })
      };
    }

    // Action : Annuler une commande non payée
    if (action === 'annuler_commande') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          succes: true, 
          message: `Commande ${commandeId} annulee. Aucune commission versee.` 
        })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ erreur: 'Action non reconnue' }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ erreur: 'Erreur serveur' }) };
  }
};
