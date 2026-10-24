// Caisse Noogó : application des caissiers et livreurs (un code par personne).
// Ils peuvent AJOUTER des ventes et des demandes de dépense, jamais rien supprimer ni modifier.
const crypto = require("crypto");
const { signerJeton, verifierJeton } = require("./_auth");
const S = require("./_store");
const U = require("./_suivi");
const { chargerCatalogue } = require("./_catalogue");

const NUMERO_RESPONSABLE = "22665120902";
const DUREE_MS = 30 * 24 * 3600 * 1000;
const MODES = { especes: "Espèces", orange: "Orange Money", wave: "Wave", resp: "Payé au responsable" };

const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const entier = (n, min, max, nom) => { const v = Math.round(Number(n)); if (!Number.isFinite(v) || v < min || v > max) throw new Error(nom + " invalide"); return v; };

async function equipe() { const l = await S.getDoc("equipe"); return Array.isArray(l) ? l : []; }
const sansCode = (m) => ({ id: m.id, nom: m.nom, point: m.point, poste: m.poste === "livreur" ? "livreur" : "caissier" });
const estLivreur = (m) => m && m.poste === "livreur";

function membre(jeton, liste) {
  const secret = process.env.JETON_SECRET;
  if (!secret) return null;
  const s = verifierJeton(jeton, secret, DUREE_MS);
  if (!s || s.role !== "caisse") return null;
  const m = liste.find((x) => x.id === s.uid && x.actif !== false);
  return m || null;
}

// Tout ce que la caisse peut vendre, avec le prix du serveur
async function articles() {
  const [catalogue, config] = await Promise.all([chargerCatalogue(), S.getSuiviConfig()]);
  const cfg = config || {};
  const liste = [];
  for (const p of catalogue) {
    if (!p || p.actif === false) continue;
    const pack = p.type === "pack";
    const base = pack ? U.baseDe(p) : null;
    liste.push({
      id: p.id, nom: p.nom, prix: Number(p.prix) || 0, type: pack ? "pack" : "produit", cat: p.cat || "", gr: p.gr || "",
      pots: pack ? Math.max(1, parseInt(p.packCount, 10) || 1) : 1,
      choix: pack && !p.packCompo && !(base && base.id !== p.id),            // pack dont le client choisit les saveurs
      fixe: pack && p.packCompo ? p.packCompo : null,        // pack à contenu fixe (ex : 3 vanille + 3 banane)
      base: pack && base && base.id !== p.id ? base.id : null,
      statut: p.statut || (p.dispo === "rupture" ? "rupture" : "aujourdhui")
    });
  }
  for (const p of cfg.internes || []) liste.push({ id: p.id, nom: p.nom, prix: Number(p.prix) || 0, type: "produit", cat: "autres", gr: "", pots: 1, choix: false, base: null, statut: "aujourdhui" });
  return liste;
}

function repartir(total, parts) {   // répartit un montant entier en parts proportionnelles, le reste va à la dernière
  const somme = parts.reduce((a, b) => a + b, 0) || 1;
  let reste = total; const out = [];
  parts.forEach((q, i) => { const v = i === parts.length - 1 ? reste : Math.round((total * q) / somme); out.push(v); reste -= v; });
  return out;
}

