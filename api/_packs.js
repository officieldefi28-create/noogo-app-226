// « Packs vendus » du comptage du soir : le responsable dit combien de packs ont été vendus,
// le site retire les pots correspondants des ventes trouvées au comptage et les compte comme packs.
// Ce qui reste est vendu à l'unité, au prix normal. Les remises et surplus de livraison suivent les mêmes règles que la caisse.
const S = require("./_store");
const U = require("./_suivi");
const { chargerCatalogue } = require("./_catalogue");

async function articles() {
  const [catalogue, config] = await Promise.all([chargerCatalogue(), S.getSuiviConfig()]);
  const liste = [];
  for (const p of catalogue) {
    if (!p || p.actif === false) continue;
    const pack = p.type === "pack", base = pack ? U.baseDe(p) : null;
    liste.push({ id: p.id, nom: p.nom, prix: Number(p.prix) || 0, type: pack ? "pack" : "produit",
      pots: pack ? Math.max(1, parseInt(p.packCount, 10) || 1) : 1,
      fixe: pack && p.packCompo ? p.packCompo : null, base: pack && base && base.id !== p.id ? base.id : null });
  }
  for (const p of (config && config.internes) || []) liste.push({ id: p.id, nom: p.nom, prix: Number(p.prix) || 0, type: "produit", pots: 1, fixe: null, base: null });
  return liste;
}

const prefixe = (jr) => "PS-" + jr + "-";

async function calculer(donnees, jr, items, packs) {
  const art = await articles(), parId = {}; art.forEach((a) => (parId[a.id] = a));
  const d2 = { ...donnees, ventes: (donnees.ventes || []).filter((v) => !String(v.id || "").startsWith(prefixe(jr))), depenses: (donnees.depenses || []).filter((x) => !String(x.id || "").startsWith(prefixe(jr))) };
  const avant = U.stockAvant(d2, jr);
  const vendu = {};
  for (const it of items || []) {
    if (!it || it.restant === "" || it.restant === null || it.restant === undefined) continue;
    const pid = String(it.produitId || ""), r = Math.max(0, Math.round(Number(it.restant) || 0));
    vendu[pid] = Math.max(0, Math.round(avant[pid] || 0) - r);
  }
  const voulus = (Array.isArray(packs) ? packs : []).map((p) => ({ a: parId[String(p && p.id)], qte: Math.round(Number(p && p.qte) || 0) })).filter((p) => p.a && p.a.type === "pack" && p.qte > 0 && p.qte <= 500);
  const besoin = {}, parPack = [];
  const prend = (alloc, p, q) => { alloc[p] = (alloc[p] || 0) + q; besoin[p] = (besoin[p] || 0) + q; };
  for (const v of voulus) {
    const alloc = {};
    if (v.a.base) prend(alloc, v.a.base, v.a.pots * v.qte);
    else if (v.a.fixe) for (const k of Object.keys(v.a.fixe)) prend(alloc, k, Math.round(Number(v.a.fixe[k]) || 0) * v.qte);
    parPack.push({ v, alloc });
  }
  for (const k of Object.keys(besoin)) if (besoin[k] > (vendu[k] || 0)) {
    const nom = parId[k] ? parId[k].nom.replace(/^Crème glacée /, "") : k;
    if (!(k in vendu)) throw new Error("Comptez d'abord le reste de « " + nom + " » (cases « Reste » plus haut) : le site en a besoin pour calculer les packs.");
    throw new Error("Il faut " + besoin[k] + " pots « " + nom + " » vendus pour ces packs, mais le comptage n'en montre que " + vendu[k] + ". Vérifiez le reste compté ou le nombre de packs.");
  }
  for (const pp of parPack) if (!pp.v.a.base && !pp.v.a.fixe) {          // pack au choix : on prend les saveurs les plus vendues restantes
    for (let i = 0; i < pp.v.a.pots * pp.v.qte; i++) {
      let meilleur = "", reste = 0;
      for (const k of Object.keys(vendu)) { const r = vendu[k] - (besoin[k] || 0); if (r > reste && parId[k] && parId[k].type === "produit") { reste = r; meilleur = k; } }
      if (!meilleur) throw new Error("Pas assez de pots vendus pour « " + pp.v.a.nom + " » (il en faut " + pp.v.a.pots * pp.v.qte + ").");
      prend(pp.alloc, meilleur, 1);
    }
  }
  let remiseTot = 0, suppTot = 0, montantPacks = 0, potsEnPacks = 0;
  const lesPacks = parPack.map(({ v, alloc }) => {
    const ids = Object.keys(alloc), plein = ids.reduce((s, i) => s + (parId[i] ? parId[i].prix : 0) * alloc[i], 0), montant = v.a.prix * v.qte;
    const remise = plein > montant ? plein - montant : 0, supp = montant > plein ? montant - plein : 0;
    remiseTot += remise; suppTot += supp; montantPacks += montant; potsEnPacks += v.a.pots * v.qte;
    return { id: v.a.id, nom: v.a.nom, qte: v.qte, pots: v.a.pots * v.qte, montant, remise, supp, plein, lignes: ids.map((i) => ({ produitId: i, nom: parId[i] ? parId[i].nom.replace(/^Crème glacée /, "") : i, qte: alloc[i] })) };
  });
  const unites = Object.keys(vendu).map((k) => ({ produitId: k, nom: parId[k] ? parId[k].nom.replace(/^Crème glacée /, "") : k, qte: vendu[k] - (besoin[k] || 0), prix: parId[k] ? parId[k].prix : 0 })).filter((x) => x.qte > 0);
  return { jour: jr, venduTotal: Object.keys(vendu).reduce((s, k) => s + vendu[k], 0), packs: lesPacks, potsEnPacks, montantPacks, remiseTot, suppTot, unites, unitesTotal: unites.reduce((s, x) => s + x.qte, 0), montantUnites: unites.reduce((s, x) => s + x.qte * x.prix, 0) };
}

async function ecrire(jr, res, pointVente) {
  for (const v of await S.suiviListe("ventes")) if (v && String(v.id || "").startsWith(prefixe(jr))) await S.suiviDel("ventes", v.id);
  for (const x of await S.suiviListe("depenses")) if (x && String(x.id || "").startsWith(prefixe(jr))) await S.suiviDel("depenses", x.id);
  let k = 0;
  for (const p of res.packs) {
    let premier = true;
    for (const l of p.lignes) {
      const prix = (await articles()).find((a) => a.id === l.produitId);
      const id = prefixe(jr) + (++k);
      await S.suiviSet("ventes", id, { id, date: jr, produitId: l.produitId, qte: l.qte, montant: (prix ? prix.prix : 0) * l.qte, supp: premier ? p.supp : 0, pointVente: pointVente || "", vendeur: "", vid: "", paiement: "Comptage du soir", recuId: "", attente: false, packId: p.id, packNom: p.nom, packQte: p.qte, cree: new Date().toISOString() });
      premier = false;
    }
  }
  if (res.remiseTot > 0) await S.suiviSet("depenses", prefixe(jr) + "rem", { id: prefixe(jr) + "rem", date: jr, categorie: "Remise sur packs", description: "Remise sur packs · comptage du soir " + jr, montant: res.remiseTot, mode: "", auto: true, attente: false, cree: new Date().toISOString() });
  const doc = (await S.getDoc("packs_soir")) || {};
  if (res.packs.length) doc[jr] = res.packs.map((p) => ({ id: p.id, nom: p.nom, qte: p.qte, pots: p.pots })); else delete doc[jr];
  await S.setDoc("packs_soir", doc);
}

module.exports = { calculer, ecrire, articles };
