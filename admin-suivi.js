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

var E = { vue: null, sous: "resume", periode: "mois", du: "", au: "", ouvert: null, soir: null, soirDate: jourJ(0), message: "", nbLignesLot: 1, ouv: {}, saisie: null, plus: null, fiche: null, edit: null, autres: false };
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
  "#p-suivi .astuce{font-size:13px;color:var(--gris);margin:0 0 10px}",
  "#p-suivi .sous.principal{gap:4px;overflow:visible;position:sticky;top:52px;z-index:20;background:var(--creme,#fbf6e9);padding:8px 0}",
  "#p-suivi .sous.principal button{flex:1 1 0;padding:9px 4px;border-radius:12px;font-size:14px;text-align:center}",
  "#p-suivi .ligne-edit{display:flex;gap:8px;align-items:center;margin:6px 0}#p-suivi .ligne-edit span{flex:1}#p-suivi .ligne-edit input{width:90px;text-align:right}",
  "#p-suivi .pastille{display:inline-block;background:#c62828;color:#fff;border-radius:999px;font-size:11px;min-width:18px;padding:1px 5px;margin-left:2px}",
  "#p-suivi details.rep{background:#fff;border:1px solid var(--bord);border-radius:14px;margin:8px 0;padding:0 14px}",
  "#p-suivi details.rep summary{cursor:pointer;font-weight:700;color:var(--brun-3);padding:14px 0;list-style:none;display:flex;justify-content:space-between;align-items:center;min-height:44px}",
  "#p-suivi details.rep summary::-webkit-details-marker{display:none}",
  "#p-suivi details.rep summary::after{content:'▾';color:var(--gris);font-size:13px}",
  "#p-suivi details.rep[open] summary::after{content:'▴'}",
  "#p-suivi details.rep .corps{padding:0 0 12px}",
  "#p-suivi .tuiles-ajout{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
  "#p-suivi .tuiles-ajout button{background:#fff;border:1.5px solid var(--bord);border-radius:16px;padding:16px 12px;text-align:left;cursor:pointer;min-height:112px;display:flex;flex-direction:column;gap:2px}",
  "#p-suivi .tuiles-ajout button:active{background:#f6efe0}",
  "#p-suivi .tuiles-ajout i{font-style:normal;font-size:26px}#p-suivi .tuiles-ajout b{font-size:16px;color:var(--brun)}#p-suivi .tuiles-ajout small{color:var(--gris);font-size:12.5px;line-height:1.25}",
  "#p-suivi .membre{border:1.5px solid var(--bord);border-radius:14px;padding:12px;margin:10px 0;background:#fffdf4}#p-suivi .membre.inactif{opacity:.6}",
  "#p-suivi .menu-plus{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;background:#fff;border:1.5px solid var(--bord);border-radius:14px;padding:14px 16px;margin:8px 0 0;cursor:pointer;min-height:60px}",
  "#p-suivi .menu-plus b{display:block;font-size:16px;color:var(--brun)}#p-suivi .menu-plus small{display:block;color:var(--gris);font-size:13px;margin-top:2px}",
  "#p-suivi .retour-plus{display:inline-flex;align-items:center;border:0;background:none;color:var(--brun-3);font-weight:700;font-size:15px;padding:6px 0 10px;cursor:pointer;min-height:44px}"
].join("");
document.head.appendChild(css);

/* ---------- appels ---------- */
function appel(action, extra) {
  var corps = Object.assign({ action: action, jeton: A.jeton(), jourCloture: E.jourCloture || "" }, periodeCourante(), extra || {});
  return fetch("/api/suivi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
    .catch(function () { throw new Error("Pas de connexion internet."); })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { A.deconnecter(d.erreur || "Session expirée, reconnectez-vous."); var e = new Error("session"); e.silencieux = true; throw e; }
        if (!r.ok) throw new Error(d.erreur === "Action non reconnue" ? "Le serveur du site n'est pas à jour (mise à jour pas encore en ligne sur Vercel). Attendez 2 minutes puis rechargez la page." : (d.erreur || ("Erreur " + r.status)));
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
  if (p === "hier") { var h1 = jourJ(-1); return { du: h1, au: h1 }; }
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
  if (!c.dataset.pret) {
    c.dataset.pret = "1"; c.addEventListener("click", clic); c.addEventListener("change", change);
    c.addEventListener("toggle", function (ev) { var d = ev.target; if (d && d.classList && d.classList.contains("rep")) E.ouv[d.getAttribute("data-t")] = d.open; }, true);
  }
  if (!E.vue) c.innerHTML = '<p class="gris">Chargement du suivi…</p>';
  rafraichir();
  clearInterval(timer);
  timer = setInterval(function () { if (document.hidden || !$("p-suivi").classList.contains("actif") || E.ouvert || E.depart) return; rafraichir(); }, 60000);
}

/* ---------- rendu ---------- */
/* Cinq entrées seulement : tout le reste est rangé dans « Ajouter » et « Plus » */
var SOUS = [["resume", "Résumé"], ["ajout", "Ajouter"], ["equipe", "Équipe"], ["stock", "Stock"], ["plus", "Plus"]];
var PERIODES = [["jour", "Aujourd'hui"], ["hier", "Hier"], ["semaine", "7 jours"], ["mois", "Ce mois"]];
var PERIODES_PLUS = [["mois-dernier", "Mois dernier"], ["tout", "Tout"], ["perso", "Dates…"]];

function rendre() {
  var c = $("p-suivi"), v = E.vue;
  if (!v) return;
  if (E.sous === "equipe") lireEq();
  var nav = '<div class="sous principal" role="tablist">' + SOUS.map(function (s) { return '<button type="button" data-s="sous" data-v="' + s[0] + '" aria-pressed="' + (E.sous === s[0]) + '">' + s[1] + (s[0] === "equipe" && nbDemandes(v) ? ' <span class="pastille">' + nbDemandes(v) + '</span>' : "") + '</button>'; }).join("") + '</div>';
  var corps = { resume: vResume, ajout: vAjout, equipe: vEquipe, stock: vStockOnglet, plus: vPlus }[E.sous](v);
  var sel = document.activeElement && document.activeElement.id;
  c.innerHTML = nav + (E.message ? '<div class="msg msg-ok">' + esc(E.message) + '</div>' : "") + corps;
  if (sel && $(sel)) { try { $(sel).focus(); } catch (e) {} }
}
var DEPUIS_CONFIRM = "2026-10-24";
function recuAConfirmer(r) { return !r.du && r.paiement && r.paiement !== "Espèces" && r.verifie !== true && (r.verifie === false || String(r.date || "").slice(0, 10) >= DEPUIS_CONFIRM); }
function nbPaiements(v) { return (v.livraisons || []).filter(function (l) { return l.aConfirmer; }).length + (v.recus || []).filter(recuAConfirmer).length; }
function nbDemandes(v) { return (v.demandes || []).filter(function (d) { return d.statut === "attente"; }).length + nbPaiements(v) + nbAValider(v); }
/* Bloc repliable : l'état ouvert/fermé est retenu même quand la page se met à jour */
function repliable(titre, corps, ouvert) {
  var o = E.ouv[titre] != null ? E.ouv[titre] : !!ouvert;
  return '<details class="rep" data-t="' + esc(titre) + '"' + (o ? " open" : "") + '><summary>' + titre + '</summary><div class="corps">' + corps + '</div></details>';
}
function selPeriode() {
  var extra = PERIODES_PLUS.some(function (p) { return p[0] === E.periode; });
  var bouton = function (p) { return '<button type="button" data-s="periode" data-v="' + p[0] + '" aria-pressed="' + (E.periode === p[0]) + '">' + p[1] + '</button>'; };
  return '<div class="sous">' + PERIODES.map(bouton).join("") + '<button type="button" data-s="autres" aria-pressed="' + (extra || !!E.autres) + '">Autres ▾</button></div>' +
    (extra || E.autres ? '<div class="sous">' + PERIODES_PLUS.map(bouton).join("") + '</div>' : "") +
    (E.periode === "perso" ? '<div class="grille2" style="margin-bottom:10px"><div><label for="su-du">Du</label><input type="date" id="su-du" value="' + esc(E.du) + '"></div><div><label for="su-au">Au</label><input type="date" id="su-au" value="' + esc(E.au) + '"></div></div>' : "");
}
function optionsProduits(v, vide) {
  return (vide ? '<option value="">' + vide + '</option>' : "") + v.produits.filter(function (p) { return p.actif || p.interne; }).map(function (p) { return '<option value="' + esc(p.id) + '" data-prix="' + p.prix + '">' + esc(p.nom) + '</option>'; }).join("");
}
function optionsPoints(v, vide) {
  return '<option value="">' + vide + '</option>' + v.config.pointsVente.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join("");
}
function retour(texte, action, valeur) { return '<button class="retour-plus" type="button" data-s="' + action + '"' + (valeur != null ? ' data-v="' + valeur + '"' : "") + '>← ' + texte + '</button>'; }

/* Produits qui restent longtemps au congélateur : on suppose que les plus anciens sont vendus en premier */
var DLC_JOURS = 60;
function vieuxStock(v) {
  var out = [], lots = (v.lots || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  (v.stock || []).forEach(function (x) {
    var reste = Math.max(0, x.theorique || 0); if (!reste) return;
    var plusVieux = null;
    lots.forEach(function (l) { (l.lignes || []).forEach(function (g) { if (g.produitId !== x.id || reste <= 0) return; var q = Math.min(reste, Number(g.qte) || 0); if (q > 0) { reste -= q; plusVieux = { date: l.date, qte: q }; } }); });
    if (!plusVieux) return;
    var age = Math.floor((Date.parse(jourJ(0)) - Date.parse(plusVieux.date)) / 86400000);
    if (age >= DLC_JOURS) out.push({ nom: x.nom, age: age, qte: plusVieux.qte });
  });
  return out;
}

/* ----- Résumé : l'essentiel d'abord, le détail se déplie ----- */
function vResume(v) {
  var b = v.bilan;
  var kpi = function (t, val, cls, extra) { return '<div class="kpi"><small>' + t + '</small><b class="' + (cls || "") + '">' + val + '</b>' + (extra ? '<small>' + extra + '</small>' : "") + '</div>'; };
  var pr = v.precedent;
  var delta = function (now, avant) {
    if (!pr) return "";
    if (!avant) return now > 0 ? '<span class="delta">Nouveau (rien avant)</span>' : "";
    var p = Math.round((now - avant) / Math.abs(avant) * 100);
    return '<span class="delta ' + (p >= 0 ? "pos" : "neg") + '">' + (p >= 0 ? "▲ +" : "▼ ") + p + " % vs période d'avant</span>";
  };
  var h = selPeriode();
  h += '<div class="kpis"><div class="kpi gros"><small>Chiffre d\'affaires · ' + esc(nomPeriode()) + '</small><b>' + fcfa(b.ca) + '</b><small>' + b.quantite + ' pièces vendues</small>' + (pr ? delta(b.ca, pr.ca) : "") + '</div>' +
    kpi("Résultat net", signe(b.resultat), b.resultat >= 0 ? "pos" : "neg", "ce que vous gagnez vraiment") +
    kpi("Caisse actuelle", fcfa(b.caisse), b.caisse >= 0 ? "" : "neg", "argent attendu en caisse") +
    kpi("Dépenses", fcfa(b.depensesTotales), "", b.production ? "dont production " + fcfa(b.production) : "frais, publicité, salaires…") +
    kpi("Marge brute", fcfa(b.margeBrute), b.margeBrute >= 0 ? "pos" : "neg", b.margePct + " % du CA") + '</div>';

  /* À surveiller : deux alertes visibles, le reste se déplie */
  var al = [];
  if (nbAValider(v)) al.push('<div class="alerte rouge"><b>' + nbAValider(v) + ' chose' + (nbAValider(v) > 1 ? 's' : '') + ' à valider :</b> ventes, production ou comptage envoyés par l\'équipe. Allez dans Équipe.</div>');
  (v.comptesEsp || []).filter(function (x) { return x.date >= jourJ(-2) && x.ecart < 0 && x.statut !== "accepte"; }).forEach(function (x) { al.push('<div class="alerte rouge"><b>Manque dans la caisse de ' + esc(x.vendeur) + ' :</b> ' + fcfa(-x.ecart) + ' le ' + esc(dateFr(x.date)) + '. Prévenez-la avant de valider.</div>'); });
  if (nbPaiements(v)) al.push('<div class="alerte rouge"><b>' + nbPaiements(v) + ' paiement' + (nbPaiements(v) > 1 ? 's' : '') + ' à confirmer :</b> vérifiez votre téléphone (65 12 09 02) puis allez dans Équipe › la personne.</div>');
  vieuxStock(v).forEach(function (x) { al.push('<div class="alerte rouge"><b>Produit gardé longtemps :</b> ' + esc(x.nom) + ' (' + x.qte + ' pots produits il y a ' + x.age + ' jours). Vérifiez la qualité et vendez-les en premier.</div>'); });
  var nomsOk = function (l) { return l.map(function (x) { return esc(x.nom) + " (" + x.theorique + ")"; }).join(", "); };
  if (b.alertes.length) al.push('<div class="alerte rouge"><b>Stock négatif :</b> ' + nomsOk(b.alertes) + '. Il manque une production ou un comptage.</div>');
  var bas = (v.stock || []).filter(function (x) { return x.actif && x.produit > 0 && x.theorique >= 0 && x.theorique <= 5; });
  if (bas.length) al.push('<div class="alerte"><b>Stock bas :</b> ' + nomsOk(bas) + ' — pensez à produire.</div>');
  var dernier = (v.comptages || []).length ? v.comptages[0].date : "";
  if ((v.ventes || []).length && dernier < jourJ(-1)) al.push('<div class="alerte"><b>Comptage du soir manquant :</b> dernier comptage ' + (dernier ? dateFr(dernier) : "jamais") + '. Sans lui, les ventes ne sont pas fiables.</div>');
  if (b.margeBrute < 0) al.push('<div class="alerte rouge"><b>Marge négative :</b> vous vendez moins cher que le coût de revient. Vérifiez les coûts dans Plus › Réglages.</div>');
  (v.controles || []).forEach(function (c) { if (c.titre === "Stock négatif") return; al.push('<div class="alerte' + (c.niveau === "rouge" ? " rouge" : "") + '"><b>' + esc(c.titre) + ' :</b> ' + esc(c.texte) + '</div>'); });
  if (!al.length && b.ca > 0) al.push('<div class="alerte vert">Tout est en ordre : pas de stock négatif, comptage à jour.</div>');
  h += al.slice(0, 2).join("");
  if (al.length > 2) h += repliable((al.length - 2) + " autre" + (al.length > 3 ? "s" : "") + " alerte" + (al.length > 3 ? "s" : ""), al.slice(2).join(""));

  h += '<div class="grille2" style="margin:10px 0"><button class="btn btn-vert" type="button" data-s="rapport-wa">Rapport WhatsApp</button><button class="btn btn-clair" type="button" data-s="vers" data-v="envoi">Envoyer / exporter</button></div>';

  /* Détail de la caisse : d'où vient chaque franc */
  var cd = b.caisseDetail || {};
  var lc = function (t, val, cls) { return '<div class="rang"><span>' + t + '</span><b class="' + (cls || "") + '">' + val + '</b></div>'; };
  var det = '<p class="astuce">Voici d\'où vient le chiffre « Caisse actuelle » (depuis ' + (cd.depuis ? dateFr(cd.depuis) : "le début") + ').</p>' +
    lc("Caisse de départ", fcfa(cd.depart)) + lc("+ Ventes encaissées", fcfa(cd.ventes), "pos") + (cd.rendu ? lc("+ Argent rendu (livreurs, clients)", fcfa(cd.rendu), "pos") : "") + (cd.nonEncaisse ? lc("(Vendu mais pas encore payé : " + fcfa(cd.nonEncaisse) + ", non compté)", "") : "") + lc("− Production (coût des lots)", fcfa(cd.production), "neg") + lc("− Dépenses", fcfa(cd.depenses), "neg") +
    (cd.achats ? lc("− Achats de marchandises", fcfa(cd.achats), "neg") : "") + (cd.apports ? lc("+ Apports d'argent", fcfa(cd.apports), "pos") : "") + (cd.remboursements ? lc("− Remboursements d'apport", fcfa(cd.remboursements), "neg") : "") +
    '<div class="rang" style="font-weight:800"><span>= Caisse actuelle</span><b>' + fcfa(b.caisse) + '</b></div>' +
    '<p class="astuce" style="margin-top:10px">Sur la période affichée : ventes ' + fcfa(b.ca) + ' − argent sorti ' + fcfa(b.sortiesPeriode) + ' (dépenses ' + fcfa(b.charges) + ' + production ' + fcfa(b.production) + (b.achats ? ' + achats ' + fcfa(b.achats) : "") + ') = <b class="' + (b.fluxPeriode >= 0 ? "pos" : "neg") + '">' + signe(b.fluxPeriode) + '</b>.</p>' +
    '<p class="astuce">La caisse monte quand vous vendez et descend quand vous produisez ou dépensez. Pour le <b>résultat net</b>, la production ne compte qu\'au fur et à mesure que les glaces se vendent (coût des produits vendus : ' + fcfa(b.cout) + ') : sinon vous seriez « en perte » le jour où vous produisez, alors que le stock vaut de l\'argent.</p>';
  h += repliable("Détail de la caisse", det);
  if (b.resteADuTotal > 0) h += repliable("Argent à récupérer : " + fcfa(b.resteADuTotal), blocDettes(v, ""));
  if (b.livraisonPacks > 0) h += '<div class="carte"><h3>Livraison incluse dans les packs</h3><div class="rang"><span>Surplus encaissé en plus des pots</span><b>' + fcfa(b.livraisonPacks) + '</b></div><p class="astuce">Les livreurs remettent le prix complet du pack. Les pots comptent au prix normal (ventes, stock, caisse) ; ce surplus est à part. Notez la part du livreur dans Ajouter › Dépense si vous voulez la suivre.</p></div>';

  var jours = b.parJour.slice(-14), max = Math.max.apply(null, [1].concat(jours.map(function (j) { return j.ca; })));
  h += repliable("Ventes par jour", jours.length ? jours.map(function (j) {
    return '<div class="ligne-j"><span>' + esc(dateFr(j.date)) + '</span><div class="bar" style="width:' + Math.max(2, Math.round(j.ca / max * 100)) + '%"></div><b style="text-align:right">' + fcfa(j.ca) + '</b></div>';
  }).join("") : '<p class="gris">Aucune vente sur cette période.</p>');
  h += repliable("Par produit", b.parProduit.length ? '<table><tr><th>Produit</th><th class="n">Qté</th><th class="n">CA</th><th class="n">Marge</th></tr>' + b.parProduit.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + p.qte + '</td><td class="n">' + fcfa(p.ca) + '</td><td class="n ' + (p.marge >= 0 ? "pos" : "neg") + '">' + fcfa(p.marge) + '</td></tr>'; }).join("") + '</table>' : '<p class="gris">Rien pour le moment.</p>');
  h += repliable("Par point de vente", b.parPoint.length ? '<table><tr><th>Point</th><th class="n">Qté</th><th class="n">CA</th></tr>' + b.parPoint.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + p.qte + '</td><td class="n">' + fcfa(p.ca) + '</td></tr>'; }).join("") + '</table>' : '<p class="gris">Rien pour le moment.</p>');
  if (b.parVendeur && b.parVendeur.length) h += repliable("Par vendeur (caisse)", '<table>' + b.parVendeur.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + p.qte + ' pièces</td><td class="n">' + fcfa(p.ca) + '</td></tr>'; }).join("") + '</table>');
  h += repliable("Dépenses par catégorie", b.parCategorie.length || b.production ? '<table>' + b.parCategorie.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td class="n">' + fcfa(p.total) + '</td></tr>'; }).join("") + (b.production ? '<tr><td>Production (lots)</td><td class="n">' + fcfa(b.production) + '</td></tr>' : "") + '</table>' : '<p class="gris">Aucune dépense.</p>');
  var autres = '<div class="rang"><span>Pertes, offerts (au coût)</span><b>' + fcfa(b.pertes) + '</b></div><div class="rang"><span>Valeur du stock (au coût)</span><b>' + fcfa(b.valeurStock) + '</b></div><div class="rang"><span>Coût des produits vendus</span><b>' + fcfa(b.cout) + '</b></div>';
  if (b.achats) autres += '<div class="rang"><span>Achats de marchandises à revendre</span><b>' + fcfa(b.achats) + '</b></div>';
  if (b.apports || b.remboursements) autres += '<div class="rang"><span>Apports d\'argent' + (b.remboursements ? " · remboursés" : "") + '</span><b>' + fcfa(b.apports) + (b.remboursements ? " · " + fcfa(b.remboursements) : "") + '</b></div>';
  h += repliable("Autres chiffres", autres);
  return h;
}

