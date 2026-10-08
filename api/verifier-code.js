const { getPartenaires } = require("./_store");
const { chargerCatalogue, calculerPanier, jourValide, calculerMontant } = require("./_catalogue");
const { ipClient } = require("./_auth");
const { limiter } = require("./_store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const { code, articles } = req.body || {};
    if (!code || String(code).trim() === "") return res.status(200).json({ valide: false });

    // Anti-devinette : 30 essais / 10 min par appareil
    if (!(await limiter("code:" + ipClient(req), 30, 600))) {
      return res.status(429).json({ valide: false, message: "Trop d'essais, réessayez dans quelques minutes" });
    }

    const partenaires = await getPartenaires();
    const codeN = String(code).trim().toUpperCase().slice(0, 40);
    const p = partenaires.find((x) => (x.code || "").toUpperCase() === codeN && x.actif && !x.archive);
    if (!p) return res.status(200).json({ valide: false, message: "Code promo invalide" });
    if (!jourValide(p)) return res.status(200).json({ valide: false, message: "Ce code n'est pas valable aujourd'hui" });

    const catalogue = await chargerCatalogue();
    const panier = calculerPanier(articles, catalogue);
    let remise = calculerMontant(p.remiseType, p.remiseValeur, panier.total);
    if (remise > panier.total) remise = panier.total;
    return res.status(200).json({ valide: true, remise, montantFinal: panier.total - remise });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ valide: false, message: "Codes promo momentanément indisponibles" });
    return res.status(500).json({ valide: false, message: "Erreur serveur" });
  }
};
