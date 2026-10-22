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

// Heure d'enregistrement d'une fiche : champ « cree », sinon l'heure inscrite dans son identifiant (lot-xxxx), sinon la valeur par défaut.
function heureEnregistree(r, defaut) {
  if (r && r.cree && !isNaN(Date.parse(r.cree))) return new Date(r.cree).toISOString();
  const m = /^[A-Za-z]+-([0-9a-z]{7,9})[0-9a-f]{6}$/.exec(String((r && r.id) || ""));
  if (m) { const t = parseInt(m[1], 36); if (t > 1.6e12 && t < 4.1e12) return new Date(t).toISOString(); }
  return defaut;
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

  // Heure à laquelle chaque comptage a été enregistré (anciens comptages sans heure : on suppose 18 h ce jour-là)
  const heureComptage = {};
  for (const c of donnees.comptages || []) heureComptage[c.produitId + "|" + jour(c.date)] = heureEnregistree(c, jour(c.date) + "T18:00:00.000Z");
  for (const l of donnees.lots || []) {
    const total = (l.lignes || []).reduce((s, x) => s + nombre(x.qte), 0);
    const coutU = total > 0 ? nombre(l.cout) / total : 0;
    const hLot = heureEnregistree(l, "");
    for (const x of l.lignes || []) if (nombre(x.qte) > 0) {
      // Une production notée APRÈS le comptage du soir (même jour) compte pour la suite : elle ne doit jamais gonfler les ventes
      const hC = heureComptage[x.produitId + "|" + jour(l.date)];
      const apres = !l.depart && (l.moment === "apres" ? true : l.moment === "avant" ? false : !!(hC && hLot && hLot > hC));
      pousse(x.produitId, { date: jour(l.date), rang: apres ? 4 : 0, type: "lot", qte: nombre(x.qte), coutU, ref: l.id });
    }
  }
  for (const c of donnees.commandes || []) {
    if (c.statutLivraison !== "livree") continue;
    const base = nombre(c.montantTotal);
    const ratio = base > 0 ? nombre(c.montantApresRemise != null ? c.montantApresRemise : base) / base : 1;
    const d = jour(c.dateLivraison || c.date);
    for (const a of c.articles || []) {
      if (Array.isArray(a.compo) && a.compo.length) {
        // Pack au choix : chaque saveur choisie sort du stock de son propre produit
        const tot = a.compo.reduce((s, x) => s + nombre(x.qte), 0) || 1;
        for (const x of a.compo) pousse(x.id, { date: d, rang: 1, type: "vente", source: "site", canal: CANAL_SITE, qte: nombre(x.qte), montant: (nombre(a.total) * ratio * nombre(x.qte)) / tot, ref: c.id });
        continue;
      }
      const p = catParId[a.id] || { id: a.id, type: a.type };
      const b = baseDe(p) || { id: a.id, n: 1 };
      pousse(b.id, { date: d, rang: 1, type: "vente", source: "site", canal: CANAL_SITE, qte: nombre(a.qte) * b.n, montant: nombre(a.total) * ratio, ref: c.id });
    }
  }
  for (const v of donnees.ventes || []) {
    const prix = v.prix != null && v.prix !== "" ? nombre(v.prix) : prixDe(v.produitId);
    pousse(v.produitId, { date: jour(v.date), rang: 1, type: "vente", source: "manuel", canal: v.pointVente || CANAL_DEFAUT, qte: nombre(v.qte), montant: v.montant != null && v.montant !== "" ? Math.max(0, nombre(v.montant)) : Math.max(0, nombre(v.qte) * prix - nombre(v.remise)), ref: v.id, vendeur: v.vendeur || "", paiement: v.paiement || "", recu: v.recuId || "" });
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
        ventes.push({ date: e.date, produitId: id, nom: nomDe(id), qte: e.qte, montant: arrondi(e.montant), cout: arrondi(e.qte * coutMoyen()), canal: e.canal, source: e.source, ref: e.ref, vendeur: e.vendeur || "", paiement: e.paiement || "", recu: e.recu || "" });
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
  const L = r.lots.filter((x) => dans(jour(x.date)) && !x.depart);

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
  const parVendeur = groupe(V.filter((x) => x.vendeur), (x) => x.vendeur, (x, o) => { if (!x) return { qte: 0, ca: 0 }; o.qte += x.qte; o.ca += x.montant; }).sort((a, b) => b.ca - a.ca);
  const parPaiement = groupe(V.filter((x) => x.paiement), (x) => x.paiement, (x, o) => { if (!x) return { qte: 0, ca: 0 }; o.qte += x.qte; o.ca += x.montant; }).sort((a, b) => b.ca - a.ca);
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
  const cL = somme(r.lots.filter((x) => apres(jour(x.date)) && !x.depart), (x) => nombre(x.cout));
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
    parProduit, parPoint, parVendeur, parPaiement, parCategorie, parJour
  };
}

