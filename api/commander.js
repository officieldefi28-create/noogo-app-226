const { getStore } = require("@netlify/blobs");

// Jours de la semaine : 0=dimanche, 1=lundi, 2=mardi ... 6=samedi
function jourValide(partenaire) {

if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) {
return true; // pas de restriction : valide tous les jours
}

let aujourdhui = new Date().getDay();
return partenaire.joursActifs.includes(aujourdhui);

}

function calculerRemise(partenaire, montantTotal) {

let remise = 0;

if (partenaire.remiseType === "pourcentage") {
remise = Math.round(montantTotal * (partenaire.remiseValeur / 100));
} else {
remise = partenaire.remiseValeur;
}

if (remise > montantTotal) {
remise = montantTotal;
}

return remise;

}

function calculerCommission(partenaire, montantApresRemise) {

if (partenaire.commissionType === "fixe") {
return partenaire.commissionValeur;
}

return Math.round(montantApresRemise * (partenaire.commissionValeur / 100));

}

exports.handler = async (event) => {

if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Méthode non autorisée" };
}

try {

const donnees = JSON.parse(event.body);
const { code, montantTotal, nomClient, telClient, localisation, modePaiement } = donnees;

const store = getStore("noogo-data");

let partenaires = (await store.get("partners.json", { type: "json" })) || [];
let commandes = (await store.get("orders.json", { type: "json" })) || [];

let partenaire = null;
let messageCode = null;

if (code && code.trim() !== "") {

let codeNormalise = code.trim().toUpperCase();
let trouve = partenaires.find(
(p) => p.code.toUpperCase() === codeNormalise && p.actif
);

if (!trouve) {
messageCode = "Code promo invalide ou désactivé";
} else if (!jourValide(trouve)) {
messageCode = "Ce code n'est valable que le mardi et le samedi";
} else {
partenaire = trouve;
}

}

let remise = 0;
let montantApresRemise = montantTotal;
let commission = 0;

if (partenaire) {

remise = calculerRemise(partenaire, montantTotal);
montantApresRemise = montantTotal - remise;
commission = calculerCommission(partenaire, montantApresRemise);

}

let nouvelleCommande = {
id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
date: new Date().toISOString(),
code: partenaire ? partenaire.code : null,
partenaireId: partenaire ? partenaire.id : null,
partenaireNom: partenaire ? partenaire.nom : null,
montantTotal: montantTotal,
remise: remise,
montantApresRemise: montantApresRemise,
commission: commission,
nomClient: nomClient || "",
telClient: telClient || "",
localisation: localisation || "",
modePaiement: modePaiement || "especes",
statutLivraison: "en_attente",
statutCommission: "impaye"
};

commandes.push(nouvelleCommande);
await store.setJSON("orders.json", commandes);

return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
codeValide: !!partenaire,
messageCode: messageCode,
remise: remise,
montantFinal: montantApresRemise,
partenaireNom: partenaire ? partenaire.nom : null
})
};

} catch (erreur) {

return {
statusCode: 500,
body: JSON.stringify({ erreur: "Erreur serveur", details: erreur.message })
};

}

};
