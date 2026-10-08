// Stockage Noogo : Redis (Upstash, via Vercel Storage). En test local : mémoire.
// Les listes sont stockées en "hash" (une entrée par commande / partenaire) pour éviter
// que deux commandes simultanées ne s'écrasent entre elles.

const MEMOIRE = process.env.NOOGO_MEMORY_STORE === "1";
const mem = { hash: {}, kv: {}, compteurs: {} };

let redis = null;
function db() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const e = new Error("Base de données non connectée");
    e.code = "DB_NON_CONFIGUREE";
    throw e;
  }
  const { Redis } = require("@upstash/redis");
  redis = new Redis({ url, token });
  return redis;
}

async function hgetall(nom) {
  if (MEMOIRE) return { ...(mem.hash[nom] || {}) };
  return (await db().hgetall(nom)) || {};
}
async function hset(nom, champ, valeur) {
  if (MEMOIRE) { (mem.hash[nom] = mem.hash[nom] || {})[champ] = JSON.parse(JSON.stringify(valeur)); return; }
  await db().hset(nom, { [champ]: valeur });
}
async function hdel(nom, champ) {
  if (MEMOIRE) { if (mem.hash[nom]) delete mem.hash[nom][champ]; return; }
  await db().hdel(nom, champ);
}
async function hget(nom, champ) {
  if (MEMOIRE) return (mem.hash[nom] || {})[champ] || null;
  return (await db().hget(nom, champ)) || null;
}

const valeurs = (o) => Object.values(o || {});

async function getPartenaires() { return valeurs(await hgetall("noogo:partenaires")); }
async function getPartenaire(id) { return hget("noogo:partenaires", id); }
async function setPartenaire(p) { await hset("noogo:partenaires", p.id, p); }
async function deletePartenaire(id) { await hdel("noogo:partenaires", id); }

async function getCommandes() { return valeurs(await hgetall("noogo:commandes")); }
async function getCommande(id) { return hget("noogo:commandes", id); }
async function setCommande(c) { await hset("noogo:commandes", c.id, c); }
async function deleteCommande(id) { await hdel("noogo:commandes", id); }

async function getCatalogue() {
  if (MEMOIRE) return mem.kv["noogo:catalogue"] || null;
  return (await db().get("noogo:catalogue")) || null;
}
async function setCatalogue(liste) {
  if (MEMOIRE) { mem.kv["noogo:catalogue"] = liste; return; }
  if (liste === null) await db().del("noogo:catalogue");
  else await db().set("noogo:catalogue", liste);
}

// Limite de requêtes : renvoie true si autorisé.
async function limiter(cle, max, secondes) {
  try {
    if (MEMOIRE) {
      const now = Date.now();
      const c = mem.compteurs[cle];
      if (!c || now > c.fin) { mem.compteurs[cle] = { n: 1, fin: now + secondes * 1000 }; return true; }
      c.n += 1; return c.n <= max;
    }
    const k = "noogo:rl:" + cle;
    const n = await db().incr(k);
    if (n === 1) await db().expire(k, secondes);
    return n <= max;
  } catch (e) {
    if (e.code === "DB_NON_CONFIGUREE") throw e;
    return true; // en cas de souci Redis on ne bloque pas les clients
  }
}

module.exports = {
  getPartenaires, getPartenaire, setPartenaire, deletePartenaire,
  getCommandes, getCommande, setCommande, deleteCommande,
  getCatalogue, setCatalogue, limiter
};
