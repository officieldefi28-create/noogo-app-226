# 🍦 Noogo - Système de Commande en Ligne

## 📋 Description
Noogo est une plateforme de commande en ligne pour crèmes glacées, popcorn et pains frais.
Livraison à Karpala et alentours. Ouvert 24h/24.

---

## 🚀 Déploiement Vercel

Ce projet est déployé automatiquement sur Vercel.

**URL:** https://noogo-app-226.vercel.app

### Configuration requise:
1. Connecter votre repo GitHub à Vercel
2. Vercel détectera automatiquement `vercel.json`
3. Déploiement automatique à chaque push

---

## 🗂️ Structure des fichiers

```
noogo-app-226/
├── index.html           ← Page d'accueil (site client)
├── admin.html           ← Espace administration
├── partenaire.html      ← Espace partenaires
├── manifest.json        ← Configuration PWA
├── sw.js                ← Service Worker (offline)
├── /produits/           ← Photos des produits
├── /API/                ← Backend (Node.js/Express)
└── README.md            ← Ce fichier
```

---

## 🔧 Fonctionnalités

### Client (index.html)
- ✅ Catalogue produits avec photos
- ✅ Panier dynamique
- ✅ Filtrage par catégorie
- ✅ Codes promo (FB, TT, MARDI, SAMEDI)
- ✅ Commande via WhatsApp
- ✅ Installation PWA (télécharger l'app)
- ✅ Mode hors ligne

### Admin (admin.html)
- ✅ Connexion sécurisée (mot de passe)
- ✅ Gestion codes promo
- ✅ Activer/Désactiver produits
- ✅ Ajouter produits
- ✅ Créer packs
- ✅ Upload photos (Cloudinary)
- ✅ Gestion commandes
- ✅ Gestion partenaires

### API Backend (/API/)
Doit implémenter les actions suivantes:

**Produits:**
- `creer_produit` - Ajouter un produit
- `lister_produits` - Lister tous les produits
- `set_produit_etat` - Activer/Désactiver
- `supprimer_produit` - Supprimer un produit
- `reset_produits_etat` - Réactiver tous

**Packs:**
- `creer_pack` - Créer un pack
- `lister_packs` - Lister les packs
- `supprimer_pack` - Supprimer un pack

**Codes Promo:**
- `creer_code` - Créer un code promo
- `lister_codes` - Lister les codes

**Commandes:**
- `lister_commandes` - Lister les commandes
- `supprimer_commande` - Supprimer une commande

**Partenaires:**
- `lister_partenaires` - Lister les partenaires
- `supprimer_partenaire` - Supprimer un partenaire

---

## 🔑 Identifiants Admin

**Mot de passe:** `delfioficiel`

⚠️ À changer dans `admin.html` ligne 13: `const MDP_ADMIN = "..."`

---

## 📸 Upload Photos Cloudinary

### Configuration:
1. Crée un compte Cloudinary: https://cloudinary.com
2. Cloud Name: `h03nfuzc`
3. Crée un Upload Preset: `noogo-produits`
4. Settings → Upload → Add Upload Preset → nom: `noogo-produits`

### Utilisation:
- Dans Admin → Section "Upload Photos"
- Sélectionne une photo
- Clique "Uploader"
- Copie l'URL reçue
- Utilise cette URL dans "Ajouter Produit" ou "Créer Pack"

---

## 📱 Installation PWA

L'app s'installe automatiquement sur:
- 📱 Téléphones Android/iOS
- 💻 Ordinateurs (Chrome, Edge)

**Bouton:** "Installer" en haut du site

---

## ⚙️ Configuration API

L'API doit être accessible à: `/api/admin`

Exemple de requête:
```javascript
fetch("/api/admin", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    action: "creer_produit",
    id: "choco-xl",
    nom: "Chocolat XL",
    prix: 2500,
    cat: "cremes",
    img: "https://..."
  })
})
```

---

## 🔐 Sécurité

- Mot de passe admin à changer
- HTTPS obligatoire (Vercel fourni)
- Validations côté client ET serveur
- Pas de données sensibles en localStorage

---

## 📞 Support

**WhatsApp:** +226 61 68 27 06
**Email:** officieldefi28@gmail.com

---

**Dernière mise à jour:** Septembre 2026
**Version:** 2.0 Professional
