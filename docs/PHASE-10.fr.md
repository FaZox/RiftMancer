# Phase 10 — Distribution aux amis : bilan (M0 à M14)

*English version: [PHASE-10.md](PHASE-10.md).*

Du 17 au 20 novembre 2026. Objectif : une appli que des amis installent eux-mêmes (appli PC et appli
Android, sans outils de développement), qui ne perd jamais leurs données, dont le contenu (nouvelles
cartes, traductions, cartes bannies) se met à jour depuis l'appli PC, et qui sert aussi en tournoi et
pour suivre les prix.

Le cahier des charges (AMELIORATIONS-APPLI.md) reste hors du dépôt ; son découpage en modules et leur
état sont dans [ROADMAP.fr.md](../ROADMAP.fr.md) (Phase 10), le détail de chaque module dans
[CHANGELOG.md](../CHANGELOG.md). Ce document en fait la synthèse.

**Règle de chaque module** : tests Node pour toute logique nouvelle, lint sans erreur, construction,
APK de test, CHANGELOG et ROADMAP, un commit poussé ; aucune boîte `confirm()` / `alert()` du système,
couleurs d'état par jetons, textes de 11 px au moins, captures PC et téléphone.

---

## 1. Ce qui a été fait

| Module | Ce que ça apporte | Où (principal) | Tests (au 20/11) | Commit |
|---|---|---|---|---|
| **M0** Fondations du design | Jetons d'état `state.ok/warn/bad/info`, composants communs (`Dialog`, `Sheet`, `Banner`, `StatusPill`, `EmptyState`…), maquettes versionnées | `src/components/common/`, `docs/maquettes/` | — | `9b507ea` |
| **M1** Cartes bannies et format | Listes officielles datées (18 sept. et 23 nov. 2026), formats Standard / 2v2, bandeau de contrôle du deck, badge « Bannie » | `public/banlist.json`, `src/lib/deckRules.js` | 8 | `068cea2` |
| **M2** Prix cohérents | Variation seulement sur le vrai historique, foils à part, prix estimés « ≈ », plus-value juste, promos à leur prix | `src/lib/prices.js`, `src/lib/valueData.js` | 8 | `ee8c335` |
| **M3** États Cardmarket | Échelle MT/NM/EX/GD/LP/PL/PO, migration NM→NM, LP→EX, MP→GD, HP→PL, D→PO | `src/lib/conditions.js` | 6 | `66bfd90` |
| **M4** Nettoyage du scanner | Une seule chaîne (couleurs puis IA), seuils dans l'en-tête du catalogue, mode « Rapide » retiré | `src/lib/scanRules.js`, `src/lib/photoScan.js` | 4 | `b14bff5` |
| **M5** Signature et paquet | Version unique 2.1.0, `npm run release`, `npm run release:check`, APK signé, guide pour les amis | `scripts/release.mjs`, `docs/LISEZ-MOI-AMIS.md` | 9 | `76b0d84` |
| **M6** Ne jamais perdre les données | Sauvegardes automatiques du téléphone (10 gardées), rappel de synchro, dossier supplémentaire sur le PC, conflits visibles | `src/lib/autoBackup.js`, Réglages → Sauvegardes | 10 | `91f1955` |
| **M7** Contenu à jour depuis le PC | Couches de contenu ; mises à jour des cartes bannies, traductions, nouvelles cartes (parité vérifiée) ; packs signés Ed25519 ; versions échangées à la synchro ; APK sans grandes images (252 → 121 Mo) | `electron/content.cjs`, Réglages → Contenu | 11 + 8 + 5 + 5 + 5 + 4 | `b8f230a` → `4084d40` |
| **M8** Quand quelque chose casse | Écran de secours, erreurs de démarrage nommées, rapport de diagnostic sans donnée personnelle | `src/lib/errorLog.js`, `RescueScreen.jsx` | 4 | `037c94f` |
| **M9** Ergonomie | Écran de chargement « Forge hextech », navigation (Decks \| Matchs, compteur en un geste), réglages en neuf sections, recherche globale et raccourcis, premier lancement, finitions | `ForgeSplash.jsx`, `settingsSections.jsx`, `GlobalSearch.jsx` | 6 + 3 + 3 + 5 + 3 + 4 | `10847a9` → `caf6bd2` |
| **M10** Decks et jeu compétitif | Codes de deck au format commun (Piltover Archive) et texte d'inscription, versions d'un deck, notes par adversaire, compteur 1v1 / 2v2 / chacun pour soi avec historique et reprise, errata signalés | `src/lib/deckCodes.js`, `deckVersions.js`, `opponentNotes.js`, `scoreGame.js`, `errata.js` | 4 + 3 + 4 + 5 + 4 | `b0f9a23` → `c52520d` |
| **M11** Confort du scan | Scan mains libres, sons (coupés par défaut), variantes (illustrations alternatives, signées) ; langue détectée étudiée mais **pas livrée** | `src/lib/handsFree.js`, `scanSounds.js`, `variants.js` | 3 + 3 + 3 | `4f169f7` → `30458e0` |
| **M12** Alertes de prix | Alertes sur mes cartes (± X % en 7 jours, valeur minimale), panneau « Mouvements » dans Valeur, résumé après chaque mise à jour des prix | `src/lib/priceMoves.js`, `MovementsPanel.jsx` | 5 | `c7ebc60` |
| **M13** Entre amis | Listes partagées par fichier (doubles et souhaits, sans prix payés ni emplacements), échanges possibles par ami, calculateur d'échange | `src/lib/friendLists.js`, `FriendsView.jsx` | 5 | `531e4b3` |
| **M14** Documentation et qualité | Guide amis et README à jour, tests d'écran (`npm run test:e2e`), découpage de `useAppController` et `ScanTab`, intégration continue légère | `scripts/e2e.mjs`, `tests/e2e/`, `src/hooks/app/`, `.github/workflows/ci.yml` | 3 parcours | `a763d56` → `3f576dd` |

