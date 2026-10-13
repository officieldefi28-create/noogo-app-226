/* Noogó — onglet « Clients » de l'admin : avis (à valider), demandes de revendeurs, actualités, pages légales.
   Tout passe par /api/communaute (le serveur vérifie la session admin). */
(function () {
"use strict";
var A = window.NOOGO_ADMIN;
if (!A) return;
var $ = function (id) { return document.getElementById(id); };
var esc = A.esc;
var E = { d: null, sous: "visites", edit: null };
var dateFr = function (iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); };
var jour = function () { return new Date().toISOString().slice(0, 10); };

function appel(action, extra) {
  return fetch("/api/communaute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action, jeton: A.jeton() }, extra || {})) })
    .catch(function () { throw new Error("Pas de connexion internet."); })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
      if (r.status === 401) { A.deconnecter("Session expirée, reconnectez-vous."); var e = new Error("Session expirée"); e.silencieux = true; throw e; }
      if (!r.ok) throw new Error(d.erreur || "Erreur"); return d; }); });
}
function compteur() {
  var d = E.d; if (!d) return;
  var n = d.avis.filter(function (a) { return a.statut === "attente"; }).length + d.demandes.filter(function (r) { return r.statut === "nouveau"; }).length;
  var c = $("cpt-communaute"); if (c) { c.textContent = n; c.classList.toggle("cachee", !n); }
}
function charger(silencieux) {
  return appel("tout").then(function (d) { E.d = d; compteur(); if ($("p-communaute").classList.contains("actif")) rendre(); })
    .catch(function (e) { if (!silencieux && !e.silencieux) A.toast(e.message, "err"); });
}
function ouvrir() {
  var c = $("p-communaute");
  if (!c.dataset.pret) { c.dataset.pret = "1"; c.addEventListener("click", clic); }
  if (!E.d) c.innerHTML = '<p class="gris">Chargement…</p>'; else rendre();
  charger(false);
}
setInterval(function () { if (A.jeton() && !document.hidden) charger(true); }, 120000);
setTimeout(function () { if (A.jeton()) charger(true); }, 4000);