// ───────── Analyse automatique : rentabilité, conseil de production, seuil de rentabilité, objectifs ─────────
const ajouteJours = (jr, n) => { const d = new Date(jr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function analyse(donnees, auj) {
  const r = calculer(donnees);
  const cfg = donnees.config || {};
  const d1 = ajouteJours(auj, -1), d7 = ajouteJours(auj, -7), d30 = ajouteJours(auj, -30);
  // dernier coût de lot connu par produit (le coût du dernier lot montre si vos coûts ont changé)
  const dernierCout = {};
  const lotsTries = [...(donnees.lots || [])].filter((l) => !l.depart).sort((a, b) => (jour(a.date) + (a.cree || "")) < (jour(b.date) + (b.cree || "")) ? -1 : 1);
  for (const l of lotsTries) {
    const total = (l.lignes || []).reduce((sm, x) => sm + nombre(x.qte), 0);
    if (total > 0) for (const x of l.lignes || []) if (nombre(x.qte) > 0) dernierCout[x.produitId] = nombre(l.cout) / total;
  }
  const produits = [];
  for (const p of r.suivis) {
    const st = r.stock[p.id];
    if (!st) continue;
    if (!p.actif && !(st.theorique > 0) && !(st.vendu > 0)) continue;
    const vs = r.ventes.filter((v) => v.produitId === p.id);
    const sem = vs.filter((v) => v.date >= d7 && v.date <= d1);
    const joursVente = new Set(sem.map((v) => v.date)).size;
    const q7 = sem.reduce((sm, v) => sm + v.qte, 0);
    const moyenne = joursVente > 0 ? q7 / joursVente : 0;
    const m30 = vs.filter((v) => v.date >= d30 && v.date <= auj);
    const vendu30 = m30.reduce((sm, v) => sm + v.qte, 0);
    const marge30 = m30.reduce((sm, v) => sm + (v.montant - v.cout), 0);
    const ca30 = m30.reduce((sm, v) => sm + v.montant, 0);
    const prix = p.prix, coutU = st.coutMoyen;
    const margeU = prix - coutU;
    const cible = Math.ceil(moyenne * 1.15);
    let alerte = "";
    if (!(coutU > 0)) alerte = "sans-cout";
    else if (margeU <= 0) alerte = "perte";
    else if (prix > 0 && margeU / prix < 0.3) alerte = "faible";
    else if (dernierCout[p.id] != null && coutU > 0 && dernierCout[p.id] > coutU * 1.1) alerte = "cout-hausse";
    produits.push({
      id: p.id, nom: p.nom, prix, coutU: arrondi(coutU), coutDernier: dernierCout[p.id] != null ? arrondi(dernierCout[p.id]) : null,
      margeU: arrondi(margeU), margePct: prix > 0 ? Math.round((margeU / prix) * 1000) / 10 : 0,
      vendu30, ca30: arrondi(ca30), marge30: arrondi(marge30),
      theorique: st.theorique, valeur: st.valeur,
      moyenne: Math.round(moyenne * 10) / 10, joursDonnees: joursVente,
      joursStock: moyenne > 0 ? Math.round((Math.max(0, st.theorique) / moyenne) * 10) / 10 : null,
      cible, aProduire: Math.max(0, cible - Math.max(0, st.theorique)),
      confiance: joursVente >= 3 ? "ok" : "faible", alerte
    });
  }
  produits.sort((a, b) => b.marge30 - a.marge30);

  const mois = auj.slice(0, 7);
  const Vm = r.ventes.filter((v) => v.date.slice(0, 7) === mois && v.date <= auj);
  const ca = Vm.reduce((sm, v) => sm + v.montant, 0), cg = Vm.reduce((sm, v) => sm + v.cout, 0);
  const charges = (donnees.depenses || []).filter((x) => jour(x.date).slice(0, 7) === mois && classeDepense(x.categorie) === "charge").reduce((sm, x) => sm + nombre(x.montant), 0);
  const margePct = ca > 0 ? (ca - cg) / ca : 0;
  const caSeuil = margePct > 0 ? Math.round(charges / margePct) : null;
  const jourDuMois = Number(auj.slice(8, 10)), nbJours = new Date(Date.UTC(Number(auj.slice(0, 4)), Number(auj.slice(5, 7)), 0)).getUTCDate();
  const caJour = r.ventes.filter((v) => v.date === auj).reduce((sm, v) => sm + v.montant, 0);
  return {
    date: auj, produits,
    seuil: { mois, charges: arrondi(charges), margePct: Math.round(margePct * 1000) / 10, caSeuil, caMois: arrondi(ca), projection: jourDuMois > 0 ? arrondi((ca / jourDuMois) * nbJours) : 0, atteint: caSeuil != null && ca >= caSeuil },
    objectifs: { jour: arrondi(cfg.objectifJour), mois: arrondi(cfg.objectifMois), caJour: arrondi(caJour), caMois: arrondi(ca) }
  };
}

// ───────── Journée (rapport de fin de journée, pour la clôture de caisse) ─────────
function journee(donnees, date) {
  const r = calculer(donnees);
  const V = r.ventes.filter((v) => v.date === date);
  const D = (donnees.depenses || []).filter((x) => jour(x.date) === date).map((x) => ({ ...x, classe: classeDepense(x.categorie) }));
  const somme = (arr, f) => arr.reduce((sm, x) => sm + f(x), 0);
  const eEsp = /esp|caisse|cash/i;
  const modes = {};
  for (const v of V) { const k = v.paiement || (v.source === "site" ? "Commandes en ligne" : "Non précisé"); modes[k] = (modes[k] || 0) + v.montant; }
  const vend = {};
  for (const v of V) if (v.vendeur) vend[v.vendeur] = (vend[v.vendeur] || 0) + v.montant;
  const espVentes = somme(V.filter((v) => v.paiement === "Espèces" || (!v.paiement && v.source !== "site")), (v) => v.montant);
  const especeDep = (x) => !x.mode || eEsp.test(x.mode);
  const sorties = somme(D.filter((x) => (x.classe === "charge" || x.classe === "achat" || x.classe === "remb") && especeDep(x)), (x) => nombre(x.montant));
  const entrees = somme(D.filter((x) => x.classe === "apport" && especeDep(x)), (x) => nombre(x.montant));
  return {
    date, ca: arrondi(somme(V, (v) => v.montant)), qte: somme(V, (v) => v.qte),
    parPaiement: Object.keys(modes).map((k) => ({ nom: k, total: arrondi(modes[k]) })).sort((a, b) => b.total - a.total),
    parVendeur: Object.keys(vend).map((k) => ({ nom: k, total: arrondi(vend[k]) })).sort((a, b) => b.total - a.total),
    nbRecus: (donnees.recus || []).filter((x) => x && x.date === date).length,
    depenses: arrondi(somme(D.filter((x) => x.classe === "charge" || x.classe === "achat"), (x) => nombre(x.montant))),
    encaissEspeces: arrondi(espVentes), sortiesEspeces: arrondi(sorties), apportsEspeces: arrondi(entrees),
    especesAttendues: arrondi(espVentes + entrees - sorties)
  };
}

module.exports = { analyse, journee, CATEGORIES_DEPENSE, TYPES_PERTE, POINTS_VENTE_DEFAUT, CANAL_SITE, classeDepense, baseDe, produitsSuivis, calculer, stockAvant, bilan };
