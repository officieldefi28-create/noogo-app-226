/* Noogó — onglet « Suivi » de l'admin : ventes, stock, production, dépenses, bilan.
   Tout est calculé par le serveur (/api/suivi) ; cette page n'affiche et n'envoie que des faits. */
(function () {
"use strict";
var A = window.NOOGO_ADMIN;
if (!A) return;
var $ = function (id) { return document.getElementById(id); };
var esc = A.esc;
var fcfa = function (n) { n = Math.round(Number(n) || 0); return n.toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F"; };
var signe = function (n) { return (n > 0 ? "+" : "") + fcfa(n); };
var jourJ = function (dx) { var d = new Date(Date.now() + (dx || 0) * 86400000); return d.toISOString().slice(0, 10); };
var dateFr = function (d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : d; };

var E = { vue: null, sous: "resume", periode: "mois", du: "", au: "", ouvert: null, soir: null, soirDate: jourJ(0), message: "", nbLignesLot: 1 };
var timer = null;

/* ---------- styles propres à l'onglet ---------- */
var css = document.createElement("style");
css.textContent = [
  "#p-suivi .sous{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}",
  "#p-suivi .sous::-webkit-scrollbar{display:none}",
  "#p-suivi .sous button{flex:0 0 auto;border:1.5px solid var(--bord);background:#fff;border-radius:999px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;color:var(--brun-3);min-height:44px}",
  "#p-suivi .sous button[aria-pressed=true]{background:var(--brun);color:var(--or-clair);border-color:var(--brun)}",
  "#p-suivi .kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}",
  "#p-suivi .kpi{background:#fff;border:1px solid var(--bord);border-radius:14px;padding:12px 14px}",
  "#p-suivi .kpi small{display:block;color:var(--gris);font-size:12.5px;font-weight:600}",
  "#p-suivi .kpi b{display:block;font-size:20px;font-family:var(--police-titre);margin-top:2px}",
  "#p-suivi .kpi.gros{grid-column:1/-1;background:var(--brun);color:#fff;border-color:var(--brun)}",
  "#p-suivi .kpi.gros small{color:var(--or-clair)}#p-suivi .kpi.gros b{font-size:28px;color:#fff}",
  "#p-suivi .pos{color:#1b7a34}#p-suivi .neg{color:#c62828}",
  "#p-suivi table{width:100%;border-collapse:collapse;font-size:14px}",
  "#p-suivi th{text-align:left;font-size:12px;color:var(--gris);font-weight:700;padding:6px 6px;border-bottom:1px solid var(--bord)}",
  "#p-suivi td{padding:8px 6px;border-bottom:1px solid #f0e6c8;vertical-align:middle}",
  "#p-suivi td.n,#p-suivi th.n{text-align:right;white-space:nowrap}",
  "#p-suivi .bar{height:10px;border-radius:6px;background:linear-gradient(90deg,#1f5a2e,#c9982b);min-width:2px}",
  "#p-suivi .ligne-j{display:grid;grid-template-columns:48px 1fr 84px;gap:8px;align-items:center;font-size:13px;margin:6px 0}",
  "#p-suivi .rang{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #f0e6c8;font-size:14px}",
  "#p-suivi .rang .g{min-width:0}#p-suivi .rang .g small{display:block;color:var(--gris);font-size:12.5px}",
  "#p-suivi .grille2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
  "#p-suivi .soir input.reste{width:84px;text-align:center;font-weight:700;font-size:18px;min-height:46px}",
  "#p-suivi .formulaire{border:2px solid var(--or);border-radius:14px;padding:14px;background:#fffdf4;margin:10px 0}",
  "#p-suivi h3{margin:0 0 8px}",
  "#p-suivi .astuce{font-size:13px;color:var(--gris);margin:0 0 10px}"
].join("");
document.head.appendChild(css);

/* ---------- appels ---------- */
function appel(action, extra) {
  var corps = Object.assign({ action: action, jeton: A.jeton() }, periodeCourante(), extra || {});
  return fetch("/api/suivi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
    .catch(function () { throw new Error("Pas de connexion internet."); })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { A.deconnecter(d.erreur || "Session expirée, reconnectez-vous."); var e = new Error("session"); e.silencieux = true; throw e; }
        if (!r.ok) throw new Error(d.erreur || ("Erreur " + r.status));
        return d;
      });
    });
}
function periodeCourante() {
  var p = E.periode, t = jourJ(0), debutMois = t.slice(0, 8) + "01";
  if (p === "jour") return { du: t, au: t };
  if (p === "semaine") return { du: jourJ(-6), au: t };
  if (p === "mois") return { du: debutMois, au: t };
  if (p === "mois-dernier") {
    var d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    var fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { du: d.toISOString().slice(0, 10), au: fin.toISOString().slice(0, 10) };
  }
  if (p === "perso") return { du: E.du, au: E.au };
  return { du: "", au: "" };
}
function charge(action, extra, ok) {
  return appel(action, extra).then(function (d) { E.vue = d; if (ok) ok(d); rendre(); return d; })
    .catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); throw e; });
}
function rafraichir() { return charge("lire").catch(function () {}); }

