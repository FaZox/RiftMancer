# DEV_NOTES.md – Référence technique pour RiftMancer

> **Fichier dédié à l'IA et aux développeurs** – Contient uniquement les informations techniques essentielles.
> **Ne pas supprimer** : Utilisé pour économiser des tokens lors des futures sessions.

---

## 📌 **Référence rapide**
| Besoin | Fichier/Commande | Emplacement |
|--------|------------------|-------------|
| **Build PC** | `npm run desktop:exe` | `release/RiftMancer Setup <version>.exe` |
| **Build PC Test** | `npm run desktop:exe:test` | `release/RiftMancer Test Setup <version>.exe` |
| **Build Android** | `npm run android:apk` | `release/RiftMancer.apk` |
| **Modèles IA** | YOLO + DINOv2 | `public/models/` |
| **Cartes** | Images + hashes | `public/cards/`, `public/card-hashes.json` |
| **Données PC** | SQLite | `%APPDATA%\riftmancer\collection.sqlite` |
| **Données Test** | SQLite | `%APPDATA%\riftmancer-test\collection.sqlite` |
| **Port Sync Prod** | Serveur | **47321** |
| **Port Sync Test** | Serveur | **47322** |

---

## 🏗️ **Architecture du projet**

### Dossiers clés
```text
RiftMancer/
├── src/                      # Code source (React)
│   ├── desktop/              # Interface PC (Electron)
│   │   └── DesktopApp.jsx    # Point d'entrée PC
│   ├── App.jsx               # Point d'entrée Mobile
│   ├── components/           # Composants UI (partagés PC/Mobile)
│   ├── hooks/                # Logique métiers (useAppController, useCollection, useWishlist...)
│   ├── lib/                  # Utilitaires
│   │   ├── cardMatcher.js    # Moteur de reconnaissance (couleur + IA)
│   │   ├── yoloDetector.js   # Détection YOLO11s-pose
│   │   ├── aiRecognizer.js   # Reconnaissance DINOv2
│   │   ├── fingerprint.js     # Empreinte couleur (16x16 grid)
│   │   ├── syncClient.js     # Client de sync (Mobile)
│   │   ├── syncProtocol.js   # Protocole de sync (chiffrement, format)
│   │   ├── collectionDB.js    # Gestion IndexedDB (Mobile)
│   │   ├── prints.js / variants.js  # Variantes d'une carte (lien `oracle`)
│   └── i18n/                 # Traductions (FR/EN)
│
├── electron/                  # Backend PC (Node.js)
│   ├── main.cjs              # Processus principal Electron
│   ├── server.cjs             # Serveur de sync local
│   ├── store.cjs             # Gestion SQLite (PC)
│   ├── prices.cjs             # Récupération prix Cardmarket
│   ├── backups.cjs           # Sauvegardes automatiques
│   ├── syncCrypto.cjs        # Chiffrement (AES-256-GCM, HMAC-SHA256)
│   └── mdns.cjs              # Découverte réseau (mDNS)
│
├── android/                   # Projet Capacitor (Android)
│   └── capacitor.config.json # Configuration Capacitor
│
├── public/                    # Ressources statiques
│   ├── cards/               # Images des cartes (WebP, 2048px)
│   │   └── thumbs/          # Miniatures (300px)
│   ├── models/               # Modèles IA (ONNX)
│   │   ├── yolo11s-pose-riftbound-dyn.onnx  # Détection (float32, input variable)
│   │   └── dinov2s-ft-fp16.onnx             # Reconnaissance (DINOv2-small, 168x168px)
│   ├── card-hashes.json      # Catalogue + fingerprints couleurs
│   ├── sym/                  # Symboles du jeu : runes de domaines, gemmes de rareté, icônes de types (type-*.png)
│   └── ort/                  # ONNX Runtime WASM
│
├── scripts/                   # Scripts utilitaires
│   ├── make-icons.mjs        # Génération icônes app
│   ├── desktop-exe.mjs        # Build installeur PC
│   ├── android-apk.mjs       # Build APK Android
│   └── build-mobile.mjs      # Build web pour mobile
│
└── release/                   # Sortie des builds
    ├── RiftMancer Setup <version>.exe   # Installeur PC **production**
    ├── RiftMancer Test Setup <version>.exe # Installeur PC **test**
    └── RiftMancer.apk                   # APK Android
```

