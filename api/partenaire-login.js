const { verifierMotDePasse, signerJeton } = require("./_auth");
const { getPartenaires } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  const secretJeton = process.env.JETON_SECRET;
  if (!secretJeton) {
    return res.status(500).json({ erreur: "Configuration serveur manquante (JETON_SECRET)" });
  }

  try {
    const { code, motDePasse } = req.body || {};

    if (!code || !motDePasse) {
      return res.status(400).json({ erreur: "Code promo et mot de passe requis" });
    }

    const partenaires = await getPartenaires();
    const codeNormalise = String(code).trim().toUpperCase();
    const partenaire = partenaires.find(
      (p) => (p.code || "").toUpperCase() === codeNormalise
    );

    if (!partenaire || !partenaire.actif) {
      return res.status(401).json({ erreur: "Code ou mot de passe incorrect" });
    }

    if (!verifierMotDePasse(motDePasse, partenaire.motDePasseHache)) {
      return res.status(401).json({ erreur: "Code ou mot de passe incorrect" });
    }

    const jeton = signerJeton({ partenaireId: partenaire.id, creeLe: Date.now() }, secretJeton);

    return res.status(200).json({ jeton, nom: partenaire.nom, code: partenaire.code });
  } catch (erreur) {
    return res.status(500).json({ erreur: "Erreur serveur", details: erreur.message });
  }
};
