export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erreur: 'Méthode non autorisée' });
  }

  try {
    const { codePartenaire } = req.body || {};

    if (!codePartenaire) {
      return res.status(400).json({ erreur: 'Code partenaire requis' });
    }

    return res.status(200).json({
      succes: true,
      message: 'Connexion partenaire réussie',
      partenaire: {
        code: codePartenaire,
        solde: 0,
        commissions: []
      }
    });
  } catch (err) {
    return res.status(500).json({ erreur: 'Erreur serveur' });
  }
}
