# Noogó — Guide de déploiement (GitHub + Vercel)

## 1. Remplacer le contenu du dépôt GitHub
1. Décompressez le zip.
2. Sur GitHub, dans le dépôt `noogo-app-226`, **supprimez tous les anciens fichiers** (index-FIXED.html, index_backup.html, index_OLD_BACKUP.html, `admin .js`, anciens _auth.js/_store.js/commander.js à la racine, restes Netlify, anciens documents).
2. Glissez-déposez **tout le contenu du dossier décompressé** (pas le dossier lui-même) : « Add file → Upload files », puis « Commit changes ».
   Le dossier `api/`, `assets/` et `produits/` doivent être envoyés avec leurs fichiers.
3. Vercel redéploie automatiquement.

## 2. Variables d'environnement (Vercel → Settings → Environment Variables)
| Nom | Valeur |
|---|---|
| `ADMIN_PASSWORD` | **NOUVEAU** mot de passe admin (l'ancien était public sur GitHub : il faut le considérer compromis) |
| `JETON_SECRET` | longue suite aléatoire (40 caractères ou plus) |

Après l'ajout : Deployments → « Redeploy ».

## 3. Base de données (commandes, partenaires, catalogue)
Vercel → Storage → Create → **Upstash Redis** (offre gratuite) → Connect au projet.
Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont ajoutées toutes seules. Redéployez.
Sans base, le site marche quand même (commande via WhatsApp), mais l'admin et les partenaires affichent « base non connectée ».

## 4. Photos depuis l'admin (Cloudinary)
Compte Cloudinary (cloud `h03nfuzc`) → Settings → Upload → Upload presets → créer `noogo-produits`, **Signing mode : Unsigned**.

## 5. Premiers réglages
- Ouvrez `/admin.html`, connectez-vous avec le nouveau mot de passe.
- Partenaires → « Configuration rapide » : crée les codes MARDI, SAMEDI, FB, TT.
- Catalogue : changez prix, photos, disponibilité (Banane « sur commande », etc.), puis « Enregistrer le catalogue ».

## Règles en place
- Livraison à la charge du client pour les articles seuls ; **incluse pour les packs** ; retrait gratuit.
- Codes promo cachés (utilisables seulement si saisis).
- Les prix sont recalculés côté serveur : impossible de les falsifier depuis le navigateur.
