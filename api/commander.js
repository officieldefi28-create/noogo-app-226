const { getPartenaires, setCommande, limiter, getCommandes } = require("./_store");
const { chargerCatalogue, calculerPanier, jourValide, calculerMontant, dejaUtilise, codeExpire, limiteAtteinte, resoudreAmi } = require("./_catalogue");
const { ipClient } = require("./_auth");
const { getReglages } = require("./_store");
const { fusionner } = require("./_site");

const PAIEMENTS = ["especes", "orange", "wave"];
const nettoyer = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

// Pour les packs « livraison incluse » : valeur des pots au prix normal, et ce qui reste (= la livraison cachée dans le prix)
function cacheLivraison(panier, catalogue) {
  let pots = 0, supp = 0;
  for (const l of (panier && panier.lignes) || []) {
    if (l.type !== "pack") continue;
    const p = catalogue.find((x) => x.id === l.id);
    if (!p || p.packLiv === "sans") continue;
    let v = null;
    if (p.packCompo) { v = 0; for (const k of Object.keys(p.packCompo)) { const b = catalogue.find((x) => x.id === k); if (!b) { v = null; break; } v += b.prix * (parseInt(p.packCompo[k], 10) || 0); } }
    else { const m = /^pk-(van|bao|ban|cho|fra)-(p|g)$/.exec(p.id), BP = { van: "vanille", bao: "baobab", ban: "banane", cho: "choco", fra: "fraise" }, b = m && catalogue.find((x) => x.id === BP[m[1]] + "-" + m[2]); if (b) v = b.prix * (parseInt(p.packCount, 10) || 5); }
    if (v == null) continue;
    pots += v * l.qte; if (l.total > v * l.qte) supp += l.total - v * l.qte;
  }
  return { pots, supp };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    if (!(await limiter("cmd:" + ipClient(req), 20, 3600))) {
      return res.status(429).json({ erreur: "Trop de commandes depuis cet appareil. Contactez-nous sur WhatsApp." });
    }

    const tel = nettoyer(d.telClient, 30);
    // Le téléphone est obligatoire : sans lui, le livreur ne peut pas joindre le client.
    if (tel.replace(/\D/g, "").length < 8) return res.status(400).json({ erreur: "Numéro de téléphone obligatoire (8 chiffres au moins)" });
    let rgl = {}; try { rgl = fusionner(await getReglages()).reglages; } catch (e) { rgl = {}; }
    if (rgl.ferme === "oui") return res.status(403).json({ erreur: rgl.messageFerme || "Commandes fermées pour le moment" });

    const catalogue = await chargerCatalogue();
    const panier = calculerPanier(d.articles, catalogue);
    if (!panier.lignes.length) return res.status(400).json({ erreur: "Panier vide" });
    const mini = parseInt(rgl.commandeMin, 10) || 0;
    if (mini && panier.total < mini) return res.status(400).json({ erreur: "Commande minimale : " + mini + " FCFA" });

    // Code promo (revalidé ici, jamais fait confiance au navigateur)
    let remise = 0, commission = 0, partenaireId = null, codeFinal = "", parrainTel = "";
    const codeSaisi = nettoyer(d.codePromo || d.partenaireCode, 40).toUpperCase();
    if (codeSaisi) {
      let p = (await getPartenaires()).find((x) => (x.code || "").toUpperCase() === codeSaisi && x.actif && !x.archive && jourValide(x));
      const toutes = await getCommandes();
      if (p) {
        if (codeExpire(p)) return res.status(400).json({ erreur: "Ce code n'est plus valable (date dépassée). Retirez le code pour commander." });
        if (limiteAtteinte(p, toutes)) return res.status(400).json({ erreur: "Ce code n'est plus disponible (nombre maximum d'utilisations atteint). Retirez le code pour commander." });
        if (dejaUtilise(p, tel, toutes)) return res.status(400).json({ erreur: "Ce code a déjà été utilisé avec ce numéro : il ne sert qu'une fois par client. Retirez le code pour commander." });
      } else {
        const ami = resoudreAmi(codeSaisi, tel, toutes, rgl);
        if (ami && ami.erreur) return res.status(400).json({ erreur: ami.erreur + ". Retirez le code pour commander." });
        if (ami) { p = ami.p; parrainTel = ami.p.parrain; }
      }
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
      parrainTel,
      remise,
      montantApresRemise: Math.max(0, panier.total - remise),
      // Livraison : incluse pour les packs ; à la charge du client pour les articles seuls (convenue sur WhatsApp)
      livraison: retrait ? "retrait" : (panier.aPack && panier.produits === 0 ? "incluse" : (panier.aPack ? "packs-inclus" : "a-charge-client")),
      livraisonCachee: retrait ? 0 : cacheLivraison(panier, catalogue).supp,   // part « livraison » incluse dans les packs (visible seulement par vous)
      produitsPacks: retrait ? 0 : cacheLivraison(panier, catalogue).pots,
      fraisLivraison: retrait ? 0 : Math.max(0, Math.min(50000, Math.round(Number(d.fraisLivraison) || 0))),   // estimation affichée au client (articles seuls) : payée en espèces au livreur, hors caisse
      quartierLivraison: retrait ? "" : (nettoyer(d.quartier, 60) || ""),
      source: (nettoyer(d.source, 30) || "").toLowerCase().replace(/[^a-z0-9_-]/g, "") || "direct",
      commission,
      partenaireId,
      statutLivraison: "en_attente",
      statutCommission: "impaye",
      note: nettoyer(d.note, 300),
      source: nettoyer(d.source, 20) || "site"
    };
    await setCommande(cmd);
    return res.status(200).json({ succes: true, commandeId: cmd.id, remise, totalFinal: cmd.montantApresRemise });
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Enregistrement indisponible" });
    console.error("commander", e && e.message);
    return res.status(500).json({ erreur: "Erreur lors de l'enregistrement de la commande" });
  }
};
