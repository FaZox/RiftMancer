# RiftMancer

> Basé sur [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) de Nekoraru22 (licence MIT), largement modifié et étendu.

*English version: [README.md](README.md).*

Scanner et gestionnaire de collection pour le jeu de cartes **Riftbound** (League of Legends TCG).
Deux applications qui partagent les mêmes données et se synchronisent entre elles :

- **Logiciel PC (Windows)** — interface pensée pour la souris et les grands écrans (1080p, 2K, 4K) ;
- **Application Android** — interface pensée pour le téléphone, scan à la caméra.

Reconnaissance des cartes par intelligence artificielle (YOLO11 + empreintes couleur, puis DINOv2), hors ligne, sans compte.

**Documentation** : [sécurité](SECURITY.md) · [guide pour les amis](docs/LISEZ-MOI-AMIS.md) ([anglais](docs/FRIENDS-GUIDE.md)) (installer, appairer, synchroniser, mettre à jour) · [nouveautés par version](docs/NOUVEAUTES.md) ([anglais](docs/WHATS-NEW.md)) · [journal des changements](CHANGELOG.md) · [données et base de données](docs/BASE-DE-DONNEES.md) · études : [modèles d’IA](docs/RAPPORT-MODELES-IA.md), [langue détectée](docs/ETUDE-LANGUE.md), [variantes](docs/ETUDE-VARIANTES.md).

## Télécharger

