const {
  hacherMotDePasse, genererMotDePasseTemporaire, motDePasseAdminValide,
  adminValide, signerJeton, ipClient
} = require("./_auth");
const S = require("./_store");
const defaut = require("../catalogue.json");
const { majPhotos } = require("./_catalogue");
const { fusionner: fusionnerSite, valider: validerSite } = require("./_site");

const CATS = ["cremes", "popcorn", "pain", "esquimau", "gros"];
const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const sansHash = (p) => { const { motDePasseHache, ...reste } = p; return reste; };

// Nettoie un catalogue envoyé par l'admin (jamais de confiance aveugle)
function validerCatalogue(liste) {
  if (!Array.isArray(liste) || liste.length === 0 || liste.length > 300) throw new Error("Catalogue invalide");
  const vus = new Set();
  return liste.map((p) => {
    const id = txt(p.id, 40);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Identifiant invalide : " + id);
    if (vus.has(id)) throw new Error("Identifiant en double : " + id);
    vus.add(id);
    const prix = Math.round(Number(p.prix));
    if (!(prix >= 0 && prix < 10000000)) throw new Error("Prix invalide pour " + id);
    const prixBarre = Math.round(Number(p.prixBarre)) || 0;
    const o = {
      id,
      cat: CATS.includes(p.cat) ? p.cat : "cremes",
      type: p.type === "pack" ? "pack" : "produit",
      nom: txt(p.nom, 90) || id,
      info: txt(p.info, 90),
      prix,
      img: txt(p.img, 300),
      actif: p.actif !== false
    };
    if (p.gr === "petit" || p.gr === "grand") o.gr = p.gr;
    if (prixBarre > prix) o.prixBarre = prixBarre;
    if (p.badge) o.badge = txt(p.badge, 14).toUpperCase();
    if (p.surCommande) o.surCommande = true;
    if (p.desc) o.desc = txt(p.desc, 160);
    if (o.type === "pack") {
      o.packCount = Math.max(1, Math.min(50, parseInt(p.packCount, 10) || 1));
      o.packLabel = txt(p.packLabel, 60);
    }
    return o;
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  try {
    const data = req.body || {};
    const { action } = data;

    if (!process.env.ADMIN_PASSWORD || !process.env.JETON_SECRET) {
      return res.status(500).json({ erreur: "Configuration manquante : ADMIN_PASSWORD et JETON_SECRET doivent être définis dans Vercel." });
    }

    // ── Connexion (le mot de passe n'est plus jamais dans le code) ──
    if (action === "login") {
      if (!(await S.limiter("alogin:" + ipClient(req), 8, 600))) {
        return res.status(429).json({ erreur: "Trop de tentatives. Réessayez dans 10 minutes." });
      }
      if (!motDePasseAdminValide(data.motDePasse)) return res.status(401).json({ erreur: "Mot de passe incorrect" });
      const jeton = signerJeton({ role: "admin", creeLe: Date.now() }, process.env.JETON_SECRET);
      return res.status(200).json({ jeton });
    }

    if (!adminValide(data.jeton)) return res.status(401).json({ erreur: "Session expirée, reconnectez-vous", session: false });

    switch (action) {
      case "tout_voir": {
        const [partenaires, commandes] = await Promise.all([S.getPartenaires(), S.getCommandes()]);
        return res.status(200).json({
          partenaires: partenaires.map(sansHash).sort((a, b) => String(a.nom).localeCompare(String(b.nom))),
          commandes: commandes.sort((a, b) => new Date(b.date) - new Date(a.date))
        });
      }

      // ───────── Partenaires ─────────
      case "creer_partenaire": {
        const nom = txt(data.nom, 80), telephone = txt(data.telephone, 30);
        const code = txt(data.code, 30).toUpperCase().replace(/\s+/g, "");
        if (!nom || !telephone || !code) return res.status(400).json({ erreur: "Nom, téléphone et code sont requis" });
        if ((await S.getPartenaires()).some((p) => (p.code || "").toUpperCase() === code)) {
          return res.status(400).json({ erreur: "Ce code promo existe déjà" });
        }
        const perso = txt(data.motDePasse, 60);
        if (perso && perso.length < 4) return res.status(400).json({ erreur: "Mot de passe : 4 caractères minimum" });
        const mdp = perso || genererMotDePasseTemporaire();
        const p = {
          id: "PART-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
          nom, telephone,
          type: txt(data.type, 20) || "particulier",
          code,
          remiseType: data.remiseType === "fixe" ? "fixe" : "pourcentage",
          remiseValeur: Math.max(0, Number(data.remiseValeur) || 0),
          commissionType: data.commissionType === "fixe" ? "fixe" : "pourcentage",
          commissionValeur: Math.max(0, Number(data.commissionValeur) || 0),
          joursActifs: Array.isArray(data.joursActifs) ? data.joursActifs.map(Number).filter((j) => j >= 0 && j <= 6) : [],
          actif: true,
          motDePasseHache: hacherMotDePasse(mdp)
        };
        await S.setPartenaire(p);
        return res.status(200).json({ succes: true, partenaire: sansHash(p), motDePasseTemporaire: perso ? null : mdp });
      }

      case "modifier_partenaire": {
        const p = await S.getPartenaire(data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });
        if (data.code) {
          const code = txt(data.code, 30).toUpperCase().replace(/\s+/g, "");
          if ((await S.getPartenaires()).some((a) => a.id !== p.id && (a.code || "").toUpperCase() === code)) {
            return res.status(400).json({ erreur: "Ce code promo est déjà utilisé par un autre partenaire" });
          }
          p.code = code;
        }
        if (data.nom) p.nom = txt(data.nom, 80);
        if (data.telephone != null && data.telephone !== "") p.telephone = txt(data.telephone, 30);
        if (data.type) p.type = txt(data.type, 20);
        if (data.remiseType) p.remiseType = data.remiseType === "fixe" ? "fixe" : "pourcentage";
        if (data.remiseValeur !== undefined && data.remiseValeur !== "") p.remiseValeur = Math.max(0, Number(data.remiseValeur) || 0);
        if (data.commissionType) p.commissionType = data.commissionType === "fixe" ? "fixe" : "pourcentage";
        if (data.commissionValeur !== undefined && data.commissionValeur !== "") p.commissionValeur = Math.max(0, Number(data.commissionValeur) || 0);
        if (Array.isArray(data.joursActifs)) p.joursActifs = data.joursActifs.map(Number).filter((j) => j >= 0 && j <= 6);
        if (data.nouveauMotDePasse) {
          const m = txt(data.nouveauMotDePasse, 60);
          if (m.length < 4) return res.status(400).json({ erreur: "Mot de passe : 4 caractères minimum" });
          p.motDePasseHache = hacherMotDePasse(m);
        }
        await S.setPartenaire(p);
        return res.status(200).json({ succes: true, partenaire: sansHash(p) });
      }

      case "supprimer_partenaire": {
        if (!(await S.getPartenaire(data.partenaireId))) return res.status(404).json({ erreur: "Partenaire introuvable" });
        await S.deletePartenaire(data.partenaireId);
        return res.status(200).json({ succes: true });
      }

      case "creer_codes_automatiques": {
        // Mêmes codes qu'avant : MARDI, SAMEDI, FB, TT (remise fixe de 100 FCFA, valables mardi et samedi)
        const defs = [{ code: "MARDI", jours: [2] }, { code: "SAMEDI", jours: [6] }, { code: "FB", jours: [2, 6] }, { code: "TT", jours: [2, 6] }];
        const existants = await S.getPartenaires();
        const resultats = [];
        for (const d of defs) {
          if (existants.some((p) => (p.code || "").toUpperCase() === d.code)) { resultats.push({ code: d.code, statut: "existait déjà" }); continue; }
          await S.setPartenaire({
            id: "PART-" + Date.now() + "-" + d.code, nom: "Code " + d.code, telephone: "", type: "particulier",
            code: d.code, remiseType: "fixe", remiseValeur: 100, commissionType: "fixe", commissionValeur: 0,
            joursActifs: d.jours, actif: true, auto: true, motDePasseHache: hacherMotDePasse(genererMotDePasseTemporaire())
          });
          resultats.push({ code: d.code, statut: "créé" });
        }
        return res.status(200).json({ succes: true, resultats });
      }

      case "basculer_actif":
      case "archiver_partenaire":
      case "desarchiver_partenaire":
      case "reinitialiser_mot_de_passe": {
        const p = await S.getPartenaire(data.partenaireId);
        if (!p) return res.status(404).json({ erreur: "Partenaire introuvable" });
        let mdp = null;
        if (action === "basculer_actif") p.actif = !p.actif;
        else if (action === "reinitialiser_mot_de_passe") { mdp = genererMotDePasseTemporaire(); p.motDePasseHache = hacherMotDePasse(mdp); }
        else p.archive = action === "archiver_partenaire";
        await S.setPartenaire(p);
        return res.status(200).json({ succes: true, motDePasseTemporaire: mdp });
      }

      case "payer_tout_le_solde": {
        const commandes = (await S.getCommandes()).filter((c) => c.partenaireId === data.partenaireId && c.statutLivraison === "livree" && c.statutCommission === "impaye");
        for (const c of commandes) { c.statutCommission = "paye"; await S.setCommande(c); }
        const p = await S.getPartenaire(data.partenaireId);
        if (p) { p.reclamationEnCours = false; await S.setPartenaire(p); } // la réclamation est soldée
        return res.status(200).json({ succes: true, nombre: commandes.length });
      }

      // ───────── Commandes ─────────
      case "valider_livraison":
      case "annuler_commande":
      case "remettre_en_attente":
      case "marquer_commission_payee":
      case "archiver_commande":
      case "desarchiver_commande": {
        const c = await S.getCommande(data.commandeId);
        if (!c) return res.status(404).json({ erreur: "Commande introuvable" });
        if (action === "valider_livraison") c.statutLivraison = "livree";
        else if (action === "annuler_commande") c.statutLivraison = "annulee";
        else if (action === "remettre_en_attente") c.statutLivraison = "en_attente";
        else if (action === "marquer_commission_payee") c.statutCommission = "paye";
        else c.archive = action === "archiver_commande";
        await S.setCommande(c);
        return res.status(200).json({ succes: true });
      }

      case "supprimer_commande": {
        if (!(await S.getCommande(data.commandeId))) return res.status(404).json({ erreur: "Commande introuvable" });
        await S.deleteCommande(data.commandeId);
        return res.status(200).json({ succes: true });
      }

      // ───────── Catalogue (produits, packs, photos, prix, promos) ─────────
      case "catalogue_get": {
        const perso = await S.getCatalogue();
        const modifie = Array.isArray(perso) && perso.length > 0;
        return res.status(200).json({ produits: modifie ? majPhotos(perso) : defaut.produits, personnalise: modifie });
      }
      // ───────── Site : textes, paiement et galerie de la page d'accueil ─────────
      case "site_get": {
        return res.status(200).json(fusionnerSite(await S.getReglages()));
      }
      case "site_save": {
        const v = validerSite(data);
        await S.setReglages(v);
        return res.status(200).json({ succes: true, ...fusionnerSite(v) });
      }
      case "site_reset": {
        await S.setReglages(null);
        return res.status(200).json({ succes: true, ...fusionnerSite(null) });
      }
      case "catalogue_save": {
        let liste;
        try { liste = validerCatalogue(data.produits); } catch (e) { return res.status(400).json({ erreur: e.message }); }
        await S.setCatalogue(liste);
        return res.status(200).json({ succes: true, nombre: liste.length });
      }
      case "catalogue_reset": {
        await S.setCatalogue(null);
        return res.status(200).json({ succes: true, produits: defaut.produits });
      }

      default:
        return res.status(400).json({ erreur: "Action non reconnue" });
    }
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") {
      return res.status(503).json({ erreur: "La base de données n'est pas connectée. Dans Vercel : Storage → Upstash Redis → Connect.", code: "DB" });
    }
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
