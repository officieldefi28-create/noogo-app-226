const { getPartenaires, getCommandes, getReglages } = require("./_store");
const SITE = require("./_site");
const { chargerCatalogue, calculerPanier, jourValide, calculerMontant, dejaUtilise, codeExpire, limiteAtteinte, resoudreAmi } = require("./_catalogue");
const { ipClient } = require("./_auth");
const { limiter } = require("./_store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const { code, articles, tel } = req.body || {};
    if (!code || String(code).trim() === "") return res.status(200).json({ valide: false });

    // Anti-devinette : 30 essais / 10 min par appareil
    if (!(await limiter("code:" + ipClient(req), 30, 600))) {
      return res.status(429).json({ valide: false, message: "Trop d'essais, réessayez dans quelques minutes" });
    }

    const partenaires = await getPartenaires();
    const codeN = String(code).trim().toUpperCase().slice(0, 40);
    let p = partenaires.find((x) => (x.code || "").toUpperCase() === codeN && x.actif && !x.archive);
    const toutes = await getCommandes();
    if (p) {
      if (!jourValide(p)) return res.status(200).json({ valide: false, message: "Ce code n'est pas valable aujourd'hui" });
      if (codeExpire(p)) return res.status(200).json({ valide: false, message: "Ce code n'est plus valable (date dépassée)" });
      if (limiteAtteinte(p, toutes)) return res.status(200).json({ valide: false, message: "Ce code n'est plus disponible" });
      if (tel && dejaUtilise(p, tel, toutes)) return res.status(200).json({ valide: false, message: "Ce code a déjà été utilisé avec ce numéro (une seule fois par client)" });
    } else {
      let rgl = {}; try { rgl = SITE.fusionner(await getReglages()).reglages; } catch (e) {}
      const ami = resoudreAmi(codeN, tel || "", toutes, rgl);
      if (!ami) return res.status(200).json({ valide: false, message: "Code promo invalide" });
      if (ami.erreur) return res.status(200).json({ valide: false, message: ami.erreur });
      p = ami.p;
    }
    const catalogue = await chargerCatalogue();
    const panier = calculerPanier(articles, catalogue);
    let remise = calculerMontant(p.remiseType, p.remiseValeur, panier.total);
    if (remise > panier.total) remise = panier.total;
    return res.status(200).json({ valide: true, remise, montantFinal: panier.total - remise });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ valide: false, message: "Codes promo momentanément indisponibles" });
    console.error("verifier-code", e && e.message);
    return res.status(500).json({ valide: false, message: "Erreur serveur" });
  }
};
