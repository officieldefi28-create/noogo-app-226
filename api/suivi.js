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
  const [catalogue, config, lots, ventes, pertes, depenses, comptages, commandes, equipe, recus, demandes] = await Promise.all([
    chargerCatalogue(), S.getSuiviConfig(), S.suiviListe("lots"), S.suiviListe("ventes"), S.suiviListe("pertes"),
    S.suiviListe("depenses"), S.suiviListe("comptages"), S.getCommandes(),
    lireEquipe(), S.suiviListe("recus"), S.suiviListe("demandes")
  ]);
  const motCaisse = (await S.getDoc("caisse-mot")) || "bingo";
  const cfg = configPropre(config);
  // « Nouveau départ » : les commandes du site livrées avant ce moment ne comptent plus dans le suivi
  const cmds = cfg.debutHeure ? commandes.filter((c) => String(c.dateLivraison || c.date || "") >= cfg.debutHeure) : commandes;
  return { catalogue, config: cfg, lots, ventes, pertes, depenses, comptages, commandes: cmds, equipe, recus, demandes, motCaisse };
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
async function equipeSauver(liste, config) {
  const pv = new Set((config.pointsVente || []));
  const vus = new Set(), codes = new Set();
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
    propre.push({ id, nom, code, point: point || "Local", actif: x.actif !== false });
  }
  await S.setDoc("equipe", propre);
  return propre;
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
    depenses: calc.depenses.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 1500),
    comptages: donnees.comptages.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 1500),
    equipe: donnees.equipe, motCaisse: donnees.motCaisse, recus: (donnees.recus || []).sort((a, b) => ((a.heure || "") < (b.heure || "") ? 1 : -1)).slice(0, 800),
    demandes: (donnees.demandes || []).sort((a, b) => ((a.heure || "") < (b.heure || "") ? 1 : -1)).slice(0, 200),
    categories: U.CATEGORIES_DEPENSE, typesPerte: U.TYPES_PERTE
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
  try {
    const d = req.body || {};
    if (!adminValide(d.jeton)) return res.status(401).json({ erreur: "Session expirée, reconnectez-vous", session: false });

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
        const lot = { id: d.id ? idPropre(d.id) : nouvelId("lot"), date: date(d.date), nom: txt(d.nom, 60) || "Lot", cout: entier(d.cout, 0, 100000000, "Coût"), lignes, note: txt(d.note, 200) };
        await S.suiviSet("lots", lot.id, lot);
        break;
      }
      case "ajouter_vente": {
        await verifierProduits([idPropre(d.produitId)]);
        const v = { id: d.id ? idPropre(d.id) : nouvelId("v"), date: date(d.date), produitId: idPropre(d.produitId), qte: entier(d.qte, 1, 100000, "Quantité"), pointVente: txt(d.pointVente, 40), remise: entier(d.remise || 0, 0, 100000000, "Remise"), note: txt(d.note, 200) };
        if (d.prix !== undefined && d.prix !== "" && d.prix !== null) v.prix = entier(d.prix, 0, 10000000, "Prix");
        await S.suiviSet("ventes", v.id, v);
        break;
      }
      case "ajouter_perte": {
        if (!U.TYPES_PERTE[d.type]) throw new Error("Type de perte invalide");
        await verifierProduits([idPropre(d.produitId)]);
        const p = { id: nouvelId("p"), date: date(d.date), produitId: idPropre(d.produitId), qte: entier(d.qte, 1, 100000, "Quantité"), type: d.type, note: txt(d.note, 200) };
        await S.suiviSet("pertes", p.id, p);
        break;
      }
      case "ajouter_depense": {
        if (!U.CATEGORIES_DEPENSE.includes(d.categorie)) throw new Error("Catégorie invalide");
        const x = { id: nouvelId("d"), date: date(d.date), categorie: d.categorie, description: txt(d.description, 120), montant: entier(d.montant, 1, 1000000000, "Montant"), mode: txt(d.mode, 30), note: txt(d.note, 200) };
        await S.suiviSet("depenses", x.id, x);
        break;
      }
      case "comptage": {
        // Reste du soir : une ligne par produit compté ; une ligne vide = produit non compté
        const jr = date(d.date);
        const pv = txt(d.pointVente, 40);
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 300);
        for (const it of items) {
          const pid = idPropre(it.produitId);
          const id = jr + "_" + pid;
          if (it.restant === "" || it.restant === null || it.restant === undefined) { await S.suiviDel("comptages", id); continue; }
          await S.suiviSet("comptages", id, { id, date: jr, produitId: pid, restant: entier(it.restant, 0, 100000, "Reste"), pointVente: pv });
        }
        break;
      }
      case "equipe_save": {
        const donnees = await charger();
        await equipeSauver(d.liste, donnees.config);
        break;
      }
      case "caisse_mot": {
        const mot = txt(d.mot, 30).toLowerCase();
        if (!/^[a-z0-9]{3,20}$/.test(mot)) throw new Error("Mot invalide : 3 à 20 lettres ou chiffres, sans espace ni accent");
        await S.setDoc("caisse-mot", mot);
        break;
      }
      case "demande_decider": {
        const dem = (await S.suiviListe("demandes")).find((x) => x && x.id === txt(d.id, 40));
        if (!dem) throw new Error("Demande invalide");
        if (dem.statut !== "attente") throw new Error("Demande invalide : déjà traitée");
        if (d.decision === "accepter") {
          const cat = U.CATEGORIES_DEPENSE.includes(d.categorie) ? d.categorie : "Autre dépense";
          const dep = { id: nouvelId("d"), date: dem.date, categorie: cat, description: (dem.motif + " — " + dem.vendeur).slice(0, 120), montant: dem.montant, mode: "Caisse", note: "Demande " + dem.id };
          await S.suiviSet("depenses", dep.id, dep);
          dem.statut = "accepte"; dem.depenseId = dep.id;
        } else if (d.decision === "refuser") dem.statut = "refuse";
        else throw new Error("Décision invalide");
        dem.decideLe = new Date().toISOString();
        await S.suiviSet("demandes", dem.id, dem);
        break;
      }
      case "supprimer_recu": {
        const idR = txt(d.id, 60);
        for (const v of await S.suiviListe("ventes")) if (v && v.recuId === idR) await S.suiviDel("ventes", v.id);
        await S.suiviDel("recus", idR);
        break;
      }
      case "supprimer": {
        const types = { lot: "lots", vente: "ventes", perte: "pertes", depense: "depenses", comptage: "comptages" };
        if (!types[d.type]) throw new Error("Type invalide");
        const idSup = txt(d.id, 80);
        await S.suiviDel(types[d.type], idSup);
        // Une ligne de l'historique repris, supprimée volontairement, ne doit jamais revenir
        if (/^h-/.test(idSup)) {
          const sup = (await S.getDoc("suivi-supprimes")) || [];
          if (!sup.includes(idSup)) { sup.push(idSup); await S.setDoc("suivi-supprimes", sup.slice(-500)); }
        }
        break;
      }
      case "sauvegarde": {
        const [lots, ventes, pertes, depenses, comptages, config] = await Promise.all([S.suiviListe("lots"), S.suiviListe("ventes"), S.suiviListe("pertes"), S.suiviListe("depenses"), S.suiviListe("comptages"), S.getSuiviConfig()]);
        return res.status(200).json({ sauvegardeLe: new Date().toISOString(), config, lots, ventes, pertes, depenses, comptages, recus: await S.suiviListe("recus"), demandes: await S.suiviListe("demandes"), equipe: await lireEquipe() });
      }
      case "nouveau_depart": {
        const jr = date(d.date || new Date().toISOString().slice(0, 10));
        const caisse = entier(d.caisse, 0, 1000000000, "Caisse");
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 80)
          .map((x) => ({ produitId: idPropre(x.produitId), qte: entier(x.qte || 0, 0, 100000, "Stock"), cu: entier(x.coutUnitaire || 0, 0, 10000000, "Coût") }))
          .filter((x) => x.qte > 0);
        // 1) tout effacer (la sauvegarde a été téléchargée avant par l'admin)
        for (const t of ["lots", "ventes", "pertes", "depenses", "comptages", "recus", "demandes"]) {
          for (const x of await S.suiviListe(t)) if (x && x.id) await S.suiviDel(t, String(x.id));
        }
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
        await S.setSuiviConfig(configPropre(d.config));
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
    return res.status(200).json(vue(await charger(), d));
  } catch (e) {
    if (e && e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Base de données non connectée", code: "DB" });
    if (e && /invalide|Ajoutez/.test(e.message || "")) return res.status(400).json({ erreur: e.message });
    console.error("suivi", e && e.message);
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
