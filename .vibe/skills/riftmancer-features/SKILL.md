---
name: riftmancer-features
description: Référence des fonctionnalités essentielles de RiftMancer.
  Cartographie chaque feature (scanner, collection, decks, sync) vers ses
  fichiers sources.
---
## 🎯 Scanner &amp; Reconnaissance

- **Moteurs** : IA (DINOv2) + Empreinte couleurs (fingerprint)
- **Sources** : `src/lib/cardMatcher.js`, `src/lib/aiRecognizer.js`, `src/lib/fingerprint.js`
- **Détection** : `src/hooks/useCardDetection.js`, `src/lib/yoloDetector.js`
- **Scan photo** : `src/components/scan/PhotoScanView.jsx`, `src/lib/photoScan.js`
- **Scan grille** : `src/components/scan/GridScanView.jsx`, `src/lib/gridScan.js`
- **Paramètres scanner** : `src/components/settings/ScannerSettings.jsx`

## 🃏 Gestion Cartes

- **Collection** : `src/hooks/useCollection.js`, `src/lib/collectionDB.js` (IndexedDB)
- **Ajout manuel** : `src/components/scanner/ManualAdd.jsx`, `src/lib/manualCards.js`
- **Doublons** : Détection automatique via `isSameStack()` dans `src/lib/cardLocale.js`
- **Langues/Éditions** : Gestion dans `src/lib/printingChoice.js`, `src/lib/printingPick.js`
- **Catalogue** : `src/lib/catalog.js`, `src/lib/catalogChoice.js`
- **Variantes/impressions** : regroupées par champ `oracle` → `src/lib/prints.js`, `src/lib/variants.js`, `groupKey()` dans `src/lib/cardsBrowser.js`

## 📊 Collection &amp; Valeur

- **Affichage** : `src/components/collection/CollectionTab.jsx`
- **Vues** : Cartes, Progression, Souhaits (Wishlist)
- **Valeur** : `src/components/value/ValueTab.jsx`, `src/lib/prices.js`
- **Prix** : Récupération Cardmarket (PC: `electron/prices.cjs`, Mobile: API directe)
- **Statistiques** : `src/components/collection/StatsView.jsx`
- **Tri/Filtres** : `src/hooks/useCollectionFilter.js`
- **Souhaits (wishlist)** : `src/hooks/useWishlist.js` (records `wish:<cardId>`), vues `WishlistView.jsx` / `CollectionWishlist.jsx`. Piège : `CardZoom` doit recevoir `byCard={wishlist.byCard}` (et pas seulement `wanted=`) pour que le cœur suive la variante affichée.

## 🎲 Decks &amp; Organisation

- **Decks** : `src/components/organize/DecksTab.jsx`, `src/hooks/useDeckEditor.js`
- **Éditeur** : `src/components/organize/DeckEditor.jsx`
- **Règles** : Vérification dans `src/lib/deckRules.js`
- **Codes** : Import/Export via `src/lib/deckCodes.js`
- **Matchs** : `src/components/matches/MatchesView.jsx`, `src/lib/matchStats.js`
- **Compteur** : `src/components/matches/CounterFab.jsx`

## ⚡ Synchronisation

- **PC ↔ Mobile** : Serveur local (`electron/server.cjs`, port 47321/47322)
- **Protocole** : `src/lib/syncProtocol.js`, `src/lib/syncClient.js`
- **Cryptographie** : `electron/syncCrypto.cjs`
- **Découverte** : mDNS (`electron/mdns.cjs`)
- **Sauvegardes** : `electron/backups.cjs`, `src/lib/autoBackup.js`, `src/lib/localBackup.js`

## 🎨 UI/UX

- **Thème** : `src/index.css` (Tailwind + classes personnalisées)
- **Internationalisation** : `src/lib/i18n.js`, `src/i18n/` (FR/EN)
- **Aide** : `src/lib/help.js`, `src/components/common/HelpLayer.jsx`
- **Notifications** : `src/components/ToastNotification.jsx`
- **Recherche globale** : `src/components/common/GlobalSearch.jsx`, `src/lib/globalSearch.js`
- **Paramètres** : `src/components/settings/`

## 📱 Plateformes

- **Mobile** : Capacitor (`android/`, `capacitor.config.json`)
- **PC** : Electron (`electron/`, `vite.config.js`)
- **Responsive** : Adaptation via CSS et hooks (`src/desktop/DesktopApp.jsx`)

## 🔍 Recherche &amp; Filtres

- **Recherche cartes** : `src/lib/cardQuery.js`
- **Filtres collection** : `src/hooks/useCollectionFilter.js`
- **Tris** : Par nom, valeur, rareté, quantité, etc.
- **Groupement** : Par set, type, couleur, langue, édition

## 📦 Contenu

- **Cartes** : `public/cards/`, `public/card-hashes.json`
- **Catalogue** : Métadonnées dans `public/catalog*.json`
- **Traductions** : `src/i18n/fr.json`, `src/i18n/en.json`
- **Règles** : `src/lib/rulings.js`
- **Bannissements** : `src/lib/banlist.js`, `src/lib/banUpdate.js`
- **Mises à jour** : `src/lib/contentNotices.js`, `electron/contentFetch.cjs`

## 🎵 Son &amp; Feedback

- **Sons scan** : `src/lib/scanSounds.js`
- **Vibrations** : Gestion via Capacitor
- **Feedback visuel** : Animations et indicateurs

## 🔧 Outils

- **Import/Export** : CSV (`src/lib/csvImport.js`), JSON
- **Partage** : `src/lib/deckShare.js`, codes de deck
- **Diagnostic** : `src/lib/diagnostic.js`, `src/lib/diagnosticReport.js`
- **Benchmark** : `npm run eval:matcher`, `npm run eval:detector`

