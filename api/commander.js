const { getPartenaires, setCommande, limiter } = require("./_store");
const { chargerCatalogue, calculerPanier, jourValide, calculerMontant } = require("./_catalogue");
const { ipClient } = require("./_auth");

const PAIEMENTS = ["especes", "orange", "wave"];
const nettoyer = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    if (!(await limiter("cmd:" + ipClient(req), 20, 3600))) {
      return res.status(429).json({ erreur: "Trop de commandes depuis cet appareil. Contactez-nous sur WhatsApp." });
    }

    const tel = nettoyer(d.telClient, 30);
    if (tel.replace(/\D/g, "").length < 8) return res.status(400).json({ erreur: "Numéro de téléphone invalide" });

    const catalogue = await chargerCatalogue();
    const panier = calculerPanier(d.articles, catalogue);
    if (!panier.lignes.length) return res.status(400).json({ erreur: "Panier vide" });

    // Code promo (revalidé ici, jamais fait confiance au navigateur)
    let remise = 0, commission = 0, partenaireId = null, codeFinal = "";
    const codeSaisi = nettoyer(d.codePromo || d.partenaireCode, 40).toUpperCase();
    if (codeSaisi) {
      const p = (await getPartenaires()).find((x) => (x.code || "").toUpperCase() === codeSaisi && x.actif && !x.archive && jourValide(x));
      if (p) {
        remise = Math.min(panier.total, calculerMontant(p.remiseType, p.remiseValeur, panier.total));
        commission = calculerMontant(p.commissionType, p.commissionValeur, panier.total);
        partenaireId = p.id;
        codeFinal = p.code;
      }
    }

    const retrait = d.modeReception === "retrait";
    const cmd = {
      id: "CMD-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase(),
      date: new Date().toISOString(),
      nomClient: nettoyer(d.nomClient, 80) || "Non renseigné",
      telClient: tel,
      localisation: retrait ? "Retrait au local" : (nettoyer(d.localisation, 200) || "Non précisée"),
      modePaiement: PAIEMENTS.includes(d.modePaiement) ? d.modePaiement : "especes",
      modeReception: retrait ? "retrait" : "livraison",
      articles: panier.lignes,
      montantProduits: panier.produits,
      montantPacks: panier.packs,
      montantTotal: panier.total,
      code: codeFinal,
      remise,
      montantApresRemise: Math.max(0, panier.total - remise),
      // Livraison : incluse pour les packs ; à la charge du client pour les articles seuls (convenue sur WhatsApp)
      livraison: retrait ? "retrait" : (panier.aPack && panier.produits === 0 ? "incluse" : (panier.aPack ? "packs-inclus" : "a-charge-client")),
      commission,
      partenaireId,
      statutLivraison: "en_attente",
      statutCommission: "impaye",
      source: nettoyer(d.source, 20) || "site"
    };
    await setCommande(cmd);
    return res.status(200).json({ succes: true, commandeId: cmd.id, remise, totalFinal: cmd.montantApresRemise });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Enregistrement indisponible" });
    return res.status(500).json({ erreur: "Erreur lors de l'enregistrement de la commande" });
  }
};
