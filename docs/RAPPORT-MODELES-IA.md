# Rapport — Reconnaissance des cartes par modèles d'IA

*English version: [AI-MODELS-REPORT.md](AI-MODELS-REPORT.md).*

*Riftbound Scanner — travaux du 2026-11-11 (étapes 1, 2, 2.5, 4 et 4.6 de `AMELIORATIONS-MODELES.md`).*
*Rédigé pour être relu par un autre assistant ou un développeur : ce qui a été fait, comment c'est mesuré, ce qu'on en tire, ce qui reste discutable.*

---

## 1. Résumé

- **Problème de départ.** L'identification d'une carte, une fois détectée par YOLO, reposait sur une empreinte couleurs : une grille 16×16 RGB de l'illustration après égalisation d'histogramme. Sur photos simulées, cette méthode acceptait 70 % des cartes sans rien demander ; pour les 30 % restants, il fallait demander « quelle carte ? » à l'utilisateur.
- **Solution retenue.** Un modèle d'image pré-entraîné (**DINOv2-small, quantifié int8, 24 Mo, Apache 2.0**) est combiné à l'empreinte couleurs, **en cascade** :
  - les couleurs décident seules quand elles sont sûres ;
  - sinon, le modèle calcule une seule image de 168×168 px, et un score combiné (50 % IA, 50 % couleurs) départage les 100 meilleures candidates selon les couleurs.
- **Résultat (photos réelles, 65 photos) :** les cartes acceptées justes passent de **69,2 % à 84,6 %**, avec **0 carte fausse** et 0 carte hors catalogue acceptée. Sur 600 photos simulées : 70,3 % → 77,3 %, avec 0,2 % de fausses.
- **Vitesse mesurée par l'utilisateur :**
  - **PC (4 cœurs)** : identification 271 → **44 ms** ; modèle IA 260 → **69 ms** quand il sert. Objectif (< 50 ms) atteint.
  - **Téléphone Android (1 seul cœur)** : identification 490 → **84 ms** ; modèle IA 1 984 → **388 ms** quand il sert. **La détection YOLO reste à environ 2,1 s** et représente 95 % du temps d'un scan.
- **Blocage identifié.** La WebView Android de l'utilisateur ne fournit pas `SharedArrayBuffer` : « mémoire partagée : non », « page isolée : non », même avec les en-têtes COOP/COEP. ONNX Runtime Web est donc limité à 1 cœur sur le téléphone.
- **Préconisation (acceptée par l'utilisateur) :** exécuter les modèles (YOLO, puis DINOv2) **en natif Android**, avec ONNX Runtime Android via un plugin Capacitor : multi-cœurs, XNNPACK, NNAPI éventuel. Gain attendu : YOLO à environ 150-300 ms, IA à environ 50-80 ms.

---

## 2. Contexte technique

| Élément | Avant | Après |
|---|---|---|
| Détection | YOLO11s-pose ONNX (4 coins), `src/lib/yoloDetector.js` — inchangé | idem |
| Redressement | `src/lib/perspectiveCrop.js` | + `warpQuadRGBA` (version sans DOM, utilisable en Node) |
| Identification | `fingerprint.js` (grille 16×16×3) + `matchIndex.js` (centrage, marge) | + `aiRecognizer.js` (DINOv2) + cascade dans `cardMatcher.js` |
| Catalogue | `public/card-hashes.json` (1 408 cartes) | + champ `e` par carte (vecteur IA int8) + en-tête `embeddings` |
| Exécution des modèles | onnxruntime-web 1.31 (WASM ; WebGPU sur PC pour YOLO) | idem ; DINOv2 en WASM int8 |
| Plateformes | PC (Electron, serveur local avec COOP/COEP) et Android (Capacitor) | idem |

**Règle de décision (`matchIndex.decide`).** Un score centré est calculé pour chaque carte : vecteur moins la moyenne du catalogue, puis normalisation et produit scalaire. La meilleure carte est acceptée si `score ≥ abs` **et** si son avance sur la meilleure carte d'une **autre illustration** atteint `marge` (les rééditions à l'illustration identique partagent un `artGroup` et ne se concurrencent pas). Il y a deux jeux de seuils :
- « Prudent » (défaut) ;
- « Rapide », réglable par l'utilisateur.

