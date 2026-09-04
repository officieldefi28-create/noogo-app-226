const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ erreur: 'Méthode non autorisée' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { motDePasseAdmin, action } = data;

    // Mot de passe admin sécurisé
    if (motDePasseAdmin !== 'delfioficiel') {
      return {
        statusCode: 401,
        body: JSON.stringify({ erreur: 'Mot de passe incorrect' })
      };
    }

    // Actions d'administration de base
    if (action === 'tout_voir') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          partenaires: [],
          commandes: []
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ succes: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erreur: 'Erreur interne du serveur' })
    };
  }
};
                            
