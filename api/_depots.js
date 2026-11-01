// Dépôts Orange Money / Wave reçus sur le téléphone du responsable.
// Lit le texte d'un SMS, évite les doublons (numéro de transaction), propose à qui rattacher l'argent.
// Rien n'est compté tant que le responsable n'a pas rangé le dépôt.
const S = require("./_store");

const dernierChiffres = (s) => String(s || "").replace(/\D/g, "").slice(-8);
const nombre = (s) => { const n = parseFloat(String(s || "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n) : 0; };

function lireSms(texte) {
  const t = String(texte || "").replace(/\s+/g, " ").trim().slice(0, 600);
  const m = t.match(/re[cç]u\s+([\d][\d\s.,]*?)\s*(?:FCFA|F\s*CFA|XOF|CFA)/i);
  if (!m) return null;                                   // pas un SMS de dépôt
  const montant = nombre(m[1]);
  if (montant < 1 || montant > 100000000) return null;
  let de = "", num = "";
  const e = t.match(/\bdu\s+(\+?\d[\d\s]{5,15})\s*,\s*([^.]+?)\s*\./i) || t.match(/\bdu\s+(\+?\d[\d\s]{5,15})/i);
  if (e) { num = e[1].replace(/\D/g, ""); de = (e[2] || "").trim().slice(0, 40); }
  const so = t.match(/solde[^0-9]*([\d][\d\s.,]*?)\s*(?:FCFA|F\s*CFA|XOF|CFA)/i);
  const tr = t.match(/Trans\s*id\s*:?\s*([A-Za-z0-9._-]{6,40})/i);
  return { montant, de, num, solde: so ? nombre(so[1]) : null, transId: tr ? tr[1].replace(/[.\-_]+$/, "") : "", mode: /wave/i.test(t) ? "Wave" : "Orange Money" };
}

async function proposer(dep, equipe) {
  const l8 = dernierChiffres(dep.num);
  const numeros = (await S.getDoc("numeros")) || {};
  if (l8.length >= 8 && numeros[l8]) return { ...numeros[l8], raison: "Numéro déjà reconnu" };
  if (l8.length >= 8) {
    const lv = (equipe || []).find((x) => x && x.actif !== false && dernierChiffres(x.tel) === l8);
    if (lv) return { type: lv.poste === "livreur" ? "livreur" : "equipe", id: lv.id, nom: lv.nom, raison: "Numéro de " + lv.nom };
  }
  const recus = (await S.suiviListe("recus")).find((r) => r && !r.archive && !r.du && !r.verifie && /orange|wave/i.test(String(r.paiement || "")) && Number(r.total) === dep.montant);
  if (recus) return { type: "recu", id: recus.id, nom: (recus.vendeur || "") + " · reçu de " + recus.total + " F", raison: "Vente en " + recus.paiement + " du même montant" };
  const cmd = (await S.getCommandes()).find((c) => c && c.statutLivraison !== "annulee" && !c.depotId && c.modePaiement && c.modePaiement !== "especes" && (Number(c.montantApresRemise != null ? c.montantApresRemise : c.montantTotal) === dep.montant || (l8.length >= 8 && dernierChiffres(c.telClient) === l8)));
  if (cmd) return { type: "commande", id: cmd.id, nom: (cmd.nomClient || "Client") + " · commande " + cmd.id, raison: "Commande du site (montant ou numéro identique)" };
  return null;
}

async function enregistrer(brut, equipe, source) {
  const p = lireSms(brut);
  if (!p) return { ignore: true };
  const id = p.transId ? "DP-" + p.transId.replace(/[^A-Za-z0-9_-]/g, "") : "DP-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const existe = (await S.suiviListe("depots")).find((x) => x && x.id === id);
  if (existe) return { deja: true, depot: existe };
  const dep = { id, date: new Date().toISOString().slice(0, 10), heure: new Date().toISOString(), montant: p.montant, mode: p.mode, de: p.de, num: p.num, transId: p.transId, solde: p.solde, source: source || "sms", statut: "attente", cible: null, brut: String(brut || "").slice(0, 300) };
  dep.propose = await proposer(dep, equipe);
  await S.suiviSet("depots", id, dep);
  return { depot: dep };
}

// Contrôle avec le solde écrit dans le SMS : si l'écart ne correspond pas au montant, un SMS manque (ou un retrait a eu lieu)
function annoter(liste) {
  const l = (liste || []).filter((x) => x && !x.archive).sort((a, b) => ((a.heure || "") < (b.heure || "") ? -1 : 1));
  let prec = null;
  l.forEach((x) => {
    x.alerteSolde = 0;
    if (x.solde != null && x.source === "sms") {
      if (prec && prec.solde != null) { const diff = x.solde - prec.solde - x.montant; if (Math.abs(diff) > 1) x.alerteSolde = diff; }
      prec = x;
    }
  });
  return l.reverse();
}

module.exports = { lireSms, enregistrer, proposer, annoter, dernierChiffres };
