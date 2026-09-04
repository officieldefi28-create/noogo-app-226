const { getStore } = require("@netlify/blobs");

function jourValide(partenaire) {

if (!partenaire.joursActifs || partenaire.joursActifs.length === 0) {
return true;
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

exports.handler = async (event) => {

if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Méthode non autorisée" };
}

try {

const { code, montantTotal } = JSON.parse(event.body);

if (!code || code.trim() === "") {
return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ valide: false })
};
}

const store = getStore("noogo-data");
let partenaires = (await store.get("partners.json", { type: "json" })) || [];

let codeNormalise = code.trim().toUpperCase();
let partenaire = partenaires.find(
(p) => p.code.toUpperCase() === codeNormalise && p.actif
);

if (!partenaire) {
return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ valide: false, message: "Code promo invalide" })
};
}

if (!jourValide(partenaire)) {
return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
valide: false,
message: "Ce code n'est valable que le mardi et le samedi"
})
};
}

let remise = calculerRemise(partenaire, montantTotal || 0);

return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
valide: true,
remise: remise,
montantFinal: (montantTotal || 0) - remise
})
};

} catch (erreur) {

return {
statusCode: 500,
body: JSON.stringify({ erreur: "Erreur serveur", details: erreur.message })
};

}

};
