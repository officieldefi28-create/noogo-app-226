// Suivi de gestion (admin uniquement) : lots, ventes, pertes, dépenses, comptage du soir, bilan.
const crypto = require("crypto");
const { adminValide } = require("./_auth");
const S = require("./_store");
const U = require("./_suivi");
const { chargerCatalogue } = require("./_catalogue");

const txt = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const date = (s) => { const d = String(s || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) throw new Error("Date invalide"); return d; };
const entier = (n, min, max, nom) => { const v = Math.round(Number(n)); if (!Number.isFinite(v) || v < min || v > max) throw new Error(nom + " invalide"); return v; };
const idPropre = (s) => { const v = txt(s, 60); if (!/^[A-Za-z0-9_-]+$/.test(v)) throw new Error("Produit invalide"); return v; };
const nouvelId = (p) => p + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

async function charger() {
  const [catalogue, config, lots, ventes, pertes, depenses, comptages, commandes, equipe, recus, demandes, journal, clotures] = await Promise.all([
    chargerCatalogue(), S.getSuiviConfig(), S.suiviListe("lots"), S.suiviListe("ventes"), S.suiviListe("pertes"),
    S.suiviListe("depenses"), S.suiviListe("comptages"), S.getCommandes(),
    lireEquipe(), S.suiviListe("recus"), S.suiviListe("demandes"), S.getDoc("journal"), S.getDoc("clotures")
  ]);
  const motCaisse = (await S.getDoc("caisse-mot")) || "bingo";
  const cfg = configPropre(config);
  const actifs = (l) => (l || []).filter((x) => x && !x.archive), archives = (l) => (l || []).filter((x) => x && x.archive);
  const archivesDonnees = { recus: archives(recus), depenses: archives(depenses) };
  // « Nouveau départ » : les commandes du site livrées avant ce moment ne comptent plus dans le suivi
  const cmds = cfg.debutHeure ? commandes.filter((c) => String(c.dateLivraison || c.date || "") >= cfg.debutHeure) : commandes;
  return { catalogue, config: cfg, lots, ventes: actifs(ventes), pertes, depenses: actifs(depenses), comptages, commandes: cmds, equipe, recus: actifs(recus), archives: archivesDonnees, demandes, motCaisse, journal: Array.isArray(journal) ? journal : [], clotures: Array.isArray(clotures) ? clotures : [] };
}

function configPropre(c) {
  c = c || {};
  const couts = {};
  if (c.couts && typeof c.couts === "object") for (const k of Object.keys(c.couts).slice(0, 300)) { if (/^[A-Za-z0-9_-]+$/.test(k)) couts[k] = Math.max(0, Math.round(Number(c.couts[k]) || 0)); }
  const internes = (Array.isArray(c.internes) ? c.internes : []).slice(0, 60)
    .map((p) => ({ id: txt(p && p.id, 40), nom: txt(p && p.nom, 80), prix: Math.max(0, Math.round(Number(p && p.prix) || 0)) }))
    .filter((p) => /^[A-Za-z0-9_-]+$/.test(p.id) && p.nom);
  const pv = (Array.isArray(c.pointsVente) ? c.pointsVente : U.POINTS_VENTE_DEFAUT).map((x) => txt(x, 40)).filter(Boolean).slice(0, 40);
  return {
    caisseDepart: Math.round(Number(c.caisseDepart) || 0),
    objectifJour: Math.max(0, Math.min(100000000, Math.round(Number(c.objectifJour) || 0))),
    objectifMois: Math.max(0, Math.min(1000000000, Math.round(Number(c.objectifMois) || 0))),
    depuis: /^\d{4}-\d{2}-\d{2}$/.test(String(c.depuis || "")) ? c.depuis : "",
    pointsVente: pv, couts, internes,
    debutHeure: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(c.debutHeure || "")) ? c.debutHeure : ""
  };
}

// Un produit doit exister dans le catalogue ou dans « produits non vendus sur le site »
async function verifierProduits(ids) {
  const donnees = await charger();
  const connus = new Set(U.produitsSuivis(donnees.catalogue, donnees.config).map((p) => p.id));
  for (const id of ids) if (!connus.has(id)) throw new Error("Produit invalide : " + id);
}

function periode(d) {
  const du = d.du ? date(d.du) : "", au = d.au ? date(d.au) : "";
  return [du, au];
}