var SOUS = [["visites", "Visites"], ["avis", "Avis"], ["revendeurs", "Revendeurs"], ["actus", "Actualités"], ["legal", "Pages légales"]];
function rendre() {
  var c = $("p-communaute"), d = E.d; if (!d) return;
  var nA = d.avis.filter(function (a) { return a.statut === "attente"; }).length, nR = d.demandes.filter(function (r) { return r.statut === "nouveau"; }).length;
  var lib = { visites: "Visites", avis: "Avis" + (nA ? " (" + nA + ")" : ""), revendeurs: "Revendeurs" + (nR ? " (" + nR + ")" : ""), actus: "Actualités", legal: "Pages légales" };
  var nav = '<div class="filtres" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + SOUS.map(function (s) {
    return '<button type="button" class="puce" data-c="sous" data-v="' + s[0] + '" aria-pressed="' + (E.sous === s[0]) + '">' + lib[s[0]] + '</button>'; }).join("") + '</div>';
  c.innerHTML = nav + ({ visites: vVisites, avis: vAvis, revendeurs: vRev, actus: vActus, legal: vLegal }[E.sous])(d);
}
function etoiles(n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
function bt(act, id, label, cls) { return '<button type="button" class="btn btn-petit ' + (cls || "btn-clair") + '" data-c="' + act + '" data-id="' + esc(id) + '">' + label + '</button>'; }

function vVisites(d) {
  var S = d.stats || {}, jours = Object.keys(S).sort().reverse().slice(0, 14);
  var EV = [["visite", "Visites"], ["carte_vue", "Ont vu la carte"], ["ajout_panier", "Ajouts au panier"], ["panier_ouvert", "Paniers ouverts"], ["commande_envoyee", "Commandes envoyées"]];
  var tot = {}; EV.forEach(function (e) { tot[e[0]] = 0; });
  jours.forEach(function (j) { EV.forEach(function (e) { tot[e[0]] += S[j][e[0]] || 0; }); });
  var taux = tot.visite ? Math.round((tot.commande_envoyee / tot.visite) * 1000) / 10 : 0;
  var h = '<div class="carte"><h3>14 derniers jours</h3>' + EV.map(function (e) { return '<div class="rang"><div class="g"><b>' + e[1] + '</b></div><div style="text-align:right"><b>' + tot[e[0]] + '</b></div></div>'; }).join("") +
    '<p class="astuce">Sur 100 visiteurs, ' + taux + ' envoient une commande. Si « visites » est haut et « ajouts au panier » bas, le problème est la carte ; si les paniers sont ouverts mais pas envoyés, c\'est la livraison, le prix ou la confiance.</p></div>';
  if (!jours.length) return '<div class="carte"><p class="gris">Les compteurs commencent à partir de maintenant : revenez demain.</p></div>';
  return h + '<div class="carte"><h3>Jour par jour</h3>' + jours.map(function (j) { var x = S[j]; return '<div class="rang"><div class="g"><b>' + esc(dateFr(j)) + '</b><small>' + EV.map(function (e) { return e[1] + " " + (x[e[0]] || 0); }).join(" · ") + '</small></div></div>'; }).join("") + '</div>';
}
function vAvis(d) {
  var L = { attente: ["badge-or", "À valider"], publie: ["badge-vert", "Publié"], masque: ["badge-gris", "Masqué"] };
  var intro = '<p class="gris petit">Les avis envoyés par les clients ne s\'affichent sur le site qu\'après votre validation. Publiez seulement de vrais avis.</p>';
  if (!d.avis.length) return intro + '<div class="vide">Aucun avis pour le moment.</div>';
  return intro + d.avis.map(function (a) {
    var l = L[a.statut] || L.attente;
    return '<article class="carte" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>' + esc(a.nom) + (a.quartier ? ' · ' + esc(a.quartier) : '') + '</b><span class="badge ' + l[0] + '">' + l[1] + '</span></div>' +
      '<div style="color:#c9982b;font-size:18px;letter-spacing:2px">' + etoiles(a.note) + '</div><p style="margin:6px 0">' + esc(a.texte) + '</p><p class="gris petit">' + esc(dateFr(a.date)) + '</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (a.statut !== "publie" ? bt("avis-publie", a.id, "Publier", "btn-vert") : "") + (a.statut !== "masque" ? bt("avis-masque", a.id, "Masquer") : "") + bt("avis-suppr", a.id, "Supprimer", "btn-contour") + '</div></article>';
  }).join("");
}
function vRev(d) {
  var intro = '<p class="gris petit">Les personnes qui veulent devenir revendeurs depuis le site. Rappelez-les, puis marquez « Traité ».</p>';
  if (!d.demandes.length) return intro + '<div class="vide">Aucune demande pour le moment.</div>';
  return intro + d.demandes.map(function (r) {
    var wa = String(r.tel || "").replace(/\D/g, "");
    return '<article class="carte" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(r.nom) + '</b><span class="badge ' + (r.statut === "nouveau" ? "badge-or" : "badge-gris") + '">' + (r.statut === "nouveau" ? "Nouveau" : "Traité") + '</span></div>' +
      '<p class="petit" style="margin:4px 0">' + esc(r.tel) + (r.quartier ? ' · ' + esc(r.quartier) : '') + (r.activite ? ' · ' + esc(r.activite) : '') + '</p>' +
      (r.message ? '<p style="margin:4px 0">' + esc(r.message) + '</p>' : '') + '<p class="gris petit">' + esc(dateFr(r.date)) + '</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn btn-petit btn-clair" href="tel:' + esc(String(r.tel).replace(/[^\d+]/g, "")) + '">Appeler</a>' +
      (wa.length >= 8 ? '<a class="btn btn-petit btn-vert" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">WhatsApp</a>' : '') +
      bt("dem-" + (r.statut === "nouveau" ? "traite" : "nouveau"), r.id, r.statut === "nouveau" ? "Marquer traité" : "Remettre en nouveau") + bt("dem-suppr", r.id, "Supprimer", "btn-contour") + '</div></article>';
  }).join("");
}
function vActus(d) {
  var e = E.edit;
  var form = '<article class="carte" style="margin-bottom:12px"><b>' + (e && e.id ? "Modifier l'actualité" : "Nouvelle actualité") + '</b>' +
    '<label for="ac-titre">Titre</label><input id="ac-titre" type="text" maxlength="100" value="' + esc(e ? e.titre : "") + '" placeholder="Ex : Nouveau parfum Néré !">' +
    '<label for="ac-texte">Texte</label><textarea id="ac-texte" rows="3" maxlength="600" placeholder="Quelques lignes">' + esc(e ? e.texte : "") + '</textarea>' +
    '<label for="ac-date">Date</label><input id="ac-date" type="date" value="' + esc(e ? e.date : jour()) + '">' +
    '<label class="sw" style="margin-top:8px"><input type="checkbox" id="ac-visible"' + (!e || e.visible !== false ? " checked" : "") + '><i></i>Visible sur le site</label>' +
    '<div style="display:flex;gap:6px;margin-top:10px">' + bt("actu-sauver", e && e.id || "", "Enregistrer", "btn-brun") + (e ? bt("actu-annuler", "", "Annuler") : "") + '</div></article>';
  var liste = d.actus.length ? d.actus.map(function (a) {
    return '<article class="carte" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(a.titre) + '</b>' + (a.visible === false ? '<span class="badge badge-gris">Masquée</span>' : '') + '</div><p class="gris petit">' + esc(a.date) + '</p><p style="margin:4px 0">' + esc(a.texte) + '</p>' +
      '<div style="display:flex;gap:6px">' + bt("actu-edit", a.id, "Modifier") + bt("actu-suppr", a.id, "Supprimer", "btn-contour") + '</div></article>';
  }).join("") : '<div class="vide">Aucune actualité. Elles s\'affichent sur le site dès que vous en publiez une.</div>';
  return form + liste;
}
var CH = [["entreprise", "Présentation de l'entreprise (mentions légales)", 3], ["ifu", "Numéro IFU (laissez vide tant que vous ne l'avez pas)", 1], ["rccm", "Numéro RCCM (laissez vide tant que vous ne l'avez pas)", 1],
  ["confidentialite", "Confidentialité (vos données)", 6], ["reclamations", "Réclamations", 4], ["remboursement", "Remboursement et retours", 5]];
function vLegal(d) {
  return '<p class="gris petit">Ces textes s\'affichent sur la page « Infos légales » du site (lien en bas de page). Relisez-les et adaptez-les à vos règles réelles.</p><div id="legal-champs">' +
    CH.map(function (c) { return '<label for="lg-' + c[0] + '">' + esc(c[1]) + '</label>' + (c[2] === 1 ? '<input id="lg-' + c[0] + '" type="text" maxlength="40" value="' + esc(d.legal[c[0]]) + '">' : '<textarea id="lg-' + c[0] + '" rows="' + c[2] + '" maxlength="2000">' + esc(d.legal[c[0]]) + '</textarea>'); }).join("") +
    '</div><div style="margin-top:12px">' + bt("legal-sauver", "", "Enregistrer les pages", "btn-brun") + ' <a class="btn btn-petit btn-clair" href="/legal.html" target="_blank" rel="noopener">Voir la page</a></div>';
}

function clic(ev) {
  var t = ev.target.closest("[data-c]"); if (!t) return;
  var a = t.getAttribute("data-c"), id = t.getAttribute("data-id"), d = E.d;
  if (a === "sous") { E.sous = t.getAttribute("data-v"); E.edit = null; return rendre(); }
  var run = function (act, extra, msg, apres) {
    t.disabled = true;
    return appel(act, extra).then(function () { if (msg) A.toast(msg, "ok"); if (apres) apres(); return charger(true); }).then(function () { rendre(); }).catch(function (e) { if (!e.silencieux) A.toast(e.message, "err"); t.disabled = false; });
  };
  if (a.indexOf("avis-") === 0 && a !== "avis-suppr") return run("avis_statut", { id: id, statut: a.slice(5) }, a === "avis-publie" ? "Avis publié" : "Avis masqué");
  if (a === "avis-suppr") { if (!confirm("Supprimer cet avis définitivement ?")) return; return run("avis_suppr", { id: id }, "Avis supprimé"); }
  if (a === "dem-traite" || a === "dem-nouveau") return run("demande_statut", { id: id, statut: a.slice(4) }, "Mis à jour");
  if (a === "dem-suppr") { if (!confirm("Supprimer cette demande ?")) return; return run("demande_suppr", { id: id }, "Demande supprimée"); }
  if (a === "actu-edit") { E.edit = d.actus.find(function (x) { return x.id === id; }) || null; return rendre(); }
  if (a === "actu-annuler") { E.edit = null; return rendre(); }
  if (a === "actu-suppr") { if (!confirm("Supprimer cette actualité ?")) return; return run("actu_suppr", { id: id }, "Actualité supprimée"); }
  if (a === "actu-sauver") return run("actu_sauver", { id: id, titre: $("ac-titre").value, texte: $("ac-texte").value, date: $("ac-date").value, visible: $("ac-visible").checked }, "Actualité enregistrée", function () { E.edit = null; });
  if (a === "legal-sauver") { var legal = {}; CH.forEach(function (c) { legal[c[0]] = $("lg-" + c[0]).value; }); return run("legal_sauver", { legal: legal }, "Pages enregistrées"); }
}
window.CommunauteUI = { ouvrir: ouvrir };
})();
