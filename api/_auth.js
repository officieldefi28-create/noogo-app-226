const crypto = require("crypto");

// --- Mots de passe : hachage sécurisé (pbkdf2, intégré à Node, pas de dépendance externe) ---

function hacherMotDePasse(motDePasse) {

const sel = crypto.randomBytes(16).toString("hex");
const hash = crypto
.pbkdf2Sync(motDePasse, sel, 100000, 64, "sha512")
.toString("hex");

return `${sel}:${hash}`;

}

function verifierMotDePasse(motDePasse, motDePasseHache) {

const [sel, hash] = motDePasseHache.split(":");

const hashTest = crypto
.pbkdf2Sync(motDePasse, sel, 100000, 64, "sha512")
.toString("hex");

return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashTest));

}

// --- Jetons de session signés (pas de base de données de sessions nécessaire) ---

function signerJeton(donnees, secret) {

const payload = Buffer.from(JSON.stringify(donnees)).toString("base64url");
const signature = crypto
.createHmac("sha256", secret)
.update(payload)
.digest("base64url");

return `${payload}.${signature}`;

}

function verifierJeton(jeton, secret) {

try {

const [payload, signature] = jeton.split(".");

const signatureAttendue = crypto
.createHmac("sha256", secret)
.update(payload)
.digest("base64url");

if (
!crypto.timingSafeEqual(
Buffer.from(signature),
Buffer.from(signatureAttendue)
)
) {
return null;
}

const donnees = JSON.parse(Buffer.from(payload, "base64url").toString());

// Le jeton expire après 7 jours
if (Date.now() - donnees.creeLe > 7 * 24 * 60 * 60 * 1000) {
return null;
}

return donnees;

} catch (erreur) {

return null;

}

}

function genererMotDePasseTemporaire() {

return crypto.randomBytes(4).toString("hex").toUpperCase();

}

module.exports = {
hacherMotDePasse,
verifierMotDePasse,
signerJeton,
verifierJeton,
genererMotDePasseTemporaire
};
