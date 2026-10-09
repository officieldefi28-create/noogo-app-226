// Photos des articles : l'admin envoie une photo (JPEG redimensionnée), elle est gardée en base
// et servie à tous les visiteurs par GET /api/photo?id=...
const crypto = require("crypto");
const { adminValide } = require("./_auth");
const S = require("./_store");

const MAX_OCTETS = 600 * 1024; // une photo préparée par l'admin fait ~100 à 300 Ko

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.id) || "");
      if (!/^[a-f0-9]{16,40}$/.test(id)) return res.status(404).end();
      const b64 = await S.getPhoto(id);
      if (!b64) return res.status(404).end();
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(Buffer.from(String(b64), "base64"));
    }

    if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });
    res.setHeader("Cache-Control", "no-store");
    const d = req.body || {};
    if (!adminValide(d.jeton)) return res.status(401).json({ erreur: "Session expirée, reconnectez-vous", session: false });

    const b64 = String(d.donnees || "").replace(/^data:image\/jpeg;base64,/, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return res.status(400).json({ erreur: "Photo invalide" });
    const octets = Buffer.from(b64, "base64");
    if (octets.length < 500) return res.status(400).json({ erreur: "Photo invalide" });
    if (octets.length > MAX_OCTETS) return res.status(413).json({ erreur: "Photo trop lourde, réessayez" });
    if (!(octets[0] === 0xff && octets[1] === 0xd8)) return res.status(400).json({ erreur: "La photo doit être un JPEG" });

    const id = crypto.randomBytes(12).toString("hex");
    await S.setPhoto(id, b64);
    return res.status(200).json({ url: "/api/photo?id=" + id });
  } catch (e) {
    if (e && e.code === "DB_NON_CONFIGUREE") return res.status(503).json({ erreur: "Base de données non connectée" });
    console.error("photo", e && e.message);
    return res.status(500).json({ erreur: "Erreur serveur" });
  }
};