// Même durée, juste avant : sert aux comparaisons « par rapport à la période d'avant »
function precedente(donnees, du, au) {
  if (!du || !au) return null;
  const j = (x) => Date.parse(x + "T00:00:00Z");
  const jours = Math.round((j(au) - j(du)) / 86400000) + 1;
  const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
  const pAu = fmt(j(du) - 86400000), pDu = fmt(j(du) - jours * 86400000);
  const b = U.bilan(donnees, pDu, pAu);
  return { du: pDu, au: pAu, ca: b.ca, resultat: b.resultat, quantite: b.quantite, margeBrute: b.margeBrute };
}

// Équipe de la caisse : un code par personne (créés ici, jamais dans la caisse)
async function lireEquipe() { const l = await S.getDoc("equipe"); return Array.isArray(l) ? l : []; }
const POSTES = { caissier: "Caissier", livreur: "Livreur" };
async function equipeSauver(liste, config) {
  const pv = new Set((config.pointsVente || []));
  const vus = new Set(), codes = new Set();
  const anciens = {}; (await lireEquipe()).forEach((m) => (anciens[m.id] = m));
  const propre = [];
  for (const x of (Array.isArray(liste) ? liste : []).slice(0, 40)) {
    const nom = txt(x && x.nom, 40); if (!nom) continue;
    let id = /^[A-Za-z0-9_-]{3,40}$/.test(String(x.id || "")) ? String(x.id) : nouvelId("e");
    if (vus.has(id)) id = nouvelId("e"); vus.add(id);
    let code = txt(x.code, 20);
    if (code && !/^[A-Za-z0-9]{4,12}$/.test(code)) throw new Error("Code invalide pour " + nom + " : 4 à 12 lettres ou chiffres, sans espace");
    if (code && codes.has(code.toLowerCase())) throw new Error("Code invalide : « " + code + " » est déjà donné à quelqu'un d'autre");
    while (!code || codes.has(code.toLowerCase())) code = String(crypto.randomInt(100000, 999999));
    codes.add(code.toLowerCase());
    const point = txt(x.point, 40);
    const ancien = anciens[id];
    const lien = !x.nouveauLien && ancien && ancien.lien ? ancien.lien : crypto.randomBytes(9).toString("hex");   // lien personnel : jamais écrit par le navigateur
    propre.push({ id, nom, code, point: point || "Local", actif: x.actif !== false, poste: POSTES[x.poste] ? x.poste : "caissier", tel: String(x.tel || "").replace(/\D/g, "").slice(0, 15), lien });
  }
  await S.setDoc("equipe", propre);
  return propre;
}

// Prix actuels du catalogue (hors packs) + produits internes : sert à figer le prix au moment de la saisie
async function prixActuels() {
  const m = {};
  for (const p of await chargerCatalogue()) if (p && p.type !== "pack") m[p.id] = Math.round(Number(p.prix) || 0);
  const cfg = configPropre(await S.getSuiviConfig());
  for (const p of cfg.internes) m[p.id] = p.prix;
  return m;
}

// Journal des modifications (qui/quoi/quand) : jamais de code ni de mot secret dedans
async function noter(libelle, detail) {
  try {
    const j = (await S.getDoc("journal")) || [];
    j.push({ t: new Date().toISOString(), a: libelle, r: String(detail || "").slice(0, 200) });
    await S.setDoc("journal", j.slice(-400));
  } catch (e) { /* le journal ne doit jamais bloquer une saisie */ }
}
// Un paiement non espèces doit être confirmé par le responsable (règle en vigueur depuis le 24/10/2026 ; avant : considéré confirmé)
const aConfirmer = (mode, verifie, date) => !!mode && mode !== "Espèces" && verifie !== true && (verifie === false || String(date || "").slice(0, 10) >= "2026-10-24");
const fr = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
const jour = (x) => String(x || "").slice(0, 10);
const jjmm = (d) => String(d || "").slice(8, 10) + "/" + String(d || "").slice(5, 7);
function decrire(type, o, noms) {
  if (!o) return "";
  const nom = (id) => (noms && noms[id]) || id;
  if (type === "lots") return (o.nom || "Production") + " · " + (o.lignes || []).map((x) => x.qte + " " + nom(x.produitId)).join(", ") + " · " + jjmm(o.date);
  if (type === "ventes") return o.qte + " × " + nom(o.produitId) + " · " + jjmm(o.date) + (o.vendeur ? " · " + o.vendeur : "");
  if (type === "pertes") return o.qte + " × " + nom(o.produitId) + " (" + (U.TYPES_PERTE[o.type] || o.type) + ") · " + jjmm(o.date);
  if (type === "depenses") return (o.categorie || "Dépense") + " " + fr(o.montant) + " · " + jjmm(o.date);
  if (type === "comptages") return "Reste de " + nom(o.produitId) + " : " + o.restant + " · " + jjmm(o.date);
  return "";
}

