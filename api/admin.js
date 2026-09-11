// API Admin - Noogo V2.0
const fs = require('fs');
const path = require('path');

const PRODUITS_FILE = path.join(__dirname, 'produits.json');

// Charger produits
function chargerProduits() {
  try {
    const data = fs.readFileSync(PRODUITS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { produits: [], packs: [] };
  }
}

// Sauvegarder produits
function sauvegarderProduits(data) {
  fs.writeFileSync(PRODUITS_FILE, JSON.stringify(data, null, 2));
}

// Actions admin
module.exports = {
  // Lister produits
  lister_produits: (req, res) => {
    const data = chargerProduits();
    res.json({ ok: true, produits: data.produits });
  },

  // Créer produit
  creer_produit: (req, res) => {
    const { id, nom, prix, categorie, img, description } = req.body;
    if (!id || !nom || !prix) {
      return res.json({ ok: false, erreur: 'Champs manquants' });
    }
    
    const data = chargerProduits();
    const nouveau = {
      id,
      nom,
      prix,
      categorie: categorie || 'cremes',
      img: img || '🍦',
      rating: 0,
      avis: 0,
      actif: true,
      description: description || ''
    };
    
    data.produits.push(nouveau);
    sauvegarderProduits(data);
    res.json({ ok: true, msg: 'Produit créé' });
  },

  // Modifier état produit (actif/inactif)
  set_produit_etat: (req, res) => {
    const { produitId, actif } = req.body;
    const data = chargerProduits();
    const prod = data.produits.find(p => p.id === produitId);
    
    if (!prod) {
      return res.json({ ok: false, erreur: 'Produit non trouvé' });
    }
    
    prod.actif = actif;
    sauvegarderProduits(data);
    res.json({ ok: true, msg: 'État modifié' });
  },

  // Supprimer produit
  supprimer_produit: (req, res) => {
    const { produitId } = req.body;
    const data = chargerProduits();
    data.produits = data.produits.filter(p => p.id !== produitId);
    sauvegarderProduits(data);
    res.json({ ok: true, msg: 'Produit supprimé' });
  },

  // Lister packs
  lister_packs: (req, res) => {
    const data = chargerProduits();
    res.json({ ok: true, packs: data.packs });
  },

  // Créer pack
  creer_pack: (req, res) => {
    const { nom, desc, prix, cat, produits } = req.body;
    const data = chargerProduits();
    
    const nouveau = {
      id: 'pack-' + Date.now(),
      nom,
      prix,
      img: '🎁',
      rating: 0,
      avis: 0,
      actif: true,
      produits: produits || []
    };
    
    data.packs.push(nouveau);
    sauvegarderProduits(data);
    res.json({ ok: true, msg: 'Pack créé' });
  },

  // Supprimer pack
  supprimer_pack: (req, res) => {
    const { packId } = req.body;
    const data = chargerProduits();
    data.packs = data.packs.filter(p => p.id !== packId);
    sauvegarderProduits(data);
    res.json({ ok: true, msg: 'Pack supprimé' });
  }
};
