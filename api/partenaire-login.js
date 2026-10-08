const { verifierMotDePasse, signerJeton, ipClient } = require("./_auth");
const { getPartenaires, limiter } = require("./_store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  const secret = process.env.JETON_SECRET;
  if (!secret) return res.status(500).json({ erreur: "Configuration serveur manquante (JETON_SECRET)" });
  try {
    const { code, motDePasse } = req.body || {};
    if (!code || !motDePasse) return res.status(400).json({ erreur: "Code promo et mot de passe requis" });
    if (!(await limiter("plogin:" + ipClient(req), 10, 600))) {
      return res.status(429).json({ erreur: "Trop de tentatives. Réessayez dans 10 minutes." });
    }
    const codeN = String(code).trim().toUpperCase();
    const p = (await getPartenaires()).find((x) => (x.code || "").toUpperCase() === codeN);
    if (!p || !p.actif || p.archive || !verifierMotDePasse(motDePasse, p.motDePasseHache)) {
      return res.status(401).json({ erreur: "Code ou mot de passe incorrect" });
    }
    const jeton = signerJeton({ role: "partenaire", partenaireId: p.id, creeLe: Date.now() }, secret);
    return res.status(200).json({ jeton, nom: p.nom, code: p.code });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Service momentanément indisponible" });
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