/* ---------- ouverture ---------- */
function ouvrir() {
  var c = $("p-suivi");
  if (!c.dataset.pret) { c.dataset.pret = "1"; c.addEventListener("click", clic); c.addEventListener("change", change); }
  if (!E.vue) c.innerHTML = '<p class="gris">Chargement du suivi…</p>';
  rafraichir();
  clearInterval(timer);
  timer = setInterval(function () { if (document.hidden || !$("p-suivi").classList.contains("actif") || E.ouvert) return; rafraichir(); }, 60000);
}

/* ---------- rendu ---------- */
var SOUS = [["resume", "Résumé"], ["soir", "Ce soir"], ["ventes", "Ventes"], ["stock", "Stock"], ["production", "Production"], ["depenses", "Dépenses"], ["params", "Réglages"]];
var PERIODES = [["jour", "Aujourd'hui"], ["semaine", "7 jours"], ["mois", "Ce mois"], ["mois-dernier", "Mois dernier"], ["tout", "Tout"], ["perso", "Dates…"]];

function rendre() {
  var c = $("p-suivi"), v = E.vue;
  if (!v) return;
  var nav = '<div class="sous" role="tablist">' + SOUS.map(function (s) { return '<button type="button" data-s="sous" data-v="' + s[0] + '" aria-pressed="' + (E.sous === s[0]) + '">' + s[1] + '</button>'; }).join("") + '</div>';
  var corps = { resume: vResume, soir: vSoir, ventes: vVentes, stock: vStock, production: vProduction, depenses: vDepenses, params: vParams }[E.sous](v);
  var sel = document.activeElement && document.activeElement.id;
  c.innerHTML = nav + (E.message ? '<div class="msg msg-ok">' + esc(E.message) + '</div>' : "") + corps;
  if (sel && $(sel)) { try { $(sel).focus(); } catch (e) {} }
}
function selPeriode() {
  return '<div class="sous">' + PERIODES.map(function (p) { return '<button type="button" data-s="periode" data-v="' + p[0] + '" aria-pressed="' + (E.periode === p[0]) + '">' + p[1] + '</button>'; }).join("") + '</div>' +
    (E.periode === "perso" ? '<div class="grille2" style="margin-bottom:10px"><div><label for="su-du">Du</label><input type="date" id="su-du" value="' + esc(E.du) + '"></div><div><label for="su-au">Au</label><input type="date" id="su-au" value="' + esc(E.au) + '"></div></div><button class="btn btn-brun btn-petit" type="button" data-s="appliquer-dates">Afficher</button>' : "");
}
function optionsProduits(v, vide) {
  return (vide ? '<option value="">' + vide + '</option>' : "") + v.produits.filter(function (p) { return p.actif || p.interne; }).map(function (p) { return '<option value="' + esc(p.id) + '" data-prix="' + p.prix + '">' + esc(p.nom) + '</option>'; }).join("");
}
function optionsPoints(v, vide) {
  return '<option value="">' + vide + '</option>' + v.config.pointsVente.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join("");
}

