---
name: riftmancer-structure
description: Guide de l'architecture du projet RiftMancer. Identifie
  l'emplacement de chaque composant, module et service pour une navigation
  rapide dans le codebase.
---
## Frontend (React + Vite)

- `src/App.jsx` - Point d'entrée mobile
- `src/desktop/DesktopApp.jsx` - Point d'entrée PC
- `src/components/` - Tous les composants UI
- `src/hooks/` - Logique réutilisable (useAppController, useCollection, etc.)
- `src/lib/` - Bibliothèques utilitaires (cardMatcher, prices, syncClient, etc.)

## Backend Electron (PC)

- `electron/main.cjs` - Processus principal Electron
- `electron/server.cjs` - Serveur de sync local (port 47321/47322)
- `electron/store.cjs` - Gestion SQLite (collection)
- `electron/content.cjs` - Gestion du contenu (cartes, traductions)

## Android (Capacitor)

- `android/` - Configuration Capacitor
- `capacitor.config.json` - Config Capacitor

## Scripts utiles

- `scripts/` - Tous les scripts npm run

## Données

- `public/cards/` - Images des cartes
- `public/card-hashes.json` - Hashes des cartes
- `src/data/` - Données statiques

## Tests

- `tests/` - Tests Node.js
- `tests/e2e/` - Tests end-to-end

## Build

- `dist/` - Build Vite
- `release/` - Packages de release

