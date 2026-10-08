const { verifierJeton } = require("./_auth");
const { getPartenaire, setPartenaire } = require("./_store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const secret = process.env.JETON_SECRET;
  if (!secret) return res.status(500).json({ erreur: "Configuration serveur manquante (JETON_SECRET)" });
  try {
    const session = verifierJeton((req.body || {}).jeton, secret);
    if (!session || session.role !== "partenaire") return res.status(401).json({ erreur: "Session expirée, merci de vous reconnecter" });
    const p = await getPartenaire(session.partenaireId);
    if (!p || p.archive) return res.status(404).json({ erreur: "Compte introuvable" });
    p.reclamationEnCours = true;
    p.reclamationDate = new Date().toISOString();
    await setPartenaire(p);
    return res.status(200).json({ succes: true });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Service momentanément indisponible" });
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