// Contrôles automatiques de cohérence (comme un commissaire aux comptes) : signalent ce qui peut fausser les chiffres
function controles(donnees, calc) {
  const liste = [];
  const stock = Object.values(calc.stock);
  const neg = stock.filter((s) => s.theorique < 0);
  if (neg.length) liste.push({ niveau: "rouge", titre: "Stock négatif", texte: neg.map((s) => s.nom + " (" + s.theorique + ")").join(", ") + " : il manque une production ou une vente est en double." });
  const sansCout = stock.filter((s) => s.vendu > 0 && !(s.coutMoyen > 0));
  if (sansCout.length) liste.push({ niveau: "orange", titre: "Prix de revient manquant", texte: sansCout.map((s) => s.nom).join(", ") + " : sans coût de production, la marge affichée est fausse." });
  const sansPrix = calc.ventes.filter((v) => v.montant === 0 && v.qte > 0 && v.source !== "manuel");
  if (sansPrix.length) liste.push({ niveau: "orange", titre: "Ventes à 0 F", texte: sansPrix.length + " vente(s) comptées sans prix : vérifiez le prix du produit." });
  const surplus = (calc.ajustements || []).filter((a) => a.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  if (surplus.length) liste.push({ niveau: "orange", titre: "Surplus au comptage (7 jours)", texte: surplus.length + " fois vous aviez plus que prévu : production oubliée ou vente notée en double ?" });
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const cl = donnees.clotures || [];
  if (calc.ventes.some((v) => v.date === hier) && !cl.some((c) => c.date === hier)) liste.push({ niveau: "info", titre: "Journée d'hier non clôturée", texte: "Allez dans « Clôture » pour compter la caisse et vérifier qu'il ne manque rien." });
  const ecarts = cl.filter((c) => c.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) && c.ecart !== 0);
  if (ecarts.length) liste.push({ niveau: "orange", titre: "Écart de caisse (7 jours)", texte: ecarts.map((c) => jjmm(c.date) + " : " + (c.ecart > 0 ? "+" : "") + fr(c.ecart)).join(", ") + "." });
  const att = (donnees.demandes || []).filter((x) => x && x.statut === "attente").length;
  if (att) liste.push({ niveau: "orange", titre: "Demandes de dépense en attente", texte: att + " demande(s) à accepter ou refuser." });
  const tard = (donnees.commandes || []).filter((c) => c.statutLivraison === "livree" && c.date && c.dateLivraison && String(c.dateLivraison).slice(0, 10) > String(c.date).slice(0, 10)).length;
  if (tard) liste.push({ niveau: "info", titre: "Commandes validées le lendemain", texte: tard + " commande(s) du site validées un autre jour que la commande : leur vente est comptée à la date de validation." });
  return liste;
}

// Une dépense acceptée sur demande d'un vendeur garde le nom de ce vendeur (pour l'affichage par personne)
function decorerDepenses(liste, demandes) {
  const parId = {}; (demandes || []).forEach((x) => x && (parId[x.id] = x));
  return (liste || []).map((x) => {
    if (x.vid) return x;
    const m = /^Demande (\S+)/.exec(String(x.note || ""));
    const dem = m && parId[m[1]];
    return dem ? { ...x, vid: dem.vid, vendeur: dem.vendeur } : x;
  });
}

