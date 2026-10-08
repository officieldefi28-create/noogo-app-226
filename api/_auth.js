const crypto = require("crypto");

function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(motDePasse), sel, 100000, 64, "sha512").toString("hex");
  return `${sel}:${hash}`;
}

function verifierMotDePasse(motDePasse, motDePasseHache) {
  try {
    const [sel, hash] = String(motDePasseHache || "").split(":");
    if (!sel || !hash) return false;
    const test = crypto.pbkdf2Sync(String(motDePasse), sel, 100000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test));
  } catch (e) {
    return false;
  }
}

function signerJeton(donnees, secret) {
  const payload = Buffer.from(JSON.stringify(donnees)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifierJeton(jeton, secret, dureeMs = 7 * 24 * 3600 * 1000) {
  try {
    if (!jeton || typeof jeton !== "string") return null;
    const [payload, signature] = jeton.split(".");
    if (!payload || !signature) return null;
    const attendue = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const a = Buffer.from(signature), b = Buffer.from(attendue);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const donnees = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!donnees.creeLe || Date.now() - donnees.creeLe > dureeMs) return null;
    return donnees;
  } catch (e) {
    return null;
  }
}

function genererMotDePasseTemporaire() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Mot de passe administrateur : variable d'environnement ADMIN_PASSWORD (jamais dans le code).
function motDePasseAdminValide(saisi) {
  const attendu = process.env.ADMIN_PASSWORD;
  if (!attendu || typeof saisi !== "string") return false;
  const h = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(saisi), h(attendu));
}

const DUREE_ADMIN_MS = 12 * 3600 * 1000;

function adminValide(jeton) {
  const secret = process.env.JETON_SECRET;
  if (!secret) return null;
  const s = verifierJeton(jeton, secret, DUREE_ADMIN_MS);
  return s && s.role === "admin" ? s : null;
}

function ipClient(req) {
  const xf = req.headers["x-forwarded-for"];
  return (xf ? String(xf).split(",")[0] : req.socket && req.socket.remoteAddress) || "inconnue";
}

module.exports = {
  hacherMotDePasse, verifierMotDePasse, signerJeton, verifierJeton,
  genererMotDePasseTemporaire, motDePasseAdminValide, adminValide, ipClient
};