### Retouches demandées après les essais (20/11)

| Retouche | Pourquoi | Commit |
|---|---|---|
| Écran de chargement d'une durée fixe (2,4 s) | voir l'animation entière, même quand l'appli démarre vite | `193159b` |
| Jauge du chargement fluide | elle saccadait pendant que le téléphone charge les modèles : elle tourne maintenant toute seule (animation du navigateur), pleine à 2,4 s ou dès que l'appli est prête | `f2fc8a7` |
| Carte nette dans la fiche | une image tournée est toujours un peu floue : un seul balancement, puis la carte se pose droite | `a8aaad0` |
| Carte plus grande dans la fiche (téléphone puis PC) | trop petite : ≈ 264 px au lieu de 200 sur un téléphone de 412 px ; 343 × 479 au lieu de 267 × 372 sur un écran 1440 × 900 | `42f5eb4`, `e5375c2` |

## 2. Décisions prises

- **Promos** : prix de la promo de la carte sur Cardmarket, « ≈ » s'il y en a plusieurs ou aucune (M2).
- **États** : correspondance usuelle vers l'échelle Cardmarket, sans coefficient de prix par état (M3).
- **Mode « Rapide »** : retiré (M4).
- **Clé de signature Android** : créée par l'auteur (annexe A du cahier), jamais dans le dépôt (M5).
- **Vérification hebdomadaire** des nouvelles cartes et des traductions : activée par défaut, rien installé sans clic (M7).
- **Packs de contenu signés** (Ed25519) : seul l'auteur produit des packs ; clé publique dans `electron/packPublicKey.json` (M7e).
- **APK sans les grandes images** : reçues du PC à la première synchro (M7f).
- **Écran de chargement A « Forge hextech »** (18/11), puis durée fixe de 2,4 s (20/11).
- **Langue détectée** : laissée de côté, pas assez fiable (M11c, ci-dessous).
- **Intégration continue légère, sans les fichiers Git LFS** (20/11) : le quota LFS gratuit ne suffirait pas.

## 3. Ce qui n'est pas livré

- **Langue détectée (M11c)** : mesurée au banc sur 173 vraies photos ; un lecteur simple lit « • FR » sur une photo nette, mais le résultat dépend trop de son réglage (0 à 5 erreurs pour ~100 décisions selon le réglage) et ne décide rien pour ~45 % des photos de l'appli. Rapport : [ETUDE-LANGUE.md](ETUDE-LANGUE.md) ; script : `scripts/study-language.mjs`.
- **Lot 12, plus tard** : moteur de reconnaissance natif sur Android, collecte de photos chez les amis.
- **Intégration continue** : sans les images ni les modèles, 25 tests se mettent de côté sur GitHub (23 faute des fichiers LFS, 2 faute de Python + OpenCV). La reconnaissance, les tests d'écran et l'APK se vérifient en local.

## 4. Vérifications

| Vérification | Commande | État au 20/11 |
|---|---|---|
| Tests | `npm test` | 259 réussis, 1 mis de côté (export du banc, sans modèles d'essai) |
| Lint | `npm run lint` | aucune erreur |
| Tests d'écran | `npm run test:e2e` (après `npm run build`) | 3 parcours réussis |
| Intégration continue | onglet Actions de GitHub | réussie (234 réussis, 25 de côté, audit : 0 faille) |
| Paquet de distribution | `npm run release:check` | à lancer sur le paquet de la version |

**À vérifier sur les appareils** (je ne pilote pas le téléphone) :

- scan mains libres avec une vraie caméra (déclenchement, une seule fois par carte) ;
- résumé « Prix mis à jour : … » après une vraie mise à jour des prix ; panneau « Mouvements » une fois 7 jours d'historique ;
- export puis import d'une liste d'amis (Documents/Riftbound, sélecteur de fichiers d'Android) ;
- fiche d'une carte nette une fois les grandes images reçues du PC.

## 5. Publier la version 2.1.0

Aucune version n'a encore été distribuée (aucune étiquette `v*`) : la 2.1.0 sera la première.

1. Les nouveautés de la 2.1.0 sont écrites dans [NOUVEAUTES.md](NOUVEAUTES.md) (affichées dans l'appli après une mise à jour, et copiées en `NOUVEAUTES.txt`).
2. `npm run release -- 2.1.0` (ou `--essai` pour essayer la chaîne sans rien enregistrer) : tests, lint, installateur PC, APK signé, `release/v2.1.0/` avec le guide et les empreintes, commit et étiquette en local.
3. `npm run release:check`, puis `git push origin main v2.1.0`, et déposer le dossier `release/v2.1.0/` dans le Drive partagé.

## 6. Fichiers de travail hors du dépôt

Volontairement jamais versionnés : `AMELIORATIONS-APPLI.md`, `AMELIORATIONS-MODELES.md`,
`AMELIORATIONS-NATIF.md`, `CORRECTIONS.md`, `CORRECTIONS-v2.md`, `MODULE-BANC.md`, les photos du banc
(`model/real-photos-raw/`), la clé de signature Android (`android/keystore.properties`, `*.jks`) et la
clé privée des packs (`%USERPROFILE%\.riftbound\`).
