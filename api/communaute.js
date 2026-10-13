// Communauté : avis clients (modérés), suivi de commande, demandes de revendeurs, actualités, pages légales.
// Un seul point d'entrée pour rester dans la limite de fonctions de l'hébergeur.
const crypto = require("crypto");
const S = require("./_store");
const { adminValide, ipClient } = require("./_auth");

const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const bloc = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/\r/g, "").trim().slice(0, max);
const nouvelId = (p) => p + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const parDate = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));

const LEGAL_DEFAUT = {
  entreprise: "Noogó — glaces naturelles, popcorn et gourmandises. Karpala, Ouagadougou (Burkina Faso).",
  ifu: "", rccm: "",
  confidentialite: "Quand vous commandez, nous enregistrons votre nom, votre quartier ou adresse de livraison et, si vous le donnez, votre numéro de téléphone. Ces informations servent uniquement à préparer, livrer et suivre votre commande, et à vous recontacter à ce sujet. Nous ne les vendons pas et ne les transmettons à aucun tiers, hormis le livreur lorsque c'est nécessaire. Pour consulter, corriger ou faire effacer vos données, écrivez-nous sur WhatsApp.",
  reclamations: "Un problème avec votre commande (retard, produit abîmé, erreur) ? Écrivez-nous sur WhatsApp le jour même, avec une photo si possible. Nous répondons rapidement et cherchons une solution : remplacement du produit ou remboursement selon le cas.",
  remboursement: "Les glaces sont des produits frais qui doivent rester congelés : une fois livrées et acceptées, elles ne sont ni reprises ni échangées. En cas de produit non conforme ou abîmé à la livraison, signalez-le immédiatement : nous remplaçons ou remboursons l'article concerné. Une commande annulée avant sa préparation n'est pas facturée."
};
const legalPropre = (d) => {
  d = d || {};
  const o = {};
  for (const [k, m] of [["entreprise", 300], ["ifu", 40], ["rccm", 40], ["confidentialite", 2000], ["reclamations", 1500], ["remboursement", 1500]]) {
    o[k] = typeof d[k] === "string" ? bloc(d[k], m) : LEGAL_DEFAUT[k];
  }
  return o;
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    const action = String(d.action || "");
    const ip = ipClient(req);

    // ───────── Public ─────────
    if (action === "stat") {
      const EV = ["visite", "carte_vue", "ajout_panier", "panier_ouvert", "commande_envoyee"];
      const ev = String(d.evt || "");
      if (EV.includes(ev) && (await S.limiter("stat:" + ip, 60, 3600))) {
        try { await S.hincr("noogo:stats", new Date().toISOString().slice(0, 10) + "|" + ev, 1); } catch (e) {}
      }
      return res.status(200).json({ ok: true });
    }
    if (action === "avis_lire") {
      const tous = Object.values(await S.hgetall("noogo:avis")).filter((a) => a.statut === "publie").sort(parDate);
      const n = tous.length, moyenne = n ? Math.round((tous.reduce((s, a) => s + a.note, 0) / n) * 10) / 10 : 0;
      return res.status(200).json({ moyenne, nombre: n, avis: tous.slice(0, 30).map((a) => ({ nom: a.nom, quartier: a.quartier, note: a.note, texte: a.texte, date: a.date })) });
    }
    if (action === "avis_envoyer") {
      if (d.site) return res.status(200).json({ succes: true }); // piège anti-robots
      if (!(await S.limiter("avis:" + ip, 3, 3600))) return res.status(429).json({ erreur: "Trop d'avis envoyés depuis cet appareil. Réessayez plus tard." });
      const note = Math.round(Number(d.note)), texte = txt(d.texte, 400), nom = txt(d.nom, 40);
      if (!(note >= 1 && note <= 5)) return res.status(400).json({ erreur: "Choisissez une note de 1 à 5." });
      if (texte.length < 5) return res.status(400).json({ erreur: "Écrivez au moins quelques mots." });
      if (!nom) return res.status(400).json({ erreur: "Indiquez votre prénom." });
      const a = { id: nouvelId("AV"), date: new Date().toISOString(), nom, quartier: txt(d.quartier, 40), note, texte, statut: "attente" };
      await S.hset("noogo:avis", a.id, a);
      return res.status(200).json({ succes: true });
    }
    if (action === "actus_lire") {
      const l = (await S.getDoc("actus")) || [];
      return res.status(200).json({ actus: l.filter((x) => x.visible !== false).sort(parDate).slice(0, 6) });
    }
    if (action === "legal_lire") return res.status(200).json(legalPropre(await S.getDoc("legal")));
    if (action === "revendeur_envoyer") {
      if (d.site) return res.status(200).json({ succes: true });
      if (!(await S.limiter("rev:" + ip, 3, 3600))) return res.status(429).json({ erreur: "Trop de demandes depuis cet appareil. Écrivez-nous sur WhatsApp." });
      const nom = txt(d.nom, 80), tel = txt(d.tel, 30);
      if (!nom) return res.status(400).json({ erreur: "Indiquez votre nom." });
      if (tel.replace(/\D/g, "").length < 8) return res.status(400).json({ erreur: "Indiquez un numéro de téléphone valide pour que nous puissions vous rappeler." });
      const r = { id: nouvelId("RV"), date: new Date().toISOString(), nom, tel, quartier: txt(d.quartier, 60), activite: txt(d.activite, 80), message: txt(d.message, 400), statut: "nouveau" };
      await S.hset("noogo:demandes", r.id, r);
      return res.status(200).json({ succes: true });
    }
    if (action === "commande_suivre") {
      if (!(await S.limiter("suivre:" + ip, 40, 3600))) return res.status(429).json({ erreur: "Trop de recherches. Réessayez plus tard." });
      const id = txt(d.id, 40).toUpperCase();
      if (!/^CMD-\d{10,15}-[A-Z0-9]{3}$/.test(id)) return res.status(400).json({ erreur: "Code invalide. Il ressemble à CMD-1234567890123-ABC." });
      const c = await S.getCommande(id);
      if (!c) return res.status(404).json({ erreur: "Commande introuvable. Vérifiez le code." });
      const etape = c.statutLivraison === "livree" ? "livree" : c.statutLivraison === "annulee" ? "annulee" : (c.etape || "recue");
      return res.status(200).json({
        id: c.id, date: c.date, etape, retrait: c.modeReception === "retrait",
        articles: (c.articles || []).map((a) => ({ nom: a.nom, qte: a.qte })),
        total: c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal
      });
    }

    // ───────── Admin ─────────
    if (!adminValide(d.jeton)) return res.status(401).json({ erreur: "Session expirée, reconnectez-vous", session: false });

    switch (action) {
      case "tout": {
        const [avis, demandes, actus, legal] = await Promise.all([S.hgetall("noogo:avis"), S.hgetall("noogo:demandes"), S.getDoc("actus"), S.getDoc("legal")]);
        const brut = await S.hgetall("noogo:stats");
        const stats = {};
        for (const [k, v] of Object.entries(brut)) { const [j, e] = k.split("|"); if (!stats[j]) stats[j] = {}; stats[j][e] = Number(v) || 0; }
        return res.status(200).json({ stats, avis: Object.values(avis).sort(parDate), demandes: Object.values(demandes).sort(parDate), actus: (actus || []).sort(parDate), legal: legalPropre(legal) });
      }
      case "avis_statut": {
        const a = await S.hget("noogo:avis", txt(d.id, 60));
        if (!a) return res.status(404).json({ erreur: "Avis introuvable" });
        if (!["publie", "masque", "attente"].includes(d.statut)) return res.status(400).json({ erreur: "Statut invalide" });
        a.statut = d.statut; await S.hset("noogo:avis", a.id, a);
        return res.status(200).json({ succes: true });
      }
      case "avis_suppr": await S.hdel("noogo:avis", txt(d.id, 60)); return res.status(200).json({ succes: true });
      case "demande_statut": {
        const r = await S.hget("noogo:demandes", txt(d.id, 60));
        if (!r) return res.status(404).json({ erreur: "Demande introuvable" });
        r.statut = d.statut === "traite" ? "traite" : "nouveau"; await S.hset("noogo:demandes", r.id, r);
        return res.status(200).json({ succes: true });
      }
      case "demande_suppr": await S.hdel("noogo:demandes", txt(d.id, 60)); return res.status(200).json({ succes: true });
      case "actu_sauver": {
        const titre = txt(d.titre, 100), texte = bloc(d.texte, 600);
        if (!titre) return res.status(400).json({ erreur: "Donnez un titre à l'actualité." });
        const l = (await S.getDoc("actus")) || [];
        const dt = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")) ? d.date : new Date().toISOString().slice(0, 10);
        const id = /^ac-[a-z0-9]+$/.test(String(d.id || "")) ? d.id : nouvelId("AC").toLowerCase();
        const o = { id, titre, texte, date: dt, visible: d.visible !== false };
        const i = l.findIndex((x) => x.id === id);
        if (i >= 0) l[i] = o; else l.push(o);
        await S.setDoc("actus", l.slice(-100));
        return res.status(200).json({ succes: true, id });
      }
      case "actu_suppr": {
        const l = (await S.getDoc("actus")) || [];
        await S.setDoc("actus", l.filter((x) => x.id !== d.id));
        return res.status(200).json({ succes: true });
      }
      case "legal_sauver": {
        const v = legalPropre(d.legal);
        await S.setDoc("legal", v);
        return res.status(200).json({ succes: true, legal: v });
      }
      default: return res.status(400).json({ erreur: "Action inconnue" });
    }
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Enregistrement indisponible" });
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
