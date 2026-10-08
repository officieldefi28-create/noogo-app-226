const { verifierJeton } = require("./_auth");
const { getPartenaire, getCommandes } = require("./_store");

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

    const mes = (await getCommandes()).filter((c) => c.partenaireId === p.id);
    const livrees = mes.filter((c) => c.statutLivraison === "livree");
    const gagne = livrees.reduce((s, c) => s + (c.commission || 0), 0);
    const paye = livrees.filter((c) => c.statutCommission === "paye").reduce((s, c) => s + (c.commission || 0), 0);

    return res.status(200).json({
      nom: p.nom,
      code: p.code,
      remiseType: p.remiseType, remiseValeur: p.remiseValeur,
      commissionType: p.commissionType, commissionValeur: p.commissionValeur,
      joursActifs: p.joursActifs || [],
      nombreCommandesTotal: mes.length,
      nombreCommandesLivrees: livrees.length,
      nombreCommandesEnAttente: mes.filter((c) => c.statutLivraison === "en_attente").length,
      totalGagne: gagne,
      totalPaye: paye,
      soldeRestant: gagne - paye,
      reclamationEnCours: !!p.reclamationEnCours,
      commandes: mes.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30).map((c) => ({
        date: c.date,
        montantTotal: c.montantTotal,
        commission: c.commission || 0,
        statutLivraison: c.statutLivraison,
        statutCommission: c.statutCommission
      }))
    });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Service momentanément indisponible" });
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
