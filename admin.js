const crypto = require("crypto");
const { hacherMotDePasse } = require("./_auth");
const { getPartenaires, setPartenaires, getCommandes, setCommandes, getProduitsEtat, setProduitsEtat } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  try {
    const data = req.body || {};
    let { motDePasseAdmin, action } = data;

    // Action publique : lire état produits
    if (action === "get_produits_etat") {
      const etat = await getProduitsEtat();
      return res.status(200).json({ etat });
    }

    // Vérification du mot de passe admin
    if (motDePasseAdmin !== "delfioficiel") {
      return res.status(401).json({ erreur: "Mot de passe incorrect" });
    }

    let partenaires = await getPartenaires();
    let commandes = await getCommandes();

    // Normalisation / Alias pour éviter les erreurs "Action non reconnue" depuis le front-end
    if (action === "activer_produit" || action === "desactiver_produit") action = "toggle_produit";

    switch (action) {

      // ── PRODUITS VISIBILITÉ ──
      case "toggle_produit": {
        const { produitId } = data;
        if (!produitId) return res.status(400).json({ erreur: "produitId requis" });
        const etat = await getProduitsEtat();
        const actuelEtat = produitId in etat ? etat[produitId] : true;
        etat[produitId] = !actuelEtat;
        await setProduitsEtat(etat);
        return res.status(200).json({ succes: true, produitId, actif: etat[produitId] });
      }

      case "set_produit_etat": {
        const { produitId, actif } = data;
        if (!produitId) return res.status(400).json({ erreur: "produitId requis" });
        const etat = await getProduitsEtat();
        etat[produitId] = !!actif;
        await setProduitsEtat(etat);
        return res.status(200).json({ succes: true, produitId, actif: etat[produitId] });
      }

      case "reset_produits_etat": {
        await setProduitsEtat({});
        return res.status(200).json({ succes: true, message: "Tous les produits réactivés" });
      }

      // ── VUE GÉNÉRALE ──
      case "tout_voir": {
        const etat = await getProduitsEtat();
        return res.status(200).json({
          partenaires,
          commandes: commandes.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
          produitsEtat: etat
        });
      }

      // ── PARTENAIRES ──
      case "creer_partenaire": {
        const { nom, telephone, type, code, remiseType, remiseValeur, commissionType, commissionValeur, joursActifs } = data;
        if (!nom || !telephone || !code) return res.status(400).json({ erreur: "Nom, téléphone et code requis" });
        const codeExiste = partenaires.some(p => (p.code||"").toUpperCase() === String(code).toUpperCase());
        if (codeExiste) return res.status(400).json({ erreur: "Ce code promo existe déjà" });
        const mdpTemp = crypto.randomBytes(4).toString("hex").toUpperCase();
        const partenaire = {
          id: "PART-" + Date.now(),
          nom, telephone, type: type || "particulier",
          code: String(code).toUpperCase(),
          remiseType: remiseType || "pourcentage",
          remiseValeur: Number(remiseValeur) || 0,
          commissionType: commissionType || "pourcentage",
          commissionValeur: Number(commissionValeur) || 0,
          joursActifs: joursActifs || [],
          actif: true,
          archive: false,
          motDePasseHache: hacherMotDePasse(mdpTemp)
        };
        partenaires.push(partenaire);
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, partenaire, motDePasseTemporaire: mdpTemp });
      }

      case "modifier_partenaire": {
        const { partenaireId, nom, telephone, type, code, remiseType, remiseValeur, commissionType, commissionValeur, joursActifs } = data;
        const p = partenaires.find(p => p.id === partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });
        if (code) {
          const ncode = String(code).toUpperCase();
          if (partenaires.some(a => a.id !== partenaireId && (a.code||"").toUpperCase() === ncode))
            return res.status(400).json({ erreur: "Code déjà utilisé" });
          p.code = ncode;
        }
        if (nom) p.nom = nom;
        if (telephone) p.telephone = telephone;
        if (type) p.type = type;
        if (remiseType) p.remiseType = remiseType;
        if (remiseValeur !== undefined) p.remiseValeur = Number(remiseValeur) || 0;
        if (commissionType) p.commissionType = commissionType;
        if (commissionValeur !== undefined) p.commissionValeur = Number(commissionValeur) || 0;
        if (joursActifs !== undefined) p.joursActifs = joursActifs;
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, partenaire: p });
      }

      case "supprimer_partenaire": {
        const avant = partenaires.length;
        partenaires = partenaires.filter(p => p.id !== data.partenaireId);
        if (partenaires.length === avant) return res.status(404).json({ erreur: "Introuvable" });
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true });
      }

      case "basculer_actif": {
        const p = partenaires.find(p => p.id === data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Introuvable" });
        p.actif = !p.actif;
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true });
      }

      case "reinitialiser_mot_de_passe": {
        const p = partenaires.find(p => p.id === data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Introuvable" });
        const mdpTemp = crypto.randomBytes(4).toString("hex").toUpperCase();
        p.motDePasseHache = hacherMotDePasse(mdpTemp);
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, motDePasseTemporaire: mdpTemp });
      }

      case "creer_codes_automatiques": {
        const resultats = [];
        const defs = [
          { code: "MARDI", joursActifs: [2] },
          { code: "SAMEDI", joursActifs: [6] },
          { code: "FB", joursActifs: [] },
          { code: "TT", joursActifs: [] }
        ];
        for (const d of defs) {
          if (partenaires.some(p => (p.code||"") === d.code)) { resultats.push({code:d.code, statut:"existait déjà"}); continue; }
          const mdpTemp = crypto.randomBytes(4).toString("hex").toUpperCase();
          partenaires.push({
            id: "PART-" + Date.now() + "-" + d.code, nom: "Code " + d.code,
            telephone: "", type: "automatique", code: d.code,
            remiseType: "fixe", remiseValeur: 100,
            commissionType: "fixe", commissionValeur: 0,
            joursActifs: d.joursActifs, actif: true, auto: true, archive: false,
            motDePasseHache: hacherMotDePasse(mdpTemp)
          });
          resultats.push({ code: d.code, statut: "créé" });
        }
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, resultats });
      }

      // ── COMMANDES ──
      case "valider_livraison": {
        const c = commandes.find(c => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Introuvable" });
        c.statutLivraison = "livree";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "annuler_commande": {
        const c = commandes.find(c => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Introuvable" });
        c.statutLivraison = "annulee";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "supprimer_commande": {
        const avant = commandes.length;
        commandes = commandes.filter(c => c.id !== data.commandeId);
        if (commandes.length === avant) return res.status(404).json({ erreur: "Introuvable" });
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "marquer_commission_payee": {
        const c = commandes.find(c => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Introuvable" });
        c.statutCommission = "paye";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "payer_tout_le_solde": {
        commandes.forEach(c => {
          if (c.partenaireId === data.partenaireId && c.statutLivraison === "livree" && c.statutCommission !== "paye")
            c.statutCommission = "paye";
        });
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "archiver_commande":
      case "desarchiver_commande": {
        const c = commandes.find(c => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Introuvable" });
        c.archive = action === "archiver_commande";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "archiver_partenaire":
      case "desarchiver_partenaire": {
        const p = partenaires.find(p => p.id === data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Introuvable" });
        p.archive = action === "archiver_partenaire";
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true });
      }

      default:
        return res.status(400).json({ erreur: "Action non reconnue : " + action });
    }
  } catch (err) {
    return res.status(500).json({ erreur: "Erreur serveur", details: err.message });
  }
};
