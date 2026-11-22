# Feuille de route — RiftMancer (anciennement Riftbound Scanner)

*English version: [ROADMAP.md](ROADMAP.md).*

Fichier de suivi des fonctionnalités. Mis à jour au fur et à mesure du développement.
Légende : `[x]` fait · `[~]` en cours · `[ ]` à faire

## Décisions prises

- **Pas d'hébergement en ligne.** Données 100 % locales, synchronisation téléphone ↔ PC sur le Wi-Fi.
- **Plateformes** : Android (Capacitor 8) + PC Windows (Electron 38, SQLite intégré à Node). iPhone plus tard éventuellement (même code).
- **Stack** : React + Vite (inchangé), SQLite côté PC, base locale côté Android. Python reste pour le scraper.
- **Appareils** : 1 téléphone + 1 PC appairés (QR code).
- **Synchronisation manuelle** (décision du 05/11/2026) : uniquement quand l'utilisateur touche « Synchroniser maintenant » sur le téléphone, pour ne jamais mélanger un travail en cours sur le PC. Le téléphone fonctionne seul hors réseau. Fusion fiche par fiche : seule une carte modifiée des deux côtés est en conflit (la plus récente gagne).
- **Volume visé** : plusieurs milliers d'exemplaires → listes virtualisées, écritures ciblées, synchro incrémentale.
- **Modèle de données** : un exemplaire physique = une fiche (id unique + date de modification) ; l'affichage regroupe en piles.
- **Images** : miniatures incluses dans l'appli Android, grandes images envoyées par le PC à la première synchro. **Aucune perte de qualité** : les images originales ne sont jamais modifiées, les miniatures sont des fichiers en plus.
- **Rangement** : un seul niveau (boîtes).
- **Prêts** : liste de personnes réutilisable.
- **Decks** : vérification des règles de construction Riftbound.
- **Prix** : Cardmarket, prix « trend », en €, sans distinction FR/EN.
- **Interface** : en français au départ ; **anglais et français depuis le 21/11/2026** (anglais par défaut sauf système en français).
- **Pas de collection existante à migrer.**
- **GitHub** : dépôt privé FaZox/RiftboundApp ; modifications dans ce dossier, commit / push seulement à la demande.

## Déjà fait

- [x] Choix de la langue (EN/FR) avant de scanner
- [x] Langue affichée et filtrable dans la collection ; piles séparées par langue
- [x] Noms et textes français des cartes (données riftboundfr.fr, `model/fr/`)
- [x] Export CardNexus avec la colonne Language

## Phase 1 — Fondations ✅

- [x] Modèle YOLO copié dans `public/models/` (normal + int8 `-q8`) ; scan testé (97 % sur une carte test)
- [x] onnxruntime intégré à l'appli (plus de CDN) — `scripts/copy-ort.mjs`, lancé par `npm run dev` / `npm run build`
- [x] Polices intégrées (plus de Google Fonts), TensorFlow.js CDN inutilisé retiré
- [x] `card-hashes.json` allégé de 12 Mo à 2,2 Mo sans perte (champ `d` retiré, empreintes en octets base64)
- [x] Nouvelle base locale IndexedDB `riftbound-collection` (remplace `localStorage` et le code mort `src/lib/indexedDB.js`)
- [x] Modèle « un exemplaire = une fiche » (`src/lib/collectionDB.js`, `src/hooks/useCollection.js`) avec `updatedAt` + suppression logique pour la future synchro
- [x] Liste de collection virtualisée (@tanstack/react-virtual) — testé avec 5 000 exemplaires
- [x] Miniatures 300 px (`scripts/make-thumbs.mjs`, `npm run thumbs`) ; originaux intacts
- [x] Mise en cache PWA : miniatures pré-chargées, grandes images et modèles mis en cache à la première utilisation
- [x] Interface entièrement en français (rareté, type et domaine traduits)

## Phase 2 — Applications et synchronisation ✅

