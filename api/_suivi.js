// Noogó — calculs du suivi (stock, ventes, marges, caisse, bilan). Fonctions pures : aucune écriture ici.
//
// Principe : l'admin ne note que des FAITS (lots produits, ventes directes, pertes, dépenses,
// et le « reste du soir »). Tout le reste est recalculé à chaque lecture :
//  • commandes du site livrées  → ventes « En ligne » automatiques (les packs retirent leurs pots du stock)
//  • reste du soir (comptage)   → ventes = stock attendu − reste compté
//  • coût moyen des lots        → marge et valeur du stock

const CATEGORIES_DEPENSE = [
  "Transport / livraison",
  "Publicité / recharge",
  "Salaire",
  "Impôt / taxe",
  "Loyer / courant / gaz / eau",
  "Emballage / fournitures",
  "Matériel",
  "Autre dépense",
  "Achat marchandises (à revendre)",
  "Apport d'argent (+)",
  "Remboursement d'apport (−)"
];
const TYPES_PERTE = { gate: "Gâté", offert: "Offert", degustation: "Dégustation" };
const POINTS_VENTE_DEFAUT = ["La Jeunesse", "Aube Nouvelle", "Local"];
const CANAL_SITE = "En ligne";
const CANAL_DEFAUT = "Non précisé";

const classeDepense = (cat) => {
  const c = String(cat || "");
  if (c.indexOf("Apport") === 0) return "apport";
  if (c.indexOf("Remboursement") === 0) return "remb";
  if (c.indexOf("Achat marchandises") === 0) return "achat";
  return "charge";
};

const jour = (d) => String(d || "").slice(0, 10);
const nombre = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const arrondi = (n) => Math.round(nombre(n));
const PACK = /^pk-(van|bao|ban|cho|fra)-(p|g)$/;
const BASE = { van: "vanille", bao: "baobab", ban: "banane", cho: "choco", fra: "fraise" };

// Produit réellement stocké derrière un article du catalogue (un pack = N pots du même parfum)
function baseDe(p) {
  if (!p) return null;
  if (p.type === "pack") {
    const m = PACK.exec(p.id);
    if (m) return { id: BASE[m[1]] + "-" + m[2], n: Math.max(1, parseInt(p.packCount, 10) || 5) };
    return { id: p.id, n: 1 };
  }
  return { id: p.id, n: 1 };
}

// Liste des produits suivis : articles du catalogue (hors packs) + produits internes (non vendus en ligne)
function produitsSuivis(catalogue, config) {
  const liste = [];
  const vus = new Set();
  for (const p of catalogue || []) {
    if (!p || p.type === "pack" || vus.has(p.id)) continue;
    vus.add(p.id);
    liste.push({ id: p.id, nom: p.nom, prix: nombre(p.prix), actif: p.actif !== false, interne: false });
  }
  for (const p of (config && config.internes) || []) {
    if (!p || vus.has(p.id)) continue;
    vus.add(p.id);
    liste.push({ id: p.id, nom: p.nom, prix: nombre(p.prix), actif: true, interne: true });
  }
  return liste;
}

