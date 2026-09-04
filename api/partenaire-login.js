const { getStore } = require("@netlify/blobs");
const { verifierMotDePasse, signerJeton } = require("./_auth");

exports.handler = async (event) => {

if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Méthode non autorisée" };
}

const secretJeton = process.env.JETON_SECRET;

if (!secretJeton) {
return {
statusCode: 500,
body: JSON.stringify({ erreur: "Configuration serveur manquante (JETON_SECRET)" })
};
}

try {

const { telephone, motDePasse } = JSON.parse(event.body);

if (!telephone || !motDePasse) {
return {
statusCode: 400,
body: JSON.stringify({ erreur: "Numéro et mot de passe requis" })
};
}

const store = getStore("noogo-data");
let partenaires = (await store.get("partners.json", { type: "json" })) || [];

let telNormalise = telephone.replace(/\s+/g, "");

let partenaire = partenaires.find(
(p) => p.telephone.replace(/\s+/g, "") === telNormalise
);

if (!partenaire || !partenaire.actif) {
return {
statusCode: 401,
body: JSON.stringify({ erreur: "Numéro ou mot de passe incorrect" })
};
}

if (!verifierMotDePasse(motDePasse, partenaire.motDePasseHache)) {
return {
statusCode: 401,
body: JSON.stringify({ erreur: "Numéro ou mot de passe incorrect" })
};
}

let jeton = signerJeton(
{ partenaireId: partenaire.id, creeLe: Date.now() },
secretJeton
);

return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
jeton: jeton,
nom: partenaire.nom,
code: partenaire.code
})
};

} catch (erreur) {

return {
statusCode: 500,
body: JSON.stringify({ erreur: "Erreur serveur", details: erreur.message })
};

}

};