- [x] Application PC Electron (`electron/`, `npm run desktop`) : SQLite intégré, serveur de synchro local (port 47321)
- [x] Application Android Capacitor (`android/`, `npm run android:apk` → APK ≈ 55 Mo), caméra autorisée
- [x] Appairage par QR code (adresse + port + clé secrète) dans Réglages, ou code à coller
- [x] Synchronisation incrémentale **manuelle** (bouton), avec le nombre de modifications en attente ; la modification la plus récente gagne
- [x] Si l'adresse IP du PC change, le téléphone le retrouve sur le réseau local
- [x] Grandes images et nouvelles extensions (catalogue) envoyées du PC vers le téléphone, avec progression ; option pour ne pas télécharger les grandes images
- [x] Sauvegarde automatique sur le PC (ouverture, après synchro avec changements au plus toutes les 10 min, fermeture ; 30 gardées) + bouton « Sauvegarder maintenant »
- [x] Testé : synchro dans les deux sens, suppression, synchro auto après modification, code refusé (401), app PC réelle via l'adresse Wi-Fi
- [x] Essai sur un vrai téléphone Android (Android 16) : installation, modèle de détection, appairage et synchro OK
- [ ] Icône de l'application Android (actuellement celle par défaut de Capacitor)
- [ ] Installeur Windows (.exe) — pour l'instant l'app PC se lance avec `npm run desktop`

## Phase 3 — Collection ✅

