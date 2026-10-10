const S = require("./_store");
const { fusionner } = require("./_site");

// Réglages publics du site (textes, paiement, galerie) : lecture seule.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");
  let stocke = null;
  try { stocke = await S.getReglages(); } catch (e) { /* base absente : valeurs par défaut */ }
  return res.status(200).json(fusionner(stocke));
};
