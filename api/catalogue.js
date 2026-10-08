const { chargerCatalogue } = require("./_catalogue");

// Catalogue public (lecture seule) : la version modifiée par l'admin, sinon celle par défaut.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");
  try {
    const produits = await chargerCatalogue();
    return res.status(200).json({ produits });
  } catch (e) {
    return res.status(500).json({ erreur: "Catalogue indisponible" });
  }
};