### Page « Cartes » (PC) — `src/desktop/pages/CardsPage.jsx`
- En-tête en **2 bandeaux** (design « aéré » A) : ligne 1 = titre + actions (Manquantes→souhaits, Exporter, **Filtres**) ; ligne 2 = recherche à **largeur fixe** (380–460 px, pas pleine largeur) + possession + bascules icônes (griser manquantes, regrouper) + tri. La ligne « résultats + chips » ne s'affiche que si un filtre est actif ou une sélection en cours.
- Panneau de filtres de gauche **repliable** (état local `filtersOpen`).
- Grille **6 cartes par ligne exactement** (`fixedCols={6}` sur `CardsGrid`, `gap=24`), tuiles de 230 px comme la Collection : plus de sélecteur S/M/L (`DEFAULT_VIEW.size = 'l'` dans `useCardsBrowser.js`).
- Filtres PC (`CardsFiltersDesktop` dans `src/components/cards/CardsParts.jsx`) : domaines en icônes de runes (`public/sym/<domaine>.svg`), déroulants multi-sélection Type / Rareté / Autres, curseurs Énergie / Puissance (`numTerm` / `setNumQuery` dans `src/lib/cardQuery.js`). Les icônes de type sont des glyphes blancs `public/sym/type-<id>.png`, affichés en **masque CSS** teinté par le texte (sonde au démarrage dans `src/lib/symbols.js` : déposer le fichier suffit).
- Collection PC (`src/desktop/pages/CollectionCards.jsx`) : taille fixe « Grandes » (230 px), sélecteur S/M/L supprimé lui aussi.

---

## 🔨 **Commandes de build**

### Développement
```bash
npm install                # Installe les dépendances
npm run dev                # Serveur Vite (web, hot reload)
npm run desktop            # Build + lance Electron (PC)
npm run desktop:start      # Lance Electron sans rebuild
```

### Production
```bash
npm run build              # Build web (dans dist/)
npm run desktop:exe        # **Installeur PC production** → release/
npm run android:apk        # APK Android → release/
```

### Test
```bash
npm run desktop:exe:test   # Installeur PC **test** (dossier séparé)
npm run android:apk:test   # APK Android **test**
```

### Release
```bash
npm run release -- <version>      # Package complet (PC + Android)
npm run release -- <version> --essai # Test sans commit/tag
npm run release:check            # Vérifie les pré-requis
```

---

## 🤖 **Modèles IA**

### 1. Détection (YOLO11s-pose)
- **Fichier** : `public/models/yolo11s-pose-riftbound-dyn.onnx`
- **Format** : ONNX float32
- **Tâche** : Détection des cartes (bounding box + 4 keypoints pour les coins)
- **Input** : Variable (320px en camera mode, 416px en photo mode)
- **Output** : `class_id`, `cx`, `cy`, `w`, `h`, `x1`, `y1`, `x2`, `y2`, `x3`, `y3`, `x4`, `y4`
- **Classe** : `0` (carte)
- **Seuil de sharpness** : 100 (variance Laplacienne à 64x64)

### 2. Reconnaissance (DINOv2-small)
- **Fichier** : `public/models/dinov2s-ft-fp16.onnx`
- **Format** : ONNX float16
- **Tâche** : Identification de la carte (quand la couleur hésite)
- **Input** : 168x168px (artwork crop)
- **Fallback** : Empreinte couleur (grille 16x16 RGB + histogramme égalisé)

