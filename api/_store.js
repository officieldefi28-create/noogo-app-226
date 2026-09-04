const { kv } = require("@vercel/kv");

async function getPartenaires() {
  return (await kv.get("partners")) || [];
}
async function setPartenaires(partenaires) {
  await kv.set("partners", partenaires);
}
async function getCommandes() {
  return (await kv.get("orders")) || [];
}
async function setCommandes(commandes) {
  await kv.set("orders", commandes);
}

module.exports = { getPartenaires, setPartenaires, getCommandes, setCommandes };
