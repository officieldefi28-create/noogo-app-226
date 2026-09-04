const { getStore } = require("@netlify/blobs");
const { verifierJeton } = require("./_auth");

exports.handler = async (event) => {

if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Méthode non autorisée" };
}

const secretJeton = process.env.JETON_SECRET;

try {

const { jeton } = JSON.parse(event.body);

let session = verifierJeton(jeton, secretJeton);

if (!session) {
return {
statusCode: 401,
body: JSON.stringify({ erreur: "Session expirée, merci de vous reconnecter" })
};
}

const store = getStore("noogo-data");
let partenaires = (await store.get("partners.json", { type: "json" })) || [];
let commandes = (await store.get("orders.json", { type: "json" })) || [];

let partenaire = partenaires.find((p) => p.id === session.partenaireId);

if (!partenaire) {
return {
statusCode: 404,
body: JSON.stringify({ erreur: "Compte introuvable" })
};
}

let mesCommandes = commandes.filter((c) => c.partenaireId === partenaire.id);

let commandesLivrees = mesCommandes.filter((c) => c.statutLivraison === "livree");

let totalGagne = commandesLivrees.reduce((s, c) => s + c.commission, 0);
let totalPaye = commandesLivrees
.filter((c) => c.statutCommission === "paye")
.reduce((s, c) => s + c.commission, 0);
let soldeRestant = totalGagne - totalPaye;

return {
statusCode: 200,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
nom: partenaire.nom,
code: partenaire.code,
nombreCommandesTotal: mesCommandes.length,
nombreCommandesLivrees: commandesLivrees.length,
nombreCommandesEnAttente: mesCommandes.filter(
(c) => c.statutLivraison === "en_attente"
).length,
totalGagne: totalGagne,
totalPaye: totalPaye,
soldeRestant: soldeRestant,
commandes: mesCommandes
.sort((a, b) => new Date(b.date) - new Date(a.date))
.slice(0, 30)
.map((c) => ({
date: c.date,
montantTotal: c.montantTotal,
commission: c.commission,
statutLivraison: c.statutLivraison,
statutCommission: c.statutCommission
}))
})
};

} catch (erreur) {

return {
statusCode: 500,
body: JSON.stringify({ erreur: "Erreur serveur", details: erreur.message })
};

}

};