### 3. Empreinte couleur (Fingerprint)
- **Methode** : Grille 16x16 pixels sur le crop artwork
- **Prétraitement** : Histogramme égalisé (par canal RGB)
- **Similarité** : Cosine similarity entre vecteurs 768D (256 cells × 3 channels)
- **Seuil** : 
  - > 0.95 → "Sûr"
  - 0.90-0.95 → "Probable"
  - < 0.90 → "Incertain" (demande à l'utilisateur)

### Adaptive Crop (par type de carte)
| Type de carte | Bottom edge | Raison |
|---------------|-------------|--------|
| `unit`, `spell`, `gear`, `rune` | 0.55 | Layout standard |
| `legend` | 0.85 | Texte plus petit |
| `battlefield`, `*a*`, `*-star-*` | 0.95 | Full-art |

---

## 🔄 **Synchronisation PC ↔ Mobile**

### Protocole v3
- **Transport** : HTTP local (non chiffré, mais contenu chiffré)
- **Chiffrement** : AES-256-GCM (pour les données) + HMAC-SHA256 (pour l'intégrité)
- **Dérivation de clé** : HKDF-SHA256 (à partir du secret partagé)
- **Authentification** : 
  - Header `X-RB-Device` : ID du device
  - Header `X-RB-Time` : Timestamp UTC
  - Header `X-RB-Nonce` : Nonce unique
  - Header `X-RB-Sig` : HMAC du message (méthode + path + time + nonce + body hash)
- **Validité** : ±5 min sur le timestamp, nonces mémorisés 10 min
- **Découverte** : mDNS (`_riftbound._tcp`) ou scan /24

### Ports
| Version | Port | Dossier données | ID PC (hash) |
|---------|------|-----------------|--------------|
| Production | **47321** | `%APPDATA%\riftmancer` | Change tous les jours (UTC) |
| Test | **47322** | `%APPDATA%\riftmancer-test` | Change tous les jours (UTC) |

### Points de terminaison
| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/pair` | POST | Appairage (QR code, validité 5 min) |
| `/api/hello` | GET | Ping public (retourne `app`, `proto`, `pcIdHash`) |
| `/api/sync` | POST | Sync des données (chiffré) |
| `/api/prices` | GET | Récupération des prix |
| `/api/catalog` | GET | Récupération du catalogue |

### Données synchronisées
- `copies` (collection)
- `wishlist` (records `wish:<cardId>`, quantité voulue — hook `src/hooks/useWishlist.js`)
- `boxes`
- `decks`
- `people`
- `loans`
- `trades`
- `matches`
- `learned` (corrections scanner)

---

## 🗃️ **Stockage des données**

### PC (Electron)
- **Base de données** : SQLite (`%APPDATA%\riftmancer\collection.sqlite`)
- **Tables** :
  - `records` : `collection`, `id`, `data` (JSON), `updatedAt`, `deleted`, `seq`, `origin`
  - `meta` : Métadonnées
- **Sauvegardes** : 30 dernières dans `backups/` (automatique au lancement/fermeture)
- **Prix** : `prices.json` (Cardmarket, mise à jour quotidienne)

### Mobile (Capacitor)
- **Base de données** : IndexedDB (`riftbound-collection`, version 7)
- **Stores** : 1 par collection (`copies`, `wishlist`, etc.)
- **Flag `dirty`** : Marque les changements non synchronisés

### Contenu des cartes
- **Images** : `public/cards/<id>.webp` (2048px)
- **Miniatures** : `public/cards/thumbs/<id>.webp` (300px)
- **Catalogue** : `public/card-hashes.json` (métadonnées + fingerprints couleurs `f` + **signatures IA `e` par carte** + header `embeddings` (moteur, `modelSha256`, seuils) + `artGroup` des reprints)
  - Signatures IA régénérées localement : `node scripts/build-embeddings.mjs` (lit `public/cards/*.webp` + `public/models/dinov2s-ft-fp16.onnx`, cache `model/cache/`) — sans elles, Réglages → Scanner affiche « IA indisponible : empreinte couleurs utilisée ».
  - Groupes de reprints : `node scripts/catalog-groups.mjs` (après build-embeddings). Header public : `npm run catalog:base` → `public/catalog-base.json`.
- **Modèles** : `public/models/` (YOLO detecteur + DINOv2 reconnaissance)

### Rulings (FAQ) et affichage FR
- **Rulings** : couche « rulings » (rifthunt `/bulk/rulings`, FAQ anglais CC BY-SA 4.0) → `src/lib/rulings.js`, affichés dans `src/components/collection/RulingsList.jsx`
- **Vue FR** : `src/lib/rulingsFr.js` — deux niveaux, hors ligne : (1) traductions FR complètes et curatées de `public/rulings-fr.json` (clé = nom FAQ + id de ruling, servi comme fichier statique ; couverture 167/167 rulings, 71 cartes ; à mettre à jour quand la FAQ évolue — les ids inconnus retombent automatiquement) ; (2) sinon vue terminologique déterministe (noms de cartes officiels FR `nameFr` + glossaire de mécaniques vérifié contre les textes FR officiels `textFr`) — jamais de traduction mot à mot de la grammaire anglaise. Mémoïsé par catalogue/entrée + version de la couche. Bascule FR/EN dans l'en-tête de la section (défaut = préférence d'affichage FR). Tests : `tests/rulingsFr.test.mjs`
- **Rulings à traduire** : `missingCuratedRulings()` (src) / `content.rulingsFrMissing()` (electron/content.cjs, lu depuis `dist/rulings-fr.json`) → notification Electron à l'installation d'une couche rulings (main.cjs) + badge `status().rulingsFrMissing` dans Réglages → Contenu (ContentSection.jsx)
- **Textes de cartes FR non officiels** : `public/card-texts-fr.json` (clé = oracle, repli id ; 390/390 oracles sans textFr officiel couverts — les promos héritent de la traduction de l'original via l'oracle) chargé au démarrage (`useStartup.js → loadCardTextsFr`), servi par `cardLocale.js → getLocalizedText` (textFr officiel > non officiel marqué « Traduction française non officielle » dans CardZoom > anglais ; bascule FR/EN de la fiche). Tests : `tests/cardTextsFr.test.mjs`
- **Skill** : `.vibe/skills/riftmancer-traductions-fr/SKILL.md` — workflow de traduction/validation des deux fichiers

---

## 📡 **Récupération des prix (Cardmarket)**

### Source
- **Fichiers** : 
  - `productCatalog/productList/products_singles_22.json` (liste des produits)
  - `priceGuide/price_guide_22.json` (prix)
- **Fréquence** : 1 fois/jour (PC) ou manuelle (Mobile)
- **Mapping** : Via [rifthunt.com API](https://rifthunt.com/api) (pour les IDs Cardmarket)

### Stockage
- **PC** : `%APPDATA%\riftmancer\prices.json`
- **Mobile** : Reçu via sync `/api/prices`
- **Historique** : 31 jours par carte (pour les graphiques)

---

## 🎯 **Reconnaissance des cartes**

### Pipeline
1. **Détection** (YOLO11s-pose) → Localisation des cartes dans l'image
2. **Crop** → Extraction du rectangle de la carte (perspective warp si nécessaire)
3. **Artwork Crop** → Découpage de la zone illustration (adaptatif par type)
4. **Fingerprint** → Grille 16x16 couleurs (histogramme égalisé)
5. **Match** → Cosine similarity avec le catalogue
6. **Si incertain** → DINOv2 sur les 100 meilleurs candidats

### Seuil de décision
| Score | Décision | Action |
|-------|----------|--------|
| > 0.95 | "Sûr" | Ajout automatique |
| 0.90-0.95 | "Probable" | Ajout automatique |
| < 0.90 | "Incertain" | Demande à l'utilisateur (5 choix) |

### Cas spéciaux
- **Battlefields** : Test en rotation 0°, 90°, 180°, 270°
- **Reprints** : Même art → choix du set (mémorisé pour la session)
- **Alternate Arts** : Traité comme carte séparée
- **Signed Cards** : Regroupé avec la version régulière

---

## 🧪 **Tests**

### Commandes
```bash
npm test                 # Tous les tests Node.js
npm run test:e2e        # Tests end-to-end (Electron)
npm run lint             # Lint ESLint
npm run eval:matcher    # Benchmark reconnaissance (rapport dans model/eval-report.json)
npm run eval:detector    # Benchmark détection
```

### Pré-requis pour les tests
- `public/card-hashes.json` (catalogue)
- `public/cards/` (images des cartes)
- Si manquant : `npm run content:import -- <dossier>`

---

## ⚙️ **Configuration**

### Fichiers importants
| Fichier | Rôle |
|---------|------|
| `CLAUDE.md` | Point d'entrée Claude Code (règles + skills) ; wrappers `.claude/skills/<nom>/SKILL.md` → contenu canonique `.vibe/skills/<nom>/SKILL.md` (`.claude/` est gitignoré) |
| `AGENTS.md` | Règles non négociables (lu aussi par Codex / Cursor / Copilot) |
| `package.json` | Version, scripts, dépendances |
| `vite.config.js` | Configuration Vite |
| `capacitor.config.json` | Configuration Capacitor |
| `electron/builder-config.js` | Configuration electron-builder |
| `android/keystore.properties` | Clé de signature Android (exclu du Git) |

### Variables d'environnement
| Variable | Usage |
|----------|-------|
| `RB_KEYSTORE` | Chemin vers keystore Android |
| `RB_KEYSTORE_PASSWORD` | Mot de passe keystore |
| `RB_KEY_ALIAS` | Alias de la clé |
| `RB_KEY_PASSWORD` | Mot de passe de la clé |
| `CSC_LINK` | Chemin vers le certificat Windows |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat |

---

## 🐛 **Problèmes connus & Workarounds**

| Problème | Cause | Solution |
|----------|-------|----------|
| **SmartScreen bloque l'installeur** | Pas de signature Microsoft | "Plus d'infos" → "Exécuter quand même" |
| **Prix non mis à jour** | Échec téléchargement Cardmarket | Relancer manuellement dans Réglages → Prix |
| **Sync bloquée** | Pare-feu | Autoriser le port 47321/47322 (TCP) |
| **Cartes non reconnues** | Modèles manquants | Vérifier `public/models/` et `public/card-hashes.json` |
| **Build Android échoue** | Android SDK manquant | Installer Android Studio + SDK |
| **ONNX Runtime manquant** | Build sans dépendances | `npm install` puis rebuild |

---

## 📚 **Ressources externes**

- **API Riot** : [playriftbound.com/en-us/card-gallery/](https://playriftbound.com/en-us/card-gallery/) (source des images)
- **Cardmarket** : [cardmarket.com](https://www.cardmarket.com/) (prix)
- **Rifthunt** : [rifthunt.com/api](https://rifthunt.com/api) (IDs Cardmarket)
- **riftboundfr.fr** : [riftboundfr.fr](https://riftboundfr.fr) (traductions FR)

---

> **⚠️ IMPORTANT** : Ce fichier est **optimisé pour l'IA**. Si tu modifies le projet, mets à jour ce fichier pour que je reste efficace !
