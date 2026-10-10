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
  const [catalogue, config, lots, ventes, pertes, depenses, comptages, commandes] = await Promise.all([
    chargerCatalogue(), S.getSuiviConfig(), S.suiviListe("lots"), S.suiviListe("ventes"), S.suiviListe("pertes"),
    S.suiviListe("depenses"), S.suiviListe("comptages"), S.getCommandes()
  ]);
  return { catalogue, config: configPropre(config), lots, ventes, pertes, depenses, comptages, commandes };
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
    pointsVente: pv, couts, internes
  };
}

function periode(d) {
  const du = d.du ? date(d.du) : "", au = d.au ? date(d.au) : "";
  return [du, au];
}

function vue(donnees, d) {
  const [du, au] = periode(d || {});
  const calc = U.calculer(donnees);
  return {
    config: donnees.config,
    produits: calc.suivis,
    stock: Object.values(calc.stock),
    bilan: U.bilan(donnees, du, au),
    ventes: calc.ventes.filter((x) => (!du || x.date >= du) && (!au || x.date <= au)).slice(0, 400),
    pertes: calc.pertes.filter((x) => (!du || x.date >= du) && (!au || x.date <= au)).slice(0, 300),
    ajustements: calc.ajustements.slice(-100),
    lots: calc.lots.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 200),
    depenses: calc.depenses.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 500),
    comptages: donnees.comptages.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 300),
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
        const lot = { id: d.id ? idPropre(d.id) : nouvelId("lot"), date: date(d.date), nom: txt(d.nom, 60) || "Lot", cout: entier(d.cout, 0, 100000000, "Coût"), lignes, note: txt(d.note, 200) };
        await S.suiviSet("lots", lot.id, lot);
        break;
      }
      case "ajouter_vente": {
        const v = { id: d.id ? idPropre(d.id) : nouvelId("v"), date: date(d.date), produitId: idPropre(d.produitId), qte: entier(d.qte, 1, 100000, "Quantité"), pointVente: txt(d.pointVente, 40), remise: entier(d.remise || 0, 0, 100000000, "Remise"), note: txt(d.note, 200) };
        if (d.prix !== undefined && d.prix !== "" && d.prix !== null) v.prix = entier(d.prix, 0, 10000000, "Prix");
        await S.suiviSet("ventes", v.id, v);
        break;
      }
      case "ajouter_perte": {
        if (!U.TYPES_PERTE[d.type]) throw new Error("Type de perte invalide");
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
      case "supprimer": {
        const types = { lot: "lots", vente: "ventes", perte: "pertes", depense: "depenses", comptage: "comptages" };
        if (!types[d.type]) throw new Error("Type invalide");
        await S.suiviDel(types[d.type], txt(d.id, 80));
        break;
      }
      case "config": {
        await S.setSuiviConfig(configPropre(d.config));
        break;
      }
      case "importer_historique": {
        const h = require("../data/historique-noogo.json");
        const cfg = configPropre(await S.getSuiviConfig());
        const interne = new Set(cfg.internes.map((p) => p.id));
        for (const p of h.internes) if (!interne.has(p.id)) cfg.internes.push(p);
        if (!cfg.depuis) { cfg.depuis = h.config.depuis; cfg.caisseDepart = h.config.caisseDepart; }
        const pv = new Set(cfg.pointsVente);
        for (const p of h.config.pointsVente) if (!pv.has(p)) cfg.pointsVente.push(p);
        await S.setSuiviConfig(configPropre(cfg));
        for (const l of h.lots) await S.suiviSet("lots", l.id, l);
        for (const v of h.ventes) await S.suiviSet("ventes", v.id, v);
        for (const p of h.pertes) await S.suiviSet("pertes", p.id, p);
        for (const x of h.depenses) await S.suiviSet("depenses", x.id, x);
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
