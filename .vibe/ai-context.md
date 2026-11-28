# 🤖 AI Context – RiftMancer

> Lire après `.vibe/INIT.md`, à chaque session sur ce projet.

## 📖 Ordre de lecture

1. **Ce fichier** (contexte + règles).
2. **`DEV_NOTES.md`** → toute question technique (architecture, build, modèles IA, sync, stockage, commandes, tests). Ne jamais parser `README.md`.
3. **Skill local** (`.vibe/skills/<nom>/SKILL.md`, chargé via `skill <nom>`) si la tâche correspond.

## 💬 Style

Ultra-concis : faits bruts → solution → question si blocage. Aucun remplissage.

## 🔨 Règle de build automatique après chaque modification

Modification terminée + build OK → lancer automatiquement :
1. `npm run desktop:exe:test` (installeur TEST avec les changements)
2. `release/RiftMancer Test Setup <version>.exe` pour l'installer

Jamais la version production automatiquement.

## ⚠️ Pièges connus (ne pas retomber dedans)

- **`CardZoom` et le cœur des souhaits** : toujours passer `byCard={wishlist.byCard}` en plus de `wanted=...`, sinon le cœur d'une variante reflète la carte d'origine (bug corrigé dans CardsTab, CardsPage, CollectionPage, MoreTab, OrganizeTab, ValueTab). Sur PC, la fiche `CardReliquary` est ouverte via le hook `useReliquary`, qui passe déjà `byCard`.
- **Variantes** : regroupées par `oracle` (`src/lib/prints.js`, `groupKey` dans `src/lib/cardsBrowser.js`).
- **Skills locaux** : format `.vibe/skills/<nom>/SKILL.md` (dossier + SKILL.md), sinon Vibe ne les découvre pas.

## 📌 Ressources par demande

| Demande | Où |
|---------|-----|
| Installation PC/Android | skill `riftmancer-install` + `release/` |
| Build / release / déploiement | skill `riftmancer-build` + `DEV_NOTES.md` (Commandes) |
| Tests | skill `riftmancer-tests` |
| Architecture / navigation code | skill `riftmancer-structure` + `DEV_NOTES.md` |
| Feature → fichiers sources | skill `riftmancer-features` |
| Git (commits, branches, releases) | skill `riftmancer-git` |
| Scanner, modèles IA, sync, stockage, ports | `DEV_NOTES.md` |

## 📁 Chemins utiles

- Racine : `C:\Users\bower\Documents\RiftMancer`
- Code React : `src/` · Backend Electron : `electron/` · Android : `android/`
- Cartes : `public/cards/` · Catalogue : `public/card-hashes.json` · Modèles IA : `public/models/`
- Installeurs : `release/` · Données PC : `%APPDATA%\riftmancer(-test)\collection.sqlite`

## 🔄 Mises à jour

Si le projet change (chemins, commandes, skills, pièges) → mettre à jour `DEV_NOTES.md` et ce fichier.