/* ----- Résumé ----- */
function vResume(v) {
  var b = v.bilan;
  var kpi = function (t, val, cls, extra) { return '<div class="kpi"><small>' + t + '</small><b class="' + (cls || "") + '">' + val + '</b>' + (extra ? '<small>' + extra + '</small>' : "") + '</div>'; };
  var jours = b.parJour.slice(-14), max = Math.max.apply(null, [1].concat(jours.map(function (j) { return j.ca; })));
  var h = selPeriode();
  h += '<div class="kpis"><div class="kpi gros"><small>Chiffre d\'affaires</small><b>' + fcfa(b.ca) + '</b><small>' + b.quantite + ' pièces vendues</small></div>' +
    kpi("Marge brute", fcfa(b.margeBrute), b.margeBrute >= 0 ? "pos" : "neg", b.margePct + " % du CA") +
    kpi("Résultat net", signe(b.resultat), b.resultat >= 0 ? "pos" : "neg", "après dépenses et pertes") +
    kpi("Dépenses", fcfa(b.charges)) + kpi("Pertes (au coût)", fcfa(b.pertes)) +
    kpi("Caisse actuelle", fcfa(b.caisse), b.caisse >= 0 ? "" : "neg", "depuis le départ réglé dans Réglages") + kpi("Valeur du stock", fcfa(b.valeurStock), "", "au coût de production") + '</div>';
  if (b.alertes.length) h += '<div class="msg msg-err"><b>Stock négatif :</b> ' + b.alertes.map(function (a) { return esc(a.nom) + " (" + a.theorique + ")"; }).join(", ") + '. Il manque une production ou un comptage : notez-les dans « Production » ou « Ce soir ».</div>';
  if (b.achats) h += '<p class="astuce">Achats de marchandises à revendre (hors résultat tant que non vendus) : ' + fcfa(b.achats) + '</p>';
  if (b.apports || b.remboursements) h += '<p class="astuce">Apports d\'argent : ' + fcfa(b.apports) + (b.remboursements ? ' · Remboursés : ' + fcfa(b.remboursements) : '') + '</p>';
  h += '<div class="carte"><h3>Ventes par jour</h3>' + (jours.length ? jours.map(function (j) {
    return '<div class="ligne-j"><span>' + esc(dateFr(j.date)) + '</span><div class="bar" style="width:' + Math.max(2, Math.round(j.ca / max * 100)) + '%"></div><b style="text-align:right">' + fcfa(j.ca) + '</b></div>';
  }).join("") : '<p class="gris">Aucune vente sur cette période.</p>') + '</div>';
  h += '<div class="carte"><h3>Par produit</h3>' + (b.parProduit.length ? '<table><tr><th>Produit</th><th class="n">Qté</th><th class="n">CA</th><th class="n">Marge</th></tr>' + b.parProduit.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + p.qte + '</td><td class="n">' + fcfa(p.ca) + '</td><td class="n ' + (p.marge >= 0 ? "pos" : "neg") + '">' + fcfa(p.marge) + '</td></tr>'; }).join("") + '</table>' : '<p class="gris">Rien pour le moment.</p>') + '</div>';
  h += '<div class="carte"><h3>Par point de vente</h3>' + (b.parPoint.length ? '<table><tr><th>Point</th><th class="n">Qté</th><th class="n">CA</th></tr>' + b.parPoint.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + p.qte + '</td><td class="n">' + fcfa(p.ca) + '</td></tr>'; }).join("") + '</table>' : '<p class="gris">Rien pour le moment.</p>') + '</div>';
  h += '<div class="carte"><h3>Dépenses par catégorie</h3>' + (b.parCategorie.length ? '<table>' + b.parCategorie.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + fcfa(p.total) + '</td></tr>'; }).join("") + '</table>' : '<p class="gris">Aucune dépense.</p>') + '</div>';
  return h;
}

