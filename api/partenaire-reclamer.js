const { verifierJeton } = require("./_auth");
const { getPartenaires, setPartenaires } = require("./_store");

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
    const partenaire = partenaires.find((p) => p.id === session.partenaireId);

    if (!partenaire) {
      return res.status(404).json({ erreur: "Compte introuvable" });
    }

    partenaire.reclamationEnCours = true;
    partenaire.reclamationDate = new Date().toISOString();

    await setPartenaires(partenaires);

    return res.status(200).json({ succes: true });
  } catch (erreur) {
    return res.status(500).json({ erreur: "Erreur serveur", details: erreur.message });
  }
};