/* ----- Ajouter : un seul écran de choix, puis le formulaire voulu ----- */
function vAjout(v) {
  if (!E.saisie) {
    var T = [["production", "🍦", "Production", "J'ai produit des glaces"], ["soir", "🌙", "Reste du soir", "Compter ce qu'il reste"], ["vente", "🛒", "Vente", "Noter ou revoir les ventes"], ["depense", "💸", "Dépense", "Frais, publicité, apport d'argent"], ["perte", "🗑️", "Perte ou offert", "Gâté, offert, dégustation"]];
    return '<p class="astuce">Que voulez-vous noter ?</p><div class="tuiles-ajout">' + T.map(function (t) { return '<button type="button" data-s="saisie" data-v="' + t[0] + '"><i>' + t[1] + '</i><b>' + t[2] + '</b><small>' + t[3] + '</small></button>'; }).join("") + '</div>';
  }
  var corps = { production: vProduction, soir: vSoir, vente: function (x) { return vVentes(x, "vente"); }, perte: function (x) { return vVentes(x, "perte"); }, depense: vDepenses }[E.saisie](v);
  return retour("Ajouter", "saisie", "") + corps;
}

/* ----- Équipe : une caisse par personne ----- */
var nomPoste = function (p) { return p === "livreur" ? "Livreur" : "Caissier"; };
function lienDe(m) { return m && m.lien ? location.origin + "/caisse.html?c=" + m.lien : ""; }
function lireEq() {
  if (!E.eq) return;
  document.querySelectorAll("[data-eq-i]").forEach(function (e) {
    var i = +e.getAttribute("data-eq-i"), k = e.getAttribute("data-eq-k"); if (!E.eq[i]) return;
    E.eq[i][k] = e.type === "checkbox" ? e.checked : e.value;
  });
}
function statsMembre(v, id, du, au) {
  var dans = function (d) { return (!du || d >= du) && (!au || d <= au); };
  var recus = (v.recus || []).filter(function (r) { return r.vid === id && dans(r.date); });
  var deps = (v.depenses || []).filter(function (d) { return d.vid === id && dans(d.date); });
  var livs = (v.livraisons || []).filter(function (l) { return l.livreurId === id && dans(l.date); });
  var parMode = {}, total = 0;
  recus.forEach(function (r) { parMode[r.paiement] = (parMode[r.paiement] || 0) + r.total; total += r.total; });
  livs.forEach(function (l) { var k = l.mode || "Espèces"; parMode[k] = (parMode[k] || 0) + l.total; total += l.total; });
  return { recus: recus, deps: deps, livs: livs, parMode: parMode, total: total, depTotal: deps.reduce(function (s, d) { return s + (Number(d.montant) || 0); }, 0), nb: recus.length + livs.length };
}
/* ----- À valider : ce que la caissière envoie (ventes, production, comptage du soir) ----- */
function groupesAttente(v, vid) {
  var g = {};
  (v.recus || []).filter(function (r) { return r.attente && (!vid || r.vid === vid); }).forEach(function (r) { var k = r.vid + "|" + r.date; (g[k] = g[k] || { vid: r.vid, date: r.date, vendeur: r.vendeur, recus: [] }).recus.push(r); });
  return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
}
function livAttente(v, vid) { return (v.livraisons || []).filter(function (l) { return l.attente && (!vid || l.livreurId === vid); }); }
function nbAValider(v) { return groupesAttente(v).length + (v.lotsProp || []).length + (v.propositions || []).length + livAttente(v).length; }
function ligneRecuAttente(r) {
  return '<div class="rang"><div class="g"><b>' + heureFr(r.heure) + ' · ' + fcfa(r.total) + '</b><small>' + r.lignes.map(function (l) { return l.qte + " × " + esc(l.nom); }).join(", ") + '<br>' + esc(r.paiement) +
    (r.du ? ' · <b>à rendre' + (r.du.echeance ? " avant le " + esc(dateFr(r.du.echeance)) : "") + '</b>' : "") + '</small></div><div style="text-align:right">' +
    (r.du ? '<button class="btn btn-brun btn-petit" type="button" data-s="recu-paye" data-id="' + esc(r.id) + '">Payé en espèces</button><br>' : "") +
    '<button class="btn btn-clair btn-petit" type="button" data-s="supprimer-recu" data-id="' + esc(r.id) + '">Supprimer</button></div></div>';
}
function blocAValider(v, vid) {
  var gs = groupesAttente(v, vid), lp = (v.lotsProp || []).filter(function (x) { return !vid || x.vid === vid; }), pr = (v.propositions || []).filter(function (x) { return !vid || x.vid === vid; });
  var lv = livAttente(v, vid);
  if (!gs.length && !lp.length && !pr.length && !lv.length) return "";
  var noms = {}; v.produits.forEach(function (x) { noms[x.id] = x.nom; });
  var theo = {}; v.stock.forEach(function (x) { theo[x.id] = x.theorique; });
  var h = '<div class="carte"><h3>À valider <span class="badge badge-rouge">' + (gs.length + lp.length + pr.length + lv.length) + '</span></h3><p class="astuce">Ce que la caissière a envoyé. <b>Rien de tout ça n\'est encore compté dans la caisse ni dans les chiffres.</b> Vérifiez, corrigez (supprimez ou changez), puis validez.</p>';
  lv.forEach(function (l) {
    var opt = function (m) { return '<option' + (l.mode === m ? " selected" : "") + '>' + m + '</option>'; };
    h += '<div class="formulaire" style="margin:8px 0"><b>Livraison de ' + esc(l.livreur || "") + ' · ' + fcfa(l.total) + '</b><br><span class="gris">' + esc(l.client || "") + ' · ' + esc(dateFr(l.date)) + '<br>' + esc(l.resume || "") + '<br>Il dit avoir été payé : <b>' + esc(l.mode || "Espèces") + '</b></span>' +
      '<label for="lm-' + esc(l.id) + '">Paiement à retenir</label><select id="lm-' + esc(l.id) + '">' + opt("Espèces") + opt("Orange Money") + opt("Wave") + '</select>' +
      '<p class="astuce">Validez seulement si vous avez bien reçu l\'argent (en main, ou sur le 65 12 09 02 pour Orange Money / Wave).</p>' +
      '<div class="grille2"><button class="btn btn-vert btn-petit" type="button" data-s="liv-ok" data-id="' + esc(l.id) + '">Argent reçu</button><button class="btn btn-brun btn-petit" type="button" data-s="liv-du" data-id="' + esc(l.id) + '">Pas reçu : il me doit</button></div>' +
      '<button class="btn btn-clair btn-petit btn-bloc" type="button" style="margin-top:6px" data-s="liv-non" data-id="' + esc(l.id) + '">Refuser cette livraison</button></div>';
  });
  gs.forEach(function (g) {
    var tot = g.recus.reduce(function (m, r) { return m + (Number(r.total) || 0); }, 0), du = g.recus.reduce(function (m, r) { return m + (r.du ? Number(r.total) || 0 : 0); }, 0);
    h += '<div class="formulaire" style="margin:8px 0"><b>Ventes de ' + esc(g.vendeur) + ' · ' + esc(dateFr(g.date)) + '</b><br><span class="gris">' + g.recus.length + ' reçu' + (g.recus.length > 1 ? "s" : "") + ' · total ' + fcfa(tot) + (du ? ' · dont à rendre plus tard ' + fcfa(du) : "") + '</span>' + g.recus.map(ligneRecuAttente).join("") +
      '<button class="btn btn-vert btn-petit btn-bloc" type="button" style="margin-top:8px" data-s="valider-jour" data-vid="' + esc(g.vid) + '" data-date="' + esc(g.date) + '">Valider cette journée</button></div>';
  });
  lp.forEach(function (p) {
    h += '<div class="formulaire" style="margin:8px 0"><b>Production notée par ' + esc(p.vendeur) + ' · ' + esc(dateFr(p.date)) + '</b>' + p.lignes.map(function (l) { return '<div class="ligne-edit"><span>' + esc(noms[l.produitId] || l.produitId) + '</span><input type="number" inputmode="numeric" min="0" data-pl="' + esc(p.id) + '" data-pid="' + esc(l.produitId) + '" value="' + l.qte + '"></div>'; }).join("") +
      '<label for="pc-' + esc(p.id) + '">Coût de la production (F)</label><input type="number" inputmode="numeric" min="0" id="pc-' + esc(p.id) + '" value="' + (p.cout || "") + '" placeholder="À compléter">' +
      '<div class="grille2" style="margin-top:8px"><button class="btn btn-vert btn-petit" type="button" data-s="prod-ok" data-id="' + esc(p.id) + '">Valider</button><button class="btn btn-clair btn-petit" type="button" data-s="prod-non" data-id="' + esc(p.id) + '">Refuser</button></div></div>';
  });
  pr.forEach(function (p) {
    h += '<div class="formulaire" style="margin:8px 0"><b>Reste en stock compté par ' + esc(p.vendeur) + ' · ' + esc(dateFr(p.date)) + '</b><p class="astuce">À droite : ce que l\'application attendait. Changez un chiffre si besoin.</p>' + p.items.map(function (l) {
      var t = theo[l.produitId], diff = t != null && t !== l.restant;
      return '<div class="ligne-edit"><span>' + esc(noms[l.produitId] || l.produitId) + '<small class="gris"> attendu ' + (t != null ? t : "?") + '</small></span><input type="number" inputmode="numeric" min="0" data-cl="' + esc(p.id) + '" data-pid="' + esc(l.produitId) + '" value="' + l.restant + '" style="' + (diff ? "border-color:#c62828" : "") + '"></div>';
    }).join("") +
      '<div class="grille2" style="margin-top:8px"><button class="btn btn-vert btn-petit" type="button" data-s="compt-ok" data-id="' + esc(p.id) + '">Valider le comptage</button><button class="btn btn-clair btn-petit" type="button" data-s="compt-non" data-id="' + esc(p.id) + '">Refuser</button></div></div>';
  });
  return h + '</div>';
}
/* ----- Argent à récupérer : livreurs et clients qui doivent encore de l'argent ----- */
function blocDettes(v, vid) {
  var cr = ((v.bilan && v.bilan.creances) || []).filter(function (c) { return c.reste > 0 && (!vid || c.id === vid); });
  var encs = (v.encaissements || []).filter(function (e) { return !vid || e.deId === vid; }).slice(0, 6);
  if (!cr.length && !encs.length) return "";
  var h = '<p class="astuce">Produits remis aux livreurs ou vendus à crédit, validés par vous. Quand quelqu\'un vous rend de l\'argent, notez-le ici : la caisse monte et ce qu\'il doit baisse. Le livreur voit lui-même ce qu\'il doit.</p>';
  h += cr.map(function (c, i) {
    var retard = c.echeance && c.echeance < jourJ(0);
    return '<div class="rang" style="align-items:flex-start"><div class="g"><b>' + esc(c.nom || "?") + '</b><small>' + (c.type === "livreur" ? "Livreur" : "Client à crédit") + ' · doit ' + fcfa(c.du) + (c.paye ? ", rendu " + fcfa(c.paye) : "") + (c.echeance ? ' · pour le ' + esc(dateFr(c.echeance)) : "") + (retard ? ' <span class="badge badge-rouge">En retard</span>' : "") + '</small>' +
      '<div style="display:flex;gap:6px;margin-top:6px"><input type="number" inputmode="numeric" min="1" id="enc-' + i + '" placeholder="Montant rendu" style="flex:1"><button class="btn btn-vert btn-petit" type="button" data-s="encaisse" data-i="' + i + '" data-vid="' + (vid ? "1" : "") + '">Il m\'a remis</button></div></div><b class="neg">' + fcfa(c.reste) + '</b></div>';
  }).join("");
  if (encs.length) h += '<p class="astuce" style="margin-top:8px">Derniers paiements reçus :</p>' + encs.map(function (e) { return '<div class="rang"><span>' + esc(dateFr(e.date)) + ' · ' + esc(e.deNom || e.deId) + '</span><span><b class="pos">+' + fcfa(e.montant) + '</b> <button class="btn btn-clair btn-petit" type="button" data-s="enc-sup" data-id="' + esc(e.id) + '">Annuler</button></span></div>'; }).join("");
  return h;
}
function blocComptesEsp(v, vid) {
  var l = (v.comptesEsp || []).filter(function (x) { return (!vid || x.vid === vid) && x.date >= jourJ(-7); });
  var rem = (v.remises || []).filter(function (x) { return (!vid || x.vid === vid) && x.date >= jourJ(-7); }).sort(function (a, b) { return a.cree < b.cree ? 1 : -1; });
  if (!l.length && !rem.length && !vid) return "";
  var h = '<div class="carte"><h3>Argent liquide de l\'équipe</h3><p class="astuce">Attendu = ce qu\'il restait au dernier comptage + espèces encaissées − argent déjà remis (main, Orange, Wave).</p>';
  h += l.map(function (x) {
    var d = x.detail || {}, tranche = x.statut === "accepte" ? ' <span class="tag ok">Accepté</span>' : x.statut === "corrige" ? ' <span class="tag ok">Corrigé</span>' : "";
    return '<div class="rang" style="flex-wrap:wrap"><span>' + esc(x.vendeur) + ' · ' + esc(dateFr(x.date)) + tranche + '<br><small class="gris">attendu ' + fcfa(x.attendu) + ' · compté ' + fcfa(x.compte) + (d.remises ? ' · déjà remis ' + fcfa(d.remises) : '') + '</small></span><b class="' + (x.ecart < 0 && x.statut !== "accepte" ? "neg" : x.ecart > 0 ? "pos" : "") + '">' + (x.ecart === 0 ? "Juste ✓" : (x.ecart < 0 ? "Manque " : "+") + fcfa(Math.abs(x.ecart))) + '</b>' +
      '<div class="grille2" style="width:100%;margin-top:6px"><button class="btn btn-brun btn-petit" type="button" data-s="ec-ok" data-id="' + esc(x.id) + '">Accepter</button><button class="btn btn-clair btn-petit" type="button" data-s="ec-cor" data-id="' + esc(x.id) + '">Corriger</button></div>' +
      '<button class="btn btn-contour btn-petit" type="button" data-s="ec-sup" data-id="' + esc(x.id) + '" style="width:100%;margin-top:6px">Supprimer ce comptage</button></div>';
  }).join("");
  if (rem.length) h += '<p class="astuce" style="margin-top:10px">Argent déjà remis au responsable :</p>' + rem.map(function (x) {
    var tag = x.statut === "recu" ? '<span class="tag ok">Reçu</span>' : x.statut === "refuse" ? '<span class="tag ko">Refusé</span>' : '<span class="tag att">À confirmer</span>';
    return '<div class="rang" style="flex-wrap:wrap"><span>' + esc(x.vendeur) + ' · ' + esc(dateFr(x.date)) + ' · ' + esc(x.mode) + ' ' + tag + (x.note ? '<br><small class="gris">' + esc(x.note) + '</small>' : '') + '</span><b>' + fcfa(x.montant) + '</b>' +
      '<div class="grille2" style="width:100%;margin-top:6px">' + (x.statut !== "recu" ? '<button class="btn btn-brun btn-petit" type="button" data-s="rm-ok" data-id="' + esc(x.id) + '">Bien reçu</button>' : '') + (x.statut !== "refuse" ? '<button class="btn btn-clair btn-petit" type="button" data-s="rm-non" data-id="' + esc(x.id) + '">Pas reçu</button>' : '') + '<button class="btn btn-contour btn-petit" type="button" data-s="rm-sup" data-id="' + esc(x.id) + '">Supprimer</button></div></div>';
  }).join("");
  if (vid) h += '<p class="astuce" style="margin-top:10px">J\'ai déjà pris de l\'argent chez cette personne :</p><div class="grille2"><input id="rm-mt" type="number" inputmode="numeric" min="1" placeholder="Montant (F)"><select id="rm-mode"><option>Main à main</option><option>Orange Money</option><option>Wave</option></select></div><button class="btn btn-brun btn-petit" type="button" data-s="rm-add" data-vid="' + esc(vid) + '" style="width:100%;margin-top:6px">Noter cet argent pris</button>';
  return h + '</div>';
}
function blocPaiements(v, vid) {
  var att = (v.livraisons || []).filter(function (l) { return l.aConfirmer && (!vid || l.livreurId === vid); })
    .concat((v.recus || []).filter(function (r) { return recuAConfirmer(r) && (!vid || r.vid === vid); }).map(function (r) { return { id: r.id, total: r.total, livreur: r.vendeur, client: "Vente en caisse", date: r.date }; }));
  if (!att.length) return "";
  return '<div class="carte"><h3>Paiements à confirmer <span class="badge badge-rouge">' + att.length + '</span></h3><p class="astuce">Orange Money, Wave ou payé au responsable : à confirmer. Vérifiez sur votre téléphone (65 12 09 02) : si l\'argent n\'y est pas, appuyez sur « Pas reçu », la personne devra vous le remettre en espèces.</p>' + att.map(function (l) {
    return '<div class="formulaire" style="margin:8px 0"><b>' + fcfa(l.total) + '</b> · ' + esc(l.livreur || "") + '<br><span class="gris">' + esc(l.client || "") + ' · ' + esc(dateFr(l.date)) + '</span>' +
      '<div class="grille2" style="margin-top:8px"><button class="btn btn-brun btn-petit" type="button" data-s="pai-ok" data-id="' + esc(l.id) + '">Bien reçu</button><button class="btn btn-clair btn-petit" type="button" data-s="pai-non" data-id="' + esc(l.id) + '">Pas reçu</button></div></div>';
  }).join("") + '</div>';
}
function blocDemandes(v, vid) {
  var tout = (v.demandes || []).filter(function (d) { return !vid || d.vid === vid; });
  var att = tout.filter(function (d) { return d.statut === "attente"; }), faites = tout.filter(function (d) { return d.statut !== "attente"; }).slice(0, 8);
  if (!att.length && !vid) return "";
  var h = '<div class="carte"><h3>Demandes de dépense' + (att.length ? ' <span class="badge badge-rouge">' + att.length + '</span>' : '') + '</h3>';
  h += att.length ? att.map(function (d) {
    return '<div class="formulaire" style="margin:8px 0"><b>' + fcfa(d.montant) + '</b> · ' + esc(d.vendeur) + '<br><span class="gris">' + esc(d.motif) + ' · ' + esc(dateFr(d.date)) + '</span>' +
      '<label>Catégorie si acceptée</label><select id="dc-' + esc(d.id) + '">' + v.categories.map(function (c) { return '<option' + (c === "Autre dépense" ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("") + '</select>' +
      '<div class="grille2" style="margin-top:8px"><button class="btn btn-brun btn-petit" type="button" data-s="dem-ok" data-id="' + esc(d.id) + '">Accepter</button><button class="btn btn-clair btn-petit" type="button" data-s="dem-non" data-id="' + esc(d.id) + '">Refuser</button></div></div>';
  }).join("") : '<p class="gris">Aucune demande en attente.</p>';
  if (faites.length) h += '<p class="astuce" style="margin-top:10px">Déjà traitées :</p>' + faites.map(function (d) { return '<div class="rang"><span>' + esc(d.vendeur) + ' · ' + esc(d.motif) + '</span><b>' + fcfa(d.montant) + ' ' + (d.statut === "accepte" ? "✓" : "✕") + '</b></div>'; }).join("");
  return h + '</div>';
}
function heureFr(iso) { var hh = new Date(iso); return ("0" + hh.getHours()).slice(-2) + ":" + ("0" + hh.getMinutes()).slice(-2); }
function ligneRecu(r, archive) {
  return '<div class="rang"><div class="g"><b>' + esc(dateFr(r.date)) + ' ' + heureFr(r.heure) + ' · ' + esc(r.vendeur) + '</b><small>' + r.lignes.map(function (l) { return l.qte + " × " + esc(l.nom) + (l.detail ? " (" + esc(l.detail) + ")" : ""); }).join(", ") + '<br>' + esc(r.paiement) + (r.numPaiement ? " · " + esc(r.numPaiement) : "") + (r.note ? " · " + esc(r.note) : "") + '</small></div><div style="text-align:right"><b>' + fcfa(r.total) + '</b><br>' +
    (archive ? '<button class="btn btn-brun btn-petit" type="button" data-s="archiver" data-t="recu" data-etat="0" data-id="' + esc(r.id) + '">Restaurer</button> <button class="btn btn-clair btn-petit" type="button" data-s="supprimer-recu" data-id="' + esc(r.id) + '">Supprimer</button>'
      : '<button class="btn btn-brun btn-petit" type="button" data-s="archiver" data-t="recu" data-etat="1" data-id="' + esc(r.id) + '">Archiver</button> <button class="btn btn-clair btn-petit" type="button" data-s="supprimer-recu" data-id="' + esc(r.id) + '">Supprimer</button>') + '</div></div>';
}
function ligneDepense(d, archive) {
  var plus = d.classe === "apport";
  if (d.auto) return '<div class="rang"><div class="g"><b>' + esc(d.description || d.categorie) + '</b><small>' + esc(dateFr(d.date)) + ' · ' + esc(d.categorie) + (d.vendeur ? " · " + esc(d.vendeur) : "") + ' · automatique, liée à la vente</small></div><div style="text-align:right"><b>' + fcfa(d.montant) + '</b></div></div>';
  return '<div class="rang"><div class="g"><b>' + esc(d.description || d.categorie) + '</b><small>' + esc(dateFr(d.date)) + ' · ' + esc(d.categorie) + (d.vendeur ? " · " + esc(d.vendeur) : "") + (d.mode ? " · " + esc(d.mode) : "") + '</small></div><div style="text-align:right"><b class="' + (plus ? "pos" : "") + '">' + (plus ? "+" : "") + fcfa(d.montant) + '</b><br>' +
    (archive ? '<button class="btn btn-brun btn-petit" type="button" data-s="archiver" data-t="depense" data-etat="0" data-id="' + esc(d.id) + '">Restaurer</button> <button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="depense" data-id="' + esc(d.id) + '">Supprimer</button>'
      : '<button class="btn btn-brun btn-petit" type="button" data-s="archiver" data-t="depense" data-etat="1" data-id="' + esc(d.id) + '">Archiver</button> <button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="depense" data-id="' + esc(d.id) + '">Supprimer</button>') + '</div></div>';
}
function blocArchives(v, vid) {
  var ar = (v.archives || {}), rs = (ar.recus || []).filter(function (r) { return !vid || r.vid === vid; }), ds = (ar.depenses || []).filter(function (d) { return !vid || d.vid === vid; });
  var h = '<p class="astuce">Les archives sont mises de côté : elles ne comptent plus dans aucun total. Vous pouvez les restaurer, ou les supprimer pour toujours.</p>';
  if (!rs.length && !ds.length) return h + '<p class="gris">Aucune archive.</p>';
  h += rs.map(function (r) { return ligneRecu(r, true); }).join("") + ds.map(function (d) { return ligneDepense(d, true); }).join("");
  h += '<button class="btn btn-clair btn-bloc" type="button" style="margin-top:10px" data-s="archives-vider" data-id="' + esc(vid || "") + '">Tout supprimer pour toujours (' + (rs.length + ds.length) + ')</button>';
  return h;
}

function carteMembre(v, m, i, auj) {
  var lien = lienDe(m), st = m.id ? statsMembre(v, m.id, auj, auj) : null;
  var h = '<div class="membre' + (m.actif === false ? " inactif" : "") + '"><div class="rang" style="border:0;padding:0 0 6px;align-items:center"><div class="g"><b>' + esc(m.nom || "Nouvelle personne") + '</b><small>' + nomPoste(m.poste) + ' · ' + esc(m.point || "") + (m.actif === false ? " · désactivé" : "") + '</small></div><span class="badge ' + (m.poste === "livreur" ? "badge-bleu" : "badge-or") + '">' + nomPoste(m.poste) + '</span></div>';
  if (E.edit === i) {
    h += '<label>Nom</label><input type="text" maxlength="40" data-eq-i="' + i + '" data-eq-k="nom" value="' + esc(m.nom) + '" placeholder="Ex : Awa">' +
      '<label>Poste</label><select data-eq-i="' + i + '" data-eq-k="poste"><option value="caissier"' + (m.poste !== "livreur" ? " selected" : "") + '>Caissier (vend au comptoir)</option><option value="livreur"' + (m.poste === "livreur" ? " selected" : "") + '>Livreur (livre les commandes du site)</option></select>' +
      '<label>Point de vente</label><select data-eq-i="' + i + '" data-eq-k="point">' + v.config.pointsVente.concat(v.config.pointsVente.indexOf(m.point) < 0 && m.point ? [m.point] : []).map(function (p) { return '<option' + (p === m.point ? " selected" : "") + '>' + esc(p) + '</option>'; }).join("") + '</select>' +
      '<label>Code personnel (4 à 12 lettres ou chiffres)</label><input type="text" maxlength="12" autocapitalize="none" autocomplete="off" data-eq-i="' + i + '" data-eq-k="code" value="' + esc(m.code || "") + '" placeholder="Laissez vide : un code est créé">' +
      '<label>Son numéro WhatsApp (facultatif, pour lui envoyer le lien)</label><input type="tel" inputmode="tel" maxlength="20" data-eq-i="' + i + '" data-eq-k="tel" value="' + esc(m.tel || "") + '" placeholder="Ex : 70 12 34 56">' +
      '<div class="rang" style="align-items:center"><label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" data-eq-i="' + i + '" data-eq-k="actif"' + (m.actif !== false ? " checked" : "") + '> Actif</label>' + (m.id ? '<label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" data-eq-i="' + i + '" data-eq-k="nouveauLien"' + (m.nouveauLien ? " checked" : "") + '> Nouveau lien</label>' : "") + '</div>' +
      '<p class="astuce">« Nouveau lien » : l\'ancien lien ne marchera plus (utile si un téléphone est perdu). Pensez à enregistrer.</p>' +
      '<div class="grille2"><button class="btn btn-clair btn-petit" type="button" data-s="eq-fermer">Fermer</button><button class="btn btn-clair btn-petit" type="button" data-s="eq-retirer" data-i="' + i + '">Retirer cette personne</button></div>';
  } else {
    if (st) h += '<div class="rang" style="border:0;padding:2px 0"><span class="gris">Aujourd\'hui</span><b>' + fcfa(st.total) + ' · ' + st.nb + (m.poste === "livreur" ? " encaissement" : " reçu") + (st.nb > 1 ? "s" : "") + '</b></div>' + (st.depTotal ? '<div class="rang" style="border:0;padding:2px 0"><span class="gris">Dépenses acceptées</span><b>' + fcfa(st.depTotal) + '</b></div>' : "");
    h += '<div class="rang" style="border:0;padding:2px 0"><span class="gris">Code</span><b>' + esc(m.code || "—") + '</b></div>';
    if (m.id) {
      h += '<div class="grille2" style="margin-top:8px"><button class="btn btn-vert btn-petit" type="button" data-s="lien-wa" data-i="' + i + '">Envoyer son lien</button><button class="btn btn-brun btn-petit" type="button" data-s="lien-copier" data-i="' + i + '">Copier le lien</button></div>' +
        '<div class="grille2" style="margin-top:8px"><button class="btn btn-or btn-petit" type="button" data-s="fiche" data-v="' + esc(m.id) + '">Ses ventes et dépenses</button><button class="btn btn-clair btn-petit" type="button" data-s="eq-modifier" data-i="' + i + '">Modifier</button></div>';
    } else h += '<p class="astuce">Enregistrez l\'équipe pour obtenir son lien.</p><button class="btn btn-clair btn-petit" type="button" data-s="eq-modifier" data-i="' + i + '">Modifier</button>';
  }
  return h + '</div>';
}

function vEquipe(v) {
  if (!E.eq) E.eq = JSON.parse(JSON.stringify(v.equipe || []));
  if (E.fiche) { var mm = E.eq.filter(function (x) { return x.id === E.fiche; })[0]; if (mm) return vFiche(v, mm); E.fiche = null; }
  var auj = jourJ(0);
  var h = blocAValider(v) + blocPaiements(v) + blocDemandes(v) + blocComptesEsp(v);
  h += '<div class="carte"><h3>Équipe</h3><p class="astuce">Chaque personne a <b>sa propre caisse</b> et ne voit que <b>ses</b> ventes et <b>ses</b> dépenses. Touchez « Envoyer son lien » : elle l\'ouvre sur son téléphone et sa caisse s\'ouvre toute seule.</p>';
  h += E.eq.length ? E.eq.map(function (m, i) { return carteMembre(v, m, i, auj); }).join("") : '<p class="gris">Aucune personne pour le moment. Touchez « + Ajouter une personne ».</p>';
  h += '<div class="grille2" style="margin-top:6px"><button class="btn btn-clair" type="button" data-s="eq-ajouter">+ Ajouter une personne</button><button class="btn btn-or" type="button" data-s="eq-enregistrer">Enregistrer l\'équipe</button></div></div>';
  var na = ((v.archives || {}).recus || []).length + ((v.archives || {}).depenses || []).length;
  h += repliable("Archives (" + na + ")", blocArchives(v, ""));
  var acces = '<p class="astuce">Sur le site, une petite étoile ✦ (en bas à droite de l\'accueil) mène à la caisse et à l\'administration. Elle est discrète : les clients ne la remarquent pas, et un code est demandé de toute façon.</p>' +
    '<p class="astuce">On peut aussi taper un <b>mot secret</b> dans « Suivre ma commande » : la caisse s\'ouvre.</p>' +
    '<label for="mot-caisse">Mot secret</label><input type="text" id="mot-caisse" maxlength="20" autocapitalize="none" autocomplete="off" value="' + esc(v.motCaisse || "bingo") + '"><button class="btn btn-brun btn-petit" type="button" data-s="mot-enregistrer" style="margin-top:8px">Enregistrer le mot</button>' +
    '<p class="astuce" style="margin-top:12px">Lien général de la caisse (demande le code personnel) :</p><input type="text" readonly value="' + esc(location.origin + "/caisse.html") + '" onclick="this.select()"><button class="btn btn-clair btn-petit" type="button" data-s="copier-caisse" style="margin-top:8px">Copier ce lien</button>';
  h += repliable("Autres accès à la caisse", acces);
  return h;
}

/* Fiche d'une personne : ses ventes, ses dépenses, archiver, supprimer */
function vFiche(v, m) {
  var p = periodeCourante(), st = statsMembre(v, m.id, p.du, p.au);
  var h = retour("Équipe", "fiche", "") + '<div class="carte"><h3>' + esc(m.nom) + ' · ' + nomPoste(m.poste) + '</h3><p class="astuce">' + esc(m.point || "") + ' · Seules les ventes et dépenses de cette personne sont affichées ici.</p>' + selPeriode() +
    '<div class="kpis"><div class="kpi gros"><small>' + (m.poste === "livreur" ? "Encaissé (livraisons + ventes)" : "Vendu en caisse") + '</small><b>' + fcfa(st.total) + '</b><small>' + st.nb + ' ' + (m.poste === "livreur" ? "encaissement" : "reçu") + (st.nb > 1 ? "s" : "") + '</small></div>' +
    '<div class="kpi"><small>Dépenses acceptées</small><b>' + fcfa(st.depTotal) + '</b></div><div class="kpi"><small>Espèces à recevoir</small><b>' + fcfa(st.parMode["Espèces"] || 0) + '</b></div></div>';
  var modes = Object.keys(st.parMode);
  if (modes.length) h += modes.map(function (k) { return '<div class="rang"><span>' + esc(k) + '</span><b>' + fcfa(st.parMode[k]) + '</b></div>'; }).join("");
  h += '</div>';
  h += blocAValider(v, m.id) + blocPaiements(v, m.id) + blocDemandes(v, m.id) + blocComptesEsp(v, m.id);
  var dm = blocDettes(v, m.id); if (dm) h += '<div class="carte"><h3>Ce qu\'il me doit</h3>' + dm + '</div>';
  h += '<div class="carte"><h3>Ses ventes</h3>' + (st.recus.length ? st.recus.slice(0, 150).map(function (r) { return ligneRecu(r, false); }).join("") : '<p class="gris">Aucune vente sur cette période.</p>') +
    (st.livs.length ? '<h4 style="margin:14px 0 4px">Livraisons encaissées</h4>' + st.livs.map(function (l) { return '<div class="rang"><div class="g"><b>' + esc(dateFr(l.date)) + ' · ' + esc(l.client || "") + '</b><small>' + esc(l.mode || "Espèces") + ' · modifiable dans l\'onglet Commandes</small></div><b>' + fcfa(l.total) + '</b></div>'; }).join("") : "") + '</div>';
  h += '<div class="carte"><h3>Ses dépenses</h3>' + (st.deps.length ? st.deps.map(function (d) { return ligneDepense(d, false); }).join("") : '<p class="gris">Aucune dépense sur cette période.</p>') + '</div>';
  if (st.recus.length || st.deps.length) h += '<button class="btn btn-clair btn-bloc" type="button" data-s="vendeur-archiver" data-id="' + esc(m.id) + '" data-n="' + (st.recus.length + st.deps.length) + '">Tout archiver pour cette période (' + (st.recus.length + st.deps.length) + ')</button>';
  h += repliable("Ses archives", blocArchives(v, m.id));
  return h;
}

/* ----- Ce soir (reste du jour) ----- */
function vSoir(v) {
  var s = E.soir;
  var h = '<div class="carte soir"><h3>Le reste du soir</h3><p class="astuce">Comptez ce qu\'il vous reste de chaque produit. Le logiciel calcule tout seul ce qui a été vendu, en tenant compte des commandes du site déjà livrées et des pertes notées. Laissez vide ce que vous ne comptez pas.</p>' +
    '<div class="grille2"><div><label for="so-date">Jour</label><input type="date" id="so-date" value="' + esc(E.soirDate) + '"></div>' +
    '<div><label for="so-pv">Point de vente (facultatif)</label><select id="so-pv">' + optionsPoints(v, "— non précisé —") + '</select></div></div>';
  if (!s || s.date !== E.soirDate) { h += '<p class="gris">Chargement…</p></div>'; chargerSoir(); return h; }
  var ligne = function (p) {
    var deja = s.deja[p.id], att = s.avant[p.id] || 0;
    return '<tr><td>' + esc(p.nom) + '</td><td class="n ' + (att < 0 ? "neg" : "") + '">' + att + '</td><td class="n"><input class="reste" type="number" inputmode="numeric" min="0" data-pid="' + esc(p.id) + '" value="' + (deja ? deja.restant : "") + '" placeholder="—"></td></tr>';
  };
  var utiles = s.produits.filter(function (p) { return (s.avant[p.id] || 0) !== 0 || s.deja[p.id]; }), autres = s.produits.filter(function (p) { return utiles.indexOf(p) < 0; });
  var entete = '<tr><th>Produit</th><th class="n">Attendu</th><th class="n">Reste</th></tr>';
  h += '<table style="margin-top:12px">' + entete + (utiles.length ? utiles.map(ligne).join("") : '<tr><td colspan="3" class="gris">Aucun stock attendu : notez d\'abord une production.</td></tr>') + '</table>';
  if (autres.length) h += '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600;color:var(--brun-3)">Autres produits (' + autres.length + ')</summary><table>' + entete + autres.map(ligne).join("") + '</table></details>';
  h += '<button class="btn btn-or btn-bloc" style="margin-top:14px" type="button" data-s="enregistrer-soir">Enregistrer le comptage</button>';
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
function vVentes(v, mode) {
  var h = mode === "vente" ? selPeriode() : "";
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">' + (mode === "vente" ? '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="vente">+ Vente</button>' : '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="perte">+ Perte / offert</button>') + '</div>';
  if (mode === "vente" && E.ouvert === "vente") {
    h += '<div class="formulaire"><h3>Nouvelle vente</h3><label for="fv-p">Produit</label><select id="fv-p">' + optionsProduits(v) + '</select>' +
      '<div class="grille2"><div><label for="fv-q">Quantité</label><input type="number" id="fv-q" inputmode="numeric" min="1" value="1"></div><div><label for="fv-d">Jour</label><input type="date" id="fv-d" value="' + jourJ(0) + '"></div></div>' +
      '<label for="fv-pv">Point de vente (facultatif)</label><select id="fv-pv">' + optionsPoints(v, "— non précisé —") + '</select>' +
      '<div class="grille2"><div><label for="fv-px">Prix unitaire (vide = prix du site)</label><input type="number" id="fv-px" inputmode="numeric" min="0"></div><div><label for="fv-r">Remise totale (F)</label><input type="number" id="fv-r" inputmode="numeric" min="0" value="0"></div></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-or" type="button" data-s="enregistrer-vente">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  if (mode === "perte" && E.ouvert === "perte") {
    h += '<div class="formulaire"><h3>Perte, offert ou dégustation</h3><label for="fp-p">Produit</label><select id="fp-p">' + optionsProduits(v) + '</select>' +
      '<div class="grille2"><div><label for="fp-q">Quantité</label><input type="number" id="fp-q" inputmode="numeric" min="1" value="1"></div><div><label for="fp-d">Jour</label><input type="date" id="fp-d" value="' + jourJ(0) + '"></div></div>' +
      '<label for="fp-t">Sorte</label><select id="fp-t">' + Object.keys(v.typesPerte).map(function (k) { return '<option value="' + k + '">' + esc(v.typesPerte[k]) + '</option>'; }).join("") + '</select>' +
      '<p class="astuce">Ce n\'est pas de l\'argent encaissé : le logiciel le compte au prix de revient.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-perte">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  var src = { site: ["Site", "badge-vert"], manuel: ["Noté", "badge-bleu"], comptage: ["Reste du soir", "badge-or"] };
  if (mode === "vente") h += '<div class="carte"><h3>Ventes</h3>' + (v.ventes.length ? v.ventes.map(function (x) {
    var s = src[x.source];
    return '<div class="rang"><div class="g"><b>' + esc(x.nom) + '</b> × ' + x.qte + '<small>' + esc(dateFr(x.date)) + ' · ' + esc(x.canal) + (x.vendeur ? ' · ' + esc(x.vendeur) + ' · ' + esc(x.paiement) : '') + ' <span class="badge ' + s[1] + '">' + s[0] + '</span></small></div><div style="text-align:right"><b>' + fcfa(x.montant) + '</b>' + (x.recu ? '<br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer-recu" data-id="' + esc(x.recu) + '">Supprimer le reçu</button>' : x.source === "manuel" ? '<br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="vente" data-id="' + esc(x.ref) + '">Supprimer</button>' : x.source === "comptage" ? '<br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="comptage" data-id="' + esc(x.ref) + '">Annuler ce comptage</button>' : "") + '</div></div>';
  }).join("") : '<p class="gris">Aucune vente sur cette période.</p>') + '</div>';
  if (mode === "perte" && v.pertes.length) h += '<div class="carte"><h3>Pertes, offerts, dégustations</h3>' + v.pertes.map(function (x) {
    return '<div class="rang"><div class="g"><b>' + esc(x.nom) + '</b> × ' + x.qte + '<small>' + esc(dateFr(x.date)) + ' · ' + esc(v.typesPerte[x.type] || x.type) + '</small></div><div style="text-align:right"><b>' + fcfa(x.cout) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="perte" data-id="' + esc(x.ref) + '">Supprimer</button></div></div>';
  }).join("") + '</div>';
  return h;
}

/* ----- Stock + conseils de production ----- */
function vStock(v) {
  var h = '<div class="carte"><h3>Stock en ce moment</h3><p class="astuce">Production − ventes − pertes, recalé à chaque « reste du soir ».</p><table><tr><th>Produit</th><th class="n">Stock</th><th class="n">Valeur</th></tr>' +
    v.stock.filter(function (s) { return s.produit || s.vendu || s.theorique; }).map(function (s) {
      return '<tr><td>' + esc(s.nom) + '<br><small class="gris">' + (s.dernierComptage ? "compté le " + esc(dateFr(s.dernierComptage.date)) : "jamais compté") + '</small></td><td class="n ' + (s.theorique < 0 ? "neg" : "") + '"><b>' + s.theorique + '</b></td><td class="n">' + fcfa(s.valeur) + '</td></tr>';
    }).join("") + '</table></div>';
  if (v.ajustements.length) h += repliable("Surplus constatés au comptage", '<p class="astuce">Vous aviez plus que prévu (production oubliée ?).</p>' + v.ajustements.map(function (a) { return '<div class="rang"><span>' + esc(dateFr(a.date)) + ' · ' + esc(a.nom) + '</span><b>+' + a.qte + '</b></div>'; }).join(""));
  return h;
}
function vStockOnglet(v) {
  return carteProduire(v.analyse) + vStock(v) + repliable("Rentabilité par produit", carteRenta(v.analyse));
}

/* ----- Analyse : marge automatique, quoi produire, seuil de rentabilité, objectifs ----- */
function barre(pct, couleur) { return '<div style="height:12px;border-radius:7px;background:#eee6d2;overflow:hidden;margin:6px 0"><div style="height:100%;width:' + Math.max(2, Math.min(100, pct)) + '%;background:' + (couleur || "linear-gradient(90deg,#1f5a2e,#c9982b)") + '"></div></div>'; }
var ALERTES_PRODUIT = { perte: ["Vendu à perte", "#fde8e4", "#9b2c1d"], faible: ["Marge faible", "#fff3d6", "#8a5a00"], "cout-hausse": ["Coût en hausse", "#fff3d6", "#8a5a00"], "sans-cout": ["Coût inconnu", "#eee", "#555"] };
function carteProduire(a) {
  var prod = a.produits.filter(function (p) { return p.moyenne > 0 || p.aProduire > 0; });
  var h = '<div class="carte"><h3>À produire demain</h3><p class="astuce">Calculé avec vos ventes des 7 derniers jours (+15 % de sécurité) moins ce qu\'il reste en stock.</p>';
  h += prod.length ? prod.map(function (p) { return '<div class="rang"><div class="g"><b>' + esc(p.nom) + '</b><small>vend ~' + p.moyenne + ' par jour · en stock : ' + Math.max(0, p.theorique) + (p.joursStock != null ? " (" + p.joursStock + " j)" : "") + (p.confiance === "faible" ? " · peu de données" : "") + '</small></div><div style="text-align:right"><b class="' + (p.aProduire > 0 ? "" : "pos") + '">' + (p.aProduire > 0 ? "Produire " + p.aProduire : "Stock suffisant") + '</b></div></div>'; }).join("") : '<p class="gris">Pas encore assez de ventes pour conseiller.</p>';
  return h + '</div>';
}
function carteRenta(a) {
  var h = '<p class="astuce">Marge = prix de vente − coût de revient (moyenne de vos productions). Les 30 derniers jours.</p>';
  h += a.produits.length ? a.produits.map(function (p) {
    var al = ALERTES_PRODUIT[p.alerte];
    return '<div class="rang" style="align-items:flex-start"><div class="g"><b>' + esc(p.nom) + '</b><small>Prix ' + fcfa(p.prix) + ' · coût ' + (p.coutU > 0 ? fcfa(p.coutU) : "inconnu") + (p.alerte === "cout-hausse" ? " (dernier lot : " + fcfa(p.coutDernier) + ")" : "") + '<br>Vendu : ' + p.vendu30 + ' · marge gagnée : ' + fcfa(p.marge30) + '</small>' + (al ? '<span class="badge" style="background:' + al[1] + ';color:' + al[2] + ';margin-top:4px;display:inline-block">' + al[0] + '</span>' : "") + '</div><div style="text-align:right"><b class="' + (p.margeU > 0 ? "pos" : "neg") + '">' + (p.coutU > 0 ? signe(p.margeU) : "—") + '</b><br><small>' + (p.coutU > 0 ? p.margePct + " % par pot" : "notez une production") + '</small></div></div>';
  }).join("") : '<p class="gris">Aucun produit pour le moment.</p>';
  return h;
}
function vObjectifs(v) {
  var a = v.analyse, o = a.objectifs, sz = a.seuil;
  var h = '<div class="carte"><h3>Objectifs</h3>';
  if (o.jour > 0) h += '<div class="rang"><span>Aujourd\'hui</span><b>' + fcfa(o.caJour) + ' / ' + fcfa(o.jour) + '</b></div>' + barre(o.caJour / o.jour * 100) + '<small class="gris">' + (o.caJour >= o.jour ? "Objectif du jour atteint 🎉" : "Il reste " + fcfa(o.jour - o.caJour)) + '</small>';
  if (o.mois > 0) h += '<div class="rang" style="margin-top:8px"><span>Ce mois</span><b>' + fcfa(o.caMois) + ' / ' + fcfa(o.mois) + '</b></div>' + barre(o.caMois / o.mois * 100) + '<small class="gris">' + (sz.projection ? "À ce rythme : " + fcfa(sz.projection) + " à la fin du mois" : "") + '</small>';
  if (!(o.jour > 0) && !(o.mois > 0)) h += '<p class="gris">Fixez un objectif du jour et du mois dans Plus › Réglages.</p>';
  h += '</div>';
  h += '<div class="carte"><h3>Seuil de rentabilité du mois</h3>';
  if (sz.caSeuil) h += '<p class="astuce">Vos dépenses du mois (' + fcfa(sz.charges) + ') sont payées quand vous vendez pour <b>' + fcfa(sz.caSeuil) + '</b> (marge de ' + sz.margePct + ' %).</p>' + barre(sz.caMois / sz.caSeuil * 100, sz.atteint ? "linear-gradient(90deg,#1f5a2e,#3a9a52)" : "") + '<div class="rang"><span>Vendu ce mois</span><b>' + fcfa(sz.caMois) + '</b></div><p style="margin:6px 0 0;font-weight:600;color:' + (sz.atteint ? "#1f5a2e" : "#8a5a00") + '">' + (sz.atteint ? "Seuil dépassé : tout ce que vous vendez en plus est du bénéfice." : "Il reste " + fcfa(sz.caSeuil - sz.caMois) + " à vendre pour couvrir vos dépenses.") + '</p>';
  else h += '<p class="gris">Pas encore assez de ventes avec un coût de revient pour calculer le seuil.</p>';
  return h + '</div>';
}

/* ----- Plus : les outils rangés ----- */
function vPlus(v) {
  if (!E.plus) {
    var M = [["patron", "Accès patron (lecture seule)", "Un lien pour que le patron voie les chiffres, sans rien modifier"], ["relances", "Clients à relancer", "Anciens clients, avec un message prêt à envoyer sur WhatsApp"], ["cloture", "Clôture de la journée", "Compter la caisse du soir, voir s'il manque de l'argent"], ["objectifs", "Objectifs et seuil de rentabilité", "Où j'en suis ce jour et ce mois"], ["envoi", "Envoyer et exporter", "Rapport WhatsApp, Excel, Google Sheets, Drive"], ["journal", "Journal des modifications", "Qui a changé quoi, et quand"], ["params", "Réglages du suivi", "Caisse de départ, coûts, points de vente"]];
    return '<div class="carte"><h3>Plus</h3>' + M.map(function (m) { return '<button class="menu-plus" type="button" data-s="vers" data-v="' + m[0] + '"><span><b>' + m[1] + '</b><small>' + m[2] + '</small></span><span>›</span></button>'; }).join("") + '</div>';
  }
  var corps = { patron: vPatron, relances: vRelances, cloture: vCloture, objectifs: vObjectifs, envoi: vEnvoi, journal: vJournal, params: vParams }[E.plus](v);
  return retour("Plus", "vers", "") + corps;
}
/* ----- Clients à relancer : les gens qui ont déjà commandé, avec un message gentil prêt à envoyer ----- */
function clientsDe() {
  var cm = (A && A.commandes ? A.commandes() : []), m = {};
  cm.forEach(function (c) {
    if (!c || c.statutLivraison === "annulee" || c.archive) return;
    var tel = String(c.telClient || "").replace(/\D/g, ""); if (tel.length < 8) return;
    if (tel.length === 8) tel = "226" + tel;
    var o = (m[tel] = m[tel] || { tel: tel, nom: "", n: 0, total: 0, dernier: "", art: {} });
    if (c.nomClient && c.nomClient !== "Non renseigné") o.nom = c.nomClient;
    o.n++; o.total += Number(c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal) || 0;
    var d = String(c.date || "").slice(0, 10); if (d > o.dernier) o.dernier = d;
    (c.articles || []).forEach(function (a) { o.art[a.nom] = (o.art[a.nom] || 0) + (Number(a.qte) || 1); });
  });
  return Object.keys(m).map(function (k) { var o = m[k]; var fav = Object.keys(o.art).sort(function (a, b) { return o.art[b] - o.art[a]; })[0] || ""; o.fav = fav; return o; });
}
function joursDepuis(d) { return d ? Math.floor((Date.now() - Date.parse(d + "T00:00:00Z")) / 86400000) : 999; }
function messageRelance(o) {
  var pren = (o.nom || "").split(" ")[0];
  var fav = (o.fav || "").replace(/^Crème glacée /, "").replace(/^Pack /, "pack ");
  if (o.n >= 3) return "Bonjour " + pren + " 😊 Merci d'être une cliente aussi fidèle chez Noogó 🍦 Pour vous remercier, votre prochaine commande a une petite attention de notre part. Vos glaces " + (fav ? "(" + fav + ") " : "") + "vous attendent : " + location.origin;
  return "Bonjour " + pren + " 😊 C'est Noogó 🍦 Nous espérons que vous avez bien aimé vos glaces " + (fav ? "(" + fav + ") " : "") + "! Elles sont de nouveau prêtes aujourd'hui, 100 % naturelles. Commandez en 2 minutes, livraison à Karpala : " + location.origin;
}
function vRelances() {
  var l = clientsDe();
  var h = '<div class="carte"><h3>Clients à relancer</h3><p class="astuce">Les personnes qui ont déjà commandé, avec un message gentil déjà écrit. Appuyez sur WhatsApp, relisez, envoyez. Ne relancez pas la même personne tous les jours : une fois par semaine suffit.</p>';
  if (!l.length) return h + '<p class="gris">Pas encore de client avec un numéro. Les numéros viennent des commandes du site.</p></div>';
  var groupes = [["Fidèles (3 commandes ou plus)", l.filter(function (o) { return o.n >= 3; })], ["À relancer (plus de 7 jours sans commande)", l.filter(function (o) { return o.n < 3 && joursDepuis(o.dernier) > 7; })], ["Récents (commande dans les 7 derniers jours)", l.filter(function (o) { return o.n < 3 && joursDepuis(o.dernier) <= 7; })]];
  groupes.forEach(function (g) {
    if (!g[1].length) return;
    h += '<h4 style="margin:14px 0 4px">' + g[0] + ' · ' + g[1].length + '</h4>' + g[1].sort(function (a, b) { return a.dernier < b.dernier ? 1 : -1; }).slice(0, 30).map(function (o) {
      return '<div class="rang"><div class="g"><b>' + esc(o.nom || "Client") + '</b><small>' + o.n + ' commande' + (o.n > 1 ? 's' : '') + ' · ' + fcfa(o.total) + ' · dernière le ' + esc(dateFr(o.dernier)) + (o.fav ? ' · aime : ' + esc(o.fav) : "") + '</small></div><a class="btn btn-vert btn-petit" target="_blank" rel="noopener" href="https://wa.me/' + esc(o.tel) + '?text=' + encodeURIComponent(messageRelance(o)) + '">WhatsApp</a></div>';
    }).join("");
  });
  return h + '</div>';
}
/* ----- Accès patron : un lien secret, lecture seule ----- */
function lienPatron(v) { return v.patron && v.patron.cle ? location.origin + "/patron.html?k=" + v.patron.cle : ""; }
function vPatron(v) {
  var p = v.patron, lien = lienPatron(v);
  var h = '<div class="carte"><h3>Accès patron</h3><p class="astuce">Le patron ouvre un lien sur son téléphone et voit les chiffres (ventes, résultat, caisse, stock, argent à récupérer, manques). <b>Il ne peut rien modifier</b> et ne voit ni les codes ni les liens de l\'équipe. Le lien se met à jour tout seul.</p>';
  if (!p || !p.cle) h += '<button class="btn btn-or btn-bloc" type="button" data-s="patron-creer">Créer le lien du patron</button>';
  else {
    h += '<div class="rang"><span>État</span><b class="' + (p.actif ? "pos" : "neg") + '">' + (p.actif ? "Actif" : "Désactivé") + '</b></div>';
    if (p.actif) h += '<input type="text" readonly value="' + esc(lien) + '" onclick="this.select()"><div class="grille2" style="margin-top:8px"><button class="btn btn-vert btn-petit" type="button" data-s="patron-wa">Envoyer par WhatsApp</button><button class="btn btn-brun btn-petit" type="button" data-s="patron-copier">Copier le lien</button></div>' +
      '<div class="grille2" style="margin-top:8px"><button class="btn btn-clair btn-petit" type="button" data-s="patron-off">Désactiver</button><button class="btn btn-clair btn-petit" type="button" data-s="patron-creer">Nouveau lien</button></div><p class="astuce">« Nouveau lien » : l\'ancien lien ne marchera plus (si quelqu\'un d\'autre l\'a eu).</p>';
    else h += '<button class="btn btn-or btn-bloc" type="button" data-s="patron-on">Réactiver</button>';
  }
  return h + '</div>';
}
function vEnvoi(v) {
  return '<div class="carte"><h3>Envoyer et exporter</h3><p class="astuce">Ces boutons ouvrent le menu d\'envoi de votre téléphone : choisissez WhatsApp, Google Drive, Gmail, Sheets… Sur ordinateur, le fichier se télécharge. Les chiffres suivent la période choisie dans le Résumé (' + esc(nomPeriode()) + ').</p>' +
    '<button class="btn btn-vert btn-bloc" type="button" data-s="rapport-wa">Résumé détaillé sur WhatsApp</button>' +
    '<button class="btn btn-brun btn-bloc" type="button" style="margin-top:8px" data-s="rapport-complet">Rapport complet (document avec chaque vente et dépense)</button>' +
    '<button class="btn btn-or btn-bloc" type="button" style="margin-top:8px" data-s="classeur">Classeur Excel / Google Sheets (tout en un)</button>' +
    '<p class="astuce" style="margin-top:8px">Le classeur contient 7 feuilles : Ventes, Dépenses, Productions, Pertes, Stock, Rentabilité, Clôtures.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-clair btn-petit" type="button" data-s="export" data-v="ventes">Ventes (CSV)</button><button class="btn btn-clair btn-petit" type="button" data-s="export" data-v="depenses">Dépenses (CSV)</button><button class="btn btn-clair btn-petit" type="button" data-s="export" data-v="stock">Stock (CSV)</button></div></div>';
}

/* ----- Clôture de journée : rapport + écart de caisse ----- */
function vCloture(v) {
  var j = v.journee, jr = j.date, cl = (v.clotures || []).filter(function (c) { return c.date === jr; })[0];
  var h = '<div class="carte"><h3>Clôture de la journée</h3><p class="astuce">À faire chaque soir : comptez l\'argent en espèces dans la caisse, écrivez le montant, et le logiciel vous dit s\'il manque ou s\'il y a trop.</p>' +
    '<label for="cl-d">Jour</label><input type="date" id="cl-d" value="' + esc(jr) + '"></div>';
  h += '<div class="carte"><h3>Rapport du ' + esc(dateFr(jr)) + '</h3><div class="grille2" style="margin-bottom:8px"><div class="kpi"><small>Ventes</small><b>' + fcfa(j.ca) + '</b><small>' + j.qte + ' articles' + (j.nbRecus ? " · " + j.nbRecus + " reçus" : "") + '</small></div><div class="kpi"><small>Dépenses</small><b>' + fcfa(j.depenses) + '</b></div></div>';
  h += j.parPaiement.length ? '<h4 style="margin:10px 0 4px">Par mode de paiement</h4>' + j.parPaiement.map(function (x) { return '<div class="rang"><span>' + esc(x.nom) + '</span><b>' + fcfa(x.total) + '</b></div>'; }).join("") : '<p class="gris">Aucune vente ce jour-là.</p>';
  if (j.parVendeur.length) h += '<h4 style="margin:10px 0 4px">Par vendeur</h4>' + j.parVendeur.map(function (x) { return '<div class="rang"><span>' + esc(x.nom) + '</span><b>' + fcfa(x.total) + '</b></div>'; }).join("");
  h += '</div>';
  h += '<div class="carte"><h3>Espèces attendues : ' + fcfa(j.especesAttendues) + ' + fond de caisse</h3><p class="astuce">Ventes en espèces (et ventes sans mode précisé) ' + fcfa(j.encaissEspeces) + (j.apportsEspeces ? " + apports " + fcfa(j.apportsEspeces) : "") + " − dépenses payées en espèces " + fcfa(j.sortiesEspeces) + '.</p>' +
    '<label for="cl-f">Fond de caisse du matin (F) — l\'argent déjà dans la caisse avant de commencer</label><input type="number" id="cl-f" inputmode="numeric" min="0" value="' + (cl ? cl.fond || 0 : ((v.clotures || [])[0] ? (v.clotures[0].fond || 0) : 0)) + '">' +
    '<label for="cl-c">Espèces comptées dans la caisse (F)</label><input type="number" id="cl-c" inputmode="numeric" min="0" value="' + (cl ? cl.compte : "") + '" placeholder="Ex : ' + j.especesAttendues + '">' +
    '<label for="cl-n">Remarque (facultatif)</label><input type="text" id="cl-n" maxlength="200" value="' + esc(cl ? cl.note || "" : "") + '" placeholder="Ex : 500 F rendus à un client">' +
    '<button class="btn btn-or btn-bloc" type="button" style="margin-top:10px" data-s="cloturer">' + (cl ? "Refaire la clôture" : "Clôturer la journée") + '</button>';
  if (cl) h += '<div class="alerte ' + (cl.ecart === 0 ? "vert" : "") + '" style="margin-top:10px"><b>' + (cl.ecart === 0 ? "Caisse juste ✔" : cl.ecart > 0 ? "Il y a " + fcfa(cl.ecart) + " en trop" : "Il manque " + fcfa(-cl.ecart)) + '</b><br>Comptés : ' + fcfa(cl.compte) + ' · attendus : ' + fcfa(cl.attendu) + '</div><button class="btn btn-vert btn-bloc" type="button" style="margin-top:8px" data-s="rapport-cloture">Envoyer ce rapport sur WhatsApp</button>';
  h += '</div>';
  var hist = (v.clotures || []).slice(0, 30);
  h += '<div class="carte"><h3>Dernières clôtures</h3>' + (hist.length ? hist.map(function (c) { return '<div class="rang"><div class="g"><b>' + esc(dateFr(c.date)) + '</b><small>Ventes ' + fcfa(c.ca) + ' · comptés ' + fcfa(c.compte) + '</small></div><div style="text-align:right"><b class="' + (c.ecart === 0 ? "pos" : "neg") + '">' + (c.ecart === 0 ? "Juste" : signe(c.ecart)) + '</b></div></div>'; }).join("") : '<p class="gris">Aucune clôture pour le moment.</p>') + '</div>';
  return h;
}
function rapportCloture() {
  var v = E.vue, j = v.journee, cl = (v.clotures || []).filter(function (c) { return c.date === j.date; })[0]; if (!cl) return;
  var t = "*NOOGÓ — Clôture du " + dateFr(j.date) + "*\n\nVentes : *" + fcfa(j.ca) + "* (" + j.qte + " articles)\n" + j.parPaiement.map(function (x) { return "• " + x.nom + " : " + fcfa(x.total); }).join("\n") + "\nDépenses : " + fcfa(j.depenses) + "\n\nEspèces attendues : " + fcfa(cl.attendu) + "\nEspèces comptées : " + fcfa(cl.compte) + "\n*" + (cl.ecart === 0 ? "Caisse juste ✔" : cl.ecart > 0 ? "En trop : " + fcfa(cl.ecart) : "Manque : " + fcfa(-cl.ecart)) + "*" + (cl.note ? "\nRemarque : " + cl.note : "");
  window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener");
}

/* ----- Journal des modifications ----- */
function vJournal(v) {
  var j = v.journal || [];
  var h = '<div class="carte"><h3>Journal des modifications</h3><p class="astuce">Tout ce qui est ajouté, modifié ou supprimé dans le suivi est noté ici avec la date et l\'heure. Rien ne peut être effacé de ce journal.</p>';
  if (!j.length) return h + '<p class="gris">Aucune modification notée pour le moment.</p></div>';
  h += j.map(function (x) {
    var d = new Date(x.t), p = function (n) { return String(n).padStart(2, "0"); };
    var quand = p(d.getDate()) + "/" + p(d.getMonth() + 1) + " à " + p(d.getHours()) + "h" + p(d.getMinutes());
    var sup = /^Supprim/.test(x.a);
    return '<div class="rang"><div class="g"><b>' + esc(x.a) + '</b><small>' + esc(x.r || "") + '</small></div><div style="text-align:right"><small style="white-space:nowrap">' + quand + '</small>' + (sup ? '<br><span class="badge" style="background:#fde8e4;color:#9b2c1d">supprimé</span>' : '') + '</div></div>';
  }).join("");
  return h + '</div>';
}

/* ----- Production ----- */
function vProduction(v) {
  var h = '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="lot">+ Nouvelle production</button>';
  if (E.ouvert === "lot") {
    h += '<div class="formulaire"><h3>Nouvelle production</h3><div class="grille2"><div><label for="fl-d">Jour</label><input type="date" id="fl-d" value="' + jourJ(0) + '"></div><div><label for="fl-n">Nom du lot</label><input type="text" id="fl-n" maxlength="60" placeholder="Ex : Baobab 3"></div></div>' +
      '<label for="fl-c">Dépenses totales du lot (F)</label><input type="number" id="fl-c" inputmode="numeric" min="0" placeholder="Ex : 34800">';
    for (var i = 0; i < E.nbLignesLot; i++) h += '<div class="grille2"><div><label>Produit</label><select class="fl-p">' + optionsProduits(v) + '</select></div><div><label>Quantité</label><input class="fl-q" type="number" inputmode="numeric" min="0" placeholder="Ex : 50"></div></div>';
    h += '<button class="btn btn-clair btn-petit" type="button" style="margin-top:8px" data-s="ligne-lot">+ Un autre format dans ce lot</button>' +
      '<div id="fl-m-box" style="' + ((v.comptages || []).some(function (c) { return c.date === jourJ(0); }) ? "" : "display:none") + '"><label for="fl-m">Un comptage du soir existe déjà pour ce jour. Ces pots sont…</label><select id="fl-m"><option value="">Automatique (recommandé)</option><option value="apres">Pour demain : pas encore dans le reste compté</option><option value="avant">Déjà là quand j\'ai compté : oubli de ma part</option></select><p class="astuce">« Pour demain » : la production ne change jamais les ventes du jour.</p></div>' +
      '<p class="astuce">Le coût de revient de chaque pot = dépenses ÷ nombre total de pots. Il sert à calculer vos marges.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-lot">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  h += '<div class="carte" style="margin-top:12px"><h3>Productions</h3>' + (v.lots.length ? v.lots.map(function (l) {
    var noms = {}; v.produits.forEach(function (p) { noms[p.id] = p.nom; });
    return '<div class="rang"><div class="g"><b>' + esc(l.nom) + '</b> · ' + esc(dateFr(l.date)) + '<small>' + l.lignes.map(function (x) { return x.qte + " × " + esc(noms[x.produitId] || x.produitId); }).join(" · ") + '<br>Coût de revient : ' + fcfa(l.coutUnitaire) + ' / pot</small></div><div style="text-align:right"><b>' + fcfa(l.cout) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="lot" data-id="' + esc(l.id) + '">Supprimer</button></div></div>';
  }).join("") : '<p class="gris">Aucune production notée.</p>') + '</div>';
  return h;
}

/* ----- Dépenses (la production y est comptée : c'est de l'argent sorti de la caisse) ----- */
function vDepenses(v) {
  var p = periodeCourante();
  var dans = function (d) { d = String(d || "").slice(0, 10); return (!p.du || d >= p.du) && (!p.au || d <= p.au); };
  var liste = v.depenses.filter(function (d) { return dans(d.date); });
  var lots = (v.lots || []).filter(function (l) { return !l.depart && dans(l.date); });
  var noms = {}; v.produits.forEach(function (x) { noms[x.id] = x.nom; });
  var somme = function (arr, f) { return arr.reduce(function (s, x) { return s + (Number(f(x)) || 0); }, 0); };
  var frais = somme(liste.filter(function (d) { return d.classe === "charge"; }), function (d) { return d.montant; });
  var achats = somme(liste.filter(function (d) { return d.classe === "achat"; }), function (d) { return d.montant; });
  var prod = somme(lots, function (l) { return l.cout; });
  var h = selPeriode();
  h += '<div class="kpis"><div class="kpi gros"><small>Argent sorti de la caisse · ' + esc(nomPeriode()) + '</small><b>' + fcfa(frais + achats + prod) + '</b><small>dépenses ' + fcfa(frais) + (achats ? " + achats " + fcfa(achats) : "") + ' + production ' + fcfa(prod) + '</small></div></div>';
  h += '<button class="btn btn-or" type="button" data-s="ouvrir" data-v="depense">+ Dépense ou apport</button>';
  if (E.ouvert === "depense") {
    h += '<div class="formulaire"><h3>Dépense ou apport d\'argent</h3><div class="grille2"><div><label for="fd-d">Jour</label><input type="date" id="fd-d" value="' + jourJ(0) + '"></div><div><label for="fd-m">Montant (F)</label><input type="number" id="fd-m" inputmode="numeric" min="1"></div></div>' +
      '<label for="fd-c">Catégorie</label><select id="fd-c">' + v.categories.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join("") + '</select>' +
      '<label for="fd-t">Description</label><input type="text" id="fd-t" maxlength="120" placeholder="Ex : Gaz, impression, salaire de Hamed…">' +
      '<label for="fd-mode">Paiement (facultatif)</label><select id="fd-mode"><option value="">—</option><option>Espèces</option><option>Orange Money</option><option>Moov Money</option><option>Wave</option><option>Autre</option></select>' +
      '<p class="astuce">Les productions se notent dans « Production » : elles apparaissent ici toutes seules, sans être comptées deux fois.</p>' +
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-or" type="button" data-s="enregistrer-depense">Enregistrer</button><button class="btn btn-clair" type="button" data-s="fermer">Annuler</button></div></div>';
  }
  var tout = liste.map(function (d) { return { t: "dep", d: String(d.date).slice(0, 10), x: d }; }).concat(lots.map(function (l) { return { t: "lot", d: String(l.date).slice(0, 10), x: l }; }))
    .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  h += '<div class="carte" style="margin-top:12px"><h3>Dépenses et productions</h3>' + (tout.length ? tout.map(function (it) {
    if (it.t === "lot") {
      var l = it.x;
      return '<div class="rang"><div class="g"><b>Production · ' + esc(l.nom) + '</b><small>' + esc(dateFr(l.date)) + ' · ' + l.lignes.map(function (x) { return x.qte + " × " + esc(noms[x.produitId] || x.produitId); }).join(", ") + ' <span class="badge badge-or">Production</span></small></div><div style="text-align:right"><b>' + fcfa(l.cout) + '</b><br><button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="lot" data-id="' + esc(l.id) + '">Supprimer</button></div></div>';
    }
    var d = it.x, plus = d.classe === "apport";
    if (d.auto) return '<div class="rang"><div class="g"><b>' + esc(d.description || d.categorie) + '</b><small>' + esc(dateFr(d.date)) + ' · ' + esc(d.categorie) + ' · automatique <span class="badge badge-or">Pack</span></small></div><div style="text-align:right"><b>' + fcfa(d.montant) + '</b></div></div>';
    return '<div class="rang"><div class="g"><b>' + esc(d.description || d.categorie) + '</b><small>' + esc(dateFr(d.date)) + ' · ' + esc(d.categorie) + (d.vendeur ? " · " + esc(d.vendeur) : "") + (d.mode ? " · " + esc(d.mode) : "") + '</small></div><div style="text-align:right"><b class="' + (plus ? "pos" : "") + '">' + (plus ? "+" : "") + fcfa(d.montant) + '</b><br><button class="btn btn-brun btn-petit" type="button" data-s="archiver" data-t="depense" data-etat="1" data-id="' + esc(d.id) + '">Archiver</button> <button class="btn btn-clair btn-petit" type="button" data-s="supprimer" data-t="depense" data-id="' + esc(d.id) + '">Supprimer</button></div></div>';
  }).join("") : '<p class="gris">Aucune dépense sur cette période.</p>') + '</div>';
  return h;
}

/* ----- Réglages ----- */
function vParams(v) {
  var c = v.config;
  var h = '<div class="carte"><h3>Caisse</h3><p class="astuce">Argent que vous aviez en caisse à la date de départ. La caisse actuelle = ce départ + ventes − productions − dépenses + apports.</p>' +
    '<div class="grille2"><div><label for="pa-cd">Caisse de départ (F)</label><input type="number" id="pa-cd" inputmode="numeric" value="' + c.caisseDepart + '"></div><div><label for="pa-dep">À partir du</label><input type="date" id="pa-dep" value="' + esc(c.depuis) + '"></div></div></div>';
  h += '<div class="carte"><h3>Objectifs de vente</h3><p class="astuce">Ils s\'affichent avec une barre de progression dans « Analyse ». Laissez 0 pour ne pas en avoir.</p><div class="grille2"><div><label for="pa-oj">Objectif du jour (F)</label><input type="number" id="pa-oj" inputmode="numeric" min="0" value="' + (c.objectifJour || 0) + '"></div><div><label for="pa-om">Objectif du mois (F)</label><input type="number" id="pa-om" inputmode="numeric" min="0" value="' + (c.objectifMois || 0) + '"></div></div></div>';
  h += '<div class="carte"><h3>Points de vente</h3><p class="astuce">Un par ligne. Facultatif : « En ligne » existe toujours (commandes du site).</p><textarea id="pa-pv" rows="4">' + esc(c.pointsVente.join("\n")) + '</textarea></div>';
  h += '<div class="carte"><h3>Coût de revient par défaut</h3><p class="astuce">Utilisé seulement tant qu\'aucune production n\'est notée pour ce produit (sinon c\'est le coût réel des lots).</p>' +
    v.produits.filter(function (p) { return p.actif || p.interne; }).map(function (p) { return '<div class="rang"><span style="flex:1">' + esc(p.nom) + '</span><input type="number" inputmode="numeric" min="0" style="width:110px;min-height:40px" data-cout="' + esc(p.id) + '" value="' + (c.couts[p.id] || "") + '" placeholder="0"></div>'; }).join("") + '</div>';
  h += '<div class="carte"><h3>Produits non vendus sur le site</h3><p class="astuce">Ex : un petit pot à 400 F, des esquimaux… Ils sont suivis (stock, marge) mais n\'apparaissent pas sur le site.</p>' +
    c.internes.map(function (p, i) { return '<div class="grille2" style="margin-bottom:6px;align-items:center"><input type="text" data-int-nom="' + i + '" value="' + esc(p.nom) + '"><div style="display:flex;gap:6px"><input type="number" inputmode="numeric" min="0" data-int-prix="' + i + '" value="' + p.prix + '"><button class="btn btn-clair btn-petit" type="button" data-s="retirer-interne" data-i="' + i + '">✕</button></div></div>'; }).join("") +
    '<div class="grille2" style="align-items:center"><input type="text" id="pa-in-nom" placeholder="Nom du produit"><input type="number" id="pa-in-prix" inputmode="numeric" min="0" placeholder="Prix (F)"></div></div>';
  h += '<button class="btn btn-or btn-bloc" type="button" data-s="enregistrer-params">Enregistrer les réglages</button>';
  var av = "";
  av += '<div class="carte"><h3>Reprendre mon ancien classeur</h3><p class="astuce">Ajoute les productions, ventes, dépenses et pertes du 03 au 08 octobre déjà notées dans votre classeur. À faire une seule fois (refaire ne crée pas de doublons).</p><button class="btn btn-clair" type="button" data-s="importer">Reprendre l\'historique</button></div>';
  av += '<div class="carte" style="border:2px solid #c62828"><h3>Nouveau départ (tout remettre à zéro)</h3><p class="astuce">Efface toutes les anciennes productions, ventes, pertes, dépenses et comptages. Le chiffre d\'affaires, les pertes et le résultat repartent de 0. Vous gardez seulement votre <b>caisse</b> et votre <b>stock restant</b>. Un fichier de sauvegarde est téléchargé avant, au cas où.</p>' +
    '<button class="btn btn-clair" type="button" data-s="depart-ouvrir">' + (E.depart ? "Fermer" : "Préparer le nouveau départ") + '</button>' + (E.depart ? vDepart(v) : "") + '</div>';
  h += repliable("Outils avancés (ancien classeur, nouveau départ)", av, E.depart);
  return h;
}
function vDepart(v) {
  var stock = {}; (v.stock || []).forEach(function (s) { stock[s.id] = s; });
  var lignes = v.produits.filter(function (p) { return p.actif || p.interne || (stock[p.id] && stock[p.id].theorique > 0); }).map(function (p) {
    var s = stock[p.id] || {}, q = Math.max(0, Math.round(s.theorique || 0)), cu = Math.round(s.coutMoyen || (v.config.couts && v.config.couts[p.id]) || 0);
    return '<div class="rang" style="align-items:center"><span style="flex:1">' + esc(p.nom) + '</span><input type="number" inputmode="numeric" min="0" style="width:74px;min-height:40px" data-nd-q="' + esc(p.id) + '" value="' + q + '" aria-label="Stock restant"><input type="number" inputmode="numeric" min="0" style="width:84px;min-height:40px" data-nd-c="' + esc(p.id) + '" value="' + cu + '" aria-label="Coût par pot"></div>';
  }).join("");
  return '<div class="formulaire"><label for="nd-caisse">Caisse actuelle réelle (F) : espèces + Orange Money + Wave</label><input type="number" id="nd-caisse" inputmode="numeric" value="' + Math.round(v.bilan.caisse || 0) + '"><p class="astuce">Peut être négatif (ex : -41600) : l\'argent déjà dépensé sera simplement soustrait des prochaines ventes.</p><label for="nd-date">Date du départ (le suivi repart de ce jour)</label><input type="date" id="nd-date" value="' + jourJ(-1) + '">' +
    '<p class="astuce" style="margin-top:12px"><b>Stock restant aujourd\'hui</b> : pour chaque produit, le nombre de pots que vous avez vraiment, et le coût de revient d\'un pot (colonne de droite). Mettez 0 s\'il n\'y en a plus.</p>' +
    '<div class="rang" style="font-size:12px;color:var(--gris)"><span style="flex:1">Produit</span><span style="width:74px;text-align:center">Pots</span><span style="width:84px;text-align:center">Coût / pot</span></div>' + lignes +
    '<label style="margin-top:10px">Pour confirmer, tapez le mot <b>ZERO</b></label><input type="text" id="nd-conf" autocomplete="off" placeholder="ZERO">' +
    '<button class="btn btn-bloc" type="button" data-s="depart-valider" style="background:#c62828;color:#fff;margin-top:10px">Tout effacer et repartir de zéro</button></div>';
}

/* ---------- actions ---------- */
function val(id) { var e = $(id); return e ? e.value : ""; }
function ok(msg) { E.message = ""; A.toast(msg, "ok"); }
function envoyer(action, extra, msg, fin) {
  return charge(action, extra).then(function () { E.ouvert = null; ok(msg); if (fin) fin(); rendre(); }).catch(function () {});
}
function paramsLus() {
  var c = JSON.parse(JSON.stringify(E.vue.config));
  c.caisseDepart = Number(val("pa-cd")) || 0; c.depuis = val("pa-dep"); c.objectifJour = Number(val("pa-oj")) || 0; c.objectifMois = Number(val("pa-om")) || 0;
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
/*XLSX-DEBUT*/
/* Mini-générateur de classeur Excel (.xlsx) : s'ouvre dans Excel, Google Sheets, Google Drive, LibreOffice */
var CRC_T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { var c = 0xFFFFFFFF, i; for (i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function octets(txt) { return new TextEncoder().encode(txt); }
function zipStocke(fichiers) {
  var parts = [], centr = [], pos = 0, i;
  var u16 = function (n) { return [n & 255, (n >> 8) & 255]; }, u32 = function (n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; };
  for (i = 0; i < fichiers.length; i++) {
    var nom = octets(fichiers[i][0]), d = octets(fichiers[i][1]), crc = crc32(d);
    var loc = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(d.length), u32(d.length), u16(nom.length), u16(0));
    parts.push(new Uint8Array(loc), nom, d);
    centr.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(d.length), u32(d.length), u16(nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(pos))), nom);
    pos += loc.length + nom.length + d.length;
  }
  var tailleC = 0; centr.forEach(function (c) { tailleC += c.length; });
  var fin = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(fichiers.length), u16(fichiers.length), u32(tailleC), u32(pos), u16(0)));
  var tout = parts.concat(centr, [fin]), total = 0; tout.forEach(function (p) { total += p.length; });
  var res = new Uint8Array(total), o = 0; tout.forEach(function (p) { res.set(p, o); o += p.length; });
  return res;
}
function xmlEsc(t) { return String(t == null ? "" : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function colLettre(n) { var s = ""; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function xlsx(feuilles) {
  var f = [], wb = "", rels = "", ct = "";
  feuilles.forEach(function (fe, i) {
    var nomF = String(fe.nom).replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31);
    var larg = [];
    var lignes = fe.lignes.map(function (l, r) {
      return '<row r="' + (r + 1) + '">' + l.map(function (c, k) {
        var ref = colLettre(k) + (r + 1), len = String(c == null ? "" : c).length; larg[k] = Math.max(larg[k] || 8, Math.min(48, len + 2));
        if (typeof c === "number" && isFinite(c)) return '<c r="' + ref + '"' + (r === 0 ? ' s="1"' : "") + '><v>' + c + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + (r === 0 ? ' s="1"' : "") + '><is><t xml:space="preserve">' + xmlEsc(c) + '</t></is></c>';
      }).join("") + '</row>';
    }).join("");
    f.push(["xl/worksheets/sheet" + (i + 1) + ".xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + larg.map(function (w, k) { return '<col min="' + (k + 1) + '" max="' + (k + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + '</cols><sheetData>' + lignes + '</sheetData></worksheet>']);
    wb += '<sheet name="' + xmlEsc(nomF) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  });
  var n = feuilles.length;
  f.unshift(["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ct + '</Types>']);
  f.push(["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  f.push(["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wb + '</sheets></workbook>']);
  f.push(["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
  f.push(["xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5A2E"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']);
  return zipStocke(f);
}
/*XLSX-FIN*/

/* Envoi : feuille de partage du téléphone (Google Drive, Gmail, WhatsApp, Sheets…) ou téléchargement */
function partager(nom, donnees, mime, titre) {
  var fichier;
  try { fichier = new File([donnees], nom, { type: mime }); } catch (e) { fichier = null; }
  if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] }) && navigator.share) {
    return navigator.share({ files: [fichier], title: titre || nom }).catch(function (e) { if (e && e.name === "AbortError") return; telechargerFichier(nom, donnees, mime); });
  }
  telechargerFichier(nom, donnees, mime);
  A.toast("Fichier téléchargé : ouvrez-le avec Google Sheets, Drive ou Excel, ou envoyez-le par WhatsApp.", "ok");
}
function telechargerFichier(nom, donnees, mime) {
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([donnees], { type: mime })); a.download = nom;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
var MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function classeurComplet() {
  return appel("export").then(function (d) {
    var v = E.vue, nb = function (x) { return Math.round(Number(x) || 0); };
    var feuilles = [
      { nom: "Ventes", lignes: [["Date", "Produit", "Quantité", "Chiffre d'affaires (F)", "Coût (F)", "Marge (F)", "Point de vente", "Vendeur", "Paiement", "Origine"]].concat((d.ventes || []).map(function (x) { return [x.date, x.nom, nb(x.qte), nb(x.montant), nb(x.cout), nb(x.montant - x.cout), x.canal || "", x.vendeur || "", x.paiement || "", x.source || ""]; })) },
      { nom: "Dépenses", lignes: [["Date", "Catégorie", "Description", "Montant (F)", "Paiement"]].concat((d.depenses || []).map(function (x) { return [x.date, x.categorie, x.description || "", nb(x.montant), x.mode || ""]; })) },
      { nom: "Productions", lignes: [["Date", "Lot", "Produits", "Quantité", "Coût total (F)", "Coût par pot (F)"]].concat((d.lots || []).map(function (x) { return [x.date, x.nom || "", (x.lignes || []).map(function (l) { return l.qte + " × " + l.produitId; }).join(", "), nb(x.quantite), nb(x.cout), nb(x.coutUnitaire)]; })) },
      { nom: "Pertes", lignes: [["Date", "Produit", "Quantité", "Type", "Coût (F)"]].concat((d.pertes || []).map(function (x) { return [x.date, x.nom, nb(x.qte), (E.vue.typesPerte || {})[x.type] || x.type, nb(x.cout)]; })) },
      { nom: "Stock", lignes: [["Produit", "Stock actuel", "Coût moyen (F)", "Valeur du stock (F)", "Produit au total", "Vendu", "Perdu"]].concat((d.stock || []).map(function (x) { return [x.nom, nb(x.theorique), nb(x.coutMoyen), nb(x.valeur), nb(x.produit), nb(x.vendu), nb(x.perdu)]; })) },
      { nom: "Rentabilité", lignes: [["Produit", "Prix (F)", "Coût de revient (F)", "Marge par pot (F)", "Marge (%)", "Vendu (30 j)", "Marge gagnée (30 j)", "En stock", "À produire demain"]].concat(((v.analyse || {}).produits || []).map(function (p) { return [p.nom, nb(p.prix), nb(p.coutU), nb(p.margeU), p.margePct, nb(p.vendu30), nb(p.marge30), nb(p.theorique), nb(p.aProduire)]; })) },
      { nom: "Clôtures", lignes: [["Date", "Ventes (F)", "Fond de caisse (F)", "Espèces attendues (F)", "Espèces comptées (F)", "Écart (F)", "Remarque"]].concat((v.clotures || []).map(function (c) { return [c.date, nb(c.ca), nb(c.fond), nb(c.attendu), nb(c.compte), nb(c.ecart), c.note || ""]; })) }
    ];
    return partager("Noogo-classeur-" + jourJ(0) + ".xlsx", xlsx(feuilles), MIME_XLSX, "Classeur Noogó");
  }).catch(function (e) { if (!e.silencieux) A.toast(e.message || "Impossible de préparer le classeur.", "err"); });
}

function telecharger(nom, contenu) {
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" })); a.download = nom;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- Rapports (WhatsApp) : résumé détaillé en message + rapport complet en fichier ---------- */
var NOMS_PERIODE = { jour: "Aujourd'hui", hier: "Hier", semaine: "7 derniers jours", mois: "Ce mois", "mois-dernier": "Mois dernier", tout: "Depuis le début" };
function nomPeriode() { return E.periode === "perso" ? "Du " + dateFr(E.du) + " au " + dateFr(E.au) : NOMS_PERIODE[E.periode]; }
function dansPeriode(d) { var p = periodeCourante(); return (!p.du || d >= p.du) && (!p.au || d <= p.au); }
function ligneTitre(t) { return "━━━━━━━━━━━━━━\n*" + t + "*"; }
function construireRapport(complet) {
  var v = E.vue, b = v.bilan, pr = v.precedent, T = [];
  var noms = {}; v.produits.forEach(function (p) { noms[p.id] = p.nom; });
  T.push("🍦 *NOOGÓ — RAPPORT DE GESTION*", nomPeriode() + " · édité le " + dateFr(jourJ(0)) + "/" + jourJ(0).slice(0, 4));
  T.push("", ligneTitre("1. RÉSULTATS"));
  T.push("Chiffre d'affaires : *" + fcfa(b.ca) + "* (" + b.quantite + " pièces)");
  if (pr && pr.ca) T.push("   vs période d'avant : " + (b.ca >= pr.ca ? "▲ +" : "▼ ") + Math.round((b.ca - pr.ca) / pr.ca * 100) + " % (" + fcfa(pr.ca) + ")");
  T.push("Coût des produits vendus : " + fcfa(b.cout), "Marge brute : " + fcfa(b.margeBrute) + " (" + b.margePct + " %)", "Pertes / offerts (au coût) : " + fcfa(b.pertes), "Dépenses (hors production) : " + fcfa(b.charges), "Production payée : " + fcfa(b.production), "Total sorti de la caisse : " + fcfa(b.charges + b.production), "*RÉSULTAT NET : " + signe(b.resultat) + "*");
  T.push("", ligneTitre("2. TRÉSORERIE ET STOCK"), "Caisse théorique : *" + fcfa(b.caisse) + "*", "Valeur du stock (au coût) : " + fcfa(b.valeurStock), "Production sur la période : " + fcfa(b.production));
  if (b.achats) T.push("Achats de marchandises à revendre : " + fcfa(b.achats));
  if (b.apports || b.remboursements) T.push("Apports d'argent : " + fcfa(b.apports) + " · Remboursés : " + fcfa(b.remboursements));
  T.push("", ligneTitre("3. VENTES PAR PRODUIT"));
  if (b.parProduit.length) b.parProduit.forEach(function (p) { T.push("• " + p.nom + " : " + p.qte + " → " + fcfa(p.ca) + " (marge " + fcfa(p.marge) + ")"); }); else T.push("Aucune vente.");
  T.push("", ligneTitre("4. VENTES PAR POINT DE VENTE"));
  if (b.parPoint.length) b.parPoint.forEach(function (p) { T.push("• " + p.nom + " : " + p.qte + (p.qte > 1 ? " pièces → " : " pièce → ") + fcfa(p.ca)); }); else T.push("Aucune vente.");
  if (b.parVendeur && b.parVendeur.length) { T.push("", ligneTitre("4b. VENTES PAR VENDEUR (CAISSE)")); b.parVendeur.forEach(function (p) { T.push("• " + p.nom + " : " + p.qte + " pièces → " + fcfa(p.ca)); }); }
  if (b.parPaiement && b.parPaiement.length) { T.push("", ligneTitre("4c. MODES DE PAIEMENT (CAISSE)")); b.parPaiement.forEach(function (p) { T.push("• " + p.nom + " : " + fcfa(p.ca)); }); }
  T.push("", ligneTitre("5. VENTES PAR JOUR"));
  if (b.parJour.length) b.parJour.forEach(function (j) { T.push("• " + dateFr(j.date) + " : " + fcfa(j.ca) + " (" + j.qte + " pièces)" + (j.depenses ? " · dépenses " + fcfa(j.depenses) : "")); }); else T.push("Aucune vente.");
  T.push("", ligneTitre("6. DÉPENSES"));
  var dep = v.depenses.filter(function (d) { return dansPeriode(d.date); }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  if (b.parCategorie.length) { b.parCategorie.forEach(function (c) { T.push("• " + c.nom + " : " + fcfa(c.total)); }); T.push("Total dépenses (hors production) : " + fcfa(b.charges)); if (b.production) T.push("Production payée (voir § 10) : " + fcfa(b.production), "Total sorti de la caisse : " + fcfa(b.charges + b.production)); } else T.push("Aucune dépense.");
  T.push("", ligneTitre("7. STOCK ACTUEL (théorique)"));
  var st = v.stock.filter(function (x) { return x.produit || x.vendu || x.theorique; });
  if (st.length) st.forEach(function (x) { T.push("• " + x.nom + " : *" + x.theorique + "*" + (x.theorique < 0 ? " ⚠" : x.theorique <= 5 && x.actif ? " (bas)" : "") + " — valeur " + fcfa(x.valeur)); }); else T.push("Aucun stock enregistré.");
  var al = [];
  if (b.alertes.length) al.push("⚠ Stock négatif : " + b.alertes.map(function (a) { return a.nom; }).join(", "));
  var bas = v.stock.filter(function (x) { return x.actif && x.produit > 0 && x.theorique >= 0 && x.theorique <= 5; });
  if (bas.length) al.push("⚠ Stock bas : " + bas.map(function (x) { return x.nom + " (" + x.theorique + ")"; }).join(", "));
  if (b.margeBrute < 0) al.push("⚠ Marge négative");
  if (al.length) T.push("", ligneTitre("ALERTES"), al.join("\n"));
  if (complet) {
    T.push("", ligneTitre("8. DÉTAIL DE TOUTES LES VENTES"));
    var ve = v.ventes.slice().sort(function (x, y) { return x.date < y.date ? -1 : 1; });
    if (ve.length) ve.forEach(function (x) { T.push(dateFr(x.date) + " · " + x.nom + " ×" + x.qte + " = " + fcfa(x.montant) + " · " + x.canal + (x.vendeur ? " · " + x.vendeur : "") + (x.paiement ? " · " + x.paiement : "") + (x.source === "site" ? " (commande site " + (x.ref || "") + ")" : x.source === "comptage" ? " (reste du soir)" : "")); }); else T.push("Aucune vente.");
    T.push("", ligneTitre("9. DÉTAIL DE TOUTES LES DÉPENSES"));
    if (dep.length) dep.forEach(function (d) { T.push(dateFr(d.date) + " · " + d.categorie + (d.description ? " — " + d.description : "") + " = " + fcfa(d.montant)); }); else T.push("Aucune dépense.");
    T.push("", ligneTitre("10. PRODUCTIONS"));
    var lo = v.lots.filter(function (l) { return dansPeriode(l.date) && !l.depart; });
    if (lo.length) lo.forEach(function (l) { T.push(dateFr(l.date) + " · " + l.nom + " : " + l.lignes.map(function (x) { return x.qte + " × " + (noms[x.produitId] || x.produitId); }).join(", ") + " — coût " + fcfa(l.cout) + " (" + fcfa(l.coutUnitaire) + "/pièce)"); }); else T.push("Aucune production.");
    T.push("", ligneTitre("11. PERTES, OFFERTS, DÉGUSTATIONS"));
    if (v.pertes.length) v.pertes.forEach(function (x) { T.push(dateFr(x.date) + " · " + x.nom + " ×" + x.qte + " · " + (v.typesPerte[x.type] || x.type) + " · coût " + fcfa(x.cout)); }); else T.push("Aucune perte.");
  }
  T.push("", "— Noogó · glaces naturelles, Karpala");
  return T.join("\n");
}
function rapportWA() {
  var t = construireRapport(false);
  // Un message WhatsApp reste lisible jusqu'à environ 4000 caractères : au-delà, on conseille le rapport complet
  if (t.length > 3800) t = t.slice(0, 3700).replace(/\n[^\n]*$/, "") + "\n…\n(Rapport tronqué : utilisez « Rapport complet »)";
  window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener");
}
function rapportComplet() {
  var t = construireRapport(true).replace(/\*/g, ""), nom = "Rapport-Noogo-" + jourJ(0) + ".txt";
  try {
    var f = new File([t], nom, { type: "text/plain" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: "Rapport Noogó", text: "Rapport de gestion Noogó" }).catch(function () {});
  } catch (e) {}
  telecharger(nom, "﻿" + t);
  A.toast("Rapport téléchargé : envoyez-le ensuite sur WhatsApp comme document.", "ok");
}
function clic(ev) {
  var t = ev.target.closest("[data-s]"); if (!t) return;
  var a = t.getAttribute("data-s"), v = t.getAttribute("data-v");
  E.message = "";
  switch (a) {
    case "copier-caisse":
      try { navigator.clipboard.writeText(location.origin + "/caisse.html"); A.toast("Lien copié", "ok"); } catch (e) { A.toast("Copiez le lien dans la case", "err"); } return;
    case "mot-enregistrer": return envoyer("caisse_mot", { mot: val("mot-caisse") }, "Mot secret enregistré");
    case "eq-ajouter": lireEq(); E.eq.push({ nom: "", point: (E.vue.config.pointsVente[0] || "Local"), actif: true, poste: "caissier" }); E.edit = E.eq.length - 1; return rendre();
    case "eq-modifier": lireEq(); E.edit = +t.getAttribute("data-i"); return rendre();
    case "eq-fermer": lireEq(); E.edit = null; return rendre();
    case "eq-retirer": lireEq(); if (!confirm("Retirer cette personne ? Son code et son lien ne marcheront plus.")) return; E.eq.splice(+t.getAttribute("data-i"), 1); E.edit = null; return rendre();
    case "eq-enregistrer": lireEq(); if (E.eq.some(function (m) { return !String(m.nom || "").trim(); })) return A.toast("Écrivez le nom de chaque personne.", "err"); return envoyer("equipe_save", { liste: E.eq }, "Équipe enregistrée", function () { E.eq = null; E.edit = null; });
    case "lien-copier": lireEq(); var mc = E.eq[+t.getAttribute("data-i")], lc = lienDe(mc);
      if (!lc) return A.toast("Enregistrez d'abord l'équipe.", "err");
      try { navigator.clipboard.writeText(lc); A.toast("Lien de " + mc.nom + " copié", "ok"); } catch (e) { window.prompt("Copiez ce lien :", lc); } return;
    case "lien-wa": lireEq(); var mw = E.eq[+t.getAttribute("data-i")], lw = lienDe(mw);
      if (!lw) return A.toast("Enregistrez d'abord l'équipe.", "err");
      var tw = "Bonjour " + mw.nom + " 👋\nVoici ta caisse Noogó (" + nomPoste(mw.poste).toLowerCase() + ") :\n" + lw + "\n\n1. Ouvre ce lien sur ton téléphone (avec Chrome).\n2. Touche « Installer l'application ».\n3. Ta caisse s'ouvre toute seule.\nTon code personnel : " + mw.code + "\n⚠ Ce lien est pour toi seul(e), ne le transmets pas.";
      var tel = String(mw.tel || "").replace(/\D/g, ""); if (tel.length === 8) tel = "226" + tel;
      window.open("https://wa.me/" + tel + "?text=" + encodeURIComponent(tw), "_blank", "noopener"); return;
    case "fiche": E.fiche = v || null; window.scrollTo(0, 0); return rendre();
    case "saisie": E.saisie = v || null; E.ouvert = ({ vente: "vente", perte: "perte", production: "lot", depense: "depense" })[v] || null; if (v === "production") E.nbLignesLot = 1; window.scrollTo(0, 0); return rendre();
    case "vers": window.scrollTo(0, 0); if (!v) { E.plus = null; return rendre(); } E.sous = "plus"; E.plus = v; E.ouvert = null; return rendre();
    case "autres": E.autres = !E.autres; return rendre();
    case "archiver": return envoyer("archiver", { type: t.getAttribute("data-t"), id: t.getAttribute("data-id"), etat: t.getAttribute("data-etat") !== "0" }, t.getAttribute("data-etat") === "0" ? "Restauré" : "Archivé (il ne compte plus dans les totaux)");
    case "vendeur-archiver":
      if (!confirm("Archiver ces " + t.getAttribute("data-n") + " ligne(s) (ventes et dépenses de cette personne sur la période) ? Elles ne compteront plus dans les totaux. Vous pourrez les restaurer.")) return;
      return envoyer("vendeur_archiver", { vid: t.getAttribute("data-id") }, "Archivé");
    case "archives-vider":
      if (!confirm("Supprimer POUR TOUJOURS ces archives ? Impossible de les récupérer.")) return;
      return envoyer("archives_vider", { vid: t.getAttribute("data-id") }, "Archives supprimées");
    case "dem-ok": return envoyer("demande_decider", { id: t.getAttribute("data-id"), decision: "accepter", categorie: val("dc-" + t.getAttribute("data-id")) }, "Dépense acceptée et notée");
    case "liv-ok": return envoyer("livraison_decider", { id: t.getAttribute("data-id"), decision: "valider", mode: val("lm-" + t.getAttribute("data-id")) }, "Livraison validée : elle compte maintenant");
    case "liv-du": return envoyer("livraison_decider", { id: t.getAttribute("data-id"), decision: "du" }, "Noté : le livreur doit cet argent");
    case "liv-non": if (!confirm("Refuser cette livraison ? La commande repart dans « à livrer ».")) return; return envoyer("livraison_decider", { id: t.getAttribute("data-id"), decision: "refuser" }, "Livraison refusée");
    case "patron-creer": if (E.vue.patron && E.vue.patron.cle && !confirm("Créer un nouveau lien ? L'ancien ne marchera plus.")) return; return envoyer("patron_lien", { operation: "creer" }, "Lien créé");
    case "patron-off": return envoyer("patron_lien", { operation: "desactiver" }, "Lien désactivé : le patron ne voit plus rien");
    case "patron-on": return envoyer("patron_lien", { operation: "activer" }, "Lien réactivé");
    case "patron-copier": var lp = lienPatron(E.vue); try { navigator.clipboard.writeText(lp); A.toast("Lien copié", "ok"); } catch (e) { window.prompt("Copiez ce lien :", lp); } return;
    case "patron-wa": window.open("https://wa.me/?text=" + encodeURIComponent("Bonjour 👋\nVoici le tableau Noogó (lecture seule) : tous les chiffres à jour, sur ton téléphone.\n" + lienPatron(E.vue) + "\n\nOuvre le lien avec Chrome. Tu peux l'ajouter à l'écran d'accueil."), "_blank", "noopener"); return;
    case "valider-jour": return envoyer("valider_jour", { vid: t.getAttribute("data-vid"), date: t.getAttribute("data-date") }, "Journée validée : elle compte maintenant dans la caisse");
    case "recu-paye": return envoyer("recu_payer", { id: t.getAttribute("data-id"), mode: "Espèces" }, "Marqué payé en espèces");
    case "prod-ok": { var pid0 = t.getAttribute("data-id"), lg = []; document.querySelectorAll('[data-pl]').forEach(function (e) { if (e.getAttribute("data-pl") === pid0) lg.push({ produitId: e.getAttribute("data-pid"), qte: Number(e.value) || 0 }); }); return envoyer("valider_production", { id: pid0, lignes: lg, cout: val("pc-" + pid0) }, "Production validée : le stock est mis à jour"); }
    case "prod-non": return envoyer("production_refuser", { id: t.getAttribute("data-id") }, "Production refusée");
    case "compt-ok": { var cid0 = t.getAttribute("data-id"), its = []; document.querySelectorAll('[data-cl]').forEach(function (e) { if (e.getAttribute("data-cl") === cid0) its.push({ produitId: e.getAttribute("data-pid"), restant: e.value }); }); return envoyer("valider_comptage", { id: cid0, items: its }, "Comptage validé"); }
    case "compt-non": return envoyer("proposition_supprimer", { id: t.getAttribute("data-id") }, "Comptage refusé");
    case "encaisse": { var ci = +t.getAttribute("data-i"), lst = (E.vue.bilan.creances || []).filter(function (c) { return c.reste > 0 && (!t.getAttribute("data-vid") || c.id === E.fiche); }), cc = lst[ci]; if (!cc) return; var mt = Number(val("enc-" + ci)) || 0; if (mt < 1) return alert("Entrez le montant rendu."); return envoyer("encaisser", { deType: cc.type, deId: cc.id, deNom: cc.nom, montant: mt, date: jourJ(0) }, "Argent noté : la caisse monte"); }
    case "ec-ok": return envoyer("ecart_decider", { id: t.getAttribute("data-id"), decision: "accepter" }, "Écart accepté");
    case "ec-cor": { var cm = prompt("Argent réellement compté (F) :"); if (cm === null) return; var cmn = Number(String(cm).replace(/\s/g, "")); if (!(cmn >= 0)) return alert("Montant invalide."); return envoyer("ecart_decider", { id: t.getAttribute("data-id"), decision: "corriger", compte: cmn }, "Comptage corrigé"); }
    case "ec-sup": if (!confirm("Supprimer ce comptage d'espèces ?")) return; return envoyer("ecart_decider", { id: t.getAttribute("data-id"), decision: "supprimer" }, "Comptage supprimé");
    case "rm-ok": return envoyer("remise_decider", { id: t.getAttribute("data-id"), decision: "recu" }, "Argent confirmé");
    case "rm-non": return envoyer("remise_decider", { id: t.getAttribute("data-id"), decision: "refuse" }, "Marqué : pas reçu");
    case "rm-sup": if (!confirm("Supprimer cette remise ?")) return; return envoyer("remise_decider", { id: t.getAttribute("data-id"), decision: "supprimer" }, "Remise supprimée");
    case "rm-add": { var rmt = Number(val("rm-mt")) || 0; if (rmt < 1) return alert("Entrez le montant."); return envoyer("remise_ajouter", { vid: t.getAttribute("data-vid"), montant: rmt, mode: val("rm-mode"), date: jourJ(0) }, "Argent noté"); }
    case "enc-sup": return envoyer("encaissement_supprimer", { id: t.getAttribute("data-id") }, "Paiement annulé");
    case "pai-ok": return envoyer("paiement_decider", { id: t.getAttribute("data-id"), decision: "recu" }, "Paiement confirmé");
    case "pai-non": return envoyer("paiement_decider", { id: t.getAttribute("data-id"), decision: "non" }, "Noté : le livreur doit remettre les espèces");
    case "dem-non": return envoyer("demande_decider", { id: t.getAttribute("data-id"), decision: "refuser" }, "Demande refusée");
    case "supprimer-recu":
      if (!confirm("Supprimer ce reçu et toutes ses ventes ? Les chiffres et le stock seront recalculés.")) return;
      return envoyer("supprimer_recu", { id: t.getAttribute("data-id") }, "Reçu supprimé", function () { E.soir = null; });
    case "rapport-wa": return rapportWA();
    case "classeur": return classeurComplet();
    case "rapport-cloture": return rapportCloture();
    case "cloturer": if (val("cl-c") === "") return A.toast("Écrivez les espèces comptées dans la caisse.", "err"); return envoyer("cloture", { date: val("cl-d"), compte: val("cl-c"), fond: val("cl-f"), note: val("cl-n") }, "Journée clôturée");
    case "rapport-complet": return rapportComplet();
    case "sous": E.sous = v; E.ouvert = null; E.saisie = null; E.plus = null; E.fiche = null; return rendre();
    case "periode": E.periode = v; if (v === "perso") { E.du = E.du || jourJ(-30); E.au = E.au || jourJ(0); } return rafraichir();
    case "ouvrir": E.ouvert = E.ouvert === v ? null : v; if (v === "lot") E.nbLignesLot = 1; return rendre();
    case "fermer": E.ouvert = null; return rendre();
    case "ligne-lot": E.nbLignesLot++; var prev = { d: val("fl-d"), n: val("fl-n"), c: val("fl-c"), p: [].map.call(document.querySelectorAll(".fl-p"), function (e) { return e.value; }), q: [].map.call(document.querySelectorAll(".fl-q"), function (e) { return e.value; }) }; rendre();
      $("fl-d").value = prev.d; $("fl-n").value = prev.n; $("fl-c").value = prev.c; document.querySelectorAll(".fl-p").forEach(function (e, i) { if (prev.p[i]) e.value = prev.p[i]; }); document.querySelectorAll(".fl-q").forEach(function (e, i) { if (prev.q[i]) e.value = prev.q[i]; }); return;
    case "enregistrer-vente": return envoyer("ajouter_vente", { date: val("fv-d"), produitId: val("fv-p"), qte: val("fv-q"), pointVente: val("fv-pv"), prix: val("fv-px"), remise: val("fv-r") }, "Vente enregistrée");
    case "enregistrer-perte": return envoyer("ajouter_perte", { date: val("fp-d"), produitId: val("fp-p"), qte: val("fp-q"), type: val("fp-t") }, "Perte enregistrée");
    case "enregistrer-depense": return envoyer("ajouter_depense", { date: val("fd-d"), categorie: val("fd-c"), description: val("fd-t"), montant: val("fd-m"), mode: val("fd-mode") }, "Dépense enregistrée");
    case "enregistrer-lot":
      var lignes = [].map.call(document.querySelectorAll(".fl-p"), function (e, i) { return { produitId: e.value, qte: document.querySelectorAll(".fl-q")[i].value }; });
      return envoyer("ajouter_lot", { date: val("fl-d"), nom: val("fl-n"), cout: val("fl-c"), lignes: lignes, moment: val("fl-m") }, "Production enregistrée");
    case "enregistrer-soir":
      var items = [].map.call(document.querySelectorAll("input.reste"), function (e) { return { produitId: e.getAttribute("data-pid"), restant: e.value }; });
      E.soirResume = true;
      return charge("comptage", { date: E.soirDate, pointVente: val("so-pv"), items: items, du: E.soirDate, au: E.soirDate }).then(function () { E.soir = null; ok("Comptage enregistré"); chargerSoir(); }).catch(function () {});
    case "supprimer":
      if (!confirm("Supprimer cette ligne ? Les chiffres seront recalculés.")) return;
      return envoyer("supprimer", { type: t.getAttribute("data-t"), id: t.getAttribute("data-id") }, "Supprimé", function () { E.soir = null; });
    case "retirer-interne": var c = paramsLus(); c.internes.splice(+t.getAttribute("data-i"), 1); return envoyer("config", { config: c }, "Réglages enregistrés");
    case "depart-ouvrir": E.depart = !E.depart; return rendre();
    case "depart-valider":
      if (val("nd-conf").trim().toUpperCase() !== "ZERO") { A.toast("Tapez le mot ZERO pour confirmer", "err"); return; }
      var itemsND = [].map.call(document.querySelectorAll("[data-nd-q]"), function (e) {
        var id = e.getAttribute("data-nd-q"), c = document.querySelector('[data-nd-c="' + id + '"]');
        return { produitId: id, qte: e.value, coutUnitaire: c ? c.value : 0 };
      });
      var caisseND = val("nd-caisse");
      return appel("sauvegarde").then(function (s) {
        var u = URL.createObjectURL(new Blob([JSON.stringify(s, null, 1)], { type: "application/json" })), a = document.createElement("a");
        a.href = u; a.download = "sauvegarde-suivi-noogo-" + jourJ(0) + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
        if (!confirm("Sauvegarde téléchargée. Tout effacer maintenant et repartir de zéro avec la caisse de " + caisseND + " F ?")) throw Object.assign(new Error("Annulé"), { silencieux: true });
        return charge("nouveau_depart", { date: val("nd-date") || jourJ(0), caisse: caisseND, items: itemsND });
      }).then(function () { E.depart = false; E.ouvert = null; E.soir = null; ok("Nouveau départ fait : tout repart de zéro"); rendre(); }).catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); });
    case "enregistrer-params": return envoyer("config", { config: paramsLus() }, "Réglages enregistrés");
    case "importer":
      if (!confirm("Reprendre l'historique du 03 au 08 octobre depuis votre ancien classeur ?")) return;
      return envoyer("importer_historique", {}, "Historique repris : consultez le Résumé");
    case "export":
      return appel("export").then(function (d) {
        if (v === "ventes") partager("noogo-ventes.csv", csv(d.ventes, [["date", "Date"], ["nom", "Produit"], ["qte", "Quantité"], ["montant", "Chiffre d'affaires (F)"], ["cout", "Coût (F)"], ["canal", "Point de vente"], ["source", "Origine"]]), "text/csv;charset=utf-8");
        if (v === "depenses") partager("noogo-depenses.csv", csv(d.depenses, [["date", "Date"], ["categorie", "Catégorie"], ["description", "Description"], ["montant", "Montant (F)"], ["mode", "Paiement"]]), "text/csv;charset=utf-8");
        if (v === "stock") partager("noogo-stock.csv", csv(d.stock, [["nom", "Produit"], ["theorique", "Stock"], ["coutMoyen", "Coût moyen (F)"], ["valeur", "Valeur (F)"]]), "text/csv;charset=utf-8");
      }).catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); });
  }
}
function change(ev) {
  var t = ev.target;
  if (t.id === "so-date") { E.soirDate = t.value || jourJ(0); E.soir = null; E.soirResume = false; rendre(); }
  if (t.id === "fl-d" && $("fl-m-box") && E.vue) { $("fl-m-box").style.display = (E.vue.comptages || []).some(function (c) { return c.date === t.value; }) ? "" : "none"; }
  if (t.id === "su-du" || t.id === "su-au") {
    E.du = val("su-du") || E.du; E.au = val("su-au") || E.au;
    if (E.du && E.au && E.du > E.au) return A.toast("La date de début doit être avant la date de fin.", "err");
    return rafraichir();
  }
  if (t.id === "cl-d") { E.jourCloture = t.value || ""; return charge("lire").catch(function () {}); }
  if (t.id === "fv-p") { var o = t.options[t.selectedIndex]; if ($("fv-px")) $("fv-px").placeholder = "Prix du site : " + (o ? o.getAttribute("data-prix") : ""); }
}

window.SuiviUI = { ouvrir: ouvrir };
})();