/* ----- Ce soir (reste du jour) ----- */
function vSoir(v) {
  var s = E.soir;
  var h = '<div class="carte soir"><h3>Le reste du soir</h3><p class="astuce">Comptez ce qu\'il vous reste de chaque produit. Le logiciel calcule tout seul ce qui a été vendu, en tenant compte des commandes du site déjà livrées et des pertes notées. Laissez vide ce que vous ne comptez pas.</p>' +
    '<div class="grille2"><div><label for="so-date">Jour</label><input type="date" id="so-date" value="' + esc(E.soirDate) + '"></div>' +
    '<div><label for="so-pv">Point de vente (facultatif)</label><select id="so-pv">' + optionsPoints(v, "— non précisé —") + '</select></div></div>';
  if (!s || s.date !== E.soirDate) { h += '<p class="gris">Chargement…</p></div>'; chargerSoir(); return h; }
  h += '<table style="margin-top:12px"><tr><th>Produit</th><th class="n">Attendu</th><th class="n">Reste</th></tr>' + s.produits.map(function (p) {
    var deja = s.deja[p.id], att = s.avant[p.id] || 0;
    return '<tr><td>' + esc(p.nom) + '</td><td class="n ' + (att < 0 ? "neg" : "") + '">' + att + '</td><td class="n"><input class="reste" type="number" inputmode="numeric" min="0" data-pid="' + esc(p.id) + '" value="' + (deja ? deja.restant : "") + '" placeholder="—"></td></tr>';
  }).join("") + '</table><button class="btn btn-or btn-bloc" style="margin-top:14px" type="button" data-s="enregistrer-soir">Enregistrer le comptage</button>';
  var jour = (v.ventes || []).filter(function (x) { return x.date === E.soirDate; });
  if (jour.length && E.periode === "jour" || E.soirResume) {
    var tot = jour.reduce(function (a, x) { return a + x.montant; }, 0), q = jour.reduce(function (a, x) { return a + x.qte; }, 0);
    h += '<div class="msg msg-ok"><b>Ce jour-là :</b> ' + q + ' pièces vendues, ' + fcfa(tot) + '.</div>';
  }
  return h + '</div>';
}
function chargerSoir() {
  appel("stock_avant", { date: E.soirDate }).then(function (d) { E.soir = d; rendre(); }).catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); });
}

