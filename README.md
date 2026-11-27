# RiftMancer

> Scanner et gestionnaire de collection pour **Riftbound** (TCG League of Legends).
> Basé sur [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) (MIT), fortement modifié et étendu.

*Version française : [README.fr.md](README.fr.md).*

---

🔹 **Pour les développeurs** : Voir [DEV_NOTES.md](DEV_NOTES.md) pour les détails techniques (architecture, build, modèles IA, sync).

---

## 🎯 À quoi ça sert ?

RiftMancer est une application **hors ligne** pour :
- **Scanner** tes cartes Riftbound (photo, webcam ou grille)
- **Gérer ta collection** (quantités, langues, états, boîtes)
- **Créer des decks** avec vérification des règles officielles
- **Suivre les prix** (intégration Cardmarket)
- **Synchroniser** entre ton PC et ton téléphone Android
- **Suivre tes matchs** (statistiques, historique)

---

## 📥 Téléchargement

Récupère la dernière version depuis **[les Releases GitHub](https://github.com/FaZox/RiftMancer/releases)** :

| Plateforme | Fichier | Instructions |
|------------|---------|--------------|
| **PC (Windows)** | `RiftMancer-Setup-<version>.exe` | Double-clic → "Plus d'infos" → "Exécuter quand même" (SmartScreen) |
| **Android** | `RiftMancer-<version>.apk` | Installer depuis le fichier (autoriser les sources inconnues) |

---

## ⚡ Installation et premier lancement

### PC (Windows)
1. **Installe** l'application via l'installeur `.exe`
2. **Premier lancement** :
   - L'application te proposera de **télécharger les cartes** (~170 Mo, galerie officielle Riot)
   - Ou d'**importer un dossier** existant (ex: `public/cards/`)

### Android
1. Transfère l'APK sur ton téléphone
2. Installe-le (autorise les sources inconnues si nécessaire)
3. **Paire avec ton PC** :
   - PC : Réglages → QR code
   - Phone : Réglages → "Scanner le QR code du PC"

---

## 🌟 Fonctionnalités principales

### 🔍 Scanner
- **Photo** : Glisse-dépose plusieurs photos, chaque carte est encadrée automatiquement
- **Webcam** : Cadrage en temps réel, reconnaissance instantanée
- **Grille** : Scanner une page de classeur d'un coup
- **Reconnaissance** : IA (YOLO11 + DINOv2) + empreinte couleurs, **100% hors ligne**
- **Correction** : Si doute, choix parmi les 5 meilleures correspondances

### 🃏 Collection
- **Gestion fine** : Chaque carte physique a sa langue, son état, son foil, son emplacement
- **Recherche avancée** : Par nom (FR/EN), numéro, domaine, coût, rareté, etc.
- **Valeur totale** : Calcul automatique avec historique (intégration Cardmarket)
- **Export/Import** : CSV (CardNexus, Riftmana, etc.)

### 🎲 Decks
- **Éditeur 3 colonnes** (PC) : Deck + Catalogue + Aperçu
- **Vérification des règles** : 1 Légende, 40+ cartes, max 3 copies par carte, etc.
- **Import/Export** : Codes de deck, textes de liste, feuilles de tournoi
- **Statistiques** : Courbe de coût, prix des cartes manquantes

### 📱 Synchronisation PC ↔ Mobile
- **Appairage par QR code** (réseau local)
- **Sync manuel** : Choisis la direction (PC → Phone, Phone → PC, ou les deux)
- **Chiffré** : Échange sécurisé (AES-256-GCM)
- **Données synchronisées** : Collection, decks, wishlist, matchs, boîtes

### 💰 Prix et Valeur
- **Prix Cardmarket** : Mise à jour quotidienne, historique 30 jours
- **Valeur collection** : Suivi avec variation sur 7 jours
- **Alertes** : Notification si une carte monte/descend de X%
- **Liens directs** : "Acheter sur Cardmarket" avec filtres personnalisables

### 📊 Matchs
- **Saisie rapide** : Adversaire, premier/second, Victoire/Défaite/Nulle
- **Statistiques** : Taux de victoire global, par deck, par Légende
- **Compteur de score** : Full-screen pour les parties en 1v1, 2v2 ou FFA

### 📦 Organisation
- **Boîtes** : Organise ta collection physiquement (boîtes, classeurs)
- **Prêts** : Suivi des cartes prêtées à tes amis
- **Échanges** : Calcul automatique de l'équilibre de valeur
- **Wishlist** : Liste de souhaits avec alerts prix

---

## 🛠️ Construction depuis les sources

### Pré-requis
- Node.js 20+
- Git LFS (`git lfs install` avant le clone)
- Pour l'APK Android : Android SDK (Android Studio)

### Commandes principales
```bash
npm install              # Installe les dépendances
npm run dev              # Serveur de développement (web)
npm run desktop          # Lance l'app PC en dev
npm run desktop:exe      # **Génère l'installeur PC production**
npm run desktop:exe:test  # Génère l'installeur PC **test** (version séparée)
npm run android:apk      # Génère l'APK Android
npm run build            # Build web (dans dist/)
```

### Versions Production vs Test
| | Production | Test |
|---|------------|------|
| **Nom** | RiftMancer | RiftMancer Test |
| **Badge** | Aucun | Orange "TEST" |
| **Données** | `%APPDATA%\riftmancer` | `%APPDATA%\riftmancer-test` |
| **Port sync** | 47321 | 47322 |

---

## 📁 Structure du projet
```text
RiftMancer/
├── src/                # Code source (React + Electron/Capacitor)
│   ├── desktop/        # Interface PC
│   ├── components/     # Composants UI
│   ├── hooks/          # Logique métiers
│   └── lib/            # Bibliothèques utilitaires
├── electron/           # Backend PC (SQLite, serveur sync)
├── android/            # Configuration Capacitor
├── public/             # Ressources statiques
│   ├── cards/          # Images des cartes (à télécharger)
│   └── models/         # Modèles IA (ONNX)
└── release/            # Installeurs générés
```

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Ouvre une **Pull Request** sur la branche `main` :
- Respecte les **conventions de commit** (ex: `feat(scanner): amélioration détection`)
- Ajoute des **tests** si applicable
- Mets à jour la **documentation**

---

## 📜 Licence

**GNU AGPL-3.0-or-later** – Logiciel libre.

- Tu peux **copier, modifier, redistribuer** sous la même licence.
- Le code est open-source, mais **les cartes, noms et images appartiennent à Riot Games** (non inclus dans le dépôt).
- Basé sur [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) (MIT).

> Riftbound et League of Legends sont des marques de **Riot Games, Inc.**
> Ce projet n'est **pas endorsé ou sponsorisé** par Riot Games.

---

## 📞 Support

- **Documentation** : [Friends' Guide](docs/FRIENDS-GUIDE.md) (EN/FR)
- **Nouveautés** : [WHATS-NEW.md](docs/WHATS-NEW.md) / [NOUVEAUTES.md](docs/NOUVEAUTES.md)
- **Sécurité** : Voir [SECURITY.md](SECURITY.md)
