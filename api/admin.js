const crypto = require("crypto");
const { hacherMotDePasse } = require("./_auth");
const { getPartenaires, setPartenaires, getCommandes, setCommandes } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "Méthode non autorisée" });
  }

  try {
    const data = req.body || {};
    const { motDePasseAdmin, action } = data;

    if (motDePasseAdmin !== "delfioficiel") {
      return res.status(401).json({ erreur: "Mot de passe incorrect" });
    }

    let partenaires = await getPartenaires();
    let commandes = await getCommandes();

    switch (action) {
      case "tout_voir": {
        return res.status(200).json({
          partenaires,
          commandes: commandes.slice().sort((a, b) => new Date(b.date) - new Date(a.date))
        });
      }

      case "creer_partenaire": {
        const { nom, telephone, type, code, remiseType, remiseValeur, commissionType, commissionValeur, joursActifs } = data;
        if (!nom || !telephone || !code) {
          return res.status(400).json({ erreur: "Nom, téléphone et code sont requis" });
        }
        const codeExiste = partenaires.some(
          (p) => (p.code || "").toUpperCase() === String(code).toUpperCase()
        );
        if (codeExiste) {
          return res.status(400).json({ erreur: "Ce code promo existe déjà" });
        }
        const motDePasseTemporaire = crypto.randomBytes(4).toString("hex").toUpperCase();
        const partenaire = {
          id: "PART-" + Date.now(),
          nom,
          telephone,
          type: type || "particulier",
          code: String(code).toUpperCase(),
          remiseType: remiseType || "pourcentage",
          remiseValeur: Number(remiseValeur) || 0,
          commissionType: commissionType || "pourcentage",
          commissionValeur: Number(commissionValeur) || 0,
          joursActifs: joursActifs || [],
          actif: true,
          motDePasseHache: hacherMotDePasse(motDePasseTemporaire)
        };
        partenaires.push(partenaire);
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, partenaire, motDePasseTemporaire });
      }

      case "modifier_partenaire": {
        const { partenaireId, nom, telephone, type, code, remiseType, remiseValeur, commissionType, commissionValeur, joursActifs } = data;
        const p = partenaires.find((p) => p.id === partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });

        if (code) {
          const nouveauCode = String(code).toUpperCase();
          const codeExisteAilleurs = partenaires.some(
            (autre) => autre.id !== partenaireId && (autre.code || "").toUpperCase() === nouveauCode
          );
          if (codeExisteAilleurs) {
            return res.status(400).json({ erreur: "Ce code promo est déjà utilisé par un autre partenaire" });
          }
          p.code = nouveauCode;
        }

        if (nom !== undefined && nom !== "") p.nom = nom;
        if (telephone !== undefined && telephone !== "") p.telephone = telephone;
        if (type !== undefined && type !== "") p.type = type;
        if (remiseType !== undefined && remiseType !== "") p.remiseType = remiseType;
        if (remiseValeur !== undefined && remiseValeur !== "") p.remiseValeur = Number(remiseValeur) || 0;
        if (commissionType !== undefined && commissionType !== "") p.commissionType = commissionType;
        if (commissionValeur !== undefined && commissionValeur !== "") p.commissionValeur = Number(commissionValeur) || 0;
        if (joursActifs !== undefined) p.joursActifs = joursActifs;

        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, partenaire: p });
      }

      case "supprimer_partenaire": {
        const avant = partenaires.length;
        partenaires = partenaires.filter((p) => p.id !== data.partenaireId);
        if (partenaires.length === avant) {
          return res.status(404).json({ erreur: "Partenaire introuvable" });
        }
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true });
      }

      case "creer_codes_automatiques": {
        const resultats = [];
        const defs = [
          { code: "MARDI", jour: 2 },
          { code: "SAMEDI", jour: 6 },
          { code: "FB", jour: null },
          { code: "TT", jour: null }
        ];
        for (const d of defs) {
          const existe = partenaires.some((p) => (p.code || "") === d.code);
          if (existe) {
            resultats.push({ code: d.code, statut: "existait déjà" });
            continue;
          }
          const motDePasseTemporaire = crypto.randomBytes(4).toString("hex").toUpperCase();
          partenaires.push({
            id: "PART-" + Date.now() + "-" + d.code,
            nom: "Code " + d.code,
            telephone: "",
            type: "particulier",
            code: d.code,
            remiseType: "fixe",
            remiseValeur: 100,
            commissionType: "fixe",
            commissionValeur: 0,
            joursActifs: d.jour === null ? [2, 6] : [d.jour],
            actif: true,
            auto: true,
            motDePasseHache: hacherMotDePasse(motDePasseTemporaire)
          });
          resultats.push({ code: d.code, statut: "créé" });
        }
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, resultats });
      }

      case "basculer_actif": {
        const p = partenaires.find((p) => p.id === data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });
        p.actif = !p.actif;
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true });
      }

      case "reinitialiser_mot_de_passe": {
        const p = partenaires.find((p) => p.id === data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });
        const motDePasseTemporaire = crypto.randomBytes(4).toString("hex").toUpperCase();
        p.motDePasseHache = hacherMotDePasse(motDePasseTemporaire);
        await setPartenaires(partenaires);
        return res.status(200).json({ succes: true, motDePasseTemporaire });
      }

      case "payer_tout_le_solde": {
        commandes.forEach((c) => {
          if (c.partenaireId === data.partenaireId && c.statutLivraison === "livree" && c.statutCommission === "impaye") {
            c.statutCommission = "paye";
          }
        });
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "valider_livraison": {
        const c = commandes.find((c) => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Commande introuvable" });
        c.statutLivraison = "livree";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "annuler_commande": {
        const c = commandes.find((c) => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Commande introuvable" });
        c.statutLivraison = "annulee";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "supprimer_commande": {
        const avant = commandes.length;
        commandes = commandes.filter((c) => c.id !== data.commandeId);
        if (commandes.length === avant) {
          return res.status(404).json({ erreur: "Commande introuvable" });
        }
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      case "marquer_commission_payee": {
        const c = commandes.find((c) => c.id === data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Commande introuvable" });
        c.statutCommission = "paye";
        await setCommandes(commandes);
        return res.status(200).json({ succes: true });
      }

      default:
        return res.status(400).json({ erreur: "Action non reconnue" });
    }
  } catch (err) {
    return res.status(500).json({ erreur: "Erreur serveur", details: err.message });
  }
};