- [x] Tri (extension et numéro, nom, rareté, quantité, ajout récent) et filtres : extension, type, rareté, domaine, langue, finition
- [x] Filtre par emplacement (boîte / deck / prêtées / sans emplacement)
- [x] Zoom sur une carte : grande image originale, nom et texte FR/EN (icônes d'énergie, runes, épuiser, puissance), exemplaires possédés, ajout rapide, liste de souhaits
- [x] Progression par extension (cartes de base + variantes à part) et cartes manquantes / possédées en grille
- [x] Cartes échangeables : seuil réglable (3 par défaut), exemplaires en trop par carte
- [x] Liste de souhaits synchronisée (quantité voulue, « obtenue » quand possédée, ajout de toutes les manquantes d'une extension)

## Phase 4 — Organisation ✅

- [x] Onglet « Organiser » : Decks, Boîtes, Prêts (tout est synchronisé avec le PC)
- [x] Boîtes de rangement (un niveau) : créer, renommer, supprimer (les cartes redeviennent « sans emplacement »), contenu en grille
- [x] Chaque exemplaire est à un seul endroit : boîte, deck, prêté (un deck prêté garde son deck) ; bouton « Ranger » sur chaque ligne de la Collection (quantité au choix)
- [x] Decks : Légende, champion choisi, deck principal, runes, champs de bataille ; ajout par recherche dans tout le catalogue (domaines de la Légende, « seulement mes cartes »)
- [x] Vérification des règles (`src/lib/deckRules.js`, réglables dans `RULES`), **vérifiées avec les règles officielles** : 1 Légende, champion = unité au nom du champion, ≥ 40 cartes (exactement 40 en tournoi : avertissement), max 3 par nom complet (« Jinx - Démolisseuse » ≠ « Jinx - Rebelle », champion compris), 12 runes, 3 champs de bataille différents, domaines de la Légende, réserve (sideboard) de 8 cartes
- [x] Lien avec les vrais exemplaires : dans le deck / libres / manquants par carte, « Mettre mes exemplaires libres dans ce deck », « Vider le deck », « Manquantes → souhaits » (un exemplaire ne peut pas être dans deux decks)
- [x] Scanner directement vers une boîte ou un deck (menu à côté de EN/FR, visible dès qu'une boîte ou un deck existe)
- [x] Prêts : liste de personnes réutilisable, date, « Rendu », vue « qui a quoi », historique
- [x] Filtre « Emplacement » dans la Collection ; export CSV fusionne les emplacements
- [x] Import/export de listes de decks : texte des sites de decks (Legend / Champion / MainDeck / Battlefields / Runes / Sideboard), noms anglais ou français, codes de carte, « 3x » / « x3 » ; export en anglais ou en français, copier ou .txt
- [x] Prêter un deck entier en un geste (« Prêter le deck » → « Rendu »)
- [x] Réserve (sideboard) dans les decks
- [x] Courbe d'énergie et répartition par type d'un deck
- [x] Tri des decks « le plus facile à monter » (cartes manquantes) et mention « montable avec votre collection »

## Phase 5 — Prix ✅

- [x] Source : fichiers publics de Cardmarket pour Riftbound (jeu n° 22 : catalogue produits + guide des prix, mis à jour chaque jour, sans compte)
- [x] Correspondance cartes ↔ produits Cardmarket (`electron/prices.cjs`, `src/lib/priceBuilder.js`) : le produit de chaque impression vient de rifthunt (mis en cache 7 jours ; par nom anglais complet via Riftcodex quand rifthunt ne répond pas, extension par noms communs, variantes dans l'ordre d'ajout Cardmarket) — **1 408 / 1 408 cartes** reconnues, impressions promo et prix des promos compris
- [x] Récupération par le PC au démarrage puis toutes les 3 h (téléchargement au plus une fois par jour) ; bouton « Mettre à jour les prix » ; envoi au téléphone à la synchro (fonctionne ensuite hors ligne)
- [x] Prix « tendance » ; prix foil pour les exemplaires foil ; pas de distinction FR/EN
- [x] Prix par carte (zoom + lien « Voir sur Cardmarket »), par ligne de la Collection, tri par prix, valeur totale (filtrée)
- [x] Vue « Valeur » : total, par extension, les plus chères, courbe d'évolution
- [x] Valeur des decks et coût des cartes manquantes ; coût estimé de la liste de souhaits
- [x] Historique de la valeur : un point par jour (gardé 2 ans), calculé sur le PC
- [x] Lien Cardmarket : fiche produit directe, normale et promo (`Singles/Unleashed/Mutated-Mouser`, `Singles/Unleashed-Promos/Mutated-Mouser`), noms et versions écrits comme Cardmarket
- [x] Historique du prix de chaque carte sur 1 mois (un point par jour, sur le PC, envoyé au téléphone) + variation 7 j / 30 j (moyennes Cardmarket tant que l'historique se remplit)
- [x] Plus fortes hausses / baisses de vos cartes sur 7 jours (vue Valeur)
- [x] Alertes de prix sur la liste de souhaits (« Alerte sous X € », notification quand les prix sont mis à jour)
- [x] Prix d'achat par exemplaire (champ « Payé ») et plus-value
- [ ] Améliorer la correspondance des cartes de Radiance quand Riftcodex les aura

## Phase 6 — Compléments ✅

- [x] Afficher toutes les cartes en français (bouton « FR » de la Collection ou Réglages), même les exemplaires anglais ; la langue réelle reste sur l'exemplaire
- [x] Catalogue : noms anglais complets (Riftcodex) et noms français complétés depuis les autres impressions ; suffixes « (Alternate Art) » retirés — `npm run catalog:enrich`
- [x] Nouvelle extension en une commande : `npm run catalog:update` (scraper, noms, miniatures)
- [x] Import d'une collection CSV (CardNexus, Riftmana, tableur en français ou anglais)
- [x] Vue « Stats » : domaines, rareté, type, langue, foils, cartes manquantes par extension
- [x] Échanges : liste des doubles à partager (texte FR/EN avec prix), suivi des échanges avec différence de valeur et « Appliquer à ma collection » (synchronisé)
- [x] PC : restaurer une sauvegarde (le téléphone reçoit l'état restauré à sa synchro), historique des synchros (PC et téléphone)
- [x] Tests automatiques : `npm test` (decks, import CSV, prix, synchro et restauration)
- [x] Mascotte retirée ; icône neutre provisoire (`public/icon.svg`, `npm run icons`) en attendant le design
- [x] Icône Android et installeur Windows (`npm run desktop:exe` → dossier `release/`)
- [x] `npm run android:apk` construit l'APK et l'installe si le téléphone est branché

## Phase 7 — Design « Hextech » ✅

- [x] 3 propositions comparées (Hextech, Grimoire, Nexus) — choisie : **A · Hextech**
- [x] Couleurs : bleu nuit + or, textes contrastés ; couleurs officielles des 6 domaines (corrige l'ancienne table erronée)
- [x] Formes : angles nets, boutons biseautés, titres en Cinzel, onglets segmentés, pastilles de filtre
- [x] Navigation en 5 onglets : Collection · Decks · **Scanner** (hexagone central) · Valeur · Plus
- [x] Collection : en-tête avec valeur et variation sur 7 jours, Cartes / Progression / Souhaits, filtres par domaine en un geste, **vue grille** (par défaut) ou liste (pour modifier)
- [x] Valeur : Valeur + Statistiques ; Plus : Échanges, Boîtes, Prêts, Réglages
- [x] Scanner : en-tête (mode, langue FR/EN, « Ranger dans »), cadre doré, panneau « À ajouter »
- [x] Deck : compteurs 40 / 12 / 3, courbe d'énergie dorée, coût en hexagone, bouton « Ajouter des cartes »
- [x] Icône de l'application et du logiciel PC : hexagone doré avec le cadre de scan (`public/icon.svg`, `npm run icons`)
- [x] Écran de chargement et « À propos » avec cette icône ; mention « Créé par » et lien GitHub retirés
- [x] Caméra désactivée : plus d'icône grise d'Android derrière (vidéo masquée + image vide)

- [x] Collection (grille) : nom centré dans un cadre orangé, emplacement sous le nom (« Deck : … », « Prêtée à … », « Boîte : … ») au-dessus du prix
- [x] Collection sur PC : nombre de colonnes selon la largeur (cartes ~150 px au lieu de 3 cartes géantes)
- [x] Champs de bataille affichés en paysage, à l'endroit et sans rognage (Valeur, grilles, zoom)
- [x] Souhaits / Échanges : la vignette ne chevauche plus le texte

- [x] Valeur : 1) valeur de la collection (+ courbe), 2) variations sur 7 jours avec petites images, 3) toutes les cartes (de la plus chère, par pages), 4) plus-value en bas
- [x] Zoom : texte de la carte et évolution du prix dans le même cadre orangé ; mots-clés colorés comme sur les cartes (Accelerate vert foncé, Assault rose…, réglables dans `KEYWORD_COLORS`, `src/lib/cardLocale.js`)

## Phase 8 — Fiabilité du scan et essais ✅
- [x] Scan sans doublon : verrou immédiat pendant l'analyse + pause d'1 s après chaque résultat (un double appui ne scanne plus deux fois)
- [x] Animations : balayage doré « Analyse de la carte… », bouton grisé qui tourne ; cadre vert (reconnue), rouge (non reconnue), ambre (même carte) ; vibrations différentes
- [x] Fiche de résultat immédiate sur la caméra : image, nom, % de confiance ; « Annuler » ; « Pas la bonne carte » (5 cartes proches ou recherche)
- [x] Même carte dans les 3 s : « Même carte que juste avant — Oui, +1 / Non »
- [x] Scanner : réglage « Précision » retiré (seuil fixe 80 %), barre du bas masquée pendant le scan (bouton ✕ pour sortir), cadre plus grand et plus bas, fiche de résultat sur le cadre, chargement « Scan en cours… » dès l’appui
- [x] Scanner option A : bande « IA prête » + emplacement + lampe / scan auto / caméra sous l’en-tête ; fiche « Dernière carte ajoutée » permanente (×N dans la liste) ; liste « À ajouter » compacte (quantité, état, foil, supprimer)
- [x] Bouton retour Android (ferme fenêtre, zoom, éditeur, caméra… puis Collection, puis quitte) ; menu « Ranger dans » au thème de l’app
- [x] Collection : sélection multiple + suppression, « Annuler » après toute suppression ; Scanner : « Chercher » une carte à la main, langue FR/EN par carte dans « À ajouter » ; Decks : « Ce qui me manque » pour tous les decks ; sauvegarde dans un fichier (sans PC) ; statistiques du scan
- [x] Gros bouton Scanner sur la caméra ; le bouton Scanner de la barre du bas scanne aussi quand l'écran Scanner est ouvert

- [x] **Champs de bataille** : ils étaient comparés à l'envers (images de référence tournées dans l'autre sens) ; la reconnaissance teste aussi la carte retournée à 180° — simulation : 14/77 → **77/77** reconnus, aucune régression sur 222 autres cartes
- [x] Modèle « Normal (Float32) » disponible aussi sur Android (Réglages → Modèle) ; APK ≈ 90 Mo
- [x] Synchro dans le sens choisi, jamais automatique : téléphone « Envoyer sur le PC » / « Recevoir du PC » / « Les deux sens » ; PC « Envoyer sur le téléphone » (le téléphone affiche « Recevoir » à l'ouverture et vous validez)
- [x] `npm run android:apk` copie l'APK dans `release/Riftbound-Scanner.apk` (à côté de l'installeur PC)
- [x] Données de démonstration (Plus → Réglages → « Charger / Retirer la démo »), identifiées par « demo- », retrait sans toucher aux vraies cartes

## Phase 9 — Corrections de la revue (CORRECTIONS.md)
- [x] Lot 1.1 : restauration d'une sauvegarde sur PC réparée (`fs` manquant → liste toujours vide) ; noms de sauvegarde validés (`electron/backups.cjs`) + tests
- [x] Lot 1.2 : serveur local — vérification de chemin stricte (les dossiers voisins comme `dist-mobile` ne sont plus servis) + tests
- [x] Lot 2 : sécurité — Electron 45 / Vite 8 (0 vulnérabilité high/critical), fenêtre durcie + CSP, texte des cartes assaini, synchro chiffrée et signée (protocole v2, ré-appairage), hello anonyme, CORS restreint, limiteur, réglage « synchro réseau », mDNS + recherche manuelle, APK release signé/minifié, pas de sauvegarde Android
- [x] Lot 3 : banc d'essai de la reconnaissance (`npm run eval:matcher`), score centré + marge (faux positifs hors catalogue 100 % → 0,9 %, cartes acceptées à tort 14,3 % → 0,1 %), « Carte incertaine — laquelle ? », rééditions groupées avec choix de l'extension
- [x] Lot 4 : cartes Signature + liste de bannissement, matchs synchronisés + statistiques + matchups + CSV, compteur de points, main de départ + probabilités, feuille de deck imprimable + code de partage, prix de référence (tendance / moyenne 7 j / bas)
- [x] Lot 5 : ONNX Runtime 1.31 (WebGPU sur PC : 1 220 → 19 ms ; WASM 4 fils), APK sans le modèle normal (téléchargé depuis le PC, vérifié), correction des horloges à la synchro, ESLint (`npm run lint`), découpage des gros fichiers
- [x] v2 Lot A : « Prudent » par défaut (migration des préférences), plus de mode simulation (erreur visible + Réessayer), apprentissage mesuré honnêtement (pénalité 0,3, garde-fou)
- [x] v2 Lot B : champion en Champion Zone (pioche de 39), matchups regroupés par Légende
- [x] v2 Lot C : test portable Linux/Windows, lint 71 → 0 avertissement (règles en erreur)
- [x] v2 Lot D : une clé par téléphone (protocole v3, fenêtre d’appairage), empreinte du jour, mDNS durci, SHA-256
- [x] v2 Lot E : démarrage 818 → 155 Ko (pages à la demande), moteur WebGPU seulement si utile, modèle téléchargé par morceaux
- [x] v2 Lot F : doublons de modèles supprimés, model/fr hors de git, Git LFS
- [x] Modèles IA — étape 1 : interface des moteurs, banc comparatif, photos:prepare
- [x] Modèles IA — étape 2 : DINOv2 / MobileNetV4 / SigLIP 2 mesurés (`model/MODELS.md`)
- [x] Modèles IA — étape 2.5 : DINOv2 int8 + empreinte retenu (65 photos réelles : 69 → 91 % acceptées justes)
- [x] Modèles IA — étape 4 : IA intégrée (cascade couleurs → IA), signatures dans le catalogue, réglage, repli visible, test de vitesse
- [x] Modèles IA — étape 4.6 : empreinte 5× plus rapide, 1 image IA de 168 px, Android multi-cœurs
- [ ] Modèles IA — étape 4.6 : nouvelle mesure de vitesse sur le téléphone et le PC
- [x] Détection YOLO lente sur le téléphone (≈ 2 s) : 320 px caméra, 416 px photo (2026-11-13). Sur le téléphone : 485 ms de détection, 557 ms par scan. Modèles livrés depuis le 2026-11-14 : YOLO float32 dynamique et DINOv2-small affiné sur les cartes (fp16). Moteur natif (AMELIORATIONS-NATIF.md, étape 2) : à décider
- [ ] v2 D.5 : CSP Android restreinte aux ports — à tester sur le téléphone
- [ ] v2 A.3 : précision sur de vraies photos — photos à fournir
- [x] Collecte banc d’essai dans l’appli (MODULE-BANC.md, mode développeur) : carte seule / grille, confirmation de chaque carte, « Ma collecte », export ZIP + `npm run bench:import`, option scans hésitants
- [ ] Banc : ligne « précision sur les photos collectées par source » et respect du champ `split` (autre session, étape 5)
- [ ] Collecte banc d’essai : à essayer sur le téléphone (image caméra, scans hésitants, export dans Documents/Riftbound)
- [x] CI GitHub Actions (lint, tests, build, audit) — légère, sans les fichiers LFS (M14d)
- [x] Lot 6 : incohérences de documentation corrigées ; suppression des doublons de modèles / Git LFS / `model/fr` hors git — proposés, à décider

## Phase 10 — Distribution aux amis (AMELIORATIONS-APPLI.md), découpée en modules

Ordre du cahier des charges (du plus important au moins important). Chaque
module : tests, lint, build, APK de test si Android, CHANGELOG, un commit poussé.

- [x] **M0 · Fondations du design** (B.1, B.2) : jetons d'état, `.chip` / `.toggle`, composants communs (`Dialog`, `Sheet`, `Banner`, `StatusPill`, `SectionCard`, `Field`, `DiffList`, `Stepper`, `ProgressRow`, `EmptyState`), maquettes versionnées
- [x] **M1 · Cartes bannies et format de deck** (lot 1.1)
- [x] **M2 · Prix cohérents** (lot 1.2) — promo : prix séparé (décidé)
- [x] **M3 · États Cardmarket** (lot 1.3) — correspondance usuelle NM→NM, LP→EX, MP→GD, HP→PL, D→PO (décidé)
- [x] **M4 · Nettoyage du scanner** (lot 1.4) : une seule chaîne, seuils dans l'en-tête du catalogue, mode Rapide retiré — scanner de test validé le 17/11
- [x] **M5 · Signature et paquet de distribution** (lot 2) — clé créée par l'utilisateur (annexe A) ; `npm run release -- <version>`, `npm run release:check`, version unique 2.1.0
- [x] **M6 · Ne jamais perdre les données** (lot 3) : sauvegardes automatiques, rappel de synchro, dossier supplémentaire, conflits
- [x] **M7 · Contenu à jour depuis le PC** (lot 4) — M7a couches et écran Contenu ✓, M7b cartes bannies ✓, M7c traductions ✓, M7d nouvelles cartes ✓, M7e packs signés ✓, M7f versions et APK léger ✓ : couches (4.1), nouvelles cartes avec parité (4.2), traductions (4.3), bannissements (4.4), packs (4.5, signés Ed25519 — décidé), versions et APK sans grandes images (4.6)
- [x] **M8 · Quand quelque chose casse** (lot 5) : écran de secours, erreurs de démarrage, rapport de diagnostic
- [x] **M9 · Ergonomie** (lot 6, B.3, B.4, B.6.9 à B.6.13) — écran de chargement A « Forge hextech » (choisi le 18/11) ; M9a écran de chargement ✓, M9b navigation ✓, M9c réglages en sections ✓, M9d recherche et raccourcis ✓, M9e premier lancement ✓, M9f finitions ✓
- [x] **M10 · Decks et jeu compétitif** (lot 7) — M10a codes de deck communs et inscription ✓ · M10b versions ✓ · M10c notes par adversaire ✓ · M10d compteur ✓ · M10e errata ✓
- [x] **M11 · Confort du scan** (lot 8) — M11a mains libres ✓ · M11b sons ✓ · M11c langue détectée : étudiée, pas livrée (docs/ETUDE-LANGUE.md) · M11d variantes ✓ (docs/ETUDE-VARIANTES.md)
- [x] **M12 · Alertes de prix** (lot 9) — alertes sur mes cartes (± X % en 7 jours, valeur minimale, sur le vrai historique) ✓ · panneau « Mouvements » dans Valeur ✓ · résumé après chaque mise à jour des prix ✓
- [x] **M13 · Entre amis** (lot 10) — listes partagées par fichier (doubles et souhaits, sans prix payés ni emplacements) ✓ · échanges possibles par ami ✓ · calculateur enregistrable ✓
- [x] **M14 · Documentation et qualité** (lot 11) — M14a guide amis et README ✓ · M14b tests d’écran (npm run test:e2e) ✓ · M14c découpage useAppController / ScanTab ✓ · M14d intégration continue légère, sans LFS ✓
- [x] **Retouches après les essais** (20/11) : écran de chargement de 2,4 s fixes avec une jauge fluide (animée par le navigateur), carte de la fiche qui se pose droite (nette), carte plus grande dans la fiche sur le téléphone et sur le PC
- [ ] Plus tard (lot 12) : moteur natif, collecte chez les amis

Bilan de la phase (ce qui a été fait, décisions, ce qui n’est pas livré, vérifications, publier la 2.1.0) : [docs/PHASE-10.fr.md](docs/PHASE-10.fr.md).

## Phase 11 — Corrections v3, avant la publication de la 2.1.0 (CORRECTIONS-v3.md)

Gel des fonctionnalités jusqu'à la 2.1.0 et aux premiers retours des amis : seulement ces corrections.

- [x] **Lot A · Electron et audit** : Electron 45.4.1, audit complet dans la CI, `npm run check:electron`
- [x] **Lot B · Packs de contenu** : signature vérifiée avant de lire le reste, pas d'entrée compressée ; clé privée chiffrée, liste de clés révocables
- [x] **Lot C · Récupération sur Internet** : redirections revérifiées, limite de taille pendant la lecture
- [x] **Lot D · Sauvegardes du téléphone** : copie hebdomadaire dans Documents/Riftbound
- [x] **Lot E · Petits correctifs** : test des cartes ajoutées à la main ; écran de chargement gardé à 2,4 s (décision du 20/11)
- [ ] Après la 2.1.0 (lot F) : bannissements par circuit, empreintes de la version signées, blocs JavaScript des réglages et de l'accueil plus légers, moteur natif Android

## Licence et publication (LICENCE-ET-PUBLICATION.md)

- [x] **Partie 1 · Licence MIT du projet d'origine** : `LICENSE`, crédits (README, licences tierces, guide, À propos), mention Riot FR/EN, licence dans chaque copie, `release:check` bloquant ; publiée avec la 2.1.1
- [x] **Licence : GNU AGPL-3.0** (21/11) : le détecteur est entraîné avec Ultralytics YOLO11 (AGPL-3.0) ; avis MIT du projet d’origine gardé
- [x] **Partie 2 · Renommage en RiftMancer** (21/11) : nom affiché partout, identifiant Android `com.riftmancer.app`, dossier de données PC repris au premier lancement
- [x] Partie 2 · Contenu des cartes hors de la copie publique (`npm run public:export`, `npm run content:import`, tests et version sans / avec contenu) — contenu sauvegardé dans `../sauvegarde-contenu` (21/11)
- [x] Partie 2 · Données personnelles nettoyées, recherche de secrets (gitleaks : rien de réel), **dépôt public https://github.com/FaZox/RiftMancer** publié le 21/11/2026 (historique neuf, adresse e-mail masquée, 465 fichiers)
- [x] **Cartes au premier lancement** (21/11) : une appli sans le contenu des cartes démarre avec l’en-tête du catalogue seulement (`public/catalog-base.json`) et propose « Télécharger les cartes » (galerie officielle) ou « Importer un dossier… » (une sauvegarde, une clé USB) ; le téléphone les reçoit du PC
- [x] **rifthunt en priorité** (21/11) : cartes, cartes bannies et liens Cardmarket depuis api.rifthunt.com, les anciennes sources (galerie Riot, page des règles de tournoi, Riftcodex) en secours
- [x] **Impressions et promos** (21/11) : les 318 impressions manquantes (ensembles promos PR, OPP, JDG, RWB, SGN, KDA ; signatures, showcases, alternatives), une section « Impressions et variantes » dans la fiche de la carte, prix Cardmarket propre à chaque impression
- [x] **Rulings** (21/11) : les rulings de riftboundfaq.com (via rifthunt, CC BY-SA 4.0, non officiels, en anglais) dans la fiche de la carte, questions qui s’ouvrent pour montrer la réponse
- [ ] Facultatif : traductions françaises : demander à riftboundfr.fr

## Phase 12 — Scanner par grille

Une page de classeur ou des cartes posées à plat, scannées d'un coup.

- [x] **Étape 1 · Visée en direct, photo automatique** : cadre sur chaque carte, photo pleine résolution quand rien ne bouge, pas de doublon avant la page suivante
- [x] **Étape 2 · Vérification et page suivante** : cases numérotées dans l'ordre de lecture, vert / orange, « Ajouter · page suivante », compteur de la série
- [x] **Étape 3 · Classeur** : chaque carte rangée avec sa page et sa case (d'après sa position sur la photo), numéro de page proposé et corrigeable, page déjà prise signalée, emplacement « p. 4, case 7 » dans la collection, pages du classeur case par case dans l'écran de la boîte
- [ ] Étape 4 · Précision avec les pochettes : pas nécessaire pour l'instant (essai du 20/11 : aucune carte gênée par les reflets) ; à reprendre si des amis en signalent
- [x] Essai sur le téléphone avec un vrai classeur (20/11) : assez rapide, photo prise au bon moment, pas de carte gênée par les reflets

## Phase 13 — Anglais et français (21/11)

L'appli en anglais par défaut (français quand le téléphone ou le PC est en français), français au choix dans Réglages → Affichage.

- [x] **Lot 1 · Moteur et choix de langue** : `src/lib/i18n.js` (texte français comme clé, `tx` / `tp`), « Language · Langue » dans Réglages → Affichage et au premier lancement, langue des cartes qui suit
- [x] **Lot 2 · Écrans** : 1 328 textes en anglais (`src/i18n/en.js`), `tests/i18n.test.mjs`
- [x] **Lot 3 · Phrases avec nombres et modules internes** : 1 644 textes
- [x] **Lot 4 · Dates, prix, états, feuille de tournoi, dialogues de l'appli PC** (`electron/i18n.cjs`) : 1 676 textes ; tests toujours en français
- [x] **Lot 5 · Documentation** : README (+ README.fr.md), guide des amis, nouveautés (appli et paquet), études, rapport IA, feuille de route en anglais, versions françaises gardées ; CHANGELOG en anglais à partir de maintenant
- [ ] Vérifier sur le téléphone et le PC dans les deux langues

## Autres idées (plus tard)

- [x] Simulateur de main de départ (Lot 4, finalement demandé)