// Construit tous les évènements, triés, puis rejoue l'histoire de chaque produit.
function calculer(donnees) {
  const catalogue = donnees.catalogue || [];
  const config = donnees.config || {};
  const couts = config.couts || {};
  const suivis = produitsSuivis(catalogue, config);
  const parId = {};
  suivis.forEach((p) => (parId[p.id] = p));
  const nomDe = (id) => (parId[id] ? parId[id].nom : id);
  const prixDe = (id) => (parId[id] ? parId[id].prix : 0);
  const catParId = {};
  catalogue.forEach((p) => (catParId[p.id] = p));

  // 1) évènements
  const ev = {}; // produitId -> [ {date, rang, type, ...} ]
  const pousse = (id, e) => { (ev[id] = ev[id] || []).push(e); if (!parId[id]) parId[id] = { id, nom: id, prix: 0, actif: false, interne: true, inconnu: true }; };

  for (const l of donnees.lots || []) {
    const total = (l.lignes || []).reduce((s, x) => s + nombre(x.qte), 0);
    const coutU = total > 0 ? nombre(l.cout) / total : 0;
    for (const x of l.lignes || []) if (nombre(x.qte) > 0) pousse(x.produitId, { date: jour(l.date), rang: 0, type: "lot", qte: nombre(x.qte), coutU, ref: l.id });
  }
  for (const c of donnees.commandes || []) {
    if (c.statutLivraison !== "livree") continue;
    const base = nombre(c.montantTotal);
    const ratio = base > 0 ? nombre(c.montantApresRemise != null ? c.montantApresRemise : base) / base : 1;
    const d = jour(c.dateLivraison || c.date);
    for (const a of c.articles || []) {
      const p = catParId[a.id] || { id: a.id, type: a.type };
      const b = baseDe(p) || { id: a.id, n: 1 };
      pousse(b.id, { date: d, rang: 1, type: "vente", source: "site", canal: CANAL_SITE, qte: nombre(a.qte) * b.n, montant: nombre(a.total) * ratio, ref: c.id });
    }
  }
  for (const v of donnees.ventes || []) {
    const prix = v.prix != null && v.prix !== "" ? nombre(v.prix) : prixDe(v.produitId);
    pousse(v.produitId, { date: jour(v.date), rang: 1, type: "vente", source: "manuel", canal: v.pointVente || CANAL_DEFAUT, qte: nombre(v.qte), montant: Math.max(0, nombre(v.qte) * prix - nombre(v.remise)), ref: v.id });
  }
  for (const p of donnees.pertes || []) pousse(p.produitId, { date: jour(p.date), rang: 2, type: "perte", sorte: p.type, qte: nombre(p.qte), ref: p.id });
  for (const c of donnees.comptages || []) pousse(c.produitId, { date: jour(c.date), rang: 3, type: "comptage", restant: nombre(c.restant), canal: c.pointVente || CANAL_DEFAUT, prix: c.prix != null && c.prix !== "" ? nombre(c.prix) : null, ref: c.id });

  // 2) on rejoue
  const ventes = [], pertes = [], ajustements = [], lots = [], histo = {};
  const stock = {};
  for (const id of Object.keys(ev)) {
    const liste = ev[id].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rang - b.rang));
    let courant = 0, qteLots = 0, coutLots = 0, vendu = 0, perdu = 0, dernier = null;
    histo[id] = [];
    const coutMoyen = () => (qteLots > 0 ? coutLots / qteLots : nombre(couts[id]));
    for (const e of liste) {
      if (e.type === "lot") { courant += e.qte; qteLots += e.qte; coutLots += e.qte * e.coutU; }
      else if (e.type === "vente") {
        courant -= e.qte; vendu += e.qte;
        ventes.push({ date: e.date, produitId: id, nom: nomDe(id), qte: e.qte, montant: arrondi(e.montant), cout: arrondi(e.qte * coutMoyen()), canal: e.canal, source: e.source, ref: e.ref });
      } else if (e.type === "perte") {
        courant -= e.qte; perdu += e.qte;
        pertes.push({ date: e.date, produitId: id, nom: nomDe(id), qte: e.qte, type: e.sorte, cout: arrondi(e.qte * coutMoyen()), ref: e.ref });
      } else if (e.type === "comptage") {
        const ecart = courant - e.restant;
        histo[id].push({ date: e.date, avant: courant, restant: e.restant });
        if (ecart > 0) {
          const prix = e.prix != null ? e.prix : prixDe(id);
          vendu += ecart;
          ventes.push({ date: e.date, produitId: id, nom: nomDe(id), qte: ecart, montant: arrondi(ecart * prix), cout: arrondi(ecart * coutMoyen()), canal: e.canal, source: "comptage", ref: e.ref });
        } else if (ecart < 0) {
          ajustements.push({ date: e.date, produitId: id, nom: nomDe(id), qte: -ecart, ref: e.ref });
        }
        courant = e.restant; dernier = { date: e.date, restant: e.restant };
      }
    }
    stock[id] = { id, nom: nomDe(id), theorique: courant, vendu, perdu, produit: qteLots, coutMoyen: arrondi(coutMoyen()), valeur: arrondi(Math.max(0, courant) * coutMoyen()), dernierComptage: dernier };
  }
  for (const p of suivis) if (!stock[p.id]) stock[p.id] = { id: p.id, nom: p.nom, theorique: 0, vendu: 0, perdu: 0, produit: 0, coutMoyen: arrondi(couts[p.id]), valeur: 0, dernierComptage: null };

  for (const l of donnees.lots || []) {
    const total = (l.lignes || []).reduce((s, x) => s + nombre(x.qte), 0);
    lots.push({ ...l, quantite: total, coutUnitaire: total > 0 ? arrondi(nombre(l.cout) / total) : 0 });
  }

  const depenses = (donnees.depenses || []).map((d) => ({ ...d, classe: classeDepense(d.categorie) }));
  ventes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  pertes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { suivis: Object.values(parId).filter((p) => !p.inconnu || stock[p.id]), stock, ventes, pertes, ajustements, lots, depenses, histo };
}

// Stock attendu pour chaque produit à la fin d'une journée, SANS tenir compte du comptage de ce jour-là
function stockAvant(donnees, date) {
  const d = jour(date);
  const sans = { ...donnees, comptages: (donnees.comptages || []).filter((c) => jour(c.date) !== d) };
  const filtre = (arr) => (arr || []).filter((x) => jour(x.date) <= d);
  const r = calculer({
    ...sans, lots: filtre(sans.lots), ventes: filtre(sans.ventes), pertes: filtre(sans.pertes), comptages: filtre(sans.comptages),
    commandes: (sans.commandes || []).filter((c) => jour(c.dateLivraison || c.date) <= d)
  });
  const sortie = {};
  for (const id of Object.keys(r.stock)) sortie[id] = r.stock[id].theorique;
  return sortie;
}