/* ----- Ventes + pertes ----- */
function vVentes(v) {
  var h = selPeriode();
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px"><button class="btn btn-or" type="button" data-s="ouvrir" data-v="vente">+ Vente</button><button class="btn btn-clair" type="button" data-s="ouvrir" data-v="perte">+ Perte / offert</button></div>';
  if (E.ouvert === "vente") {
    h += '<div class="formulaire"><h3>Nouvelle vente</h3><label for="fv-p">Produit</label><select id="fv-p">' + optionsProduits(v) + '</select>' +
      '<div class="grille2"><div><label for="fv-q">Quantité</label><input type="number" id="fv-q" inputmode="numeric" min="1" value="1"></div><div><label for="fv-d">Jour</label><input type="date" id="fv-d" value="' + jourJ(0) + '"></div></div>' +
      '<label for="fv-pv">Point de vente (facultatif)</label><select id="fv-pv">' + optionsPoints(v, "— non précisé —") + '</select>' +
      '<div class="grille2"><div><label for="fv-px">Prix unitaire (vide = prix du site)</label><input type="number" id="fv-px" inputmode="numeric" min="0"></div><div><label for="fv-r">Remise totale (F)</label><input type="number" id="fv-r" inputmode="numeric" min="0" value="0"></div></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-or" type="button" data-s="enregistrer-vente">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  if (E.ouvert === "perte") {
    h += '<div class="formulaire"><h3>Perte, offert ou dégustation</h3><label for="fp-p">Produit</label><select id="fp-p">' + optionsProduits(v) + '</select>' +
      '<div class="grille2"><div><label for="fp-q">Quantité</label><input type="number" id="fp-q" inputmode="numeric" min="1" value="1"></div><div><label for="fp-d">Jour</label><input type="date" id="fp-d" value="' + jourJ(0) + '"></div></div>' +
      '<label for="fp-t">Sorte</label><select id="fp-t">' + Object.keys(v.typesPerte).map(function (k) { return '<option value="' + k + '">' + esc(v.typesPerte[k]) + '</option>'; }).join("") + '</select>' +
      '<p class="astuce">Ce n\'est pas de l\'argent encaissé : le logiciel le compte au prix de revient.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-perte">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  var src = { site: ["Site", "badge-vert"], manuel: ["Noté", "badge-bleu"], comptage: ["Reste du soir", "badge-or"] };
  h += '<div class="carte"><h3>Ventes</h3>' + (v.ventes.length ? v.ventes.map(function (x) {
    var s = src[x.source];
    return '<div class="rang"><div class="g"><b>' + esc(x.nom) + '</b> × ' + x.qte + '<small>' + esc(dateFr(x.date)) + ' · ' + esc(x.canal) + ' <span class="badge ' + s[1] + '">' + s[0] + '</span></small></div><div style="text-align:right"><b>' + fcfa(x.montant) + '</b>' + (x.source === "manuel" ? '<br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="vente" data-id="' + esc(x.ref) + '">Supprimer</button>' : "") + '</div></div>';
  }).join("") : '<p class="gris">Aucune vente sur cette période.</p>') + '</div>';
  if (v.pertes.length) h += '<div class="carte"><h3>Pertes, offerts, dégustations</h3>' + v.pertes.map(function (x) {
    return '<div class="rang"><div class="g"><b>' + esc(x.nom) + '</b> × ' + x.qte + '<small>' + esc(dateFr(x.date)) + ' · ' + esc(v.typesPerte[x.type] || x.type) + '</small></div><div style="text-align:right"><b>' + fcfa(x.cout) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="perte" data-id="' + esc(x.ref) + '">Supprimer</button></div></div>';
  }).join("") + '</div>';
  return h;
}

/* ----- Stock ----- */
function vStock(v) {
  var h = '<div class="carte"><h3>Stock en ce moment</h3><p class="astuce">Production − ventes − pertes, recalé à chaque « reste du soir ».</p><table><tr><th>Produit</th><th class="n">Stock</th><th class="n">Valeur</th></tr>' +
    v.stock.filter(function (s) { return s.produit || s.vendu || s.theorique; }).map(function (s) {
      return '<tr><td>' + esc(s.nom) + '<br><small class="gris">' + (s.dernierComptage ? "compté le " + esc(dateFr(s.dernierComptage.date)) : "jamais compté") + '</small></td><td class="n ' + (s.theorique < 0 ? "neg" : "") + '"><b>' + s.theorique + '</b></td><td class="n">' + fcfa(s.valeur) + '</td></tr>';
    }).join("") + '</table></div>';
  if (v.ajustements.length) h += '<div class="carte"><h3>Surplus constatés au comptage</h3><p class="astuce">Vous aviez plus que prévu (production oubliée ?).</p>' + v.ajustements.map(function (a) { return '<div class="rang"><span>' + esc(dateFr(a.date)) + ' · ' + esc(a.nom) + '</span><b>+' + a.qte + '</b></div>'; }).join("") + '</div>';
  return h;
}

/* ----- Production ----- */
function vProduction(v) {
  var h = '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="lot">+ Nouvelle production</button>';
  if (E.ouvert === "lot") {
    h += '<div class="formulaire"><h3>Nouvelle production</h3><div class="grille2"><div><label for="fl-d">Jour</label><input type="date" id="fl-d" value="' + jourJ(0) + '"></div><div><label for="fl-n">Nom du lot</label><input type="text" id="fl-n" maxlength="60" placeholder="Ex : Baobab 3"></div></div>' +
      '<label for="fl-c">Dépenses totales du lot (F)</label><input type="number" id="fl-c" inputmode="numeric" min="0" placeholder="Ex : 34800">';
    for (var i = 0; i < E.nbLignesLot; i++) h += '<div class="grille2"><div><label>Produit</label><select class="fl-p">' + optionsProduits(v) + '</select></div><div><label>Quantité</label><input class="fl-q" type="number" inputmode="numeric" min="0" placeholder="Ex : 50"></div></div>';
    h += '<button class="btn btn-clair btn-petit" type="button" style="margin-top:8px" data-s="ligne-lot">+ Un autre format dans ce lot</button>' +
      '<p class="astuce">Le coût de revient de chaque pot = dépenses ÷ nombre total de pots. Il sert à calculer vos marges.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-lot">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  h += '<div class="carte" style="margin-top:12px"><h3>Productions</h3>' + (v.lots.length ? v.lots.map(function (l) {
    var noms = {}; v.produits.forEach(function (p) { noms[p.id] = p.nom; });
    return '<div class="rang"><div class="g"><b>' + esc(l.nom) + '</b> · ' + esc(dateFr(l.date)) + '<small>' + l.lignes.map(function (x) { return x.qte + " × " + esc(noms[x.produitId] || x.produitId); }).join(" · ") + '<br>Coût de revient : ' + fcfa(l.coutUnitaire) + ' / pot</small></div><div style="text-align:right"><b>' + fcfa(l.cout) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="lot" data-id="' + esc(l.id) + '">Supprimer</button></div></div>';
  }).join("") : '<p class="gris">Aucune production notée.</p>') + '</div>';
  return h;
}