La dernière version est sur la page **[Releases](https://github.com/FaZox/RiftMancer/releases)** :

- **PC (Windows)** : `RiftMancer-Setup-<version>.exe`. L’installateur n’est pas signé par un éditeur connu de Microsoft : sur « Windows a protégé votre ordinateur », cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
- **Android** : `RiftMancer-<version>.apk`, à ouvrir sur le téléphone (autorisez l’installation depuis cette source quand Android le demande).

Les applis sont livrées **sans les cartes** (images, noms et textes appartiennent à Riot Games). Au premier lancement, l’appli PC propose **Télécharger les cartes** (galerie officielle, environ 170 Mo) ou **Importer un dossier…** ; le téléphone les reçoit du PC à la synchro. `EMPREINTES.txt` donne le SHA-256 de chaque fichier. Pas à pas : [guide pour les amis](docs/LISEZ-MOI-AMIS.md).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
   - [Scanner](#scanner)
   - [Collection](#collection)
   - [Fiche d’une carte (zoom)](#fiche-dune-carte-zoom)
   - [Decks](#decks)
   - [Matchs](#matchs)
   - [Valeur et prix Cardmarket](#valeur-et-prix-cardmarket)
   - [Liste de souhaits](#liste-de-souhaits)
   - [Boîtes, prêts et échanges](#boîtes-prêts-et-échanges)
   - [Synchronisation téléphone ↔ PC](#synchronisation-téléphone--pc)
   - [Sauvegardes](#sauvegardes)
   - [Réglages](#réglages)
2. [Deux interfaces : PC et Android](#deux-interfaces--pc-et-android)
3. [Installation et compilation](#installation-et-compilation)
4. [Commandes](#commandes)
5. [Architecture du code](#architecture-du-code)
6. [Données et stockage](#données-et-stockage)
7. [Mettre à jour le catalogue des cartes](#mettre-à-jour-le-catalogue-des-cartes)
8. [Limites connues](#limites-connues)
9. [Annexe technique : détection, reconnaissance et entraînement du modèle](#annexe-technique)

---

## Fonctionnalités

### Scanner

- **Caméra (téléphone ou webcam)** : on cadre la carte, un appui scanne ; scan automatique en option, lampe, changement de caméra.
- **Mains libres** : téléphone sur un support (ou webcam), chaque nouvelle carte posée et immobile est scannée sans appui ; **sons** discrets en option (reconnue, à confirmer, déjà scannée), coupés par défaut.
- **Photos (PC en priorité)** : glisser-déposer ou choisir **plusieurs photos d’un coup**, avec une ou plusieurs cartes par photo.
  - Chaque carte trouvée est encadrée sur la photo ; on peut déplacer les 4 coins d’un cadre pour corriger.
  - Toutes les cartes reconnues sont cochées : « Ajouter N cartes et passer à la suivante », ou **« Tout analyser et ajouter »** pour toutes les photos.
- **Reconnaissance** : détection YOLO11s-pose (un seul modèle float32, livré avec l’appli ; sur PC, la carte graphique est utilisée via WebGPU), carte redressée en perspective, puis comparaison avec le catalogue : couleurs d’abord, et quand elles hésitent, l’IA (DINOv2 affiné) sur l’illustration, dans les deux sens. En mode photo, si peu de cartes sont trouvées (photo prise téléphone à plat), le détecteur réessaie l’image tournée de 90, 180 et 270°.
  - Décision par **score centré et marge** sur la deuxième illustration : confiance affichée calibrée, « Sûr / Probable / Incertain ».
  - Dès qu’il y a un doute, rien n’est ajouté et « laquelle est-ce ? » propose les 5 meilleures. En caméra, une carte trop petite dans l’image (moins de 2 %) est toujours demandée.
  - **Rééditions à illustration identique** (runes OGN/RAD/VEN, versions ★…) : choix de l’extension sous la carte, mémorisé pour la session.
  - Champs de bataille reconnus dans les deux sens (testés à 180°).
  - **Illustrations alternatives** reconnues comme cartes à part ; une **signée** est groupée avec sa carte normale et le scanner demande laquelle (`docs/ETUDE-VARIANTES.md`). Le foil ne se voit pas sur une photo : à indiquer soi-même.
  - « Pas la bonne carte » : 5 cartes proches proposées, ou recherche à la main.
  - **Il apprend de vos corrections** : la carte que vous choisissez vous-même devient un exemple pour les scans suivants (synchronisé avec le PC ; Réglages → Scanner → « Apprendre de mes corrections », « Oublier »).
  - Banc d’essai : `npm run eval:matcher` (photos simulées, faux positifs hors catalogue < 1 %).
- **Retour immédiat** : fiche « Dernière carte ajoutée » sur la caméra, animations (vert reconnu, rouge non reconnu, ambre même carte), vibrations ; « Annuler » ; pas de doublon sur un double appui ; « Même carte que juste avant ? Oui +1 / Non ».
- **Liste « À ajouter »** : rien n’entre dans la collection avant « Tout ajouter à la collection ». Par carte : langue (FR/EN), état, foil, quantité, supprimer.
- **« Ranger dans »** : les cartes scannées vont directement dans une boîte ou un deck.
- **Langue des cartes** (FR/EN) choisie avant de scanner ; **« Chercher une carte »** par son nom (FR ou EN) ou son numéro.
- Statistiques du scan (réussis, corrigés, annulés).

### Cartes (tout le catalogue)

- **Toutes les cartes de Riftbound**, possédées ou non, une vignette par carte (ses autres impressions regroupées, « +2 impressions »), ×N sur celles que vous avez ; « Griser les manquantes » à la demande.
- **Une seule barre de recherche** : un nom (français ou anglais), un numéro, ou des clés — `t:unité d:esprit e<=3 own:0`. Clés : `t:` type, `d:` domaine, `e:` énergie, `p:` puissance, `r:` rareté (`r>=rare`), `s:` set, `o:` texte, `n:` numéro, `is:` foil / promo / signature / bannie / champion / deck, `own:` exemplaires possédés ; opérateurs `: = != < <= > >=`, `-` devant une clé l’inverse, les guillemets regroupent les mots. Les noms anglais marchent aussi (`t:unit d:mind`).
- **Filtres** (domaines, sets avec progression, type, énergie, puissance, rareté, autres) : ils écrivent leur clé dans la barre et s’allument quand vous en tapez une ; Toutes · Possédées · Manquantes avec leur nombre.
- **Actions rapides** : la fiche en un clic ; sur PC le « + » au survol ajoute un exemplaire (avec « Annuler »), Ctrl / Maj pour en choisir plusieurs ; sur téléphone un appui long sélectionne ; sélection → souhaits, un deck ou la collection ; « Manquantes → souhaits », export CSV de la vue. Téléphone : trouver une carte avec le scanner.

### Collection

- **Un exemplaire = une fiche** : chaque carte physique a sa langue, son état, foil, son emplacement et son prix d’achat.
- **Vue grille** (images, nom dans un cadre doré, emplacement, prix) ou **tableau** (PC) où l’on modifie directement langue, état, foil, quantité, emplacement et prix payé.
- **Taille des cartes** S / M / L (PC, L par défaut) ; images en pleine définition sur PC.
- **Recherche** (nom FR/EN, numéro), **filtres** : domaine, extension, type, rareté, langue, finition, emplacement ; **tri** : extension et numéro, nom, rareté, quantité, ajout récent, prix.
- **Valeur** de la collection affichée (et de la sélection filtrée), variation sur 7 jours.
- **Sélection multiple** et suppression, **« Annuler »** après toute suppression.
- **Import CSV** (CardNexus, Riftmana, tableur FR/EN) et **export CSV** (CardNexus, Riftmana…).
- **Progression** par extension : cartes possédées / manquantes (variantes à part), « Tout ajouter aux souhaits ».
- **Tout en français** : noms et textes affichés en français même pour les exemplaires anglais (la langue réelle reste sur l’exemplaire).

### Fiche d’une carte (zoom)

- **PC** : fenêtre compacte (la collection reste visible derrière), carte à gauche, informations à droite ; flèches ← → du clavier, Échap pour fermer.
- **Téléphone** : plein écran, **glisser à gauche / à droite** pour passer à la carte suivante.
- **Mise en scène** : la carte sort d’une faille au sol, aux couleurs de son domaine, se balance une fois puis se pose droite (nette pour la lire) pendant que le décor continue de bouger ; les **légendes et les cartes à plus de 20 €** ont un décor à éclairs et un cadre électrique aux couleurs de la carte.
- **Grande carte** : sur le téléphone, la scène prend toute la largeur de l’écran (≈ 264 px de carte sur un écran de 412 px) ; sur le PC, ≈ 343 × 479 px en 1440 × 900. Sur le téléphone, l’image est nette une fois les grandes images reçues du PC.
  - Option « Animations des cartes » pour une carte simple et fixe (les légendes gardent leurs effets).
- **Onglets** : Infos (texte FR/EN, mots-clés colorés comme sur les cartes, énergie, puissance, illustrateur) · Prix (prix tendance, foil, **historique sur 1 mois**, lien Cardmarket) · Ma collection (exemplaires, emplacements).
- **Depuis la collection** : « Ajouter un exemplaire FR/EN », ♡ souhaits.
- **Depuis un deck** : « Dans le deck − N + » (on modifie le deck, jamais la collection).

### Decks

- **Légende et champion** mis en avant (animés), **règles officielles vérifiées** : 1 Légende, champion = unité du nom de la Légende, ≥ 40 cartes (40 en tournoi), 3 maximum par nom complet, 12 runes, 3 champs de bataille différents, domaines de la Légende, réserve (sideboard) de 8 cartes.
- **Compteurs** Deck / Runes / Champs / Réserve et avertissements.
- **PC — éditeur en 3 colonnes** :
  - le deck en images (3 à 6 par ligne, 3 par défaut), trié par **coût, prix ou nom** ; sous chaque carte : prix à l’unité et **« N manquantes · prix total »** ;
  - le **catalogue toujours ouvert** (2 cartes par ligne, redimensionnable) : un clic ajoute au **Deck** ou à la **Réserve** ;
  - l’**aperçu** à droite : la carte survolée en grand, énergie et puissance avec icônes, prix, « + Deck », « + Réserve ».
  - Raccourcis : clic droit sur une carte du deck = un exemplaire de moins ; clic droit / molette dans le catalogue = fiche complète.
- **Téléphone** : liste par zone avec énergie et puissance, « Réserve » / « Deck » sur chaque carte, poubelle au dernier exemplaire ; dans « Ajouter des cartes », **maintenir le doigt** sur une carte ouvre sa fiche avec « − / + » dans le deck.
- **Lien avec vos exemplaires** : dans le deck / libres / manquants, « Mettre mes exemplaires libres dans ce deck », « Vider le deck », valeur du deck et coût des cartes manquantes.
- **Cartes manquantes** : « Manquantes → souhaits », **« Manquantes → Cardmarket »**, et « Ce qui me manque » pour tous les decks à la fois (avec bouton « Acheter » par carte).
- **Import / export** de listes (texte des sites de decks, noms FR ou EN, codes de cartes), **codes de deck communs** (format Piltover Archive, lus et écrits ; l'ancien `RB1.…` reste lu), « Copier pour l'inscription », **feuille de deck pour tournoi** (imprimer / PDF sur PC) ; **prêter un deck** entier ; courbe d’énergie ; notes ; tri des decks « le plus facile à monter ».
- **Cartes Signature** (3 au total, du champion de la Légende) et **cartes bannies / limitées** (`public/banlist.json`) vérifiées.
- **Versions d'un deck** (enregistrer la liste avant un tournoi, comparer deux versions, matchs rattachés à la version jouée), **notes et plan de réserve par Légende adverse**, cartes **au texte modifié** (errata) signalées.
- **Main de départ** (main de 4, mulligan de 2 cartes, pioche) et **probabilités exactes** d’avoir une carte ou un groupe de cartes au tour N, en premier ou en second.

### Matchs

- **Saisie rapide** après une partie (Légende adverse, « J’ai commencé », Victoire / Défaite / Nul), ou complète (Bo1 / Bo3 avec manches, événement, ronde, notes) ; synchronisée entre téléphone et PC.
- **Statistiques** : victoires globales, par deck, par Légende jouée, contre chaque Légende, **matrice de matchups**, en premier / en second, par événement (grisé sous 5 parties) ; **export CSV**.
- **Compteur de points** plein écran : **1v1, 2v2 (11 points) ou chacun pour soi** (3 ou 4), tirage du premier joueur, Bo3, historique point par point avec « Annuler le dernier point », reprise d'une partie interrompue, écran toujours allumé ; il enregistre le match à la fin.

### Valeur et prix Cardmarket

- **Prix Cardmarket** (fichiers publics, jeu n° 22), mis à jour une fois par jour, **sur le PC comme sur le téléphone** (sans passer par le PC) ; ~1 303 / 1 408 cartes reconnues ; prix foil pour les foils. **Prix de référence** au choix : tendance, moyenne 7 jours ou prix bas ; ⚠ quand la tendance est instable.
- **Tableau de bord (PC)** : valeur totale, variation sur 7 jours, plus-value, courbe d’évolution, valeur par extension, plus fortes hausses et baisses, **toutes les cartes dans un tableau triable**.
- **Statistiques** : domaines, rareté, type, langue, foils, cartes manquantes par extension, statistiques du scan.
- **Alertes sur mes cartes** : une carte qui monte ou baisse de plus de X % en 7 jours (au-delà d'une valeur minimale, Réglages → Prix), calculée sur l'historique gardé par l'appli ; panneau « Mouvements » en tête de Valeur et résumé après chaque mise à jour des prix.
- **Liens « Acheter sur Cardmarket »** avec des **filtres réglables** : pays du vendeur (France par défaut), langues (FR + EN), état minimum (Good).

### Liste de souhaits

- Quantité voulue, possédées, à acheter avec le coût, variation sur 7 jours, **alerte de prix** (« sous X € », notification à la mise à jour des prix).
- **PC** : tableau dans le style de la collection.
- **« Envoyer vers mes souhaits Cardmarket »** : la liste est copiée au format Cardmarket (« 2 Jinx, Demolitionist ») et la page des souhaits Cardmarket s’ouvre — il reste à coller.

### Boîtes, prêts et échanges

- **Boîtes** de rangement : chaque exemplaire est à un seul endroit (boîte, deck ou prêté) ; contenu, valeur.
- **Prêts** : personnes, date, « qui a quoi », « Rendu », historique ; prêter un deck entier.
- **Échanges et amis** : chacun exporte un fichier avec ses doubles et ses souhaits (sans prix payés ni emplacements) ; la liste d'un ami importée montre ce qu'il a et que vous cherchez, et l'inverse ; **calculateur** d'échange avec l'écart de valeur ; historique des échanges avec « Appliquer à ma collection ». Rien n'est envoyé automatiquement.
- Vos doubles (seuil réglable) restent partageables en texte FR/EN avec prix.

### Synchronisation téléphone ↔ PC

- **Appairage par QR code** (adresse, port, clé secrète) sur le réseau local.
- **Échanges chiffrés, une clé par téléphone** : chaque requête est signée (anti-rejeu) et les données sont chiffrées (AES-256-GCM). Le QR code ne sert qu’à l’appairage, et seulement pendant qu’il est affiché sur le PC. « Dissocier » coupe un téléphone sans toucher aux autres ; « Nouveau QR code » invalide les QR codes déjà affichés ou photographiés.
- Si l’adresse IP du PC change, le téléphone le retrouve par mDNS (`_riftbound._tcp`) ; sinon bouton « Rechercher le PC sur le réseau ».
- Réglage PC « Autoriser la synchronisation sur le réseau » : désactivé, le PC n’est plus joignable depuis le Wi-Fi.
- **Toujours manuelle**, dans le sens choisi : « Envoyer sur le PC », « Recevoir du PC », « Les deux sens » ; le PC peut proposer « Envoyer sur le téléphone ».
- Synchronisation incrémentale (la modification la plus récente gagne), historique des synchros ; les nouvelles extensions et grandes images passent du PC au téléphone.
- Tout est synchronisé : exemplaires, souhaits, boîtes, decks, personnes, prêts, échanges.

### Sauvegardes

- **PC** : sauvegarde automatique (ouverture, après une synchro avec changements, fermeture ; 30 gardées), « Sauvegarder maintenant », **restauration** ; **dossier supplémentaire** (clé USB, autre disque) où chaque sauvegarde est copiée, signalé « Introuvable » sans rien bloquer.
- **Téléphone** : sauvegarde automatique (au plus une par jour s’il y a eu des changements, avant toute mise à jour des données et avant une restauration ; 10 gardées), restauration, export vers Documents ; sauvegarde dans un fichier.
- **Rappel de synchro** sur le téléphone (« N changements non envoyés au PC depuis X jours », 7 jours par défaut) ; **conflits** (fiche modifiée des deux côtés) notés dans l’historique des synchros.

### Réglages

- Cartes scannées : état, langue, foil par défaut ; affichage tout en français.
- Reconnaissance : moteur IA + couleurs (par défaut) ou couleurs seules ; apprentissage des corrections.
- Animations des cartes ; filtres Cardmarket ; synchronisation ; sauvegarde ; **données de démonstration** (charger / retirer sans toucher aux vraies cartes).

---

## Deux interfaces : PC et Android

Le **même code** pour les données et la logique, **deux interfaces** distinctes :

| | Logiciel PC | Application Android |
|---|---|---|
| Choix | logiciel Electron, ou navigateur large (≥ 1024 px) | application Capacitor, ou navigateur étroit |
| Navigation | colonne à gauche (Cartes · Collection, Valeur · Decks, Matchs · Scanner · Boîtes, Prêts, Échanges · Réglages) | barre du bas : Collection · Cartes · Valeur · **Scanner** · Decks · Boîtes · Plus |
| Scanner | photos d’abord (plusieurs à la fois), webcam en option | caméra d’abord |
| Collection | grille S/M/L ou tableau modifiable | grille ou liste |
| Fiche d’une carte | fenêtre compacte | plein écran, glisser pour changer de carte |
| Decks | 3 colonnes : deck, catalogue, aperçu | liste par zone, ajout en plein écran |
| Écrans 2K / 4K | mise à l’échelle automatique (125 % / 150 %), fenêtre maximisée | — |

Interface en **anglais ou en français** (Réglages → Affichage), thème « Hextech » (bleu nuit et or, couleurs officielles des 6 domaines).

---

## Installation et compilation

**Prérequis** : Node.js 20+, **Git LFS** (les modèles `*.onnx`, les images `*.webp` et `model/textures/` sont stockés en LFS : `git lfs install` avant de cloner) ; pour l’APK : Android SDK (Android Studio) ; pour le modèle : Python 3.

```bash
npm install
npm run dev            # version navigateur (développement)
npm run desktop        # logiciel PC
npm run desktop:exe    # installateur Windows → release/RiftMancer Setup <version>.exe
npm run android:apk    # APK Android → release/RiftMancer.apk (installé si le téléphone est branché)
npm run desktop:exe:test  # version de TEST du PC   → release/RiftMancer Test Setup <version>.exe
npm run release -- 2.2.0  # paquet à donner aux amis → release/v2.2.0/ (voir « Distribuer une version »)
npm run android:apk:test  # version de TEST Android → release/RiftMancer-Test.apk
```

### Contenu des cartes (hors du dépôt public)

Les images, noms et textes des cartes appartiennent à Riot Games, et les textes français viennent de riftboundfr.fr : ils ne sont pas publiés avec le code. Sur une machine qui les a, ils sont dans `public/cards/` et `public/card-hashes.json`. Pour les obtenir :

- `npm run content:import -- <dossier>` les copie depuis un dossier de contenu (une sauvegarde, une clé USB : `public/cards/` et `public/card-hashes.json` dedans ; par défaut `../sauvegarde-contenu`) ;
- ou `npm run catalog:update` les construit depuis la galerie officielle de Riot (scraper Python, voir l’annexe technique), puis `node scripts/build-embeddings.mjs` pour les signatures IA.

Sans eux, l’appli se construit mais n’affiche aucune carte, `npm test` met de côté (en les nommant) les fichiers de tests qui en ont besoin, et `npm run release` refuse de construire une version. `npm run public:export` fait la copie publique du dépôt (fichiers suivis seulement, vrais fichiers pour Git LFS) sans ce contenu ni les images de licence inconnue (`model/textures/`, `model/distractors/`, `model/manual-cards/`, `docs/maquettes/`), et liste les traces personnelles qui restent à nettoyer.

### Version de test et version de tous les jours

Chaque app existe en deux exemplaires installables **côte à côte** : on essaie une nouvelle version sur l’app de test sans toucher à la vraie collection.

| | Tous les jours | Test |
|---|---|---|
| PC | « RiftMancer » — données `%APPDATA%\riftmancer`, port 47321 | « RiftMancer Test » — données `%APPDATA%\riftmancer-test`, port 47322 |
| Android | « RiftMancer » (`com.riftmancer.app`) | « RiftMancer Test » (`com.riftmancer.app.test`) |

Les apps de test affichent un badge **TEST** orange. Appairez le téléphone de test avec le PC de test (QR code du PC de test) : les deux couples sont indépendants.

> L’APK et l’installateur se construisent depuis le dossier principal du projet : les images des cartes (`public/cards/`) doivent être présentes.

### APK signé (release)

Sans clé, `npm run android:apk` construit un APK **de debug** (débogable, signé avec la clé de debug de ce PC). Pour un APK **release** (optimisé, non débogable), créez une fois une clé de signature et gardez-la précieusement (sans elle, plus de mise à jour possible de l’app installée) :

```bash
keytool -genkeypair -v -keystore android/riftbound-release.jks -alias riftbound -keyalg RSA -keysize 4096 -validity 10000
```

Puis créez `android/keystore.properties` (ignoré par git, comme le `.jks`) :

```properties
storeFile=riftbound-release.jks
storePassword=…
keyAlias=riftbound
keyPassword=…
```

Ou utilisez les variables d’environnement `RB_KEYSTORE`, `RB_KEYSTORE_PASSWORD`, `RB_KEY_ALIAS`, `RB_KEY_PASSWORD`. `npm run android:apk -- --debug` force un APK de debug.

> Passer de l’APK de debug à l’APK release change la signature : Android refuse la mise à jour. Synchronisez (ou sauvegardez) la collection, désinstallez l’app du téléphone, puis installez le nouvel APK.

La version (`versionName`, `versionCode`) vient de `package.json`.

### Packs de contenu signés (auteur de l’appli)

Une seule fois : `npm run pack:keygen` crée la clé Ed25519 des packs.
- La **clé privée** va dans `%USERPROFILE%\.riftbound\pack-signing-key.pem`, **hors du dépôt** (jamais commitée, jamais donnée, jamais sur le Drive), **chiffrée** (AES-256) par une **phrase de passe** tapée deux fois dans le terminal : elle n’est jamais écrite sur le disque ni dans l’historique, et `npm run pack:sign` la redemande à chaque signature. Une clé créée avant (en clair) se protège avec `npm run pack:keygen -- --chiffrer` (même clé, mêmes packs acceptés).
- **Sauvegarde** : une copie de la clé chiffrée hors du PC (clé USB rangée, coffre du gestionnaire de mots de passe) et la phrase de passe dans le gestionnaire de mots de passe, comme pour la clé Android. Jamais sur le Drive partagé.
- Les **clés publiques** sont dans `electron/packPublicKey.json` (à commiter), sous forme de **liste** : l’appli accepte un pack signé par n’importe quelle clé de la liste qui n’est pas révoquée. Sans clé valide, tout pack est refusé.
- **Changer de clé (rotation)** : `npm run pack:keygen -- --out <autre fichier>` crée une nouvelle clé et ajoute sa clé publique à la liste ; publier une version de l’appli avec cette liste, puis signer les packs avec la nouvelle clé (`--key <fichier>`) ; dans une version suivante, `npm run pack:keygen -- --revoquer <empreinte>` marque l’ancienne révoquée.
- **Clé perdue** (ou phrase de passe oubliée) : plus aucun pack ne peut être signé avec elle ; créer une nouvelle clé comme pour une rotation et la publier dans une nouvelle version de l’appli (les amis peuvent toujours mettre leur contenu à jour eux-mêmes depuis Réglages → Contenu).
- **Clé volée** : créer une nouvelle clé, révoquer l’ancienne dans la même version de l’appli et prévenir les amis de mettre l’appli à jour ; d’ici là, ne pas importer de pack d’une source inconnue.

Pour donner un pack : Réglages → Contenu → « Exporter mon contenu » (`contenu-AAAA-MM-JJ.rbpack`), puis `npm run pack:sign -- contenu-AAAA-MM-JJ.rbpack` (vérifie aussi la signature avec la clé publique de l’appli), puis le déposer sur le Drive. À l’import, l’appli refuse un pack non signé ou signé par une autre clé, un fichier modifié, non listé ou au nom suspect (`..`), un pack fait pour un autre modèle de reconnaissance ou plus ancien que le contenu en place.

### Distribuer une version

`package.json` est la **seule source de la version** : À propos (avec la date de construction), l’APK (`versionCode` = 10000 × majeure + 100 × mineure + correctif) et l’installateur la lisent. Chaque distribution l’augmente, sinon Android refuse la mise à jour.

1. Écrire les nouveautés dans `docs/NOUVEAUTES.md` (section `## 2.2.0 — date`, pour les utilisateurs), commiter.
2. `npm run release -- 2.2.0` : arbre Git propre, version plus haute que toutes celles déjà distribuées (tags `v*`), clé de signature présente ; puis version dans `package.json`, tests, lint, installateur PC, APK signé (refusé s’il est signé avec la clé de debug ou débogable, jamais installé par adb), et vérification du paquet. Résultat dans `release/v2.2.0/` : installeur, APK, `NOUVEAUTES.txt`, `LISEZ-MOI-AMIS.txt` (`docs/LISEZ-MOI-AMIS.md`) et `EMPREINTES.txt` (SHA-256). La commande crée le commit « Version 2.2.0 » et le tag `v2.2.0` en local : `git push origin main v2.2.0`.
3. Copier le dossier entier dans le Drive partagé. Les versions de test n’y vont jamais.

`npm run release -- 2.2.0 --essai` fait tout dans `release/essai-v2.2.0/` sans commit, sans tag ni changement de version (pour essayer la chaîne, pas pour distribuer). `npm run release:check` revérifie les dossiers `release/v*/` : aucun `.jks`, `keystore.properties`, base `.sqlite`, `real-photos*`, `sauvegarde-modeles`, `model/runs`, `.pt`, `.env`, données de collecte du banc ni modèle d’essai, y compris à l’intérieur de l’APK et de l’appli PC (`release/win-unpacked`), et les empreintes.

L’appli PC installée n’ouvre pas les outils de développement (sauf l’appli de test) ; l’APK release n’est pas débogable, sa WebView n’est donc pas inspectable, et `allowBackup` est désactivé.

### Installateur Windows signé

L’installateur n’est pas signé : Windows SmartScreen affiche un avertissement (« Informations complémentaires → Exécuter quand même »). Avec un certificat de signature de code, electron-builder signe automatiquement si ces variables d’environnement sont définies au moment de `npm run desktop:exe` (jamais dans le dépôt) :

```bash
set CSC_LINK=C:\chemin\vers\certificat.pfx
set CSC_KEY_PASSWORD=…
```

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement Vite |
| `npm run build` | version web dans `dist/` (+ miniatures, ONNX Runtime) |
| `npm run desktop` | construit puis lance le logiciel PC |
| `npm run desktop:exe` | installateur Windows (NSIS) dans `release/` |
| `npm run build:mobile` | version web pour Android dans `dist-mobile/` |
| `npm run android:apk` | APK Android dans `release/`, installé par adb si un téléphone est branché |
| `npm run release -- <version>` | paquet de distribution dans `release/v<version>/` (`--essai` : sans rien enregistrer) |
| `npm run release:check` | vérifie qu’aucun paquet ne contient de clé, de données ou de version de test |
| `npm run thumbs` | miniatures des cartes (300 px) |
| `npm run icons` | icônes de l’application à partir de `public/icon.svg` |
| `npm run catalog:update` | nouvelle extension : scraper, noms, miniatures |
| `npm run catalog:enrich` | noms anglais complets et noms français du catalogue |
| `npm run lint` | vérification du code (ESLint) |
| `npm run eval:matcher` | banc d’essai de la reconnaissance (`--sample 300`, `--aug 3` ; rapport `model/eval-report.json`) |
| `npm test` | tests automatiques (decks, import CSV, prix, synchro et son chiffrement, sauvegardes, sécurité du serveur) |
| `npm run test:e2e` | tests d’écran : trois parcours dans l’appli construite (`dist/`, `--build` pour la construire avant), dans une fenêtre Electron de la taille d’un téléphone — scanner une photo et retrouver la carte, deck invalide, sauvegarder puis restaurer ; captures des échecs dans `test-results/e2e/` |

---

## Architecture du code

```text
src/
  main.jsx               choisit l’interface : PC (src/desktop) ou Android (src/App.jsx)
  App.jsx                interface Android
  desktop/               interface PC : DesktopApp, Sidebar, pages/ (Collection, Scan, Decks,
                         Valeur, Boîtes / Prêts / Échanges, Réglages)
  components/            écrans et composants Android, et composants partagés
                         (zoom d’une carte, scène animée, tuiles de cartes, dialogues…)
  hooks/                 logique partagée par les deux interfaces :
                         useAppController (toute la logique de l’app), useCollectionFilter,
                         useDeckEditor, useValueData, useCollection, useWishlist, useRecords…
  lib/                   cardMatcher (reconnaissance), photoScan, yoloDetector, deckRules,
                         prices / priceBuilder (Cardmarket), cardmarket (liens, souhaits),
                         collectionDB (IndexedDB), syncClient, uiPrefs, zoomGesture…
electron/                logiciel PC : fenêtre, base SQLite, serveur de synchro, prix, sauvegardes
android/                 projet Android (Capacitor)
scripts/                 build mobile, APK, icônes, miniatures, catalogue
model/                   scraper du catalogue, génération du dataset, entraînement YOLO
public/                  modèles ONNX, catalogue (card-hashes.json), images et miniatures des cartes
tests/                   tests Node (npm test)
```

---

## Données et stockage

Chaque donnée est un enregistrement JSON dans une collection, les mêmes sur les deux applis ; description complète (champs, liens, synchro, sauvegardes, fichiers) : **[docs/BASE-DE-DONNEES.md](docs/BASE-DE-DONNEES.md)**.

- **PC** : SQLite (`node:sqlite`), `%APPDATA%\riftmancer\collection.sqlite` : une table `records (collection, id, data JSON, updatedAt, deleted, seq, origin)` + `meta` ; serveur de synchronisation local (port 47321) ; 30 sauvegardes dans `backups\`.
- **Téléphone / navigateur** : IndexedDB `riftbound-collection` (version 7), un magasin par collection, marque `dirty` pour les changements pas encore envoyés.
- **Collections** (synchronisées et sauvegardées) : `copies` (une par carte physique), `wishlist`, `boxes`, `decks`, `people`, `loans`, `trades`, `matches`, `learned`. Chaque enregistrement a `id`, `createdAt`, `updatedAt` (le plus récent gagne) et `deleted` (rien n’est effacé).
- **Prix** : table des prix + historique (31 jours par carte), gardés sur l’appareil, utilisables hors ligne.
- **Catalogue** (hors de la base) : `public/card-hashes.json` (cartes, noms FR/EN, textes, empreintes couleur, signatures IA) ; images originales dans `public/cards/`, miniatures dans `public/cards/thumbs/` ; mises à jour installées depuis le PC dans `catalogue\`.

---

## Mettre à jour le catalogue des cartes

**Depuis l’appli PC, sans outils de développement** : Réglages → **Contenu**.
- *Cartes* → « Rechercher » : lit la liste des cartes de [rifthunt.com](https://rifthunt.com/api) (données de Riot, toutes les impressions ; la galerie officielle de Riot quand il ne répond pas), montre les nouvelles cartes et les cartes modifiées, puis, après « Installer », vérifie la parité des empreintes sur 50 cartes, télécharge les images, calcule empreintes couleurs, signatures IA et groupes de rééditions. Vérification hebdomadaire au démarrage (désactivable).
- *Traductions françaises* → « Mettre à jour » ou « Importer des fichiers… » (riftboundfr.fr).
- *Cartes bannies* → « Mettre à jour » (listes de rifthunt.com, reprises de Riot, chaque bannissement avec sa date et ceux déjà annoncés ; le règlement officiel des tournois, + une annonce, quand il ne répond pas) ou « Modifier à la main ».

- *Packs* → « Exporter mon contenu » / « Importer un pack… » : un seul ami fait la mise à jour, les autres importent son pack (même sans Internet). Un pack n’est accepté que **signé par l’auteur de l’appli** (voir ci-dessous).

Ces mises à jour sont des couches par-dessus le contenu livré (`userData/catalogue/`), que le téléphone reçoit à la synchro ; « Revenir au contenu d’origine » les retire. Pour l’appli livrée elle-même (nouvelle version), la chaîne de développement reste :

```bash
npm run catalog:update   # nouvelle extension : télécharge, met à jour noms et miniatures
```

Détails (scraper, empreintes, quand réentraîner le modèle) : voir l’[annexe technique](#annexe-technique).

---

## Limites connues

- **Compte Cardmarket** : pas de liaison directe (l’API Cardmarket est réservée aux vendeurs professionnels) ; les souhaits passent par copier-coller.
- **Images en français** : Riot ne publie pas d’images de cartes en français ; noms et textes français viennent des données du catalogue.
- Les prix ne distinguent pas les langues (prix tendance Cardmarket).
- **Installateur Windows non signé** (avertissement SmartScreen) ; **APK de debug** tant qu’aucune clé n’est configurée (voir « APK signé »), `npm run release` refuse alors de construire.
- La synchronisation passe en HTTP sur le réseau local, mais son contenu est chiffré de bout en bout ; les images et le catalogue (données publiques) circulent en clair, le catalogue étant vérifié par son empreinte.

---

## Mentions

Projet de fan gratuit et non commercial.

RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.

> RiftMancer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

Riftbound et League of Legends sont des marques de Riot Games, Inc.

**Licence** : RiftMancer est un logiciel libre sous **GNU AGPL-3.0** (ou ultérieure, [LICENSE](LICENSE)) : vous pouvez le copier, le modifier et le redistribuer, à condition de partager le code source sous la même licence. Le détecteur de cartes est entraîné avec Ultralytics YOLO11 (AGPL-3.0), d’où cette licence. Basé sur [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) de Nekoraru22 (licence MIT), largement modifié et étendu. Les parties issues de riftbound-scanner gardent leur avis MIT (dans [NOTICE](NOTICE)). La licence ne couvre que le code : les noms, cartes, images, textes et marques de Riot Games n'en font pas partie. Licences des modèles d'IA et du code repris : [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

<a id="annexe-technique"></a>

## Annexe technique

*(en anglais)*

### Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        cards_scraper.py                          │
├──────────────────────────────────────────────────────────────────┤
│  1. Fetch gallery HTML                                           │
│  2. Extract card data from __NEXT_DATA__                         │
│  3. Normalize and save to SQLite                                 │
│  4. Download + optimize + rotate images (parallel WebP)          │
│  5. Adaptive crop (per card type) → eq. → 16×16 color grid  ───┐ │
└──────────────────────────────┬─────────────────────────────────│─┘
                               │                                 │
                               ▼                                 ▼
┌────────────────────────────────────────┐  ┌────────────────────────┐
│           data_creator.py              │  │    card-hashes.json    │
├────────────────────────────────────────┤  └───────────┬────────────┘
│  1. Load card images from SQLite       │              │
│  2. Generate synthetic backgrounds     │              ▼
│  3. Place cards with random transforms │  ┌────────────────────────┐
│  4. Apply augmentation pipeline        │  │  Frontend Card Matcher │
│  5. Export YOLO pose dataset           │  │  (color grid cosine,   │
│                                        │  │   then DINOv2 if unsure│
└──────────────────┬─────────────────────┘  └────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│              train.py                  │
├────────────────────────────────────────┤
│  1. Check the local CUDA GPU           │
│  2. Train YOLO11s-pose (416, multi-    │
│     scale)                             │
│  3. Export to ONNX (model/runs/…)      │
│  4. Bench, then ship by hand to        │
│     public/models/                     │
└────────────────────────────────────────┘
```

### How Detection Works

The scanner uses a **dual-layer approach** to scan cards in real time:

| Layer | Model | Question it answers | Details |
|-------|-------|---------------------|---------|
| **Detection** | YOLO11s-pose, one float32 model with a variable input size (`public/models/yolo11s-pose-riftbound-dyn.onnx`), run at **320 px** in camera mode and **416 px** in photo mode (`MODE_SIZES`, `yoloDetector.js`) | *Where* is there a card? | Locates cards in the camera frame and regresses the 4 card corners as keypoints (handles any rotation). Single class (`card`), trained on synthetic data. Out-of-focus crops are filtered out via Laplacian variance so background cards don't get matched. |
| **Identification** | Color grid fingerprint, then AI when the colors hesitate | *Which* card is it? | Crops the detected region to the artwork area (adaptive per card layout), computes a 16×16 color grid with histogram equalization, and finds the best match via cosine similarity. When the colors are not sure, a fine-tuned **DINOv2-small** (`public/models/dinov2s-ft-fp16.onnx`, 168×168 input) scores the 100 best color candidates and a combined score decides (cascade: see `docs/RAPPORT-MODELES-IA.md`). Only one scan mode remains (« Prudent »): a doubtful card is never added without asking. Tests normal, 90°-rotated and horizontally-flipped orientations to handle landscape battlefields and mirrored photos. The user can drag the 4 corner keypoints on screen to manually fine-tune the crop — a perspective warp re-runs the matcher with the corrected quad. |

YOLO alone doesn't know which card it's looking at — it only finds rectangular card-shaped objects. The color grid matcher, helped by the AI model when needed, then takes each crop and identifies the specific card. Réglages → Scanner can switch to colors only (« Couleurs seules »).

### Card Identification Pipeline

#### Artwork Crop (adaptive per card layout)

Before any feature extraction, the card image is cropped to isolate the illustration. Different card types have different art layouts, so the crop bounds are picked per card from a small table — same bounds are used at scrape time (to compute the DB feature) and at match time (to compute the query feature), so cosine similarity stays apples-to-apples.

| Card type                                  | Bottom edge | Why                                                                                                                            |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `unit / spell / gear / rune`               | **0.55**    | Standard layout: art occupies the top half, text/stats below.                                                                  |
| `legend`                                   | **0.85**    | Legends have a smaller text box; the illustration extends further down.                                                        |
| `battlefield` + `*a*` / `*-star-*` variants | **0.95**    | Full-art cards (alt-arts, star variants) and battlefields (landscape art rotated to portrait) — almost the whole card is illustration. |

The horizontal bounds are fixed at 5%–95% across all types to trim the outer black border. Each card stores its `artBottom` in `card-hashes.json`; the matcher reads it and picks the matching query crop per candidate.

```text
Standard card (0.55)            Legend (0.85)             Full-art / battlefield (0.95)
┌──────────────────┐           ┌──────────────────┐      ┌──────────────────┐
│    Card Name     │           │    Card Name     │      │                  │
├──────────────────┤           │                  │      │                  │
│                  │           │                  │      │                  │
│   Illustration   │  ─55%─►   │   Illustration   │      │   Illustration   │
│                  │           │                  │      │   (full bleed)   │
├──────────────────┤           │                  │ ─85%►│                  │
│   Card Text      │           ├──────────────────┤      │                  │
│   Stats / Energy │           │   Card Text      │      │                  │ ─95%►
└──────────────────┘           └──────────────────┘      └──────────────────┘
```

#### Color Grid Matching

Each card's artwork is converted into a compact numerical fingerprint:

```text
Artwork Crop              Histogram Eq.           16×16 Color Grid         Feature Vector
┌────────────────┐       ┌────────────────┐      ┌─┬─┬─┬─┬─┬─┬─┬─┐
│                │       │                │      │ │ │ │ │ │ │ │ │    [0.12, 0.34, 0.56,  ← R,G,B cell 1
│  Illustration  │ ────► │  Normalized    │ ───► ├─┼─┼─┼─┼─┼─┼─┼─┤     0.23, 0.45, 0.67,  ← R,G,B cell 2
│                │  eq.  │  Brightness    │      ├─┼─┼─┼─┼─┼─┼─┼─┤     ...
│                │       │                │      │ │ │ │ │ │ │ │ │     0.89, 0.12, 0.34]  ← R,G,B cell 256
└────────────────┘       └────────────────┘      └─┴─┴─┴─┴─┴─┴─┴─┘
                                                  256 cells             768 values (256 × 3 RGB)
```

1. **Histogram equalization**: Per-channel brightness normalization so dark photos match well-lit references
2. **Resize**: Equalized artwork is resized to 16×16 pixels
3. **Color extraction**: Each pixel's RGB values are normalized to 0-1 range
4. **Cosine similarity**: Query vector is compared against all stored card vectors
5. **Best match wins**: The card with the highest similarity is selected

#### Full-Resolution Cropping

When uploading a multi-card image, the app resizes it to 2048px for YOLO detection (which processes at 416×416 internally), but crops each detected card from the **original full-resolution image**. This ensures each card has maximum pixel detail for the color grid, even when many cards share a single photo.

#### Manual 4-Corner Correction

When YOLO's corner keypoints are off (slight angle error, clipped corner, perspective distortion from photographing at an angle), the user can drag the 4 corner handles on a selected detection to fit the card precisely. The handles appear on whichever detection is selected; dragging any of them deforms the quadrilateral freely — there's no rectangle constraint, so it captures real perspective.

On pointer-up, the app:

1. Geometrically sorts the 4 dragged points into visual TL → TR → BR → BL order (so the warp is robust to whichever corner the user moved past which other corner).
2. Solves an 8×8 linear system for the perspective matrix that maps the destination rectangle to the source quadrilateral.
3. Runs a bilinear-interpolated **perspective warp** over the original full-resolution image — un-distorting the card to an axis-aligned crop. If the user-drawn quad is wider than tall, the warp also rotates 90° to keep the matcher seeing a portrait layout (so `artBottom` still works).
4. Re-runs `identifyCard` on the new crop and updates the side panel with the new top-1 match.

The implementation lives in [src/lib/perspectiveCrop.js](src/lib/perspectiveCrop.js); UI/interaction in [src/components/identify/DetectionCanvas.jsx](src/components/identify/DetectionCanvas.jsx).

#### Sharpness Filter

After YOLO produces oriented bounding boxes, each crop's **Laplacian variance** is measured at 64×64 grayscale. Crops below a configurable threshold (default 100) are dropped before identification — this stops the matcher from confidently labeling out-of-focus cards in the background of a photo as random matches. Sharpness can be tuned via `detector.sharpnessThreshold` from the dev console.

#### Orientation Handling

Cards can be scanned in any rotation, mirrored (selfie cam, scan through glass), or laid out as landscape battlefields. The matcher tests up to three orientations per detection and keeps the best:

```text
┌─────────┐      ┌───────────────┐      ┌─────────┐
│         │      │               │      │         │
│  Card   │      │     Card      │      │  draC   │  (mirrored)
│         │      │               │      │         │
└─────────┘      └───────────────┘      └─────────┘
   Normal       Landscape (rot 90°)     Horizontal flip

Best similarity across the three is used
```

### Synthetic Dataset Generation

`data_creator.py` generates a synthetic YOLO pose training dataset by compositing card images onto randomized backgrounds with heavy augmentation. Each card is labeled with its 4 corners as keypoints. The goal is to train a model that detects cards in real-world camera frames and locates their corners precisely.

```bash
cd model
python data_creator.py
```

Generation is parallelized across all CPU cores using `ProcessPoolExecutor`.

#### Augmentation Pipeline

Each training image goes through the following pipeline:

```text
Background Generation          Card Placement              Global Augmentations
┌───────────────────┐        ┌──────────────────┐        ┌────────────────────┐
│ - Solid color     │        │ - Random scale   │        │ - Brightness       │
│ - Gradient        │  ───►  │ - Random rotation│  ───►  │ - Contrast         │
│ - Perlin noise    │        │ - Perspective    │        │ - Saturation       │
│ - Blurred noise   │        │ - Shadow casting │        │ - Hue shift        │
│ - Two-tone split  │        │ - Overlap avoid  │        │ - Color jitter     │
│ - Real texture    │        │ - Sleeve overlay │        │ - Gaussian noise   │
│ + Lighting grad.  │        │ - 1-5 cards      │        │ - Motion blur      │
│ + Distractors     │        │                  │        │ - JPEG artifacts   │
└───────────────────┘        └──────────────────┘        │ - Vignette         │
                                                         │ - Cutout           │
                                                         └────────────────────┘
```

The generator picks one of four scene modes per image:

- **Standard scene** (~60%): 1–5 cards placed with random transforms and overlap avoidance.
- **Grid layout** (~25%, `GRID_PROB`): cards arranged in a 2×2 up to 5×6 grid with light jitter — simulates organized collection scans, including the dense tiny-card case YOLO previously failed at.
- **Close-up** (~15%, `CLOSEUP_PROB`): a single card scaled 0.85×–1.30× of the frame, optionally clipped by the image edges — teaches the model to keep detecting cards that fill or overflow the camera view.
- **Mosaic** (~25% of train images, `MOSAIC_PROB`): YOLOv4-style 4-quadrant composition with independent sub-scenes.

**Sleeve simulation** (`SLEEVE_PROB = 0.30`): before placement, ~30% of cards get a sleeve overlay — colored border, diagonal glare streak, and 0–3 specular highlights — so the detector learns the look of cards through plastic sleeves with reflections.

#### Optional Assets

Place these in the `model/` directory before running the generator:

| Directory | Contents | Effect |
| --- | --- | --- |
| `textures/` | JPG/PNG photos of real surfaces (desks, mats, tables) | Used as backgrounds 40% of the time |
| `distractors/` | PNG objects with alpha (dice, tokens, sleeves) | Placed randomly to teach the model to ignore non-card objects |

#### Configuration

Key settings at the top of `data_creator.py`:

| Setting               | Default     | Description                                                                  |
| --------------------- | ----------- | ---------------------------------------------------------------------------- |
| `IMAGES_PER_CARD`     | 150         | Synthetic images generated per card                                          |
| `OUTPUT_SIZE`         | 768         | Image dimensions (768×768); training draws its input size from them (`imgsz=416`, multi-scale) |
| `MAX_CARDS_PER_IMAGE` | 5           | Maximum cards per standard scene                                             |
| `TRAIN_RATIO`         | 0.85        | Train/val split ratio                                                        |
| `CARD_SCALE_MIN/MAX`  | 0.10 / 0.95 | Card size range relative to image — high max lets cards fill the frame      |
| `ROTATION_RANGE`      | -75 to 75   | Rotation angle range in degrees                                              |
| `MOSAIC_PROB`         | 0.25        | Probability of YOLOv4-style 4-quadrant mosaic                                |
| `GRID_PROB`           | 0.25        | Probability of a grid layout (up to 5×6)                                     |
| `CLOSEUP_PROB`        | 0.15        | Probability of a single oversized card (possibly clipped by edges)           |
| `SLEEVE_PROB`         | 0.30        | Probability of applying sleeve overlay per card                              |

#### Generated Dataset Structure

```
model/dataset/
├── data.yaml
├── train/
│   ├── images/
│   │   └── synth_000000.jpg, synth_000005.jpg, ...
│   └── labels/
│       └── synth_000000.txt, synth_000005.txt, ...
└── val/
    ├── images/
    └── labels/
```

| File/Folder | Description |
| --- | --- |
| `data.yaml` | YOLO config file. Points to train/val paths, defines class count (`nc: 1`), class names (`['card']`) and keypoint shape (`kpt_shape: [4, 2]`). Rewritten by `train.py` with remote paths during cloud training. |
| `train/` | 85% of the dataset. Used by YOLO to learn during training. |
| `val/` | 15% of the dataset. Used by YOLO during training to measure progress and pick the best checkpoint. |
| `images/` | Synthetic 768×768 JPG images generated by `data_creator.py`. Each contains 1–30 cards (single card up to a 5×6 grid) on randomized backgrounds. |
| `labels/` | One `.txt` per image (same name). Each line is one card detection in YOLO pose format. |

#### Label Format (YOLO pose)

Labels are generated automatically by `data_creator.py` alongside each image. Since the cards are placed synthetically, the script knows the exact position, rotation, and scale of every card it composites — so it writes the corresponding label file with the precise corner coordinates. No manual annotation is needed.

Each line in a label file describes one card with an axis-aligned bounding box plus its 4 corner keypoints:

```
class cx cy w h x1 y1 x2 y2 x3 y3 x4 y4
```

Example: `0 0.612 0.418 0.647 0.583 0.288 0.399 0.508 0.138 0.935 0.434 0.705 0.721`

| Field | Meaning |
| --- | --- |
| `0` | Class ID (always `0` = card, since there's only one class) |
| `cx cy w h` | Center, width and height of the axis-aligned bounding box enclosing the 4 corners, normalized to 0-1. |
| `x1 y1` ... `x4 y4` | The 4 card corners as keypoints, normalized to 0-1, in TL → TR → BR → BL order relative to the card art. `kpt_shape: [4, 2]` means each keypoint carries only `(x, y)` — no visibility flag, since card corners are always considered visible. |

### Training (local GPU)

`model/train.py` trains on a local NVIDIA graphics card (it refuses to start without CUDA). Setup and commands are in its header:

```bash
python model/data_creator.py                       # dataset → model/dataset/ (once)
model/.venv-train/Scripts/python model/train.py    # train + export
model/.venv-train/Scripts/python model/train.py --resume
model/.venv-train/Scripts/python model/train.py --export-only
```

Same hyper-parameters as the former cloud training (Modal, A100, `imgsz=768`), except **`imgsz=416` with multi-scale training** (input drawn in 208–650 px at each batch), so that one model works well from 320 to 768 px and the phone can run the detector on small images.

| Setting | Value |
|---------|-------|
| `imgsz` | 416, `multi_scale=0.5` (the dataset images stay 768×768, `OUTPUT_SIZE` in data_creator) |
| `task` / `kpt_shape` | `pose` / `[4, 2]` (4 corner keypoints, x/y only) |
| `epochs` | 80 with `patience=40`, `cos_lr=True` |
| `close_mosaic` | 15 |
| `pose` / `box` / `cls` | 25.0 / 7.5 / 0.3 (keypoint loss weighted high for tight corner localization) |
| `hsv_v` / `mixup` / `degrees` | 0.6 / 0.2 / 3.0 |
| `fliplr` / `flipud` | 0.0 / 0.0 (no flips — see dataset notes above) |

The export goes to `model/runs/train/weights/export/`; `public/models/` is never touched by the script: a model is shipped only after it has been measured on the bench (`scripts/eval-detector.mjs`) and chosen. Trial models are kept outside Git LFS (only shipped models go there).

### Models shipped

| File | Role | Format |
|------|------|--------|
| `public/models/yolo11s-pose-riftbound-dyn.onnx` | card detector (4 corners) | float32, variable input size (320 / 416 px) |
| `public/models/dinov2s-ft-fp16.onnx` | AI recognition (illustration embedding) | DINOv2-small fine-tuned, float16, 168×168 |

Both ship with the app (PC and Android) and are checked by their SHA-256 (`scanRules.js`). The former choice « Normal (float32) / Rapide (int8) » no longer exists: one detector model for everyone (preferences v4 removed the old keys and the models once downloaded from the PC).

### Updating the Card Database

When a new RiftBound set drops or new promos are added to the official gallery, you only need to refresh the local card data — **you do not need to retrain YOLO** to recognize new cards. The detector finds "cards" generically (single class); the matcher is what identifies a specific card, and it only needs `card-hashes.json` updated.

#### Quick update — most common case

Run the full scraper once. It re-fetches the gallery, downloads any new card images, and regenerates `card-hashes.json` from scratch:

```bash
cd model
python cards_scraper.py
```

That's it. After the run finishes, hard-refresh the web app (`Ctrl+Shift+R`) and the new cards will be matchable immediately.

What the scraper does, in order:

1. Fetches `https://playriftbound.com/en-us/card-gallery/` and parses `__NEXT_DATA__`.
2. Inserts new rows into `model/riftbound.db` (`INSERT OR REPLACE`, so existing rows are updated).
3. **Wipes and recreates** `public/cards/` with all current cards as WebP. Landscape battlefields are rotated to portrait at this step.
4. Regenerates `public/card-hashes.json` with adaptive crop per card type.

#### Just regenerate hashes (no re-download)

If you only changed feature-extraction code (`_compute_color_grid`, `_equalize_histogram`, `ART_REGIONS`, `GRID_SIZE`, etc.) and the card images on disk are already up to date:

```bash
cd model
python cards_scraper.py --only-hashes
```

This skips the network fetch and the image download/optimization pass and reuses the existing `public/cards/*.webp`. About 30 seconds for ~950 cards.
Use `npm run build` to rebuild the web app with the new hashes.

#### Card thumbnails

`npm run build` also creates small previews (`public/cards/thumbs/`, 300 px wide) used by the collection list. The original images in `public/cards/` are never modified and are still used for detail views. Run `npm run thumbs` to (re)generate them manually (`npm run thumbs -- --force` to rebuild all).

#### Offline runtime

The ONNX runtime is bundled with the app (no CDN): `npm run dev` / `npm run build` copy its WASM files to `public/ort/`. The models must be in `public/models/` (`yolo11s-pose-riftbound-dyn.onnx` and `dinov2s-ft-fp16.onnx`, see « Models shipped »).

#### PC app and Android app (local sync)

The collection is local-first: the phone works on its own data and syncs with the PC app when the user taps « Synchroniser maintenant » (manual by design), both on the same Wi-Fi. Nothing is hosted online. Synced collections: `copies`, `wishlist`, `boxes`, `decks`, `people` (with the friends' lists), `loans`, `trades`, `matches`, `learned`.

- **PC app (Electron)** — `npm run desktop` (builds the web app, then opens it). The PC keeps the collection in SQLite (`%APPDATA%/riftbound-scanner/collection.sqlite`), runs a local sync server on port **47321** and makes automatic backups (`backups/`, last 30). Windows asks once to allow the app on the network: allow **private networks**.
- **Android app (Capacitor)** — `npm run build:mobile` builds `dist-mobile/` (thumbnails and the two models, without the full-size images: APK ≈121 MB) and syncs it into `android/`; `npm run android:apk` also builds the APK (release when `android/keystore.properties` exists, otherwise debug; needs the Android SDK; set `ANDROID_HOME` if Gradle can't find it). Full-size images and newer sets are downloaded from the PC during sync.
- **Pairing** — PC app: Réglages → QR code. Phone: Réglages → « Scanner le QR code du PC ». The QR contains the PC address, port and a secret; if the PC's IP changes, the phone finds it with mDNS (`_riftbound._tcp`, `electron/mdns.cjs` + the app's `DiscoveryPlugin.java`), or with a manual, throttled /24 scan.
- **Sync protocol v3** (`electron/syncCrypto.cjs`, `src/lib/syncProtocol.js`) — secrets never travel in clear; HKDF-SHA256 derives an AES-256-GCM key and an HMAC key from each. The QR code secret only signs `/api/pair`, accepted for 5 min while the QR code is shown; the PC answers with a per-phone key (and its PC secret). Every other request carries `X-RB-Device` and is signed with that phone's key: `X-RB-Time`, `X-RB-Nonce`, `X-RB-Sig` (HMAC of method, path, time, nonce, body hash; ±5 min, nonces remembered 10 min); bodies are encrypted and bound to the request nonce. Unpairing deletes the phone's key. `/api/hello` is public and only returns `{ app, proto, pcIdHash }` — a fingerprint that changes every UTC day (phones accept yesterday / today / tomorrow). Catalog and banlist integrity: full SHA-256. CORS is limited to the app WebView origin; 20 failed authentications per minute and IP → 429.
- **Sync logic** — the phone pushes its unsynced records and pulls what changed on the PC since its last sync (sequence number). Conflicts: most recent `updatedAt` wins; deletions are tombstones.

#### Cardmarket prices

The PC app downloads Cardmarket's public Riftbound files (`productCatalog/productList/products_singles_22.json` and `priceGuide/price_guide_22.json`) at most once a day and links products to cards (`electron/prices.cjs`): by each printing's Cardmarket id from [rifthunt](https://rifthunt.com/api) first, by name for the rest (full English names from rifthunt, or the Riftcodex API when rifthunt does not answer; cached a week). Trend price in EUR, foil price for foil copies. Stored in `%APPDATA%/riftbound-scanner/prices.json`, a daily collection value snapshot in SQLite (`valueHistory`), and sent to the phone at sync (`GET /api/prices`).

#### Collection storage

The collection is stored in IndexedDB (`riftbound-collection`), one record per physical copy (card id, language, finish, condition…), with `updatedAt` and a `deleted` tombstone for the phone ↔ PC sync. On the PC app the same records live in SQLite (see above).

#### French card names and texts

Riot's `fr-fr` gallery only translates UI labels, so French names and rules texts come from the two static files published by [riftboundfr.fr](https://riftboundfr.fr/cartes) (thanks to them). The site is behind a bot checkpoint, so download them **from your browser** into `model/fr/` (these two files are currently committed in the private repository — see CHANGELOG « Hygiène du dépôt » before making it public):

- `https://riftboundfr.fr/repertoire-cartes.json` → `model/fr/repertoire-cartes.json`
- `https://riftboundfr.fr/textes-cartes.json` → `model/fr/textes-cartes.json`

Then regenerate the hashes (`python cards_scraper.py --only-hashes`). Each card in `card-hashes.json` gains `nameFr` / `textFr` (joined on the card id; `ogn-299*-298` star slugs are mapped to `ogn-299-star-298`). Without the files the scraper simply skips French data. Not every card has a French text (runes, some recent cards): the app falls back to English.

In the app, pick **EN / FR** at the top of the Scan tab before scanning — new cards get that language (it is the same setting as *Settings → Language*). Each card can still be switched individually in its detail panel or in the collection. French and English copies of the same card are kept as separate stacks, the collection can be filtered by language, and the CardNexus export writes the copy's language in its `Language` column.

#### When you actually do need to retrain YOLO

You only need to re-run training if you change something that affects detection (not identification). New cards alone do not require a retrain — they're just more rows in the matcher's lookup table.

| Change | Do you need to retrain YOLO? |
|--------|------|
| New cards added (new set / promos) | **No** — just `python cards_scraper.py` |
| New artwork style with very different shape/colors | Usually no, unless the model misses detecting them |
| Change `OUTPUT_SIZE`, `imgsz`, or model arch | Yes — `modal run --detach train.py` |
| New augmentation (sleeves, grids, close-ups, etc.) | Yes — regenerate dataset + train |

Retrain workflow when needed:

```bash
cd model
python data_creator.py            # Regenerate synthetic dataset locally (CPU)
modal run --detach train.py       # Upload + train on Modal A100, ~1–2 h
# When training finishes:
modal run train.py --export-only  # Download exported ONNX to public/models/
```