// Bilan sur une période [du, au] (dates incluses, « YYYY-MM-DD »). Sans bornes : tout.
function bilan(donnees, du, au) {
  const r = calculer(donnees);
  const dans = (d) => (!du || d >= du) && (!au || d <= au);
  const V = r.ventes.filter((x) => dans(x.date));
  const P = r.pertes.filter((x) => dans(x.date));
  const D = r.depenses.filter((x) => dans(jour(x.date)));
  const L = r.lots.filter((x) => dans(jour(x.date)));

  const somme = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const ca = somme(V, (x) => x.montant), cogs = somme(V, (x) => x.cout), qte = somme(V, (x) => x.qte);
  const pertesCout = somme(P, (x) => x.cout);
  const charges = somme(D.filter((x) => x.classe === "charge"), (x) => nombre(x.montant));
  const achats = somme(D.filter((x) => x.classe === "achat"), (x) => nombre(x.montant));
  const apports = somme(D.filter((x) => x.classe === "apport"), (x) => nombre(x.montant));
  const rembs = somme(D.filter((x) => x.classe === "remb"), (x) => nombre(x.montant));
  const productionCout = somme(L, (x) => nombre(x.cout));
  const margeBrute = ca - cogs;

  const groupe = (arr, cle, champs) => {
    const m = {};
    for (const x of arr) { const k = cle(x); const o = (m[k] = m[k] || { nom: k, ...champs(null) }); champs(x, o); }
    return Object.values(m);
  };
  const parProduit = groupe(V, (x) => x.nom, (x, o) => { if (!x) return { qte: 0, ca: 0, marge: 0 }; o.qte += x.qte; o.ca += x.montant; o.marge += x.montant - x.cout; }).sort((a, b) => b.ca - a.ca);
  const parPoint = groupe(V, (x) => x.canal, (x, o) => { if (!x) return { qte: 0, ca: 0 }; o.qte += x.qte; o.ca += x.montant; }).sort((a, b) => b.ca - a.ca);
  const parCategorie = groupe(D.filter((x) => x.classe === "charge"), (x) => x.categorie, (x, o) => { if (!x) return { total: 0 }; o.total += nombre(x.montant); }).sort((a, b) => b.total - a.total);
  const jours = {};
  for (const x of V) { const j = (jours[x.date] = jours[x.date] || { date: x.date, ca: 0, qte: 0, depenses: 0 }); j.ca += x.montant; j.qte += x.qte; }
  for (const x of D.filter((y) => y.classe === "charge")) { const dj = jour(x.date); const j = (jours[dj] = jours[dj] || { date: dj, ca: 0, qte: 0, depenses: 0 }); j.depenses += nombre(x.montant); }
  const parJour = Object.values(jours).sort((a, b) => (a.date < b.date ? -1 : 1));

  // Caisse théorique : depuis la date de départ saisie dans les paramètres
  const cfg = donnees.config || {};
  const depuis = cfg.depuis || "";
  const apres = (d) => !depuis || d >= depuis;
  const cV = somme(r.ventes.filter((x) => apres(x.date)), (x) => x.montant);
  const cL = somme(r.lots.filter((x) => apres(jour(x.date))), (x) => nombre(x.cout));
  const cD = r.depenses.filter((x) => apres(jour(x.date)));
  const caisse = nombre(cfg.caisseDepart) + cV - cL
    - somme(cD.filter((x) => x.classe === "charge" || x.classe === "achat"), (x) => nombre(x.montant))
    + somme(cD.filter((x) => x.classe === "apport"), (x) => nombre(x.montant))
    - somme(cD.filter((x) => x.classe === "remb"), (x) => nombre(x.montant));

  const valeurStock = somme(Object.values(r.stock), (s) => s.valeur);
  const alertes = Object.values(r.stock).filter((s) => s.theorique < 0).map((s) => ({ nom: s.nom, theorique: s.theorique }));

  return {
    periode: { du: du || null, au: au || null },
    ca: arrondi(ca), cout: arrondi(cogs), margeBrute: arrondi(margeBrute), margePct: ca > 0 ? Math.round((margeBrute / ca) * 1000) / 10 : 0,
    quantite: qte, pertes: arrondi(pertesCout), charges: arrondi(charges), achats: arrondi(achats),
    resultat: arrondi(margeBrute - pertesCout - charges),
    apports: arrondi(apports), remboursements: arrondi(rembs), production: arrondi(productionCout),
    caisse: arrondi(caisse), valeurStock: arrondi(valeurStock), alertes,
    parProduit, parPoint, parCategorie, parJour
  };
}

module.exports = { CATEGORIES_DEPENSE, TYPES_PERTE, POINTS_VENTE_DEFAUT, CANAL_SITE, classeDepense, baseDe, produitsSuivis, calculer, stockAvant, bilan };