/* ----- Dépenses ----- */
function vDepenses(v) {
  var p = periodeCourante();
  var liste = v.depenses.filter(function (d) { return (!p.du || d.date >= p.du) && (!p.au || d.date <= p.au); });
  var h = selPeriode() + '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="depense">+ Dépense ou apport</button>';
  if (E.ouvert === "depense") {
    h += '<div class="formulaire"><h3>Dépense ou apport d\'argent</h3><div class="grille2"><div><label for="fd-d">Jour</label><input type="date" id="fd-d" value="' + jourJ(0) + '"></div><div><label for="fd-m">Montant (F)</label><input type="number" id="fd-m" inputmode="numeric" min="1"></div></div>' +
      '<label for="fd-c">Catégorie</label><select id="fd-c">' + v.categories.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join("") + '</select>' +
      '<label for="fd-t">Description</label><input type="text" id="fd-t" maxlength="120" placeholder="Ex : Gaz, impression, salaire de Hamed…">' +
      '<label for="fd-mode">Paiement (facultatif)</label><select id="fd-mode"><option value="">—</option><option>Espèces</option><option>Orange Money</option><option>Moov Money</option><option>Wave</option><option>Autre</option></select>' +
      '<p class="astuce">Les productions se notent dans « Production » (pas ici), pour ne pas compter deux fois.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-depense">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  h += '<div class="carte" style="margin-top:12px"><h3>Dépenses</h3>' + (liste.length ? liste.map(function (d) {
    var plus = d.classe === "apport";
    return '<div class="rang"><div class="g"><b>' + esc(d.description || d.categorie) + '</b><small>' + esc(dateFr(d.date)) + ' · ' + esc(d.categorie) + (d.mode ? " · " + esc(d.mode) : "") + '</small></div><div style="text-align:right"><b class="' + (plus ? "pos" : "") + '">' + (plus ? "+" : "") + fcfa(d.montant) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="depense" data-id="' + esc(d.id) + '">Supprimer</button></div></div>';
  }).join("") : '<p class="gris">Aucune dépense sur cette période.</p>') + '</div>';
  return h;
}

/* ----- Réglages ----- */
function vParams(v) {
  var c = v.config;
  var h = '<div class="carte"><h3>Caisse</h3><p class="astuce">Argent que vous aviez en caisse à la date de départ. La caisse actuelle = ce départ + ventes − productions − dépenses + apports.</p>' +
    '<div class="grille2"><div><label for="pa-cd">Caisse de départ (F)</label><input type="number" id="pa-cd" inputmode="numeric" value="' + c.caisseDepart + '"></div><div><label for="pa-dep">À partir du</label><input type="date" id="pa-dep" value="' + esc(c.depuis) + '"></div></div></div>';
  h += '<div class="carte"><h3>Points de vente</h3><p class="astuce">Un par ligne. Facultatif : « En ligne » existe toujours (commandes du site).</p><textarea id="pa-pv" rows="4">' + esc(c.pointsVente.join("\n")) + '</textarea></div>';
  h += '<div class="carte"><h3>Coût de revient par défaut</h3><p class="astuce">Utilisé seulement tant qu\'aucune production n\'est notée pour ce produit (sinon c\'est le coût réel des lots).</p>' +
    v.produits.filter(function (p) { return p.actif || p.interne; }).map(function (p) { return '<div class="rang"><span style="flex:1">' + esc(p.nom) + '</span><input type="number" inputmode="numeric" min="0" style="width:110px;min-height:40px" data-cout="' + esc(p.id) + '" value="' + (c.couts[p.id] || "") + '" placeholder="0"></div>'; }).join("") + '</div>';
  h += '<div class="carte"><h3>Produits non vendus sur le site</h3><p class="astuce">Ex : un petit pot à 400 F, des esquimaux… Ils sont suivis (stock, marge) mais n\'apparaissent pas sur le site.</p>' +
    c.internes.map(function (p, i) { return '<div class="grille2" style="margin-bottom:6px;align-items:center"><input type="text" data-int-nom="' + i + '" value="' + esc(p.nom) + '"><div style="display:flex;gap:6px"><input type="number" inputmode="numeric" min="0" data-int-prix="' + i + '" value="' + p.prix + '"><button class="btn btn-clair btn-petit" type="button" data-s="retirer-interne" data-i="' + i + '">✕</button></div></div>'; }).join("") +
    '<div class="grille2" style="align-items:center"><input type="text" id="pa-in-nom" placeholder="Nom du produit"><input type="number" id="pa-in-prix" inputmode="numeric" min="0" placeholder="Prix (F)"></div></div>';
  h += '<button class="btn btn-or btn-bloc" type="button" data-s="enregistrer-params">Enregistrer les réglages</button>';
  h += '<div class="carte" style="margin-top:14px"><h3>Exporter</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-brun btn-petit" type="button" data-s="export" data-v="ventes">Ventes (CSV)</button><button class="btn btn-brun btn-petit" type="button" data-s="export" data-v="depenses">Dépenses (CSV)</button><button class="btn btn-brun btn-petit" type="button" data-s="export" data-v="stock">Stock (CSV)</button></div><p class="astuce" style="margin-top:8px">S\'ouvre dans Excel ou Google Sheets (pour votre comptable).</p></div>';
  h += '<div class="carte"><h3>Reprendre mon ancien classeur</h3><p class="astuce">Ajoute les productions, ventes, dépenses et pertes du 03 au 08 octobre déjà notées dans votre classeur. À faire une seule fois (refaire ne crée pas de doublons).</p><button class="btn btn-clair" type="button" data-s="importer">Reprendre l\'historique</button></div>';
  return h;
}