function vue(donnees, d) {
  const [du, au] = periode(d || {});
  const calc = U.calculer(donnees);
  return {
    config: donnees.config,
    produits: calc.suivis,
    stock: Object.values(calc.stock),
    bilan: U.bilan(donnees, du, au),
    precedent: precedente(donnees, du, au),
    ventes: calc.ventes.filter((x) => (!du || x.date >= du) && (!au || x.date <= au)).slice(0, 3000),
    pertes: calc.pertes.filter((x) => (!du || x.date >= du) && (!au || x.date <= au)).slice(0, 1500),
    ajustements: calc.ajustements.slice(-100),
    lots: calc.lots.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 600),
    depenses: decorerDepenses(calc.depenses, donnees.demandes).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 1500),
    archives: { recus: (donnees.archives.recus || []).sort((a, b) => ((a.heure || "") < (b.heure || "") ? 1 : -1)).slice(0, 400), depenses: decorerDepenses(donnees.archives.depenses, donnees.demandes).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 400) },
    postes: POSTES,
    livraisons: (donnees.commandes || []).filter((c) => c && c.statutLivraison === "livree" && c.livreurId).map((c) => ({ id: c.id, date: String(c.dateLivraison || c.date || "").slice(0, 10), heure: c.dateLivraison, livreurId: c.livreurId, livreur: c.livreur, client: c.nomClient, total: Number(c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal) || 0, mode: (c.encaisse && c.encaisse.mode) || "", aConfirmer: aConfirmer(c.encaisse && c.encaisse.mode, c.encaisse && c.encaisse.verifie, c.dateLivraison || c.date) })).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 500),
    comptages: donnees.comptages.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 1500),
    equipe: donnees.equipe, motCaisse: donnees.motCaisse, recus: (donnees.recus || []).sort((a, b) => ((a.heure || "") < (b.heure || "") ? 1 : -1)).slice(0, 800),
    demandes: (donnees.demandes || []).sort((a, b) => ((a.heure || "") < (b.heure || "") ? 1 : -1)).slice(0, 200),
    analyse: U.analyse(donnees, new Date().toISOString().slice(0, 10)),
    journee: U.journee(donnees, /^\d{4}-\d{2}-\d{2}$/.test(String((d || {}).jourCloture || "")) ? d.jourCloture : new Date().toISOString().slice(0, 10)),
    clotures: (donnees.clotures || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60),
    journal: (donnees.journal || []).slice(-200).reverse(),
    controles: controles(donnees, calc),
    categories: U.CATEGORIES_DEPENSE, typesPerte: U.TYPES_PERTE
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    if (!adminValide(d.jeton)) return res.status(401).json({ erreur: "Session expirée, reconnectez-vous", session: false });

    let trace = null;
    const noms = {};
    if (/^(ajouter_|comptage|supprimer$)/.test(String(d.action || ""))) { for (const p of await chargerCatalogue()) if (p) noms[p.id] = p.nom; for (const p of configPropre(await S.getSuiviConfig()).internes) noms[p.id] = p.nom; }
    switch (d.action) {
      case "lire": return res.status(200).json(vue(await charger(), d));

      case "stock_avant": {
        const donnees = await charger();
        const jr = date(d.date);
        const avant = U.stockAvant(donnees, jr);
        const calc = U.calculer(donnees);
        const deja = {};
        donnees.comptages.filter((c) => c.date === jr).forEach((c) => (deja[c.produitId] = c));
        return res.status(200).json({ date: jr, produits: calc.suivis.filter((p) => p.actif || avant[p.id] > 0), avant, deja });
      }

      case "ajouter_lot": {
        const lignes = (Array.isArray(d.lignes) ? d.lignes : []).slice(0, 20)
          .map((x) => ({ produitId: idPropre(x.produitId), qte: entier(x.qte, 0, 100000, "Quantité") })).filter((x) => x.qte > 0);
        if (!lignes.length) throw new Error("Ajoutez au moins un produit avec une quantité");
        await verifierProduits(lignes.map((x) => x.produitId));
        const lot = { id: d.id ? idPropre(d.id) : nouvelId("lot"), date: date(d.date), nom: txt(d.nom, 60) || "Lot", cout: entier(d.cout, 0, 100000000, "Coût"), lignes, note: txt(d.note, 200), cree: new Date().toISOString() };
        if (d.moment === "avant" || d.moment === "apres") lot.moment = d.moment;   // « déjà dans le reste compté » ou « pour demain »
        await S.suiviSet("lots", lot.id, lot);
        trace = ["Production ajoutée", decrire("lots", lot, noms)];
        break;
      }
      case "ajouter_vente": {
        await verifierProduits([idPropre(d.produitId)]);
        const v = { id: d.id ? idPropre(d.id) : nouvelId("v"), date: date(d.date), produitId: idPropre(d.produitId), qte: entier(d.qte, 1, 100000, "Quantité"), pointVente: txt(d.pointVente, 40), remise: entier(d.remise || 0, 0, 100000000, "Remise"), note: txt(d.note, 200) };
        if (d.prix !== undefined && d.prix !== "" && d.prix !== null) v.prix = entier(d.prix, 0, 10000000, "Prix");
        else { const pm = await prixActuels(); if (pm[v.produitId] != null) v.prix = pm[v.produitId]; }   // prix figé à la saisie
        v.cree = new Date().toISOString();
        await S.suiviSet("ventes", v.id, v);
        trace = ["Vente ajoutée", decrire("ventes", v, noms)];
        break;
      }
      case "ajouter_perte": {
        if (!U.TYPES_PERTE[d.type]) throw new Error("Type de perte invalide");
        await verifierProduits([idPropre(d.produitId)]);
        const p = { id: nouvelId("p"), date: date(d.date), produitId: idPropre(d.produitId), qte: entier(d.qte, 1, 100000, "Quantité"), type: d.type, note: txt(d.note, 200) };
        await S.suiviSet("pertes", p.id, p);
        trace = ["Perte notée", decrire("pertes", p, noms)];
        break;
      }
      case "ajouter_depense": {
        if (!U.CATEGORIES_DEPENSE.includes(d.categorie)) throw new Error("Catégorie invalide");
        const x = { id: nouvelId("d"), date: date(d.date), categorie: d.categorie, description: txt(d.description, 120), montant: entier(d.montant, 1, 1000000000, "Montant"), mode: txt(d.mode, 30), note: txt(d.note, 200) };
        await S.suiviSet("depenses", x.id, x);
        trace = ["Dépense ajoutée", decrire("depenses", x, noms)];
        break;
      }
      case "comptage": {
        // Reste du soir : une ligne par produit compté ; une ligne vide = produit non compté
        const jr = date(d.date);
        const pv = txt(d.pointVente, 40);
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 300);
        const pm = await prixActuels();
        let nbC = 0;
        for (const it of items) {
          const pid = idPropre(it.produitId);
          const id = jr + "_" + pid;
          if (it.restant === "" || it.restant === null || it.restant === undefined) { await S.suiviDel("comptages", id); continue; }
          await S.suiviSet("comptages", id, { id, date: jr, produitId: pid, restant: entier(it.restant, 0, 100000, "Reste"), pointVente: pv, cree: new Date().toISOString(), prix: pm[pid] != null ? pm[pid] : null });
          nbC++;
        }
        trace = ["Comptage du soir", jjmm(jr) + " · " + nbC + " produit(s) compté(s)" + (pv ? " · " + pv : "")];
        break;
      }
      case "cloture": {
        const jr = date(d.date);
        const compte = entier(d.compte, 0, 1000000000, "Espèces comptées");
        const donnees = await charger();
        const j = U.journee(donnees, jr);
        const fond = d.fond === undefined || d.fond === "" || d.fond === null ? 0 : entier(d.fond, 0, 1000000000, "Fond de caisse");
        const attendu = j.especesAttendues + fond;
        const cl = { id: jr, date: jr, cree: new Date().toISOString(), compte, fond, attendu, ecart: compte - attendu, ca: j.ca, qte: j.qte, depenses: j.depenses, parPaiement: j.parPaiement, note: txt(d.note, 200) };
        const liste = (await S.getDoc("clotures")) || [];
        await S.setDoc("clotures", liste.filter((x) => x && x.date !== jr).concat([cl]).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-400));
        trace = ["Journée clôturée", jjmm(jr) + " · ventes " + fr(cl.ca) + " · espèces comptées " + fr(compte) + " · écart " + (cl.ecart > 0 ? "+" : "") + fr(cl.ecart)];
        break;
      }
      case "equipe_save": {
        const donnees = await charger();
        const eq = await equipeSauver(d.liste, donnees.config);
        trace = ["Équipe de la caisse modifiée", eq.map((m) => m.nom + (m.actif ? "" : " (désactivé)")).join(", ")];
        break;
      }
      case "caisse_mot": {
        const mot = txt(d.mot, 30).toLowerCase();
        if (!/^[a-z0-9]{3,20}$/.test(mot)) throw new Error("Mot invalide : 3 à 20 lettres ou chiffres, sans espace ni accent");
        await S.setDoc("caisse-mot", mot);
        trace = ["Mot secret de la caisse changé", ""];
        break;
      }
      case "demande_decider": {
        const dem = (await S.suiviListe("demandes")).find((x) => x && x.id === txt(d.id, 40));
        if (!dem) throw new Error("Demande invalide");
        if (dem.statut !== "attente") throw new Error("Demande invalide : déjà traitée");
        if (d.decision === "accepter") {
          const cat = U.CATEGORIES_DEPENSE.includes(d.categorie) ? d.categorie : "Autre dépense";
          const dep = { id: nouvelId("d"), date: dem.date, categorie: cat, description: (dem.motif + " — " + dem.vendeur).slice(0, 120), montant: dem.montant, mode: "Caisse", note: "Demande " + dem.id, vid: dem.vid, vendeur: dem.vendeur };
          await S.suiviSet("depenses", dep.id, dep);
          dem.statut = "accepte"; dem.depenseId = dep.id;
        } else if (d.decision === "refuser") dem.statut = "refuse";
        else throw new Error("Décision invalide");
        dem.decideLe = new Date().toISOString();
        await S.suiviSet("demandes", dem.id, dem);
        trace = ["Demande de dépense " + (dem.statut === "accepte" ? "acceptée" : "refusée"), dem.vendeur + " · " + fr(dem.montant) + " · " + dem.motif];
        break;
      }
      case "paiement_decider": {
        // Le vendeur ou livreur dit « le client a payé le responsable » : le responsable confirme (argent bien reçu) ou refuse (espèces à remettre)
        if (d.decision !== "recu" && d.decision !== "non") throw new Error("Décision invalide");
        const idp = txt(d.id, 60);
        const c = await S.getCommande(idp);
        if (c) {
          if (!c.encaisse || !aConfirmer(c.encaisse.mode, c.encaisse.verifie, c.dateLivraison || c.date)) throw new Error("Paiement invalide : déjà traité");
          if (d.decision === "recu") c.encaisse.verifie = true;
          else { c.encaisse.mode = "Espèces"; c.encaisse.verifie = true; c.encaisse.note = "Le responsable n'a rien reçu : espèces à remettre"; }
          await S.setCommande(c);
          trace = ["Paiement au responsable " + (d.decision === "recu" ? "confirmé" : "refusé (espèces à remettre)"), (c.livreur || "") + " · " + fr(c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal) + " · " + (c.nomClient || "")];
          break;
        }
        const rc = (await S.suiviListe("recus")).find((x) => x && x.id === idp);
        if (!rc || !aConfirmer(rc.paiement, rc.verifie, rc.date)) throw new Error("Paiement invalide : déjà traité");
        rc.verifie = true;
        if (d.decision === "non") {
          rc.paiement = "Espèces";
          for (const v of (await S.suiviListe("ventes")).filter((x) => x && x.recuId === idp)) { v.paiement = "Espèces"; await S.suiviSet("ventes", v.id, v); }
        }
        await S.suiviSet("recus", rc.id, rc);
        trace = ["Paiement au responsable " + (d.decision === "recu" ? "confirmé" : "refusé (espèces à remettre)"), (rc.vendeur || "") + " · " + fr(rc.total) + " · reçu " + rc.id];
        break;
      }
      case "archiver": {
        // Met de côté (sans effacer) : le chiffre disparaît des totaux, on peut le restaurer
        const etat = d.etat !== false;
        if (d.type === "recu") {
          const idR = txt(d.id, 60);
          const recu = (await S.suiviListe("recus")).find((r) => r && r.id === idR);
          if (!recu) throw new Error("Reçu invalide");
          if (etat) recu.archive = new Date().toISOString(); else delete recu.archive;
          await S.suiviSet("recus", idR, recu);
          for (const v of await S.suiviListe("ventes")) if (v && v.recuId === idR) { if (etat) v.archive = recu.archive; else delete v.archive; await S.suiviSet("ventes", v.id, v); }
          for (const x of await S.suiviListe("depenses")) if (x && x.recuId === idR) { if (etat) x.archive = recu.archive; else delete x.archive; await S.suiviSet("depenses", x.id, x); }
          trace = [etat ? "Reçu archivé" : "Reçu restauré", (recu.vendeur || "") + " · " + fr(recu.total) + " · " + jjmm(recu.date)];
        } else if (d.type === "depense") {
          const idD = txt(d.id, 80);
          const dep = (await S.suiviListe("depenses")).find((x) => x && String(x.id) === idD);
          if (!dep) throw new Error("Dépense invalide");
          if (etat) dep.archive = new Date().toISOString(); else delete dep.archive;
          await S.suiviSet("depenses", idD, dep);
          trace = [etat ? "Dépense archivée" : "Dépense restaurée", decrire("depenses", dep, noms)];
        } else throw new Error("Type invalide");
        break;
      }
      case "vendeur_archiver": {
        // Archive d'un coup les ventes et dépenses d'une personne (option : entre deux dates)
        const vid = txt(d.vid, 60); if (!vid) throw new Error("Personne invalide");
        const du = d.du ? date(d.du) : "", au = d.au ? date(d.au) : "";
        const dans = (jr) => (!du || jr >= du) && (!au || jr <= au);
        const stamp = new Date().toISOString();
        const demandes = await S.suiviListe("demandes");
        let nr = 0, nd = 0;
        for (const r of await S.suiviListe("recus")) if (r && !r.archive && r.vid === vid && dans(r.date)) {
          r.archive = stamp; await S.suiviSet("recus", r.id, r); nr++;
          for (const v of await S.suiviListe("ventes")) if (v && v.recuId === r.id) { v.archive = stamp; await S.suiviSet("ventes", v.id, v); }
        }
        for (const x of decorerDepenses(await S.suiviListe("depenses"), demandes)) if (x && !x.archive && x.vid === vid && dans(jour(x.date))) { x.archive = stamp; await S.suiviSet("depenses", x.id, x); nd++; }
        const nom = ((await lireEquipe()).find((m) => m.id === vid) || {}).nom || vid;
        trace = ["Archivé pour " + nom, nr + " reçu(s) et " + nd + " dépense(s)" + (du || au ? " · " + (du || "…") + " → " + (au || "…") : "")];
        break;
      }
      case "archives_vider": {
        // Supprime pour de bon ce qui est dans les archives (d'une personne, ou de tout le monde)
        const vid = txt(d.vid, 60);
        const demandes = await S.suiviListe("demandes");
        let nr = 0, nd = 0;
        for (const r of await S.suiviListe("recus")) if (r && r.archive && (!vid || r.vid === vid)) {
          for (const v of await S.suiviListe("ventes")) if (v && v.recuId === r.id) await S.suiviDel("ventes", v.id);
          for (const x of await S.suiviListe("depenses")) if (x && x.recuId === r.id) await S.suiviDel("depenses", x.id);
          await S.suiviDel("recus", r.id); nr++;
        }
        for (const x of decorerDepenses(await S.suiviListe("depenses"), demandes)) if (x && x.archive && (!vid || x.vid === vid)) { await S.suiviDel("depenses", String(x.id)); nd++; }
        trace = ["Archives supprimées pour toujours", nr + " reçu(s) et " + nd + " dépense(s)"];
        break;
      }
      case "supprimer_recu": {
        const idR = txt(d.id, 60);
        for (const v of await S.suiviListe("ventes")) if (v && v.recuId === idR) await S.suiviDel("ventes", v.id);
        for (const x of await S.suiviListe("depenses")) if (x && x.recuId === idR) await S.suiviDel("depenses", x.id);
        await S.suiviDel("recus", idR);
        trace = ["Reçu supprimé", idR];
        break;
      }
      case "supprimer": {
        const types = { lot: "lots", vente: "ventes", perte: "pertes", depense: "depenses", comptage: "comptages" };
        if (!types[d.type]) throw new Error("Type invalide");
        const idSup = txt(d.id, 80);
        const ancien = (await S.suiviListe(types[d.type])).find((x) => x && String(x.id) === idSup);
        await S.suiviDel(types[d.type], idSup);
        trace = ["Supprimé : " + ({ lot: "production", vente: "vente", perte: "perte", depense: "dépense", comptage: "comptage" })[d.type], decrire(types[d.type], ancien, noms)];
        // Une ligne de l'historique repris, supprimée volontairement, ne doit jamais revenir
        if (/^h-/.test(idSup)) {
          const sup = (await S.getDoc("suivi-supprimes")) || [];
          if (!sup.includes(idSup)) { sup.push(idSup); await S.setDoc("suivi-supprimes", sup.slice(-500)); }
        }
        break;
      }
      case "sauvegarde": {
        const [lots, ventes, pertes, depenses, comptages, config] = await Promise.all([S.suiviListe("lots"), S.suiviListe("ventes"), S.suiviListe("pertes"), S.suiviListe("depenses"), S.suiviListe("comptages"), S.getSuiviConfig()]);
        return res.status(200).json({ sauvegardeLe: new Date().toISOString(), config, lots, ventes, pertes, depenses, comptages, recus: await S.suiviListe("recus"), demandes: await S.suiviListe("demandes"), equipe: await lireEquipe(), clotures: (await S.getDoc("clotures")) || [], journal: (await S.getDoc("journal")) || [] });
      }
      case "nouveau_depart": {
        const jr = date(d.date || new Date().toISOString().slice(0, 10));
        const caisse = entier(d.caisse, -1000000000, 1000000000, "Caisse");
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 80)
          .map((x) => ({ produitId: idPropre(x.produitId), qte: entier(x.qte || 0, 0, 100000, "Stock"), cu: entier(x.coutUnitaire || 0, 0, 10000000, "Coût") }))
          .filter((x) => x.qte > 0);
        // 1) tout effacer (la sauvegarde a été téléchargée avant par l'admin)
        for (const t of ["lots", "ventes", "pertes", "depenses", "comptages", "recus", "demandes"]) {
          for (const x of await S.suiviListe(t)) if (x && x.id) await S.suiviDel(t, String(x.id));
        }
        trace = ["Nouveau départ", jr + " · caisse de départ " + fr(caisse)];
        // l'ancien classeur ne doit jamais revenir
        const h = require("./_data/historique-noogo.json");
        const sup = new Set((await S.getDoc("suivi-supprimes")) || []);
        for (const k of ["lots", "ventes", "pertes", "depenses"]) for (const x of h[k] || []) sup.add(x.id);
        await S.setDoc("suivi-supprimes", Array.from(sup).slice(-500));
        // 2) nouveau départ : caisse + stock restant (un lot « Stock de départ » par produit)
        const cfg = configPropre(await S.getSuiviConfig());
        cfg.caisseDepart = caisse; cfg.depuis = jr; cfg.debutHeure = new Date().toISOString();
        await S.setSuiviConfig(configPropre(cfg));
        for (const it of items) {
          const lot = { id: nouvelId("lot"), date: jr, nom: "Stock de départ", cout: it.qte * it.cu, lignes: [{ produitId: it.produitId, qte: it.qte }], note: "Nouveau départ du " + jr, depart: true };
          await S.suiviSet("lots", lot.id, lot);
        }
        break;
      }
      case "config": {
        const avantCfg = configPropre(await S.getSuiviConfig());
        const apresCfg = configPropre(d.config);
        const pa = {}; avantCfg.internes.forEach((p) => (pa[p.id] = p.prix));
        if (apresCfg.internes.some((p) => pa[p.id] != null && pa[p.id] !== p.prix)) await S.figerPrix(pa);
        await S.setSuiviConfig(apresCfg);
        trace = ["Paramètres modifiés", ""];
        break;
      }
      case "importer_historique": {
        const h = require("./_data/historique-noogo.json");
        const cfg = configPropre(await S.getSuiviConfig());
        const interne = new Set(cfg.internes.map((p) => p.id));
        for (const p of h.internes) if (!interne.has(p.id)) cfg.internes.push(p);
        if (!cfg.depuis) { cfg.depuis = h.config.depuis; cfg.caisseDepart = h.config.caisseDepart; }
        const pv = new Set(cfg.pointsVente);
        for (const p of h.config.pointsVente) if (!pv.has(p)) cfg.pointsVente.push(p);
        await S.setSuiviConfig(configPropre(cfg));
        const sup = new Set((await S.getDoc("suivi-supprimes")) || []);
        const deja = {};
        for (const t of ["lots", "ventes", "pertes", "depenses"]) deja[t] = new Set((await S.suiviListe(t)).map((x) => x.id));
        const ajoute = async (t, x) => { if (!sup.has(x.id) && !deja[t].has(x.id)) await S.suiviSet(t, x.id, x); };
        for (const l of h.lots) await ajoute("lots", l);
        for (const v of h.ventes) await ajoute("ventes", v);
        for (const p of h.pertes) await ajoute("pertes", p);
        for (const x of h.depenses) await ajoute("depenses", x);
        break;
      }
      case "export": {
        const donnees = await charger();
        const calc = U.calculer(donnees);
        return res.status(200).json({ ventes: calc.ventes, pertes: calc.pertes, depenses: calc.depenses, lots: calc.lots, stock: Object.values(calc.stock) });
      }
      default: return res.status(400).json({ erreur: "Action non reconnue" });
    }
    if (trace) await noter(trace[0], trace[1]);
    return res.status(200).json(vue(await charger(), d));
  } catch (e) {
    if (e && e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Base de données non connectée", code: "DB" });
    if (e && /invalide|Ajoutez/.test(e.message || "")) return res.status(400).json({ erreur: e.message });
    console.error("suivi", e && e.message);
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
