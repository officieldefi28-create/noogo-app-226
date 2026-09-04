const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");
const { hacherMotDePasse, genererMotDePasseTemporaire } = require("./_auth");

function verifierMotDePasseAdmin(motDePasseRecu) {

const motDePasseAdmin = process.env.ADMIN_PASSWORD;

if (!motDePasseAdmin || !motDePasseRecu) {
return false;
}

if (motDePasseRecu.length !== motDePasseAdmin.length) {
return false;
}

return crypto.timingSafeEqual(
Buffer.from(motDePasseRecu),
Buffer.from(motDePasseAdmin)
);

}

exports.handler = async (event) => {

if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Méthode non autorisée" };
}

try {

const body = JSON.parse(event.body);
const { motDePasseAdmin, action } = body;

if (!verifierMotDePasseAdmin(motDePasseAdmin)) {
return {
statusCode: 401,
body: JSON.stringify({ erreur: "Mot de passe administrateur incorrect" })
};
}

const store = getStore("noogo-data");
let partenaires = (await store.get("partners.json", { type: "json" })) || [];
let commandes = (await store.get("orders.json", { type: "json" })) || [];

// --- Lister tout (partenaires + commandes) ---
if (action === "tout_voir") {

return reponse(200, {
partenaires: partenaires,
commandes: commandes.sort((a, b) => new Date(b.date) - new Date(a.date))
});

}

// --- Créer un partenaire ---
if (action === "creer_partenaire") {

const {
nom,
telephone,
type,
code,
remiseType,
remiseValeur,
commissionType,
commissionValeur,
joursActifs
} = body;

if (!nom || !telephone || !code) {
return reponse(400, { erreur: "Nom, téléphone et code sont obligatoires" });
}

let codeExiste = partenaires.some(
(p) => p.code.toUpperCase() === code.trim().toUpperCase()
);

if (codeExiste) {
return reponse(400, { erreur: "Ce code promo existe déjà" });
}

let motDePasseTemporaire = genererMotDePasseTemporaire();

let nouveauPartenaire = {
id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
nom: nom,
telephone: telephone,
type: type || "particulier",
code: code.trim().toUpperCase(),
remiseType: remiseType || "pourcentage",
remiseValeur: Number(remiseValeur) || 0,
commissionType: commissionType || "pourcentage",
commissionValeur: Number(commissionValeur) || 0,
joursActifs: Array.isArray(joursActifs) ? joursActifs : [],
motDePasseHache: hacherMotDePasse(motDePasseTemporaire),
actif: true,
creeLe: new Date().toISOString()
};

partenaires.push(nouveauPartenaire);
await store.setJSON("partners.json", partenaires);

return reponse(200, {
message: "Partenaire créé",
motDePasseTemporaire: motDePasseTemporaire,
partenaire: { ...nouveauPartenaire, motDePasseHache: undefined }
});

}

// --- Créer automatiquement les 2 codes promo Mardi/Samedi (100 FCFA : 50 client / 50 partenaire) ---
if (action === "creer_codes_automatiques") {

let codesACreer = [
{
nom: "Promo Mardi",
telephone: "N/A-MARDI",
code: "MARDI50",
jour: 2 // mardi
},
{
nom: "Promo Samedi",
telephone: "N/A-SAMEDI",
code: "SAMEDI50",
jour: 6 // samedi
}
];

let resultats = [];

for (let c of codesACreer) {

let codeExiste = partenaires.some(
(p) => p.code.toUpperCase() === c.code.toUpperCase()
);

if (codeExiste) {
resultats.push({ code: c.code, statut: "déjà existant" });
continue;
}

let motDePasseTemporaire = genererMotDePasseTemporaire();

let nouveauPartenaire = {
id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
nom: c.nom,
telephone: c.telephone,
type: "promo_automatique",
code: c.code,
remiseType: "fixe",
remiseValeur: 50,
commissionType: "fixe",
commissionValeur: 50,
joursActifs: [c.jour],
motDePasseHache: hacherMotDePasse(motDePasseTemporaire),
actif: true,
creeLe: new Date().toISOString()
};

partenaires.push(nouveauPartenaire);
resultats.push({ code: c.code, statut: "créé" });

}

await store.setJSON("partners.json", partenaires);

return reponse(200, { message: "Codes automatiques traités", resultats: resultats });

}

// --- Activer / désactiver un partenaire (et son code) ---
if (action === "basculer_actif") {

const { partenaireId } = body;
let partenaire = partenaires.find((p) => p.id === partenaireId);

if (!partenaire) {
return reponse(404, { erreur: "Partenaire introuvable" });
}

partenaire.actif = !partenaire.actif;
await store.setJSON("partners.json", partenaires);

return reponse(200, { message: "Statut mis à jour", actif: partenaire.actif });

}

// --- Réinitialiser le mot de passe d'un partenaire ---
if (action === "reinitialiser_mot_de_passe") {

const { partenaireId } = body;
let partenaire = partenaires.find((p) => p.id === partenaireId);

if (!partenaire) {
return reponse(404, { erreur: "Partenaire introuvable" });
}

let nouveauMotDePasse = genererMotDePasseTemporaire();
partenaire.motDePasseHache = hacherMotDePasse(nouveauMotDePasse);
await store.setJSON("partners.json", partenaires);

return reponse(200, {
message: "Mot de passe réinitialisé",
motDePasseTemporaire: nouveauMotDePasse
});

}

// --- Valider la livraison d'une commande ---
if (action === "valider_livraison") {

const { commandeId } = body;
let commande = commandes.find((c) => c.id === commandeId);

if (!commande) {
return reponse(404, { erreur: "Commande introuvable" });
}

commande.statutLivraison = "livree";
await store.setJSON("orders.json", commandes);

return reponse(200, { message: "Livraison validée" });

}

// --- Annuler une commande ---
if (action === "annuler_commande") {

const { commandeId } = body;
let commande = commandes.find((c) => c.id === commandeId);

if (!commande) {
return reponse(404, { erreur: "Commande introuvable" });
}

commande.statutLivraison = "annulee";
await store.setJSON("orders.json", commandes);

return reponse(200, { message: "Commande annulée" });

}

// --- Marquer la commission d'une commande comme payée ---
if (action === "marquer_commission_payee") {

const { commandeId } = body;
let commande = commandes.find((c) => c.id === commandeId);

if (!commande) {
return reponse(404, { erreur: "Commande introuvable" });
}

commande.statutCommission = "paye";
await store.setJSON("orders.json", commandes);

return reponse(200, { message: "Commission marquée comme payée" });

}

// --- Marquer TOUTES les commissions livrées et impayées d'un partenaire comme payées ---
if (action === "payer_tout_le_solde") {

const { partenaireId } = body;

commandes
.filter(
(c) =>
c.partenaireId === partenaireId &&
c.statutLivraison === "livree" &&
c.statutCommission === "impaye"
)
.forEach((c) => {
c.statutCommission = "paye";
});

await store.setJSON("orders.json", commandes);

return reponse(200, { message: "Solde payé" });

}

return reponse(400, { erreur: "Action inconnue" });

} catch (erreur) {

return reponse(500, { erreur: "Erreur serveur", details: erreur.message });

}

};

function reponse(statusCode, corps) {

return {
statusCode: statusCode,
headers: { "Content-Type": "application/json" },
body: JSON.stringify(corps)
};

}