---

## 3. Banc d'essai — méthodologie

### 3.1 Outils

| Commande | Rôle |
|---|---|
| `npm run eval:matcher -- --compare a@art,b@full,… [--fusion α,…] [--cascade K,…] [--single] --sample 300 --aug 2 --seed 11` | Compare des moteurs (`scripts/lib/engineBench.mjs`) |
| `npm run photos:prepare` | Photos réelles `model/real-photos-raw/<code>/` → même chaîne que l'appli (YOLO + redressement) → `model/real-photos/<id>/*.png` |
| `node scripts/build-embeddings.mjs` | Signatures IA du catalogue (lancé aussi par `npm run catalog:update`) |
| `model/export_embedders.py` (venv `model/.venv-embed`) | Export ONNX depuis les poids safetensors (MobileNetV4, SigLIP 2) |

### 3.2 Photos

- **Simulées : 600**, soit 300 cartes tirées au hasard (graine 11) × 2 tirages. Chaque photo subit une rotation, une légère perspective, un recadrage décalé, une variation de lumière et de balance des blancs, du flou, un reflet de protège-carte, une compression JPEG et du bruit (`scripts/lib/simulate.mjs`). Taille finale 480×670 (celle du recadrage dans l'appli).
- **Réelles : 65**, prises au téléphone par l'utilisateur (31 puis 61 cartes différentes) et passées par la chaîne de l'appli. Correspondances manuelles :
  - les runes UNL-R02 et UNL-R05 sont absentes du catalogue mais ont la même illustration que VEN-R02 / VEN-R05 : elles sont comptées comme telles ;
  - « PAD-098 » est en réalité RAD-098 ;
  - le jeton SFD-T02 (absent du catalogue) est exclu.
- **Les deux jeux ne sont jamais mélangés dans un même pourcentage.**

### 3.3 Mesures (pour chaque configuration)

- **top-1 / top-5** : la bonne illustration est 1re, ou parmi les 5 premières.
- **acceptée juste / acceptée fausse / rejetée** (rejetée = l'appli demande).
- **hors catalogue acceptée** : on retire du catalogue toutes les cartes de la même illustration (*leave-one-out*), puis on regarde si l'appli accepte quand même une autre carte. Ce cas simule une nouvelle extension, une promo ou un jeton.
- **confusions de rééditions** : même nom, illustration différente.
- **ms/carte** (Node, CPU) et taille du modèle.

### 3.4 Calibrage

Pour chaque configuration, les seuils `abs` (−0,2 à 0,98) et `marge` (0 à 0,6) sont balayés **sur les photos simulées**. On garde le couple qui maximise les acceptées justes sous ces contraintes :
- **Prudent** : ≤ 1 % de cartes hors catalogue acceptées **et** ≤ 0,5 % de fausses ;
- **Rapide** : ≤ 10 % hors catalogue et ≤ 2 % de fausses.

Les photos réelles sont évaluées avec ces seuils, **sans recalibrage**.

### 3.5 Fusion et cascade

- **Fusion** : `score = α·IA + (1 − α)·couleurs`, pour chaque carte.
- **Cascade (`--cascade K`)** : les couleurs d'abord, avec les seuils Prudent des couleurs. Si elles acceptent, c'est fini. Sinon :
  - l'IA est calculée dans l'orientation qui convient le mieux à la 1re carte des couleurs (normale ou 180°) ;
  - elle utilise les cadrages présents parmi les K meilleures cartes des couleurs (`--single` : seulement celui de la 1re carte) ;
  - la fusion n'est appliquée qu'à ces K cartes.

---

## 4. Modèles évalués (étape 2)

Seuls des modèles sous licence Apache 2.0 ont été retenus. Les révisions et SHA-256 sont dans `model/MODELS.md` et les licences dans `THIRD_PARTY_LICENSES.md`. Les poids ont été chargés uniquement depuis des fichiers safetensors.

| Modèle | Source | Taille fp32 / int8 | Remarques |
|---|---|---|---|
| DINOv2-small | onnx-community/dinov2-small | 88,5 / 24,4 Mo (fp16 44 Mo) | ONNX officiel |
| DINOv2-small + registres | onnx-community/dinov2-with-registers-small | 88,5 / 24,4 Mo | |
| MobileNetV4-Conv-Small | timm, export maison | 9,9 / 2,6 Mo | **int8 inutilisable** : cosinus 0,14 avec le fp32 en quantification dynamique |
| SigLIP 2 Base/16 | timm, export maison | 372 / 94 Mo | int8 : cosinus 0,92, résultats médiocres |

Prétraitement : l'image entière est redimensionnée, **sans recadrage central** (pour ne couper ni le nom, ni les coûts, ni la Might), puis normalisée avec la moyenne et l'écart-type du modèle. Le vecteur est le jeton CLS, la moyenne des patchs ou la sortie poolée. Deux régions sont testées : `art` (l'illustration, découpée comme l'empreinte) et `full` (la carte entière).

### 4.1 Photos simulées (600) — seuils Prudent calibrés par configuration

| Configuration | top-1 | Acceptée juste | Fausse | Hors cat. | Taille |
|---|---|---|---|---|---|
| **grid16 (couleurs, référence)** | 84,3 % | **70,3 %** | 0,2 % | 0,7 % | 0 |
| dinov2s CLS @art / @full | 77,0 / 73,3 % | 59,0 / 57,2 % | 0 / 0,2 % | ≤ 1 % | 88,5 Mo |
| dinov2s-mean @art | 82,0 % | 65,2 % | 0 % | 0,8 % | 88,5 Mo |
| dinov2s-int8-mean @art | 79,7 % | 63,7 % | 0 % | 1,0 % | 24,4 Mo |
| dinov2s-reg-mean @full | 69,2 % | 51,2 % | 0 % | 0,8 % | 88,5 Mo |
| mnv4s @art | 60,3 % | 51,2 % | 0 % | 1,0 % | 9,9 Mo |
| siglip2b @full | 92,2 % | 44,5 % | 0,3 % | 1,0 % | 372 Mo |
| dinov2s-mean@art + grid16 α 0,5 | 93,2 % | 81,2 % | 0 % | 0,8 % | 88,5 Mo |
| **dinov2s-int8-mean@art + grid16 α 0,5** | 91,0 % | **78,8 %** | 0 % | 0,8 % | **24,4 Mo** |
| mnv4s@art + grid16 α 0,3 | 86,7 % | 74,3 % | 0 % | 1,0 % | 9,9 Mo |
| siglip2b@full + grid16 α 0,3 | 94,5 % | 85,7 % | 0 % | 0,8 % | 372 Mo |

**Constat :** aucun modèle seul ne bat l'empreinte couleurs. Combinés avec elle, ils la dépassent nettement : les deux méthodes se trompent sur des photos différentes.

### 4.2 Photos réelles (65)

| Configuration | top-1 | Acceptée juste | Fausse | Hors cat. |
|---|---|---|---|---|
| grid16 | 87,7 % | 69,2 % | 0 % | 0 % |
| dinov2s-int8-mean @art | 95,4 % | 67,7 % | 0 % | 0 % |
| mnv4s @art | 64,6 % | 30,8 % | 0 % | 0 % |
| dinov2s-int8-mean@art + grid16 α 0,5 | 98,5 % | 90,8 % | 0 % | 0 % |
| dinov2s-int8-mean@art + grid16 α 0,7 | 100 % | 93,8 % | 0 % | 0 % |
| mnv4s@art + grid16 α 0,3 | 92,3 % | 81,5 % | 0 % | 0 % |
| siglip2b@full + grid16 α 0,3 | 98,5 % | 92,3 % | 0 % | 0 % |

**À noter :** sur 32 photos seulement, MobileNetV4 + couleurs égalait DINOv2 (93,8 %). Il a reculé à 81,5 % à 65 photos. Avec si peu de vraies photos, une photo vaut 1,5 point.

### 4.3 Choix de l'étape 2.5

Le choix s'est porté sur **DINOv2-small int8, moyenne des patchs, région illustration, combiné aux couleurs avec α = 0,5**. C'est le seul candidat qui respecte toutes les contraintes :
- ≤ 25 Mo ajoutés à l'APK ;
- ≤ 1 % de cartes hors catalogue et ≤ 0,5 % de fausses ;
- plus de 10 points de gain (+8,5 points sur photos simulées, +21,6 points sur photos réelles).

α = 0,7 fait mieux sur les vraies photos (93,8 %) mais moins bien sur les simulées (74,0 %). α = 0,5 est le compromis retenu.

---

## 5. Intégration dans l'appli (étape 4)

### 5.1 Architecture

- `scripts/build-embeddings.mjs` calcule le vecteur de chaque carte (int8 + facteur d'échelle, 388 octets par carte, ≈ 0,7 Mo pour le catalogue) et l'écrit dans `card-hashes.json`. Il ajoute l'en-tête `embeddings` :

  ```json
  { "engine": "dinov2s-int8-mean-168", "region": "art", "model": "dinov2s-int8.onnx",
    "modelSha256": "dfce54a8…0d61", "dim": 384, "alpha": 0.5,
    "cascade": { "k": 100, "single": true },
    "decision": { "prudent": { "abs": 0.44, "margin": 0.11 }, "fast": { "abs": 0.34, "margin": 0.06 } } }
  ```

  Les signatures arrivent sur le téléphone **avec le catalogue**, par la même synchro et le même contrôle SHA-256.
- `src/lib/aiRecognizer.js` (module pur, testé en Node) :
  - lit et vérifie les signatures ;
  - charge le modèle et **vérifie son SHA-256** par rapport à l'en-tête ;
  - construit l'index IA aligné sur l'index couleurs (exemples appris compris).
- `src/lib/cardMatcher.js` : `identify()` est **asynchrone**. L'état de l'IA vaut `off`, `loading`, `ready` ou `error`. Les scans attendent la fin du chargement.
- **Pas de repli silencieux.** Si le modèle ou les signatures manquent ou ne correspondent pas, le scanner utilise les couleurs **et affiche un bandeau** « Reconnaissance IA indisponible, mode léger utilisé », avec un bouton « Réessayer ».
- Réglages → Scanner → « Moteur de reconnaissance » : IA (défaut, préférences v3) ou Empreinte couleurs. On y trouve l'état de l'IA et le bouton **« Tester la vitesse »** (20 cartes du catalogue posées sur un fond gris).
- **Apprentissage** : chaque correction garde aussi le vecteur IA (`learned.e[engine:sha]`). Un ancien exemple sans vecteur IA utilise le vecteur catalogue de la carte (neutre).
- Une seule exécution du modèle à la fois (file d'attente) : le scan automatique ne s'empile pas.
- `THIRD_PARTY_LICENSES.md` est livré dans l'appli (Réglages → À propos → « Licences »).
- Les binaires `.onnx` du banc (≈ 710 Mo) **ne sont pas dans git**, à cause du quota LFS. Seul le modèle de l'appli (24 Mo) l'est.

### 5.2 Cascade et vitesse (étape 4.6)

**Premières mesures de l'utilisateur**, avec la fusion complète (2 orientations × 3 cadrages = 6 images de 224 px) : sur PC, environ 1,6 s de modèle IA par carte dans un navigateur à 1 cœur et 260 ms dans l'appli PC (4 cœurs) ; sur le téléphone, 1 984 ms. Beaucoup trop lent.

Quatre optimisations ont suivi, chacune mesurée sur le banc :

1. **Cascade.** L'IA n'est calculée que quand les couleurs hésitent (≈ 30 % des photos), avec une orientation et seulement les cadrages utiles.
2. **Empreinte couleurs réécrite** (moyenne par zones séparable, lignes puis colonnes). Résultat identique au bit près, vérifié sur trois tailles d'image. Calcul des 12 vues : **276 → 55 ms**.
3. **Photo réduite à 480×670** avant l'identification (la taille du banc) : 55 → 22 ms.
4. **Une seule image IA de 168 px** au lieu de 3 de 224 px.

**Résultats du banc** (α = 0,5, seuils Prudent calibrés pour chaque variante) :

| Variante | Simulées : juste / fausse / hors cat. | Réelles : juste / fausse / hors cat. | Travail IA |
|---|---|---|---|
| Fusion complète 224 px | 78,8 / 0 / 0,8 % | 90,8 / 0 / 0 % | 6 images, toujours |
| Cascade 30, 224 px | 79,8 / 0,2 / 1,0 % | 87,7 / **1,5** / 1,5 % | 2,4 images, 30 % des photos |
| Cascade 100, 224 px | 79,8 / 0,2 / 1,0 % | 87,7 / 0 / 0 % | 2,9 images, 30 % |
| Cascade 100, 1 image, 224 px | 79,8 / 0,2 / 1,0 % | 86,2 / 0 / 0 % | 1 image, 30 % |
| **Cascade 100, 1 image, 168 px (appli)** | **77,3 / 0,2 / 1,0 %** | **84,6 / 0 / 0 %** | 1 image de 168 px, 30 % |
| Cascade 100, 1 image, 140 px | 75,5 / 0,3 / 0,8 % | 84,6 / 0 / 0 % | |
| Cascade 100, 1 image, 112 px | 75,3 / 0,2 / 1,0 % | 81,5 / 0 / 1,5 % | écarté |

Temps natif d'une image DINOv2 int8 (onnxruntime-node, PC) :

| Taille | 1 cœur | 4 cœurs |
|---|---|---|
| 224 px | 105 ms | 75 ms |
| 168 px | 57 ms | 44 ms |
| 140 px | 41 ms | 34 ms |
| 112 px | 28 ms | 22 ms |

Mode Rapide (cascade 100, 168 px) : 81,8 % de cartes justes, 0,5 % de fausses et 9,2 % de cartes hors catalogue acceptées (photos simulées).

### 5.3 Mesures sur les appareils (« Tester la vitesse », 20 cartes)

| | PC avant | PC après | Téléphone avant | Téléphone après |
|---|---|---|---|---|
| Cœurs ONNX Runtime | 4 | 4 | 1 | **1** (pas de `SharedArrayBuffer`) |
| Détection YOLO | 67 ms | 82 ms | 2 145 ms | 2 092 ms |
| Identification (moyenne) | 271 ms | **44 ms** | 490 ms | **84 ms** |
| Identification quand l'IA sert | 526 ms | 108 ms | 2 471 ms | 455 ms |
| dont modèle IA | 260 ms | **69 ms** | 1 984 ms | **388 ms** |

*« Quand l'IA sert » est mesuré en forçant l'IA, car les cartes du catalogue sont nettes et les couleurs sont toujours sûres sur ce test (0/20).*

**Tentatives pour obtenir le multi-cœurs sur Android :**
- en-têtes COOP/COEP/CORP ajoutés aux réponses de la WebView (`MainActivity.java`, `BridgeWebViewClient`) ;
- nombre de fils déterminé par un test direct de la mémoire partagée (`canShareMemory`) au lieu de `crossOriginIsolated`.

Résultat sur l'appareil de l'utilisateur : **mémoire partagée non disponible**. La WebView ne gère pas l'isolation COOP, donc pas de `SharedArrayBuffer`, donc ONNX Runtime Web reste sur 1 fil.

---

## 6. Limites et points discutables

1. **Peu de photos réelles (65).** Une photo vaut 1,5 point. Les différences de moins de 3 points entre variantes ne sont pas significatives. Il faudrait 300 à 500 vraies photos, dans des conditions variées.
2. **Calibrage sur photos simulées uniquement.** Les seuils sont choisis sur le simulateur, qui sous-estime peut-être certaines difficultés (reflets réels, protège-cartes texturés, cartes foil) et en surestime d'autres. Sur les vraies photos, les couleurs seules sont pourtant plus fiables qu'attendu (top-1 87,7 %).
3. **« Hors catalogue » simulé par *leave-one-out*.** C'est un bon indicateur, mais une vraie carte inconnue (nouvelle extension) peut ressembler davantage à une carte existante. Les trois cartes absentes rencontrées (runes UNL, jeton SFD-T02) n'ont pas été testées comme cas « hors catalogue réel ».
4. **Le test de vitesse sur cartes du catalogue est optimiste.** Les images sont nettes, les couleurs toujours sûres, et l'IA ne se déclenche jamais naturellement. En usage réel, elle se déclenchera sur environ 30 % des scans.
5. **Pénalité des exemples appris (`LEARNED_PENALTY = 0,3`)** : elle a été calibrée pour les couleurs seules (`eval-matcher --learn`), pas recalibrée pour la fusion.
6. **Cascade limitée aux 100 meilleures cartes selon les couleurs.** Si la bonne carte est au-delà, l'IA ne peut pas la rattraper. Cela explique en partie l'écart avec la fusion complète (90,8 → 84,6 % sur vraies photos), le reste venant de l'image unique de 168 px.
7. **Signatures int8 dans le catalogue** : cosinus ≥ 0,9999 avec les vecteurs float. Le banc, lui, utilise les vecteurs float.

---

## 7. Préconisations

### 7.1 Décidé — moteur natif Android (en cours)

Un plugin Capacitor (Java) avec **ONNX Runtime Android** (`com.microsoft.onnxruntime:onnxruntime-android`) :
- **YOLO d'abord** (il représente 95 % du temps sur le téléphone), puis DINOv2 ;
- multi-cœurs (`intraOpNumThreads`), XNNPACK ; NNAPI à tester ;
- passage des images : pixels du recadrage (ou de l'image entière pour YOLO) → plugin → tenseurs. Il faut mesurer le coût du pont JS ↔ natif (base64), qui peut lui-même coûter 20 à 50 ms ;
- garder le chemin WASM en repli **visible** si le plugin échoue ; le PC reste en WebGPU/WASM ;
- gain attendu : YOLO 2,1 s → 150-300 ms, IA 388 → 50-80 ms ;
- vérifier la taille de l'APK (+10-15 Mo par architecture ; limiter à arm64-v8a si possible).

### 7.2 Ensuite (par ordre d'intérêt)

1. **Plus de photos réelles** (300+) via `npm run photos:prepare`, puis recalibrer les seuils **sur un mélange** de photos simulées et réelles, en gardant toujours un jeu de photos réelles à part pour la mesure.
2. **Re-mesurer α et la taille d'entrée** quand le moteur sera natif : si le coût d'une image devient négligeable, revenir à 224 px (+2,5 points) voire à la fusion complète (+6 points sur vraies photos).
3. **Étape 3 (facultative) : affiner DINOv2 sur les cartes Riftbound** (apprentissage contrastif, RTX 5070 disponible). C'est la piste qui devrait le plus améliorer l'IA seule, aujourd'hui moins bonne que les couleurs seules.
4. **Ajouter au catalogue** les runes UNL (UNL-R01 à R06) et les jetons SFD manquants.
5. **Étape 5** du plan : vérifications par le cadre de la carte (couleur du domaine, coût, Might) pour départager les rééditions et les cartes proches.
6. Recalibrer `LEARNED_PENALTY` pour la fusion (`eval-matcher --learn` adapté au mode moteurs).

---

## 8. Reproduire

```bash
# Banc complet de l'appli (modèles dans model/embedders/, voir model/MODELS.md pour les retrouver)
npm run eval:matcher -- --compare grid16,dinov2s-int8-mean-168@art --fusion 0.5 --cascade 100 --single --sample 300 --aug 2 --seed 11

# Comparatif de l'étape 2
npm run eval:matcher -- --compare grid16,dinov2s-mean@art,dinov2s-int8-mean@art,mnv4s@art,siglip2b@full --fusion 0.3,0.5,0.7 --sample 300 --aug 2 --seed 11

# Vraies photos : model/real-photos-raw/<CODE>/*.jpg puis
npm run photos:prepare

# Signatures IA du catalogue
node scripts/build-embeddings.mjs
```

Rapport détaillé du dernier banc : `model/eval-compare.json`. Sources et SHA-256 des modèles : `model/MODELS.md`.

**Commits :**

| Commit | Contenu |
|---|---|
| 511b7a7 | étape 1 |
| 2fa1d8c, 9ea14f7, ebbf7e9 | étape 2 |
| e905619 | étape 4 |
| 5f7ec54, 3e85dc6 | étape 4.6 |

**Tests :** 76 tests Node (`npm test`), dont `tests/engines.test.mjs` :
- interface des moteurs ;
- codage int8 des vecteurs ;
- signatures faites par le modèle livré ;
- cascade et apprentissage ;
- modèle différent refusé, avec repli visible.

Lint : 0 erreur, 0 avertissement.