// Ce que le livreur a besoin de voir d'une commande (jamais plus)
function resumeLivraison(c) {
  const total = c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal;
  return {
    id: c.id, date: c.date, heure: c.dateLivraison || c.date, nomClient: c.nomClient, telClient: c.telClient || "", localisation: c.localisation || "",
    retrait: c.modeReception === "retrait", paiementPrevu: MODES[c.modePaiement] || "Espèces", total: Number(total) || 0, etape: c.etape || "recue", note: c.note || "",
    livraison: c.livraison || "", enRouteAvec: c.livreur || "", livreurId: c.livreurId || "",
    articles: (c.articles || []).map((a) => ({ nom: a.nom, qte: a.qte, detail: Array.isArray(a.compo) && a.compo.length ? a.compo.map((x) => x.qte + " × " + (x.nom || x.id)).join(", ") : "" })),
    paiement: c.encaisse ? c.encaisse.mode : ""
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    const ip = String((req.headers && (req.headers["x-forwarded-for"] || "")) || (req.socket && req.socket.remoteAddress) || "x").split(",")[0].trim();

    // Porte secrète du site : le mot tapé dans « Suivre ma commande » ouvre la caisse
    if (d.action === "porte") {
      if (!(await S.limiter("cporte:" + ip, 20, 600))) return res.status(429).json({ erreur: "Trop d'essais" });
      const mot = ((await S.getDoc("caisse-mot")) || "bingo");
      return res.status(200).json({ ok: txt(d.mot, 40).toLowerCase() === mot });
    }

    if (d.action === "connexion") {
      if (!(await S.limiter("clogin:" + ip, 12, 600))) return res.status(429).json({ erreur: "Trop d'essais. Réessayez dans 10 minutes." });
      const code = txt(d.code, 20).toLowerCase();
      const lienP = /^[0-9a-f]{18}$/.test(String(d.lien || "")) ? String(d.lien) : "";
      const liste = await equipe();
      const m = lienP ? liste.find((x) => x.actif !== false && x.lien && x.lien === lienP) : liste.find((x) => x.actif !== false && x.code && String(x.code).toLowerCase() === code);
      if (!m) return res.status(401).json({ erreur: lienP ? "Ce lien n'est plus valable : demandez-en un nouveau au responsable." : "Code incorrect" });
      const jeton = signerJeton({ role: "caisse", uid: m.id, creeLe: Date.now() }, process.env.JETON_SECRET);
      return res.status(200).json({ jeton, membre: sansCode(m), numero: NUMERO_RESPONSABLE });
    }

    const liste = await equipe();
    const m = membre(d.jeton, liste);
    if (!m) return res.status(401).json({ erreur: "Session terminée : entrez votre code", session: false });

    switch (d.action) {
      case "catalogue": return res.status(200).json({ articles: await articles(), membre: sansCode(m), numero: NUMERO_RESPONSABLE });

      case "vendre": {
        const idRecu = txt(d.id, 40);
        if (!/^R[0-9A-Za-z-]{6,36}$/.test(idRecu)) throw new Error("Reçu invalide");
        const deja = (await S.suiviListe("recus")).find((r) => r && r.id === idRecu);
        if (deja) return res.status(200).json({ recu: deja, deja: true });   // envoi répété (hors ligne) : on ne compte pas deux fois
        const mode = MODES[d.paiement] ? d.paiement : "especes";
        const num = txt(d.numPaiement, 20);
        if (mode !== "especes" && mode !== "resp" && num.replace(/\D/g, "").length < 8) throw new Error("Numéro Mobile Money invalide");
        const art = await articles();
        const parId = {}; art.forEach((a) => (parId[a.id] = a));
        const lignes = (Array.isArray(d.lignes) ? d.lignes : []).slice(0, 40);
        if (!lignes.length) throw new Error("Ticket vide invalide");
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")) && Math.abs(Date.parse(d.date) - Date.now()) < 3 * 86400000 ? d.date : aujourdhui();
        const ventes = [], recuLignes = [];
        let total = 0, k = 0, remiseTot = 0, suppTot = 0;
        for (const l of lignes) {
          const a = parId[String(l.id)];
          if (!a) throw new Error("Article invalide : " + txt(l.id, 30));
          const qte = entier(l.qte, 1, 200, "Quantité");
          const montant = a.prix * qte; total += montant;
          const pointVente = m.point || "Local";
          const base = { date, pointVente, vendeur: m.nom, vid: m.id, paiement: MODES[mode], recuId: idRecu };
          if (a.type === "pack") {
            const pots = a.pots * qte;
            if (a.base) {
              // pots au prix normal > prix du pack : la différence est une remise, notée toute seule en dépense
              const plein = (parId[a.base] ? parId[a.base].prix : 0) * pots, remise = plein > montant ? plein - montant : 0;
              remiseTot += remise;
              const supp = plein > 0 && montant > plein ? montant - plein : 0;   // pack plus cher que les pots : surplus (livraison incluse) hors caisse
              suppTot += supp;
              ventes.push({ ...base, produitId: a.base, qte: pots, montant: remise ? plein : supp ? plein : montant, supp });
              recuLignes.push({ nom: a.nom, qte, total: montant, detail: pots + " pots" });
            } else {
              const compo = a.fixe ? Object.fromEntries(Object.keys(a.fixe).map((k) => [k, a.fixe[k] * qte])) : (l.compo && typeof l.compo === "object" ? l.compo : {});
              const ids = Object.keys(compo).filter((i) => (parId[i] && parId[i].type === "produit" && Math.round(Number(compo[i])) > 0));
              const qtes = ids.map((i) => Math.round(Number(compo[i])));
              if (qtes.reduce((x, y) => x + y, 0) !== pots) throw new Error("Choisissez les " + pots + " saveurs du pack");
              const plein = ids.reduce((s, i, j) => s + parId[i].prix * qtes[j], 0);
              if (plein > montant) { remiseTot += plein - montant; ids.forEach((i, j) => ventes.push({ ...base, produitId: i, qte: qtes[j], montant: parId[i].prix * qtes[j] })); }
              else if (plein > 0 && montant > plein) { suppTot += montant - plein; ids.forEach((i, j) => ventes.push({ ...base, produitId: i, qte: qtes[j], montant: parId[i].prix * qtes[j], supp: j === 0 ? montant - plein : 0 })); }
              else { const parts = repartir(montant, qtes); ids.forEach((i, j) => ventes.push({ ...base, produitId: i, qte: qtes[j], montant: parts[j] })); }
              recuLignes.push({ nom: a.nom, qte, total: montant, detail: ids.map((i, j) => qtes[j] + " × " + parId[i].nom.replace(/^Crème glacée /, "")).join(", ") });
            }
          } else {
            ventes.push({ ...base, produitId: a.id, qte, montant });
            recuLignes.push({ nom: a.nom, qte, total: montant, detail: "" });
          }
        }
        const recu = { id: idRecu, date, heure: new Date().toISOString(), vendeur: m.nom, vid: m.id, point: m.point || "Local", lignes: recuLignes, total, paiement: MODES[mode], numPaiement: mode === "especes" || mode === "resp" ? "" : num, verifie: mode === "resp" ? false : undefined, note: txt(d.note, 150), livraison: suppTot || undefined };
        // les lignes d'abord, le reçu à la fin : un reçu présent veut dire « tout est enregistré »
        for (const v of ventes) { v.id = idRecu + "-" + (++k); await S.suiviSet("ventes", v.id, v); }
        if (remiseTot > 0) await S.suiviSet("depenses", idRecu + "-rem", { id: idRecu + "-rem", date, categorie: "Remise sur packs", description: "Remise sur packs · reçu " + idRecu, montant: remiseTot, mode: "", vid: m.id, vendeur: m.nom, recuId: idRecu, auto: true, cree: new Date().toISOString() });
        await S.suiviSet("recus", idRecu, recu);
        return res.status(200).json({ recu });
      }

      case "mes_ventes": {
        const jr = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")) ? d.date : aujourdhui();
        const recus = (await S.suiviListe("recus")).filter((r) => r && !r.archive && r.vid === m.id && r.date === jr).sort((a, b) => (a.heure < b.heure ? 1 : -1));
        const livraisons = estLivreur(m) ? (await S.getCommandes()).filter((c) => c && c.livreurId === m.id && c.statutLivraison === "livree" && String(c.dateLivraison || "").slice(0, 10) === jr).map(resumeLivraison).sort((a, b) => (a.heure < b.heure ? 1 : -1)) : [];
        const total = recus.reduce((s, r) => s + r.total, 0) + livraisons.reduce((s, l) => s + l.total, 0);
        return res.status(200).json({ date: jr, recus, livraisons, total });
      }

      // ───── Poste « livreur » : commandes du site à livrer ─────
      case "a_livrer": {
        if (!estLivreur(m)) return res.status(403).json({ erreur: "Réservé aux livreurs" });
        const l = (await S.getCommandes()).filter((c) => c && c.statutLivraison === "en_attente" && !c.archive).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 80).map(resumeLivraison);
        return res.status(200).json({ commandes: l });
      }
      case "en_route": {
        if (!estLivreur(m)) return res.status(403).json({ erreur: "Réservé aux livreurs" });
        const c = await S.getCommande(txt(d.id, 60));
        if (!c || c.statutLivraison !== "en_attente") throw new Error("Commande invalide : déjà livrée ou annulée");
        c.etape = "en_route"; c.livreur = m.nom; c.livreurId = m.id;
        await S.setCommande(c);
        return res.status(200).json({ commande: resumeLivraison(c) });
      }
      case "livrer": {
        if (!estLivreur(m)) return res.status(403).json({ erreur: "Réservé aux livreurs" });
        const c = await S.getCommande(txt(d.id, 60));
        if (!c) throw new Error("Commande invalide");
        if (c.statutLivraison === "livree") return res.status(200).json({ commande: resumeLivraison(c), deja: true });
        if (c.statutLivraison !== "en_attente") throw new Error("Commande invalide : annulée");
        const resp = d.paiement === "resp";   // le client a payé sur le numéro du responsable : à confirmer par lui
        const mode = resp ? "especes" : MODES[d.paiement] ? d.paiement : "especes";
        const num = resp ? "" : txt(d.numPaiement, 20);
        if (!resp && mode !== "especes" && num.replace(/\D/g, "").length < 8) throw new Error("Numéro Mobile Money invalide");
        const montant = c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal;
        const maintenant = new Date().toISOString();
        c.statutLivraison = "livree"; c.dateLivraison = maintenant; c.etape = "livree";
        c.livreur = m.nom; c.livreurId = m.id;
        c.encaisse = { mode: resp ? "Payé au responsable" : MODES[mode], verifie: resp ? false : undefined, numPaiement: mode === "especes" ? "" : num, montant, le: maintenant, par: m.nom, parId: m.id, note: txt(d.note, 150) };
        await S.setCommande(c);
        return res.status(200).json({ commande: resumeLivraison(c) });
      }

      case "demander_depense": {
        const montant = entier(d.montant, 1, 100000000, "Montant");
        const motif = txt(d.motif, 150);
        if (motif.length < 3) throw new Error("Motif invalide : expliquez la dépense");
        const idD = "D" + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
        const dem = { id: idD, date: aujourdhui(), heure: new Date().toISOString(), vid: m.id, vendeur: m.nom, montant, motif, statut: "attente" };
        await S.suiviSet("demandes", idD, dem);
        return res.status(200).json({ demande: dem, numero: NUMERO_RESPONSABLE });
      }

      case "mes_demandes": {
        const l = (await S.suiviListe("demandes")).filter((x) => x && x.vid === m.id).sort((a, b) => (a.heure < b.heure ? 1 : -1)).slice(0, 30);
        return res.status(200).json({ demandes: l });
      }
      default: return res.status(400).json({ erreur: "Action non reconnue" });
    }
  } catch (e) {
    if (e && e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Base de données non connectée" });
    if (e && /invalide|Choisissez|Ticket/.test(e.message || "")) return res.status(400).json({ erreur: e.message });
    console.error("caisse", e && e.message);
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
