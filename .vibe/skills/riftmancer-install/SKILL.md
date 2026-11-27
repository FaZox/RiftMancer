---
name: riftmancer-install
description: "Guide d'installation de RiftMancer sur PC (version production et test).
  Charge ce skill pour les demandes d'installation de l'application."
---

## 📥 Installation PC (Production)

### ⚡ Méthode la plus simple : Utiliser l'installeur existant

1. **Vérifier si l'installeur existe déjà** :
   ```bash
   ls release/RiftMancer*Setup*.exe
   ```
   → Si un fichier comme `RiftMancer Setup 2.4.3.exe` existe, **passe directement à l'étape 2**.

2. **Installer** :
   - Double-clique sur `release/RiftMancer Setup <version>.exe`
   - **Windows SmartScreen** affichera un avertissement (installeur non signé)
     → Clique sur **"Plus d'infos"** puis **"Exécuter quand même"**
   - Suis les instructions de l'installeur

3. **Premier lancement** :
   - L'application te proposera de **télécharger les cartes** (~170 Mo)
   - Ou d'**importer un dossier** existant (ex: `public/cards/`)

---

### 🔨 Si l'installeur n'existe pas : Construire depuis les sources

1. **Pré-requis** :
   - Node.js 20+
   - Git LFS (pour les modèles IA et images)

2. **Construire l'installeur** :
   ```bash
   npm install
   npm run desktop:exe
   ```
   → L'installeur sera généré dans `release/RiftMancer Setup <version>.exe`

3. **Installer** (voir ci-dessus)

---

## 🧪 Installation PC (Test)

Pour tester sans affecter la version production :

1. **Construire la version test** :
   ```bash
   npm run desktop:exe:test
   ```
   → Installeur généré : `release/RiftMancer Test Setup <version>.exe`

2. **Installer** :
   - Double-clique sur l'installeur **Test**
   - **Badge ORANGE "TEST"** visible dans l'application
   - **Données séparées** : `%APPDATA%\riftmancer-test` (ne mélange pas avec la prod)
   - **Port de sync** : 47322 (au lieu de 47321 pour la prod)

---

## 📁 Emplacement des fichiers

| Version | Installeur | Données | Port Sync |
|---------|------------|---------|-----------|
| Production | `release/RiftMancer Setup <version>.exe` | `%APPDATA%\riftmancer` | 47321 |
| Test | `release/RiftMancer Test Setup <version>.exe` | `%APPDATA%\riftmancer-test` | 47322 |

---

## ⚠️ Problèmes courants

1. **SmartScreen bloque l'installation** :
   → Normal, l'installeur n'est pas signé. Clique sur **"Plus d'infos" → "Exécuter quand même"**.

2. **L'application ne voit pas les cartes** :
   → Au premier lancement, télécharge les cartes via **"Download the cards"** dans l'application.
   → Ou copie un dossier `public/cards/` existant dans l'installation.

3. **Le port de sync est bloqué** :
   → Autorise l'application dans le **pare-feu Windows** (port 47321 pour la prod).

---

## 🔄 Mise à jour

1. **Construire la nouvelle version** :
   ```bash
   npm run desktop:exe
   ```
2. **Désinstaller l'ancienne version** (optionnel)
3. **Installer le nouvel installeur**

---

## 📌 Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run desktop` | Lance l'app PC en mode dev (sans installeur) |
| `npm run desktop:start` | Lance Electron directement (sans rebuild) |
| `npm run desktop:exe` | **Génère l'installeur production** |
| `npm run desktop:exe:test` | Génère l'installeur **test** |
