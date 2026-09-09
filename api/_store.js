const { kv } = require("@vercel/kv");

async function getPartenaires() { return (await kv.get("partners")) || []; }
async function setPartenaires(p) { await kv.set("partners", p); }
async function getCommandes() { return (await kv.get("orders")) || []; }
async function setCommandes(c) { await kv.set("orders", c); }
async function getProduitsEtat() { return (await kv.get("products_visibility")) || {}; }
async function setProduitsEtat(e) { await kv.set("products_visibility", e); }

module.exports = { getPartenaires, setPartenaires, getCommandes, setCommandes, getProduitsEtat, setProduitsEtat };