/* ---------- actions ---------- */
function val(id) { var e = $(id); return e ? e.value : ""; }
function ok(msg) { E.message = ""; A.toast(msg, "ok"); }
function envoyer(action, extra, msg, fin) {
  return charge(action, extra).then(function () { E.ouvert = null; ok(msg); if (fin) fin(); rendre(); }).catch(function () {});
}
function paramsLus() {
  var c = JSON.parse(JSON.stringify(E.vue.config));
  c.caisseDepart = Number(val("pa-cd")) || 0; c.depuis = val("pa-dep");
  c.pointsVente = val("pa-pv").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
  c.couts = {}; document.querySelectorAll("[data-cout]").forEach(function (e) { if (e.value !== "") c.couts[e.getAttribute("data-cout")] = Number(e.value) || 0; });
  document.querySelectorAll("[data-int-nom]").forEach(function (e) { c.internes[+e.getAttribute("data-int-nom")].nom = e.value; });
  document.querySelectorAll("[data-int-prix]").forEach(function (e) { c.internes[+e.getAttribute("data-int-prix")].prix = Number(e.value) || 0; });
  var nom = val("pa-in-nom").trim();
  if (nom) {
    var id = nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "produit";
    while (E.vue.produits.some(function (p) { return p.id === id; }) || c.internes.some(function (p) { return p.id === id; })) id += "-2";
    c.internes.push({ id: id, nom: nom, prix: Number(val("pa-in-prix")) || 0 });
  }
  return c;
}
function csv(lignes, colonnes) {
  var q = function (x) { x = x == null ? "" : String(x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  return "﻿" + [colonnes.map(function (c) { return q(c[1]); }).join(";")].concat(lignes.map(function (l) { return colonnes.map(function (c) { return q(l[c[0]]); }).join(";"); })).join("\r\n");
}
function telecharger(nom, contenu) {
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" })); a.download = nom;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function clic(ev) {
  var t = ev.target.closest("[data-s]"); if (!t) return;
  var a = t.getAttribute("data-s"), v = t.getAttribute("data-v");
  E.message = "";
  switch (a) {
    case "sous": E.sous = v; E.ouvert = null; return rendre();
    case "periode": E.periode = v; if (v === "perso") { E.du = E.du || jourJ(-30); E.au = E.au || jourJ(0); return rendre(); } return rafraichir();
    case "appliquer-dates": E.du = val("su-du"); E.au = val("su-au"); return rafraichir();
    case "ouvrir": E.ouvert = E.ouvert === v ? null : v; if (v === "lot") E.nbLignesLot = 1; return rendre();
    case "fermer": E.ouvert = null; return rendre();
    case "ligne-lot": E.nbLignesLot++; var prev = { d: val("fl-d"), n: val("fl-n"), c: val("fl-c"), p: [].map.call(document.querySelectorAll(".fl-p"), function (e) { return e.value; }), q: [].map.call(document.querySelectorAll(".fl-q"), function (e) { return e.value; }) }; rendre();
      $("fl-d").value = prev.d; $("fl-n").value = prev.n; $("fl-c").value = prev.c; document.querySelectorAll(".fl-p").forEach(function (e, i) { if (prev.p[i]) e.value = prev.p[i]; }); document.querySelectorAll(".fl-q").forEach(function (e, i) { if (prev.q[i]) e.value = prev.q[i]; }); return;
    case "enregistrer-vente": return envoyer("ajouter_vente", { date: val("fv-d"), produitId: val("fv-p"), qte: val("fv-q"), pointVente: val("fv-pv"), prix: val("fv-px"), remise: val("fv-r") }, "Vente enregistrée");
    case "enregistrer-perte": return envoyer("ajouter_perte", { date: val("fp-d"), produitId: val("fp-p"), qte: val("fp-q"), type: val("fp-t") }, "Perte enregistrée");
    case "enregistrer-depense": return envoyer("ajouter_depense", { date: val("fd-d"), categorie: val("fd-c"), description: val("fd-t"), montant: val("fd-m"), mode: val("fd-mode") }, "Dépense enregistrée");
    case "enregistrer-lot":
      var lignes = [].map.call(document.querySelectorAll(".fl-p"), function (e, i) { return { produitId: e.value, qte: document.querySelectorAll(".fl-q")[i].value }; });
      return envoyer("ajouter_lot", { date: val("fl-d"), nom: val("fl-n"), cout: val("fl-c"), lignes: lignes }, "Production enregistrée");
    case "enregistrer-soir":
      var items = [].map.call(document.querySelectorAll("input.reste"), function (e) { return { produitId: e.getAttribute("data-pid"), restant: e.value }; });
      E.soirResume = true;
      return charge("comptage", { date: E.soirDate, pointVente: val("so-pv"), items: items, du: E.soirDate, au: E.soirDate }).then(function () { E.soir = null; ok("Comptage enregistré"); chargerSoir(); }).catch(function () {});
    case "supprimer":
      if (!confirm("Supprimer cette ligne ? Les chiffres seront recalculés.")) return;
      return envoyer("supprimer", { type: t.getAttribute("data-t"), id: t.getAttribute("data-id") }, "Supprimé", function () { E.soir = null; });
    case "retirer-interne": var c = paramsLus(); c.internes.splice(+t.getAttribute("data-i"), 1); return envoyer("config", { config: c }, "Réglages enregistrés");
    case "enregistrer-params": return envoyer("config", { config: paramsLus() }, "Réglages enregistrés");
    case "importer":
      if (!confirm("Reprendre l'historique du 03 au 08 octobre depuis votre ancien classeur ?")) return;
      return envoyer("importer_historique", {}, "Historique repris : consultez le Résumé");
    case "export":
      return appel("export").then(function (d) {
        if (v === "ventes") telecharger("noogo-ventes.csv", csv(d.ventes, [["date", "Date"], ["nom", "Produit"], ["qte", "Quantité"], ["montant", "Chiffre d'affaires (F)"], ["cout", "Coût (F)"], ["canal", "Point de vente"], ["source", "Origine"]]));
        if (v === "depenses") telecharger("noogo-depenses.csv", csv(d.depenses, [["date", "Date"], ["categorie", "Catégorie"], ["description", "Description"], ["montant", "Montant (F)"], ["mode", "Paiement"]]));
        if (v === "stock") telecharger("noogo-stock.csv", csv(d.stock, [["nom", "Produit"], ["theorique", "Stock"], ["coutMoyen", "Coût moyen (F)"], ["valeur", "Valeur (F)"]]));
      }).catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); });
  }
}
function change(ev) {
  var t = ev.target;
  if (t.id === "so-date") { E.soirDate = t.value || jourJ(0); E.soir = null; E.soirResume = false; rendre(); }
  if (t.id === "fv-p") { var o = t.options[t.selectedIndex]; if ($("fv-px")) $("fv-px").placeholder = "Prix du site : " + (o ? o.getAttribute("data-prix") : ""); }
}

window.SuiviUI = { ouvrir: ouvrir };
})();
