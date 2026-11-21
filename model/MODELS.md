# Modèles d'embedding (AMELIORATIONS-MODELES.md, étape 2)

Les binaires `.onnx` de `model/embedders/` ne sont **pas** dans git. Ils pèsent
environ 710 Mo, alors que le quota Git LFS gratuit est de 1 Go. Ils se
retrouvent à l'identique avec les commandes ci-dessous. Le banc
(`npm run eval:matcher -- --compare …`) puis l'application vérifient leur SHA-256.

Licences : voir `THIRD_PARTY_LICENSES.md` (toutes Apache 2.0).

## Téléchargés tels quels (ONNX déjà publié)

### dinov2s — `onnx-community/dinov2-small`
Révision `8b1f705a3a7f6f062f6bdd21986c1583d3ef105d`. Modèle de base : `facebook/dinov2-small` (Apache 2.0).

| Fichier | Octets | SHA-256 |
|---|---|---|
| onnx/model.onnx → `dinov2s/model.onnx` | 88 532 934 | `f22797eabf810a75e41de68d378541ebea372122b25c4ce3ef25ff618250c20a` |
| onnx/model_fp16.onnx → `dinov2s/model_fp16.onnx` | 44 420 939 | `16845e153bbaf3fd1ef8a2154c454940f901f6fe8a80dd4c6c319eaecdb4d2ee` |
| onnx/model_int8.onnx → `dinov2s/model_int8.onnx` | 24 446 700 | `dfce54a839b491f395c516350ebb4a78f947e9170a6beac0f2bc5638e0f09d61` |

### dinov2s-reg — `onnx-community/dinov2-with-registers-small`
Révision `ec7abea1a8757ec4f9f7b26399d31234ffaa6e6a`. Modèle de base : `facebook/dinov2-with-registers-small` (Apache 2.0).

| Fichier | Octets | SHA-256 |
|---|---|---|
| onnx/model.onnx → `dinov2s-reg/model.onnx` | 88 522 426 | `815e440d222e60294bb5b165491c4760e7f08dc7ecd2488a5450e93d50887efe` |
| onnx/model_int8.onnx → `dinov2s-reg/model_int8.onnx` | 24 436 194 | `d91d7a3578382f1d67d272f162603a4b5cb1caec05deacb6754fbc064a856d5b` |

URL : `https://huggingface.co/<dépôt>/resolve/<révision>/onnx/<fichier>`.

Entrée `pixel_values` [b, 3, h, w] (h, w multiples de 14) ; sortie
`last_hidden_state` [b, 1 (+4 registres) + patches, 384]. Le vecteur est soit
le CLS (`cls`), soit la moyenne des patches (`mean`).

## Exportés depuis les poids safetensors (timm)

```
python -m venv model/.venv-embed
model/.venv-embed/Scripts/pip install -r model/requirements-embed.txt
model/.venv-embed/Scripts/python model/export_embedders.py mnv4s siglip2b
```

Le script vérifie la licence et fixe la révision. Il ne télécharge que
`model.safetensors` (aucun pickle), exporte en ONNX (opset 18), contrôle la
parité PyTorch / ONNX, puis produit une version int8 (`quantize_dynamic`). Le
résumé détaillé est dans `embedders/export-summary-<id>.json`.

### mnv4s — `timm/mobilenetv4_conv_small.e2400_r224_in1k`
Révision `331fb803779522b685cf942e15f914fb6741c1eb`. Entraîné sur ImageNet-1k. Entrée 224×224, normalisation ImageNet, sortie de 1280 valeurs.

| Fichier | Octets | SHA-256 |
|---|---|---|
| model.safetensors (source) | — | `7a7102ec18f62bbfb555b6fe829bbb5af749516b84174926c29ffdfdfc03aec4` |
| `mnv4s/model.onnx` | 9 944 826 | `f059bee20174d742b252b278ad70ab928f14821ae5ce0f934013865e1bde2384` |
| `mnv4s/model_int8.onnx` | 2 631 835 | `02d8930a2a856b4864731c8f5a7751772bcd638d9226c30ad84f3b9037f0903f` |

Parité fp32 : écart max 5,8e-6. **int8 inutilisable** : cosinus 0,14 avec le
fp32, la quantification dynamique casse ce réseau convolutif. Il faudrait une
quantification statique calibrée.

### siglip2b — `timm/vit_base_patch16_siglip_224.v2_webli`
Révision `4c3661e5ac879a276ddc5ddc6d3f0ecc78fd5d82`. Entraîné sur WebLI. Entrée 224×224, moyenne / écart-type 0,5, sortie de 768 valeurs.

| Fichier | Octets | SHA-256 |
|---|---|---|
| model.safetensors (source) | — | `9106b0d8d9d02ea90fc3571fffd1557cf444736f695ee40b1e57c856bc3d9494` |
| `siglip2b/model.onnx` | 371 675 949 | `64d6665d5bbbe593b7d597b9458516e603666e92dc63473c5704b036ffb720cf` |
| `siglip2b/model_int8.onnx` | 93 994 859 | `cc991108e2a4cd707105c78213b25eeb0cea60162e65fcdb302d5227a24c42ce` |

Parité fp32 : écart max 2,9e-6. int8 : cosinus 0,92 avec le fp32.

## Résultats du banc (2026-11-11, photos SIMULÉES uniquement)

Commande : `npm run eval:matcher -- --compare … --fusion … --sample 300 --aug 2 --seed 11`.
Le banc porte sur 600 photos simulées. Les seuils sont calibrés par moteur pour
accepter au plus 1 % de cartes hors catalogue et au plus 0,5 % de cartes
fausses. Fusion : score = α·modèle + (1 − α)·grid16. Les temps (ms/carte) sont
mesurés sur le CPU du PC.

| Configuration | Top-1 | Acceptée juste | Fausse | Hors cat. | Taille |
|---|---|---|---|---|---|
| grid16 (actuel) | 84,3 % | 70,3 % | 0,2 % | 0,7 % | 0 |
| dinov2s CLS @art / @full | 77,0 / 73,3 % | 59,0 / 57,2 % | 0 / 0,2 % | — | 88,5 Mo |
| dinov2s-mean @art | 82,0 % | 65,2 % | 0 % | 0,8 % | 88,5 Mo |
| dinov2s-int8-mean @art | 79,7 % | 63,7 % | 0 % | 1,0 % | 24,4 Mo |
| dinov2s-fp16 @full | 73,5 % | 57,7 % | 0,2 % | 1,0 % | 44,4 Mo |
| dinov2s-reg-mean @full | 69,2 % | 51,2 % | 0 % | 0,8 % | 88,5 Mo |
| mnv4s @art / @full | 60,3 / 55,8 % | 51,2 / 44,2 % | 0 % | 1,0 % | 9,9 Mo |
| siglip2b @full | 92,2 % | 44,5 % | 0,3 % | 1,0 % | 372 Mo |
| siglip2b-int8 @full | 51,0 % | 18,0 % | 0,2 % | 0,8 % | 94 Mo |
| **dinov2s-mean@art + grid16, α 0,5** | 93,2 % | **81,2 %** | 0 % | 0,8 % | 88,5 Mo |
| **dinov2s-int8-mean@art + grid16, α 0,3** | 90,7 % | **80,0 %** | 0 % | 1,0 % | **24,4 Mo** |
| mnv4s@art + grid16, α 0,3 | 86,7 % | 74,3 % | 0 % | 1,0 % | 9,9 Mo |
| siglip2b@full + grid16, α 0,3 | 94,5 % | 85,7 % | 0 % | 0,8 % | 372 Mo |

Aucun modèle seul ne bat l'empreinte grid16. Combinés avec elle, plusieurs
modèles la dépassent. Le seul candidat qui respecte la limite de 25 Mo est
**dinov2s-int8-mean@art + grid16 (α 0,3)**, avec +9,7 points. Il reste à le
valider sur de vraies photos.

## Résultats sur photos RÉELLES (2026-11-11, 32 photos, 31 cartes)

Les photos ont été prises au téléphone et passées par `npm run photos:prepare`
(YOLO puis redressement, la même chaîne que l'appli). Les seuils sont ceux
calibrés sur les photos simulées. Avec seulement 32 photos, une photo vaut
3,1 points : ces chiffres donnent une tendance, pas une mesure précise.

| Configuration | Top-1 | Acceptée juste | Fausse | Hors cat. | Taille |
|---|---|---|---|---|---|
| grid16 (actuel) | 93,8 % | 71,9 % | 0 % | 0 % | 0 |
| dinov2s-int8-mean @art | 93,8 % | 62,5 % | 0 % | 0 % | 24,4 Mo |
| mnv4s @art | 75,0 % | 40,6 % | 0 % | 0 % | 9,9 Mo |
| siglip2b @full | 68,8 % | 21,9 % | 0 % | 0 % | 372 Mo |
| **dinov2s-int8-mean@art + grid16, α 0,3 ou 0,5** | 100 % | **93,8 %** | 0 % | 0 % | 24,4 Mo |
| **mnv4s@art + grid16, α 0,5** | 100 % | **93,8 %** | 0 % | 0 % | **9,9 Mo** |
| mnv4s@full + grid16, α 0,3 | 100 % | 78,1 % | 0 % | 3,1 % | 9,9 Mo |
| siglip2b@full + grid16, α 0,3 | 100 % | 100 % | 0 % | 0 % | 372 Mo |

### Mise à jour : 65 photos réelles (2026-11-11)

Les runes UNL-R02 et UNL-R05 sont comptées comme ven-r02 et ven-r05 : elles
ont la même illustration, et la version UNL manque au catalogue. PAD-098 est
en réalité RAD-098. Le token SFD-T02, absent du catalogue, est exclu.

| Configuration | Top-1 | Acceptée juste | Fausse | Hors cat. |
|---|---|---|---|---|
| grid16 (actuel) | 87,7 % | 69,2 % | 0 % | 0 % |
| dinov2s-int8-mean @art | 95,4 % | 67,7 % | 0 % | 0 % |
| mnv4s @art | 64,6 % | 30,8 % | 0 % | 0 % |
| **dinov2s-int8-mean@art + grid16, α 0,5** | 98,5 % | **90,8 %** | 0 % | 0 % |
| dinov2s-int8-mean@art + grid16, α 0,7 | 100 % | 93,8 % | 0 % | 0 % |
| mnv4s@art + grid16, α 0,3 | 92,3 % | 81,5 % | 0 % | 0 % |
| siglip2b@full + grid16, α 0,3 | 98,5 % | 92,3 % | 0 % | 0 % |

Avec plus de photos, MobileNetV4 recule nettement et DINOv2 int8 reste en tête.
Choix recommandé : **dinov2s-int8-mean@art + grid16, α 0,5**. C'est le
meilleur compromis entre photos simulées (78,8 %) et réelles (90,8 %). À α 0,7,
les photos simulées tombent à 74,0 %.

## Intégration dans l'appli (étape 4)

Le modèle retenu est `public/models/dinov2s-int8.onnx`, identique à
`dinov2s/model_int8.onnx` (SHA-256 `dfce54a8…0d61`). Les signatures du
catalogue sont produites par `scripts/build-embeddings.mjs`.

L'appli fonctionne en cascade : les couleurs décident seules quand elles sont
sûres. Sinon, l'IA regarde la carte dans une seule orientation, avec les
cadrages des 100 meilleures cartes selon les couleurs (`--cascade 100`).

| Configuration | Simulées : juste / fausse / hors cat. | Réelles (65) : juste / fausse / hors cat. | IA utilisée |
|---|---|---|---|
| grid16 seul | 70,3 / 0,2 / 0,7 % | 69,2 / 0 / 0 % | jamais |
| fusion complète α 0,5 | 78,8 / 0 / 0,8 % | 90,8 / 0 / 0 % | toujours, 6 images |
| **cascade 100, α 0,5 (appli)** | **79,8 / 0,2 / 1,0 %** | **87,7 / 0 / 0 %** | **30 % des photos, 2,9 images** |
| cascade 30, α 0,5 | 79,8 / 0,2 / 1,0 % | 87,7 / 1,5 / 1,5 % | 30 %, 2,4 images |

Mode Rapide (cascade 100) : 83,2 % de cartes justes, 0,5 % de fausses et 8,8 %
de cartes hors catalogue acceptées (photos simulées).

Dans un navigateur sur un seul cœur de processeur, le modèle prend 690 ms
quand il sert, contre 1 615 ms pour la fusion complète. La mesure sur
téléphone et sur l'appli PC (plusieurs cœurs) se fait avec Réglages → Scanner
→ « Tester la vitesse » (étape 4.6).

### Vitesse (étape 4.6) : une image, taille réduite

Cascade 100 avec **une seule image IA** (`--single`), α = 0,5 :

| Entrée IA | Simulées : juste / fausse / hors cat. | Réelles : juste / fausse / hors cat. | Temps du modèle (1 cœur, natif) |
|---|---|---|---|
| 224 px | 79,8 / 0,2 / 1,0 % | 86,2 / 0 / 0 % | 105 ms |
| **168 px (appli)** | **77,3 / 0,2 / 1,0 %** | **84,6 / 0 / 0 %** | **57 ms** |
| 140 px | 75,5 / 0,3 / 0,8 % | 84,6 / 0 / 0 % | 41 ms |
| 112 px | 75,3 / 0,2 / 1,0 % | 81,5 / 0 / 1,5 % | 28 ms |

Seuils de l'appli (168 px) : Prudent abs 0,44 / marge 0,11 ; Rapide abs 0,34 /
marge 0,06, qui donne 81,8 % de cartes justes, 0,5 % de fausses et 9,2 % de
cartes hors catalogue acceptées (photos simulées).

# Détecteur de cartes YOLO11s-pose (AMELIORATIONS-NATIF.md, étape 1)

Le détecteur trouve les 4 coins de chaque carte (sortie [1, 13, N] : boîte,
confiance, coins haut-gauche, haut-droit, bas-droit, bas-gauche). Depuis le
2026-11-13, l'appli utilise **une taille d'entrée par mode** (`MODE_SIZES` de
`src/lib/yoloDetector.js`) :

| Mode | Taille | Fichier |
|---|---|---|
| Caméra (une carte de près) | 320 px | `yolo11s-pose-riftbound-320(-q8).onnx` |
| Photo importée, grille | 416 px | `yolo11s-pose-riftbound-416(-q8).onnx` |

C'est **le même modèle** que l'ancien 768 (entraîné à 768 px sur Modal). Les
fichiers ont été redimensionnés par `model/export_yolo_sizes.py`, sans
réentraînement. Seules 9 constantes du graphe dépendent de la taille d'entrée
(forme de l'attention, reshape DFL, ancres, pas). Le script les recalcule, et
recalculées pour 768 elles redonnent exactement l'original.

Quantification int8 : `onnxruntime.quantization.quantize_dynamic`, poids
`QuantType.QUInt8`, la même méthode qu'avant. Le téléphone utilise l'int8.

**Seuls les int8 sont dans git (LFS).** Les float32 sont ignorés par git.
- Le PC les sert depuis `public/models/` quand ils y sont présents.
- Le téléphone les télécharge depuis le PC et les vérifie avec
  `public/models/manifest.json`, versionné, qui contient leur SHA-256 et leur
  taille.
- L'APK de test inclut le float32 320.
- `npm run android:apk(:test)` refuse un float32 dont le SHA-256 ne
  correspond pas au manifeste.

| Fichier (`public/models/`) | Octets | SHA-256 |
|---|---|---|
| `yolo11s-pose-riftbound-320.onnx` | 38 960 987 | `d32408a42a5e35411d576db658f8efd78e645bf30af77f9cb845587167715f7c` |
| `yolo11s-pose-riftbound-320-q8.onnx` | 10 053 983 | `e4ef7a6ae7071cc9a29c408728f8b11b88658de70ae87c2955694fd59daa5c6e` |
| `yolo11s-pose-riftbound-416.onnx` | 39 007 372 | `a46a955c9014ed024241e6e521efaa8dc19332aa16995972d959978cfb638cdf` |
| `yolo11s-pose-riftbound-416-q8.onnx` | 10 100 368 | `5350389be837e527a838ea8a4964b33880e5b4c4b1beb5f01bbca809d9242a36` |

### Régénérer les modèles float32 (et int8)

La sortie est reproductible au bit près : les SHA-256 ci-dessus ont été
retrouvés à l'identique le 2026-11-13.

```
# 1. Source : l'export 768 d'origine. Il vient de la sauvegarde ci-dessous, ou de l'historique git (LFS) :
git cat-file --filters 6772729:public/models/yolo11s-pose-riftbound.onnx > model/yolo-sizes/yolo11s-pose-riftbound-768.onnx
# 2. Export aux tailles voulues, directement dans l'appli :
model/.venv-embed/Scripts/python model/export_yolo_sizes.py 320 416 --out public/models
```

Le script écrit aussi les int8 : ils doivent redonner les SHA-256 du tableau.
L'environnement `model/.venv-embed` est décrit dans la partie « Exportés
depuis les poids safetensors ».

### Sauvegarde des poids sources (hors dépôt)

`../sauvegarde-modeles/` (dossier frère du dépôt), à côté du
dépôt mais pas dedans, 179 Mo, liste des SHA-256 dans `SHA256SUMS.txt`.
Le dossier est sur le même disque que le dépôt : en faire une copie ailleurs
(disque externe, cloud) pour une vraie sauvegarde.

| Dossier | Contenu | SHA-256 |
|---|---|---|
| `detecteur-768/` | export 768 d'origine, source des modèles livrés (fp32, int8) | `3185bc30…27ca5`, `ae2373df…db5df` |
| `detecteur-320-416-float32/` | float32 320 et 416 (régénérables) | `d32408a4…5f7c`, `a46a955c…8cdf` |
| `rejete-rb416/` | `best.pt` et `last.pt` du modèle rejeté, `yolo11s-pose.pt` (poids de départ Ultralytics) | `c68f3287…eb56`, `6a6a5480…5c`, `1060bda4…a2bc` |

Le `best.pt` du modèle 768 d'origine n'a jamais été rapatrié : il est resté
sur le volume Modal. L'export ONNX 768 contient les mêmes poids.

Les anciens fichiers 768 sont sortis de l'appli. Ils restent dans l'historique
git et dans `model/yolo-sizes/` (ignoré), comme les exports 512 :

| Fichier (`model/yolo-sizes/`) | Octets | SHA-256 |
|---|---|---|
| `yolo11s-pose-riftbound-768.onnx` | 39 303 870 | `3185bc30a9a21f27557c10d960945c4acd38d8e52cbe6f719dd4282931e27ca5` |
| `yolo11s-pose-riftbound-768-q8.onnx` | 10 396 866 | `ae2373df7b33e1499da3cd8ed5fd3008614e24f27e86c06d18f0787f2e7db5df` |

## Banc de détection (2026-11-13)

`npm run eval:detector` (`scripts/eval-detector.mjs`) mesure toute la chaîne :
détection, redressement, identification (cascade couleurs puis IA, réglage
Prudent). Les sources ne sont jamais mélangées :

- **200 scènes simulées** (`python model/make_detector_eval.py`, graine 7), 1 223 cartes ;
- **65 vraies photos** d'une carte chacune (`model/real-photos-raw/`) ;
- **photos réelles de grilles** (`model/real-photos-raw/grilles/<nom>.jpg` +
  `<nom>.txt`, un code par ligne). Un code absent du catalogue (jeton…) compte
  pour la détection seulement. Il y a 6 grilles de 9 à 12 cartes (57 cartes du
  catalogue), dont une difficile : cartes qui se chevauchent, carte brillante
  penchée, champs de bataille de travers, tapis texturé. S'y ajoutent 13 photos
  d'une carte posée à distance.

| Modèle | Taille | Simulées identifiées | Coins (% diag.) | Réelles identifiées | 1 fil (Node) |
|---|---|---|---|---|---|
| ancien fp32 | 768 | 87,4 % | 0,46 | 84,6 % | 287 ms |
| ancien int8 | 768 | 86,9 % | 0,63 | 86,2 % | 283 ms |
| ancien fp32 | 512 | 87,1 % | 0,56 | 87,7 % | 135 ms |
| ancien int8 | 512 | 86,4 % | 0,69 | 87,7 % | 141 ms |
| **ancien fp32** | **416** | 86,8 % | 0,73 | 92,3 % | 86 ms |
| **ancien int8** | **416** | 86,1 % | 0,85 | 90,8 % | 87 ms |
| **ancien fp32** | **320** | 81,6 % | 1,26 | 92,3 % | 49 ms |
| **ancien int8** | **320** | 80,4 % | 1,36 | 92,3 % | 53 ms |

Toutes les tailles trouvent 100 % des cartes réelles, sans fausse détection.

Vraies photos de grilles (int8, 2026-11-13) :

| Taille | 6 grilles (57 cartes) | Grille difficile (10 cartes) | 13 cartes à distance |
|---|---|---|---|
| 320 | 47 (82,5 %) | 8 | 12 |
| **416** | **51 (89,5 %)** | **10** | 12 |
| 512 | 49 (86,0 %) | 9 | 12 |
| 768 | 52 (91,2 %) | 10 | 12 |

Toutes les tailles trouvent toutes les cartes des grilles. La seule détection
« en trop » est une carte de la grille difficile qui manque dans sa liste.

Sur le téléphone de l'utilisateur (« Tester la vitesse », 1 cœur, 20 cartes) :

| Détection | YOLO | Scan complet |
|---|---|---|
| 768 int8 (avant) | ≈ 2 090 ms | ≈ 2 175 ms |
| **320 int8** | **485 ms** | **557 ms** |
| 320 float32 | 468 ms | 537 ms |

Le float32 ne gagne que 3 % mais pèse 4 fois plus lourd : l'int8 reste livré.

Sur les vraies photos, 416 et 320 font **aussi bien que le 768**. L'écart
d'environ 5 photos sur 65 n'est pas assez grand pour conclure qu'ils font
mieux. Sur les grilles, simulées comme réelles, le 320 perd 6 à 9 points
(cartes petites dans l'image). Le 416 fait comme le 768 à une carte près
(51 contre 52 sur 57), d'où le choix du 416 pour le mode photo.

## Modèle rejeté : `yolo11s-pose-rb416` (2026-11-13)

Réentraînement local (RTX 5070, `model/train.py`) avec les mêmes réglages
et le même générateur que le modèle 768, mais à `imgsz=416` avec entraînement
multi-échelle (`multi_scale=0.5`, environ 208 à 640 px). 80 époques. Sur la
validation simulée : précision 0,9998, rappel 0,999, pose mAP50-95 0,995.

**Rejeté** : il fait nettement moins bien sur les vraies photos, à toutes les tailles.

| Taille | Simulées identifiées | Réelles identifiées (fp32 / int8) |
|---|---|---|
| 320 | 85,6 % | 75,4 % / 75,4 % |
| 416 | 86,3 % | 73,8 % / 78,5 % |
| 512 | 86,8 % | 72,3 % / 72,3 % |
| 768 | 85,4 % (gros plans 65,1 %) | 53,8 % / 58,5 % |

Diagnostic sur les vraies photos : il trouve toujours la carte, mais ses coins
s'écartent de ceux de l'ancien modèle de 1,25 % (416) à 2,24 % (768) de la
diagonale. Les coins du haut sont placés trop bas. Ce petit décalage suffit à
faire rater l'identification. Le défaut est le plus fort quand la carte remplit
presque toute l'image : c'est le cas de ces photos, et des gros plans
simulés à 768 (65 %). Avec des images d'entraînement de 640 px au plus, il
n'a presque jamais vu de carte aussi grande en pixels.

**Piste pour `data_creator.py`** si l'on réentraîne un jour : ajouter des
scènes « carte plein cadre ». La carte doit occuper 70 à 95 % de l'image, avec
une légère perspective, des bords parfois coupés par le cadre et un fond
réduit à une fine bande. C'est le cas typique d'une photo prise au téléphone.
Il faudrait aussi mesurer sur les vraies photos avant de remplacer quoi que ce soit.

Archive (ignorée par git, à ne pas supprimer) : `model/archive/yolo11s-pose-rb416-rejete/`.
Elle contient `weights/best.pt`, `last.pt`, les courbes, `results.csv` et
`weights/export/` (320, 416, 512 et 768, en fp32 et en int8).

# Image IA en 140 px au lieu de 168 (2026-11-13, avant l'étape 2)

**1. Banc de reconnaissance.** Commande :
`npm run eval:matcher -- --compare grid16,dinov2s-int8-mean-168@art,dinov2s-int8-mean-140@art --fusion 0.5 --cascade 100 --single`.
Mesures sur 4 224 photos simulées et 65 vraies photos (recadrages du
détecteur 768), cascade avec une seule image, seuils Prudent calibrés pour
chaque taille :

| Image IA | Seuils Prudent | Simulées : juste / fausse / hors cat. | Réelles : juste / fausse / hors cat. |
|---|---|---|---|
| 168 px (appli) | 0,46 / 0,15 | 78,4 / 0,1 / 1,0 % | 83,1 / 0 / 0 % |
| 140 px | 0,42 / 0,16 | 77,0 / 0,1 / 1,0 % | 83,1 / 0 / 0 % |

**2. Banc de détection, de bout en bout.** Il mesure toute la chaîne
(détection int8, redressement, identification) avec un catalogue construit à
chaque taille : `build-embeddings --engine … --out model/cache/…`, puis
`eval:detector --catalog …`. Pourcentage de cartes identifiées :

| Catalogue | Détection | 200 scènes simulées | 65 vraies photos | 6 vraies grilles (58 cartes) |
|---|---|---|---|---|
| appli (168 px, seuils 0,44 / 0,11) | 320 | 80,7 % | 92,3 % | 49 |
| appli (168 px, seuils 0,44 / 0,11) | 416 | 86,3 % | 90,8 % | 53 |
| 168 px recalibré (0,46 / 0,15) | 320 | 79,3 % | 92,3 % | 47 |
| 168 px recalibré (0,46 / 0,15) | 416 | 85,0 % | 89,2 % | 52 |
| 140 px (0,42 / 0,16) | 320 | 78,7 % | 92,3 % | 47 |
| 140 px (0,42 / 0,16) | 416 | 84,5 % | 89,2 % | 51 |

À calibration égale, le 140 px perd environ 0,5 point sur les scènes simulées
et une carte sur 58 dans les grilles. Il ne perd rien sur les vraies photos.

Côté calcul, une image IA prend 57 ms en 168 px et 41 ms en 140 px (PC, Node,
1 cœur). Sur le téléphone, elle prend 389 ms en 168 px ; le temps en 140 px
reste à mesurer avec « Tester la vitesse », case « Comparer le modèle IA ».

La décision attend cette mesure. Pour passer en 140 px : lancer
`build-embeddings --engine dinov2s-int8-mean-140 --prudent 0.42,0.16 --fast 0.30,0.07`
(sans `--out`), puis mettre à jour l'en-tête et `ENGINE` dans le script.

Les grilles comptent maintenant 58 cartes au lieu de 57, après l'ajout
d'OGN-094 à la photo difficile. Les runes OGN, RAD et VEN sont désormais
regroupées comme rééditions de la même illustration (voir `catalog-groups`) :
les grilles passent de 51 à 53 cartes en 416 px.

# Fiabilité d'abord : float32 / fp16 contre int8 (2026-11-14)

Règle de l'utilisateur : budget de 100 Mo de modèles au total. Un modèle plus
lourd n'est retenu que si le gain se voit sur le gros tirage simulé, sans
erreur de plus. Les 65 vraies photos ne suffisent pas à elles seules : une
photo y vaut 1,5 point.

## YOLO float32 à entrée dynamique

Commande : `model/export_yolo_sizes.py --dynamic`. Les 9 constantes qui
dépendent de la taille d'entrée sont calculées dans le graphe, à partir de la
taille de l'image. Le résultat est un fichier unique,
`yolo11s-pose-riftbound-dyn.onnx` : 38 899 977 octets, sha256
`c3e1f64c587a8c548fd36aaf5358a42686a760602b08daea26dcecc7e497343f`. Ses
sorties sont identiques au bit près à celles des modèles fixes en 320, 416 et
768 px (écart max 0). Sa précision est donc celle du float32 fixe.

Vitesse sur le téléphone de l'utilisateur, détection seule :

| Modèle | Détection 320 px | Détection 416 px |
|---|---|---|
| int8, taille fixe | 485 ms | — |
| float32, taille fixe | 468 à 522 ms | — |
| float32, entrée dynamique | 487 ms | 732 ms |

## DINOv2 (image de 168 px) : int8, fp16, fp32

Banc de reconnaissance : 4 224 photos simulées et 65 vraies, cascade avec une
seule image. Seuils Prudent calibrés sur ce tirage (au plus 1 % de cartes
hors catalogue acceptées, au plus 0,5 % de fausses).

| DINOv2 | Taille | Seuils Prudent | Simulées justes | Fausses | Hors catalogue | Réelles | Téléphone (1 image) |
|---|---|---|---|---|---|---|---|
| int8 | 24 Mo | score libre, marge 0,14 | 79,5 % | 0,07 % | 0,95 % | 84,6 % | 382 ms |
| **fp16** | **44 Mo** | 0,38 / 0,13 | **80,6 %** | 0,07 % | 0,99 % | 84,6 % | 401 ms |
| fp32 | 88 Mo | 0,42 / 0,13 | 80,4 % | 0,07 % | 0,99 % | 84,6 % | 388 ms |

## De bout en bout (seuils définitifs)

Mesures sur 1 000 scènes simulées (6 897 cartes, `make_detector_eval.py 1000`),
66 vraies photos, et 6 grilles plus 13 cartes posées à distance (72 cartes).
Les listes de deux grilles ont été corrigées : la carte imprimée est UNL-099,
pas UNL-090, et OGN-014, pas OGN-024. Le scanner avait raison.

| YOLO | DINOv2 | Détection | Simulées justes | Fausses | Vraies photos | Grilles |
|---|---|---|---|---|---|---|
| int8 | int8 | 320 | 5 603 | 8 | 61 / 66 | 63 / 72 |
| float32 | int8 | 320 | 5 644 | 7 | 61 / 66 | 64 / 72 |
| float32 | **fp16** | 320 | **5 690** | 6 | 61 / 66 | 67 / 72 |
| int8 | int8 | 416 | 5 943 | 6 | 59 / 66 | 68 / 72 |
| float32 | int8 | 416 | 5 969 | 4 | 61 / 66 | 67 / 72 |
| float32 | **fp16** | 416 | **5 993** | **3** | 60 / 66 | 68 / 72 |

Aucune carte réelle n'est acceptée à tort, quelle que soit la combinaison.

Par rapport à l'appli actuelle (int8 + int8), YOLO float32 + DINOv2 fp16 gagne
87 cartes en 320 px (+1,3 point) et 50 en 416 px (+0,7 point). Il fait aussi
moins de fausses : 6 au lieu de 8 en 320, 3 au lieu de 6 en 416.

Taille des options (APK sans les modèles : environ 175 Mo, surtout les images
des cartes) :

| Option | Modèles | APK |
|---|---|---|
| Actuelle : YOLO int8 320 + 416, DINOv2 int8 | 45 Mo | 209 Mo |
| YOLO float32 dynamique, DINOv2 int8 | 63 Mo | 228 Mo |
| YOLO int8 320 + 416, DINOv2 fp16 | 65 Mo | 230 Mo |
| **YOLO float32 dynamique, DINOv2 fp16** | **83 Mo** | **250 Mo** |
| YOLO float32 dynamique, DINOv2 fp32 | 127 Mo | hors budget |

## Adopté le 2026-11-14 : YOLO float32 dynamique + DINOv2 fp16

Sur décision de l'utilisateur. Les modèles livrés sont dans `public/models/`
et sont les seuls sur Git LFS :

| Fichier | Octets | SHA-256 |
|---|---|---|
| `yolo11s-pose-riftbound-dyn.onnx` | 38 899 977 | `c3e1f64c587a8c548fd36aaf5358a42686a760602b08daea26dcecc7e497343f` |
| `dinov2s-fp16.onnx` (= onnx-community `onnx/model_fp16.onnx`) | 44 420 939 | `16845e153bbaf3fd1ef8a2154c454940f901f6fe8a80dd4c6c319eaecdb4d2ee` |

En-tête du catalogue : `engine: dinov2s-fp16-mean-168`, seuils Prudent
0,38 / 0,13 et Rapide −0,2 / 0,07. Vérification de bout en bout avec les
fichiers de l'appli : 61 / 66 vraies photos en 320 px et 60 / 66 en 416 px,
67 / 72 et 68 / 72 cartes en grilles, aucune carte acceptée à tort.

Les anciens modèles livrés (int8 320, int8 416, DINOv2 int8) restent dans
l'historique git et dans `sauvegarde-modeles/essais/`. Le modèle dynamique est
aussi dans `sauvegarde-modeles/detecteur-320-416-float32/`.

# Étape 5.1 : contrôle par la couleur du cadre (2026-11-14), EN PAUSE

Idée : la couleur de la barre du nom (celle du domaine sur les cartes standard)
doit correspondre à celle de la carte proposée. En cas de désaccord, une carte
acceptée repasse en « doute ».

Le module est dans `scripts/lib/frameCheck.mjs`, réservé au banc :
`eval:matcher -- … --frame-check 50`. La barre est mesurée à une position fixe
(60 à 63 % de la hauteur), après correction de l'éclairage sur la zone de texte
blanche, puis comparée à la barre de la même carte dans le catalogue. Il
vérifie 772 cartes sur 1 415 ; les illustrations pleines, les Légendes, les
champs de bataille et les cartes incolores sont ignorés.

Une première version, qui cherchait la barre automatiquement et la comparait à
une couleur moyenne par domaine, refusait la vraie carte dans 9 % des vraies
photos : abandonnée.

Banc avec DINOv2 fp16 en cascade (une image), 4 224 photos simulées et 65
vraies, seuils Prudent recalibrés dans chaque cas :

| | Seuils | Simulées justes | Fausses | Hors catalogue | Rejetées | Réelles justes |
|---|---|---|---|---|---|---|
| sans contrôle | 0,42 / 0,14 | 79,6 % | 1 photo | 0,97 % | 20,3 % | 84,6 % |
| avec contrôle (50°) | 0,38 / 0,13 | 76,6 % | 1 photo | 0,99 % | 23,4 % | 84,6 % |

Le contrôle fait perdre 3 points de cartes justes, sans réduire ni les fausses
ni les cartes hors catalogue acceptées. Il n'apporte rien non plus sur les
vraies photos, et il est moins bon en mode Rapide (80,3 % contre 84,3 %).

**Mis en pause, pas abandonné** (décision de l'utilisateur, 2026-11-14) : pas
de gain au banc recalibré sur photos simulées (−3 points), ni sur les vraies
photos. Un test équitable de bout en bout reste à faire, une fois construite la
mesure « hors catalogue » dans le banc de bout en bout. À seuils fixes, le
contrôle ne peut que retirer des cartes acceptées : il ne peut donc gagner
qu'avec des seuils recalibrés en l'utilisant.

Réserve : le simulateur décale le cadrage jusqu'à 4 % de la hauteur, plus que
la barre elle-même. Dans l'appli, ce sont les coins de YOLO qui cadrent la
carte (environ 1 %), et sur les 65 vraies photos le contrôle ne refuse aucune
vraie carte. C'est ce que le test de bout en bout, à faire, devra trancher.

## Seuils Prudent recalibrés (2026-11-14) : 0,42 / 0,14

Recalibrage sur les 4 224 photos simulées, avec le catalogue actuel (ajouts
manuels, runes regroupées). Avec ce catalogue, l'ancien réglage 0,38 / 0,13
dépassait la limite de 1 % de cartes hors catalogue acceptées. Nouveaux
résultats : 79,6 % de cartes justes, 0,02 % de fausses et 0,97 % de cartes
hors catalogue acceptées sur les photos simulées ; 84,6 % / 0 % / 0 % sur les
65 vraies. Le mode Rapide garde −0,2 / 0,07. L'utilisateur a fixé la règle :
la limite de 1 % passe avant le reste.

# Analyse des cartes rejetées (2026-11-14, avant l'étape 5.2)

Banc de bout en bout (`eval:detector --dump`) : détecteur de l'appli, DINOv2
fp16, seuils 0,42 / 0,14, 1 000 scènes simulées et 66 vraies photos. Une carte
« rejetée » est trouvée par YOLO mais pas acceptée (« quelle carte ? »).
Catégories, dans l'ordre de priorité :

- d) la carte concurrente a le même nom (autre illustration) ;
- b) la bonne carte n'est pas première ;
- c) elle est première, mais avec un score sous 0,42 ;
- a) elle est première, mais trop proche de la deuxième (écart sous 0,14).

| Simulées | 320 px | 416 px |
|---|---|---|
| cartes trouvées / rejetées | 6 881 / 1 222 (17,8 %) | 6 892 / 920 (13,3 %) |
| a) trop proche de la 2e | 34,5 % (même énergie et Might : 120 ; différentes : 302) | 35,3 % (84 ; 241) |
| b) pas 1re | 51,8 % (dont hors du top 5 : 459) | 50,0 % (dont hors du top 5 : 329) |
| c) score trop bas | 12,7 % | 13,5 % |
| d) même nom | 1,0 % | 1,2 % |
| 5.2 chiffres, récupération maximale | +6,3 points (+8,3 avec les scores bas) | +4,9 points (+6,4) |
| 5.3 numéro de collection, maximum | +0,17 point | +0,16 point |

Sur les 66 vraies photos, il y a 5 rejets en 320 et 6 en 416, sans aucune
erreur. La lecture des chiffres en récupèrerait au plus 1 dans chaque mode ;
2 cas de a) ont la même énergie et la même Might que la deuxième carte.

La récupération « maximale » suppose une lecture des chiffres parfaite. Pour
a), il faut que la deuxième carte n'ait pas les mêmes chiffres ; pour b), que
toutes les cartes classées devant la bonne aient d'autres chiffres. Environ
200 cartes rejetées n'ont aucun chiffre imprimé (runes, champs de bataille,
Légendes) : on y compte « absent » comme une valeur.

La plus grosse part, les b) hors du top 5 (environ la moitié des rejets),
relève de la reconnaissance elle-même : seul un meilleur modèle, comme un
DINOv2 affiné, pourrait les récupérer. Les scènes simulées sont bien plus
dures que les gros plans : 18 % de rejets en scène contre 5 % en gros plan.

**Décision (2026-11-14) : 5.2 et 5.3 mis de côté.** La 5.3 est écartée (+0,2
point au mieux). La 5.2 n'apporte presque rien sur les vraies photos (1 photo
sur 66). **Règle : à réévaluer quand l'analyse des refus aura été faite sur 200
vraies photos ou plus** (module de collecte du banc). L'effort va d'abord à
l'affinage de DINOv2-small (étape 3 d'AMELIORATIONS-MODELES.md).

# Étape 3 : DINOv2-small affiné sur les cartes, ADOPTÉ (2026-11-14)

- **Script** : `model/train_embedder.py`, avec les commandes `parity`, `train`
  et `export`.
- **Base** : `facebook/dinov2-small`, révision
  `ed25f3a31f01632728cabb09d1542f84ab7b0056` (Apache 2.0). Elle redonne
  l'ONNX d'origine à 1,4e-4 près.
- **Découpage** : 80/20 par `artGroup` avec la graine 7, soit 1 080 groupes
  d'entraînement et 270 jamais vus (`model/finetune/split.json`, sauvegardé).
- **Données** : images du catalogue et simulateur porté en Python
  (perspective, rotation, cadrage décalé comme les erreurs de YOLO, lumière,
  balance des blancs, flou, reflet, faux foil, JPEG, bruit). Même découpe de
  l'illustration que l'appli, en 168 px, avec la moyenne des patchs.
- **Apprentissage** : ArcFace (s = 30, m = 0,2). Les 6 derniers blocs et la
  normalisation finale sont entraînés (lr 2e-5, tête 2e-3, AdamW, OneCycle),
  pendant 20 époques de 8 vues par carte, avec un batch de 96 en bf16.
  Durée : 53 min sur RTX 5070.
- **Mesure du script, IA seule, photos simulées** : top-1 de 97,5 % → 100 %
  sur les groupes vus et de 96,5 % → 100 % sur les jamais vus. L'écart médian
  avec la deuxième carte passe de 0,12 à 0,50 (vus) et de 0,11 à 0,48 (jamais
  vus).
- **Export** : float32 de 88,5 Mo, et fp16 `dinov2s-ft-fp16.onnx` de
  45 967 436 octets, sha256
  `45c10e5eb0c60316499d3b68d14fc51f6dab448e553fa439d9f7273bfc3b1fab`. Le
  convertisseur fp16 est celui d'onnxruntime ; l'interpolation des positions
  (78 nœuds `/m/embeddings/`) reste en float32, sinon ses échelles sont
  refusées. Parité : cosinus des vecteurs ≥ 0,999996. Le modèle tourne avec
  onnxruntime-web (WASM), à 1e-2 près de la version native.
- **Seuils Prudent : 0,40 / 0,14.** Ils sont calibrés sur 4 224 photos
  simulées, avec la limite hors catalogue du modèle précédent (0,966 %,
  `--limit-fp 0.00966`). Le mode Rapide passe à 0,28 / 0,06.

Banc de reconnaissance (cascade, une image) :

| | Simulées justes | Fausses | Hors catalogue | Réelles justes |
|---|---|---|---|---|
| DINOv2 fp16 d'origine (0,42 / 0,14) | 79,65 % | 1 | 0,966 % | 84,6 % |
| **Affiné (0,40 / 0,14)** | **83,82 %** | 1 | 0,966 % | **89,2 %** |
| Affiné, IA seule (pour information) | 79,0 % | — | 0,82 % | 100 % (65 / 65) |

Banc de bout en bout : 1 000 scènes, 173 vraies photos (dont celles de la
collecte), et grilles de 200 cartes.

| | Actuel 320 | Affiné 320 | Actuel 416 | Affiné 416 |
|---|---|---|---|---|
| Simulées justes | 5 653 | **5 883** (+3,3 pts) | 5 969 | **6 138** (+2,5 pts) |
| Simulées, acceptées à tort | 6 | **4** | 3 | **2** |
| dont groupes jamais vus | 81,6 % | **84,9 %** | 85,9 % | **88,3 %** |
| Vraies photos (173) | 147 | **155** | 145 | **153** |
| Grilles réelles (200 cartes) | 129 | **137** | 131 | **141** |

Sur les vraies photos, la seule « acceptée à tort », avec les deux modèles,
est une erreur d'étiquette : la photo est rangée sous OGN-121 alors qu'elle
montre UNL-141. La carte « hors liste » d'une grille, le Moine ardent, est
bien sur la photo. Ces deux étiquettes sont à corriger après vérification
par l'utilisateur.

Images sans carte (447 textures et objets, sans YOLO) : 10 acceptées avec le
modèle affiné aux seuils 0,36 / 0,14, contre 8 avec le modèle d'origine. Ce
sont surtout des runes et des cartes à aplats de couleur, que la cascade
accepte aux couleurs seules ; une protection est prévue.

Les poids, le découpage, le journal d'entraînement et les exports sont dans
`sauvegarde-modeles/dinov2s-affine-2026-11-14/`. L'ancien `dinov2s-fp16.onnx`
est dans `sauvegarde-modeles/essais/`.

# Cascade, orientation des photos, seuil de détection (2026-11-14, après l'affinage)

## α et nombre de candidats : α 0,5, K 300 (adopté)

Banc de reconnaissance (4 224 photos simulées, 65 réelles, une image IA, seuils
calibrés à ≤ 0,966 % hors catalogue) :

| Réglage | Simulées justes | Fausses | Réelles |
|---|---|---|---|
| α 0,5, K 100 (avant) | 83,82 % | 1 | 58/65 |
| **α 0,5, K 300** | **84,69 %** | 1 | 58/65 |
| α 0,7, K 100 | 83,72 % | 1 | 58/65 |
| α 0,3 ou 0,85, K 30 à 300 | 81,8 à 83,1 % | 1 à 2 | 58-59/65 |

Seuils Prudent 0,36 / 0,13 ; Rapide −0,2 / 0,06. De bout en bout (1 000
scènes, 173 vraies photos, grilles de 200 cartes) : simulées 5 883 → 5 923
(320 px) et 6 138 → 6 172 (416 px), fausses inchangées (4 et 2), vraies photos
155 → 155 et 153 → 154, grilles inchangées (137 et 141).

## Accord couleurs + IA (`cascade.agree`) : non adopté

Quand les couleurs sont sûres, l'IA doit aussi classer la même illustration en
tête parmi les K candidats, sinon la fusion décide (option du catalogue, code
dans `cardMatcher.js`, banc `--agree`).
- Images sans carte (447) : 10 → 6 acceptées.
- Banc de reconnaissance : 84,90 % justes, 0 fausse, 0,80 % hors catalogue.
- Mais de bout en bout : simulées 5 923 → 5 655 (320) et 6 172 → 5 879 (416),
  soit −4 points. Les vraies photos et les grilles ne perdent rien.
- Coût : l'IA tourne à chaque scan.

## Orientation EXIF

L'appli (image du navigateur, orientation appliquée par Chromium), le module de
collecte (`stripJpegMetadata` garde l'orientation) et les bancs
(`sharp().rotate()`) appliquent tous l'orientation EXIF. Elle ne corrige
**aucune** grille : les grilles du 14/11 portent l'orientation 6 (portrait),
décidée par le téléphone posé à plat, et les cartes y sont couchées après
application. Sans EXIF, elles auraient été droites.

## Réessai tourné en mode photo (adopté, règle « switch »)

`yoloDetector.detectPhoto` : si la photo droite trouve peu de cartes (aucune,
ou des cartes couvrant moins de 60 % de l'image, `yoloCore.fewCards`), YOLO
repasse sur l'image tournée de 90, 180 et 270°. Les cartes droites sont
gardées, sauf si une orientation tournée en trouve nettement plus (au moins 2
de plus et 1,5 fois plus) : on prend alors toutes ses cartes.

| Règle de fusion (416 px) | Grilles (200) | Simulées (6 897) | Faux cadres / scène |
|---|---|---|---|
| sans réessai | 141 | 6 138 | 0,001 |
| **switch (appli)** | **170** | **6 138** | 0,002 |
| best : la meilleure + ajouts | 186 | 6 102 | 0,048 |
| upright : droite + ajouts / remplacements | 186 | 6 112 | 0,032 |
| nms : la plus sûre par emplacement | 186 | 6 095 | 0,032 |

Vraies photos : 153 dans tous les cas (156 en essayant toujours les 4
orientations, avec les règles qui fusionnent). Les règles qui mélangent les
orientations gagnent sur les grilles mais montrent à YOLO des cartes
simulées tournées à des angles jamais appris (faux cadres, coins moins
précis) : c'est le réentraînement qui doit apporter le reste.

Coût : 3 passages YOLO de plus sur les photos à petites cartes.

Les cartes restantes : sur `20261114_121331_l1ed`, la carte « Permutation »
(SFD-145) est sur la photo mais la liste donne UNL-192 (à vérifier).

## Seuil de détection 0,25 : non adopté

Grilles : 141 → 146 cartes. Images sans carte (447) : cadres détectés 1 → 3
(320 px) et 2 → 5 (416 px), aucun accepté comme carte. La règle était
« aucune carte de plus » sur ces images.

## Réentraînement de YOLO (en préparation)

`model/data_creator.py` ajoute : image entière tournée de 90, 180 ou 270°
(60 %), photos 4:3 / 3:4 (60 %), grilles aux orientations mélangées (35 %),
cartes isolées à l'envers (15 %), gros plans plus fréquents (30 %) et plus
grands (80 à 97 % de la hauteur, recadrés en portrait 3:4 dans 80 % des cas).
Chaque carte garde ses propres coins (indice 0 = haut-gauche de la carte).
Jeu : `RB_DATASET_DIR=model/dataset-rot`. `model/train.py` accepte
`--weights` (partir du best.pt du modèle livré), `--imgsz`, `--epochs`,
`--batch` et `--lr0`. Le banc accepte `--rotate 90|180|270` (vraies photos et
grilles tournées) pour mesurer les cartes tournées. Règle d'adoption : au
moins aussi bien que l'actuel sur les vraies cartes seules, mieux sur les
grilles et les cartes tournées.

## Bancs plus rapides

`engineBench` calcule le score et la marge de chaque photo une seule fois,
puis teste les 3 660 couples de seuils par simples comparaisons. Résultat
identique à l'ancien calcul (`--check-calibration`), qui prenait environ 1 h
sur un seul cœur pour 30 réglages.

## Bancs en paquets, DirectML (2026-11-14)

- `node scripts/eval-detector-par.mjs --jobs N [options d'eval:detector]` :
  N parties côte à côte (`--shard k/N`), cœurs répartis (`--cores`), résultats
  additionnés. Identique à un seul banc (100 scènes : 571/639, 154/173,
  146/200), en 238 s au lieu de 722 s avec 4 parties.
- `--ep dml` : ONNX Runtime sur la carte graphique (DirectML), pour les essais
  exploratoires seulement (565 s au lieu de 722 s, mêmes résultats à une carte
  près) : le banc passe surtout son temps hors des modèles. Mesures finales sur
  CPU, comme le téléphone.

Référence du YOLO actuel sur les vraies photos et grilles tournées (`--rotate`,
sans réessai), vraies photos 320 / 416, grilles 320 / 416 :
0° 155 / 154, 143 / 146 ; 90° 128 / 122, 59 / 71 ; 180° 89 / 108, 59 / 75 ;
270° 93 / 89, 132 / 143 (à 270°, les grilles prises à plat redeviennent
droites).

Entraînements lancés le 2026-11-14 sur `model/dataset-rot` (32 480 images
d'entraînement, 5 496 de validation) :
- `rot-ft` : depuis le best.pt du modèle rejeté (le best.pt de Modal n'existe
  plus), 40 époques, SGD lr0 0,002, lot 17 (45 % de la mémoire) ;
- `rot-scratch` : depuis yolo11s-pose.pt, 80 époques, lot 16.
Les deux en même temps : carte graphique à 60-90 %, 10,9 Go sur 12.

## rot-ft arrêté, diagnostic, modèle livré reconstruit (2026-11-14)

**rot-ft** (depuis le modèle rejeté, 416 px), époque 20 : grilles 146 → 180,
mais vraies photos 155 → 117 (320) et 154 → 111 (416), toutes détectées : coins
décalés de 1,26 % de la diagonale (haut vers l'extérieur, bas resserré), le
défaut du modèle rejeté. Arrêté. rot-scratch abandonné (poids dans
`sauvegarde-modeles/rot-scratch-abandonne-2026-11-14/`).

**Générateur hors de cause** :
- étiquettes contrôlées sur une carte blanche unie : 0,33 % du vrai coin en
  moyenne, avant comme après recadrage 3:4 et rotations ;
- proportions largeur / hauteur : catalogue 0,7161, vraie carte 63 × 88 mm
  0,7159, étiquettes ancien générateur 0,7097, nouveau 0,7105 (perspective) ;
  le modèle actuel retrouve 0,708 et 0,710 sur ces jeux ; sur les vraies
  photos, ses cartes redressées font 0,737 (photos un peu en biais) ;
- le modèle actuel colle aux étiquettes de l'ancien jeu (< 0,4 % en 416,
  < 0,1 % en 768).

**Modèle livré reconstruit en PyTorch** (`model/onnx_to_pt.py`) : le best.pt de
Modal est perdu, l'ONNX 768 contient les poids. Chaque convolution reprend le
poids fusionné ; sa normalisation est neutralisée (échelle 1, moyenne 0,
variance 1 − eps, biais fusionné). Piège : le modèle livré (Ultralytics 8.4.59)
a un SPPF dont la première convolution n'a **pas d'activation** ; Ultralytics
8.4.211 remet SiLU pour la ligne courte `[1024, 5]`. La ligne complète
`[1024, 5, 3, False]` le garde sans activation. Sorties identiques à l'ONNX
(écart ≤ 0,006 px), et réexporté en 416 il redonne 154 / 173 et 146 / 200. Le
SPPF reste sans activation à l'export. Ultralytics figé en 8.4.211
(`requirements-train.txt`). Note : le modèle rejeté et rot-ft avaient le SPPF
avec SiLU.

**rot768** : depuis le modèle reconstruit
(`sauvegarde-modeles/detecteur-768/yolo11s-pose-riftbound-768-reconstruit.pt`),
768 px, multi-échelle 0,25, SGD lr0 0,002, sans échauffement fort des biais,
40 époques. Toutes les 5 époques : écart des coins avec le modèle actuel et
vraies photos à 0° reconnues ; arrêt si l'écart dépasse 0,5 % en hausse ET
les vraies photos tombent à 149 ou moins (`controles.log` dans
`sauvegarde-modeles/yolo-rot768-2026-11-15/`).

Contrôles (modèle actuel : vraies photos 154 / 173, grilles 146 / 200) :

| Époque | Écart des coins | Vraies photos 0° | Grilles |
|---|---|---|---|
| 5 | 1,84 % | 87 / 173 | 173 / 200 |
| 10 | 1,35 % | 121 / 173 | 179 / 200 |

Creux au début puis remontée : écart en baisse, vraies photos +34, grilles en
hausse. **En pause après l'époque 11** (2026-11-15, 00 h 45) : `last.pt`,
`best.pt`, `results.csv`, `watch768.sh` et `cornerdiff.mjs` copiés dans
`sauvegarde-modeles/yolo-rot768-2026-11-15/pause/`, poids de l'époque 10 dans
`epoch10/`. Reprise : `model/train.py` avec `resume=True` sur
`model/runs/rot768/weights/last.pt` (même jeu `RB_DATASET_DIR=model/dataset-rot`),
puis relancer le surveillant (`watch768.sh 10 1.35`). Encore 29 époques
(≈ 3 h 30). À la fin : banc complet des époques 30, 40 et best.pt, règle
habituelle.

**Reprise le 2026-11-15** (époque 12). Étiquettes corrigées par l'utilisateur :
`h02p` → UNL-141, grille `laii` : OGS-006 → OGN-167. Nouvelle référence du
modèle actuel en 416 : vraies photos **155 / 173**, grilles **151 / 200** ;
l'époque 10 fait 121 et 181. Surveillant : arrêt si vraies photos ≤ 150.

## Coins hors de l'image sur les vraies photos (2026-11-15)

Sur les 173 vraies photos, le modèle actuel place au moins un coin **hors de
l'image** pour 95 d'entre elles (cartes cadrées serré, 66 à 85 % de l'image),
à moins de 1 % du bord pour 14, et tous dedans pour 64.

| Coins | Photos | Actuel | rot768 ép. 10 |
|---|---|---|---|
| un coin dehors | 95 | 80 | 59 |
| un coin au bord | 14 | 14 | 12 |
| tous dedans | 64 | 61 | 50 |

- Le générateur refuse toute carte dont un coin sort de l'image (depuis le
  premier jeu, donc aussi pour le modèle livré) : **aucune image
  d'entraînement ne montre ce cas**, alors qu'il concerne 55 % des vraies
  photos. Le modèle actuel extrapole quand même ces coins, mais rate 16 % de
  ces photos contre 5 % des autres.
- Ultralytics refuse les étiquettes hors de [0, 1] et ne corrige pas un coin
  sorti de l'image (visibilité 0) : pour apprendre ce cas, il faudra des gros
  plans qui débordent, avec les coins dehors acceptés et appris.
- rot768 perd des photos dans les deux groupes (refus, pas d'erreurs) : le
  problème ne se limite pas aux coins cachés.
- L'écart des coins avec le modèle actuel n'est pas une vérité sur ces
  photos : le modèle actuel y devine aussi.
- `eval-detector --dump` écrit maintenant le nom de la photo et les coins
  pour les vraies photos.

### Coins sortis de l'image par les augmentations (Ultralytics 8.4.211)

Avec `kpt_shape [4, 2]`, à la lecture des étiquettes chaque coin reçoit une
visibilité (1 s'il est dans l'image ; une étiquette hors de [−0,01 ; 1,01]
fait rejeter l'image). Après la mosaïque, l'échelle, la translation et la
rotation, un coin sorti de l'image passe à **visibilité 0 puis est ramené au
bord** (`Instances.clip`, `RandomPerspective.apply_keypoints`). La perte des
coins ne compte que les coins visibles (`kpt_mask = visibilité ≠ 0`) : le coin
caché est **ignoré**, les coins visibles de la même carte pèsent plus. La
carte reste (son cadre est rogné à la partie visible).

Comptage sur 600 images tirées au hasard, réglages de rot768 (mosaïque 1,
échelle 0,5, translation 0,1, rotation 3°, mixup 0,2 ; `model/hidden_keypoints.py`,
processeur seulement) :

| Jeu | Mosaïque | Cartes avec ≥ 1 coin caché | Par époque |
|---|---|---|---|
| nouveau (`dataset-rot`) | oui (ép. 1–25) | 39,7 % | ≈ 130 000 / 327 000 |
| nouveau | non (ép. 26–40) | 21,3 % | ≈ 38 000 / 180 000 |
| ancien (`dataset`) | oui | 40,4 % | ≈ 131 000 / 323 000 |
| ancien | non | 22,3 % | ≈ 46 000 / 204 000 |

Les deux jeux sont pareils : le modèle voit beaucoup de cartes coupées, mais
n'apprend jamais où sont leurs coins cachés.

### Marge grise autour des vraies photos (modèle actuel, 416 px)

`eval-detector --pad 0.05` : marge grise (114) de 5 % de la largeur / hauteur
de chaque côté avant la détection, coins ramenés dans la photo.

| Marge | Vraies photos | coin hors image (95) | collé au bord (14) | 4 coins visibles (64) | Grilles |
|---|---|---|---|---|---|
| 0 | 155 | 80 | 14 | 61 | 151 |
| 5 % | 157 | 82 | 14 | 61 | 159 |
| 10 % | 156 | 81 | 14 | 61 | 148 |
| 15 % | 156 | 81 | 14 | 61 | 149 |

## Vraies photos : pochettes, inclinaison, coins dehors, flou (2026-11-15)

Coins du modèle actuel (416 px) sur les 173 vraies photos ; rot768 = époque 10.

**Pochettes.** Le générateur (`apply_sleeve_overlay`, 30 % des cartes) peint
une bande colorée de 1,2 à 3 % **sur** le bord de l'image de la carte : les
coins étiquetés sont ceux de la carte, confondus avec le bord extérieur de la
pochette, et la carte ne dépasse jamais. Une vraie pochette est plus grande
que la carte, dont le bord noir reste visible à l'intérieur. Classement des
vraies photos par la couleur du bord : 73 sans pochette, 81 bleues, 19 rouges.

| Pochette | Photos | Actuel | rot768 ép. 10 | Bord extérieur de la pochette | Bord noir de la carte |
|---|---|---|---|---|---|
| sans | 73 | **73** | 61 | — | +0,3 % / −0,3 % |
| bleue | 81 | 68 | 53 | −0,8 % / −1,7 % | +1,3 % / +0,8 % |
| rouge | 19 | **14** | 7 | −1,7 % / −2,8 % | +1,3 % / +0,8 % |

(position par rapport aux bords du modèle, en % de la largeur de la carte,
actuel / rot768 ; + = à l'intérieur). Tous les échecs du modèle actuel sont
sous pochette. Ses bords tombent dans la bande de la pochette, entre son bord
extérieur et la carte ; rot768 les pousse plus vers l'extérieur. Sans pochette,
coin dehors ou pas, le modèle actuel reconnaît tout (41 / 41, 11 / 11, 21 / 21).
Réserve : les photos sous pochette ne couvrent que 29 cartes différentes.

**Inclinaison.** Largeur du haut / largeur du bas, 4 coins visibles (64
photos) : déciles 10/25/50/75/90 = 0,79 / 0,80 / 0,82 / 0,85 / 0,86, le haut
toujours plus étroit (64 / 64). Générateur, cartes droites (nouveau jeu,
11 467) : 0,95 / 1,00 / 1,00 / 1,00 / 1,05, symétrique (perspective de 0 à
10 % par coin, au hasard) ; ancien jeu pareil. Rapport 0,82 jamais atteint.

**Coins dehors.** 78 photos sans, 71 avec 1 coin (BD 59, BG 11, HG 1), 23 avec
2 (BD + BG, tout le bas), 1 avec 3 (HG + BD + BG). Le bas de la carte sort du
cadre, comme le veut l'inclinaison.

**Flou.** Le générateur ne fait que du flou global (gaussien 3 à 7 px, 25 % ;
de bougé, 5 %), jamais partiel. Filtre de netteté de l'appli (variance du
laplacien du 64 × 64, seuil 100) : 0 photo rejetée, minimum 838 (toutes les
moins nettes sont sous pochette bleue). Moitié haute / basse de la carte
redressée : une moitié 2 fois plus nette que l'autre sur 46 photos (bas plus
net : 34), dont 40 sous pochette (reflets du plastique) ; gros plans du
générateur : bas 2 fois plus net sur 9 % (contenu de la carte).

**Correction (2026-11-15)** : les premiers comptes par groupe comparaient les
codes de carte au lieu des illustrations (une réimpression comptait comme
fausse) ; tableaux ci-dessus corrigés. Modèle actuel : coin dehors 80 / 95,
collé au bord 14 / 14, visibles 61 / 64 ; pochettes sans 73 / 73, bleue
68 / 81, rouge 14 / 19. La marge de 5 % gagne 2 photos sous pochette rouge.

## Cadre resserré, deux cadrages (modèle actuel, 416 px)

`eval-detector --shrink s` : chaque bord du cadre rentré de s × largeur de la
carte avant la reconnaissance ; `--two-crops s` : cadre normal et cadre
resserré, le meilleur score gardé.

| Resserrement | Sans (73) | Bleue (81) | Rouge (19) | Total | Grilles justes / top-1 (169 cadres) |
|---|---|---|---|---|---|
| 0 | 73 / 73 | 68 / 69 | 14 / 19 | 155 / 161 | 151 / 153 |
| 0,5 % | 73 / 73 | 68 / 70 | 14 / 19 | 155 / 162 | 151 / 153 |
| 1 % | 73 / 73 | 67 / 70 | 13 / 19 | 153 / 162 | 148 / 151 |
| 1,5 % | 73 / 73 | 66 / 71 | 13 / 19 | 152 / 163 | 144 / 149 |
| 2 % | 72 / 72 | 66 / 71 | 13 / 19 | 151 / 162 | 143 / 148 |
| 2,5 % | 69 / 70 | 60 / 64 | 12 / 19 | 141 / 153 | 144 / 149 |

(reconnues / top-1 juste sans seuils). Resserrer n'aide pas : le top-1 gagne
1 ou 2 photos bleues, les acceptées baissent.

**Pochettes rouges** (19) : 10 runes, 8 champs de bataille, 1 légende. Les 5
échecs du modèle actuel (2 runes, 3 champs de bataille) sont des refus avec le
bon top-1, tous avec un coin hors image.

**Deux cadrages** (normal + resserré de 0,5 %, meilleur score gardé), 1 000
scènes simulées (6 897 cartes) :

| | Simulées justes | Acceptées à tort | Hors catalogue acceptées* | Vraies | Grilles |
|---|---|---|---|---|---|
| normal | 6 172 | 2 | 33 (0,48 %) | 155 | 151 |
| deux cadrages | 6 207 | 3 | 35 (0,51 %) | 155 | 151 |

\* l'illustration juste retirée des 5 premiers candidats, mêmes seuils
(approximation). +35 cartes simulées, rien sur les vraies photos ni les
grilles, une fausse et deux hors catalogue de plus ; reconnaissance deux fois
plus longue pour les cartes passées par l'IA.

## Plan du générateur v3 (non lancé, `model/generator_preview.py`)

1. **Pochettes réelles** (45 % des cartes au lieu de 30 %, 58 % des vraies
   photos en ont) : pochette plus grande que la carte (2 à 4 % de la largeur
   par côté, 0 à 1,2 % de plus en haut), coins arrondis ; opaque colorée 55 %
   (bleu, rouge, noir, vert, violet, blanc, jaune), translucide 25 %,
   transparente 20 % ; voile du plastique 0 à 8 %, reflet en bande 70 %, liseré
   clair du bord. La carte est posée dedans, son bord noir visible. **Coins
   étiquetés : ceux de la carte.** Remplace `apply_sleeve_overlay`.
2. **Téléphone incliné** (60 % des cartes seules et gros plans) : haut / bas
   0,75 à 0,90, écrasement vertical 0 à 10 %, appliqué à la carte et sa
   pochette ; la perspective symétrique actuelle reste pour le reste.
3. **Bas coupé** (35 % des gros plans) : le bas de la carte dépasse du cadre
   de 2 à 9 % de sa hauteur. Ultralytics refuse les étiquettes hors de [0, 1]
   et ignore les coins sortis : il faut, dans `train.py` (pas dans le paquet),
   accepter les coins jusqu'à 15 % hors de l'image et les garder dans la perte.
   Sans cela, ces images ne peuvent pas apprendre les coins cachés. **À
   décider.**
4. Régénération du jeu, puis entraînement depuis le modèle livré reconstruit
   (768 px), surveillant par groupes de coins et par pochette ; même règle
   d'adoption.

## rot768 arrêté à mi-parcours (époque 20, 2026-11-15)

Contrôles (modèle actuel : vraies 155, grilles 151) : ép. 15 vraies 124,
grilles 182, écart 1,16 % ; ép. 20 vraies **131**, grilles 180, écart 1,14 %.
Règle de mi-parcours : 24 photos de moins que l'actuel (≥ 5) → arrêt. Poids
de l'époque 20 dans `sauvegarde-modeles/yolo-rot768-2026-11-15/epoch20/`.

Banc complet sur processeur, 416 px (sans réessai tourné) :

| | Actuel | rot768 ép. 20 |
|---|---|---|
| Scènes simulées justes (6 897) | 6 172 (fausses 2) | 6 030 (fausses 4) |
| Erreur des coins, scènes | 0,74 % | 1,23 % |
| Vraies photos 0° / 90° / 180° / 270° | 155 / 122 / 108 / 89 | 131 / 58 / 75 / 86 |
| Grilles 0° / 90° / 180° / 270° | 151 / 74 / 69 / 143 | 180 / 156 / 161 / 182 |
| Coin hors image / au bord / visibles | 80 / 14 / 61 | 69 / 10 / 52 |
| Pochette sans / bleue / rouge | 73 / 68 / 14 | 62 / 54 / 15 |

Les grilles, toutes orientations, progressent nettement ; les gros plans
reculent partout, y compris tournés (90° : 122 → 58).

**14 photos sans pochette perdues à l'époque 15** : coins à 2 à 5 % de la
largeur de la carte de ceux du modèle actuel (à l'œil, presque superposés).
Avec les coins de l'actuel, les couleurs sont sûres (score 0,68 à 0,84) ; avec
ceux de rot768, elles ne le sont plus, l'IA prend le relais avec la découpe de
la mauvaise carte des couleurs et tombe à 0,29 à 0,40 (top-1 juste : 3 / 14,
les autres sur des cartes « fourre-tout » comme `sfd-239-star`, `ogn-160`).
La reconnaissance est très sensible à quelques % de décalage des coins.

## Témoin `rot768-temoin` (en cours)

Même départ (modèle livré reconstruit) et mêmes réglages que rot768 (768 px,
multi-échelle 0,25, SGD lr0 0,002, 40 époques prévues pour le même calendrier
du taux d'apprentissage et de la mosaïque), sur l'**ancien jeu** `model/dataset`
(généré le 13/11, générateur d'avant `aa305c6`) ; arrêté après l'époque 10.
Contrôles aux époques 5 et 10 (groupes de coins et de pochettes).

## Séries caméra du 15/11 (50 photos, `model/real-photos-1115/`, hors des 173)

Cinq séries de 10 (à plat sans pochette, pochette bleue, pochette bleue sans
reflet, téléphone incliné, serré bas coupé). Appli (export) : bonne carte en
tête 9 / 9 / 10 / 5 / 10. Au banc en 320 px avec la découpe en vraie
perspective : 10 / 10 / 10 / 10 / 10 (acceptées 10 / 10 / 10 / 10 / 9).

**La différence est la découpe du mode caméra.** Le mode caméra (scan auto,
`useCardDetection` → `detector.cropCard`, et la collecte en image caméra)
découpe la carte avec `yoloDetector._cropPerspective` : 48 bandes
horizontales, chacune une transformation affine, donc une interpolation
linéaire entre les bords. Sur une carte vue en biais, la perspective tasse le
haut (plus loin) ; les bandes réparties régulièrement ne le corrigent pas et
l'illustration glisse vers le bas. Le mode photo utilise `warpQuadToPortrait`
(vraie perspective). Rejeu des 10 photos inclinées avec le code de l'appli
(Electron, modules de `src/`, coins du détecteur de l'appli) et au banc :

| | Coins appli vs banc | Découpe par bandes (appli et banc) | Vraie perspective (appli et banc) |
|---|---|---|---|
| top-1 juste | 0,6 à 4,3 px | 6 / 10 | 10 / 10 |
| acceptées | | 3 / 10 (scores 0,32 à 0,76) | 10 / 10 (0,74 à 0,97) |

Les résultats de l'appli et du banc sont identiques à chaque étape ; ils ne
divergent qu'à la découpe. Banc avec `--crop app` (imitation des bandes) sur les
50 photos : top-1 9 / 9 / 10 / 6 / 10, comme l'appli. Série inclinée :
largeur de la carte à l'entrée du détecteur 152 px (320), 196 (416), 358 (768) ;
haut / bas 0,75. Avec les bandes, top-1 6 / 7 / 7 en 320 / 416 / 768 ; avec la
vraie perspective, 10 / 10 / 10.

## Sensibilité de la reconnaissance aux coins (2026-11-15)

`scripts/eval-recognition.mjs` rejoue la reconnaissance sur des coins figés
(détection seule : `eval-detector --no-identify --dump`), avec aussi le cas
« carte hors catalogue » (l'illustration juste retirée) ;
`scripts/recognition-report.mjs` recalibre les seuils de chaque mode sur les
scènes simulées (hors catalogue ≤ 1 %, fausses ≤ 0,5 %).

Coins du modèle actuel décalés au hasard (vraies photos + séries, 223 photos ;
top-1 / acceptées, seuils de l'appli) :

| Décalage | Couleurs | IA seule | Cascade (appli) | Variante A |
|---|---|---|---|---|
| 0 % | 196 / 169 | 223 / 221 | 211 / 204 | 223 / 221 |
| 2 % | 189 / 146 | 223 / 221 | 203 / 195 | 223 / 221 |
| 3 % | 177 / 135 | 223 / 222 | 192 / 183 | 223 / 220 |
| 5 % | 152 / 92 | 223 / 222 | 176 / 165 | 222 / 215 |

Avec les coins de rot768 ép. 20 : cascade 182 / 173 à 0 %, variante A 223 / 218.
Les couleurs sont très sensibles aux coins ; l'IA sur ses 3 découpages et les
2 sens ne l'est presque pas. La cascade dépend des couleurs deux fois : leur
décision « sûre » et le découpage de leur meilleure carte donné à l'IA.

### Variantes (seuils recalibrés, 400 scènes = 2 857 cartes simulées)

Variante A : couleurs sûres → couleurs ; sinon l'IA sur les 3 découpages et
les 2 sens, fusionnée sur tout le catalogue. Aai : idem, IA seule. B : les
couleurs sur 9 cadrages (±2 % de décalage, ±2 % de taille, ±2 % de hauteur),
le meilleur gardé, puis la cascade. C : deuxième passage du détecteur
(recadrage à 15 % de marge, 320 px). N : passage simple.


### actuel N  (simulées 2857, vraies 173, grilles 502 cadres, séries 50)
| mode | seuils | simulées justes / fausses / hors cat. | vraies (top-1) | coin dehors / bord / visibles | pochette sans / bleue / rouge | grilles 0° / 90° / 180° / 270° (top-1 0°) | séries 1-5 (top-1) | IA utilisée |
|---|---|---|---|---|---|---|---|---|
| colours | 0.665 / 0.09 | 2452 / 3 / 0.98 % | 125 (147) | 58/95 · 13/14 · 54/64 | 67/73 · 52/81 · 6/19 | 122 / 49 / 49 / 109 (145) | 10 · 9 · 10 · 10 · 8 (10 · 10 · 10 · 10 · 9) | — |
| ai | 0.47 / 0.115 | 1299 / 4 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 165 / 87 / 76 / 152 (167) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 100 % |
| cascade | 0 / 0.12 | 2571 / 0 / 0.98 % | 155 (161) | 80/95 · 14/14 · 61/64 | 73/73 · 68/81 · 14/19 | 151 / 74 / 69 / 143 (153) | 10 · 10 · 10 · 10 · 9 (10 · 10 · 10 · 10 · 10) | 19 % |
| A | 0.455 / 0.11 | 2580 / 0 / 0.98 % | 171 (173) | 93/95 · 14/14 · 64/64 | 73/73 · 79/81 · 19/19 | 161 / 88 / 74 / 152 (166) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 19 % |
| Aai | 0.495 / 0.135 | 2487 / 0 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 164 / 87 / 76 / 153 (166) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 19 % |
| B | 0.43 / 0.12 | 2548 / 1 / 0.98 % | 158 (160) | 85/95 · 13/14 · 60/64 | 73/73 · 66/81 · 19/19 | 149 / 79 / 69 / 142 (154) | 10 · 10 · 10 · 10 · 9 (10 · 10 · 10 · 10 · 10) | 19 % |

### actuel C  (simulées 2855, vraies 173, grilles 502 cadres, séries 50)
| mode | seuils | simulées justes / fausses / hors cat. | vraies (top-1) | coin dehors / bord / visibles | pochette sans / bleue / rouge | grilles 0° / 90° / 180° / 270° (top-1 0°) | séries 1-5 (top-1) | IA utilisée |
|---|---|---|---|---|---|---|---|---|
| colours | 0.645 / 0.095 | 2465 / 2 / 0.91 % | 130 (150) | 63/95 · 13/14 · 54/64 | 68/73 · 56/81 · 6/19 | 124 / 61 / 55 / 116 (143) | 10 · 10 · 8 · 10 · 9 (10 · 10 · 10 · 10 · 9) | — |
| ai | 0.45 / 0.13 | 1287 / 5 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 162 / 84 / 78 / 154 (167) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 100 % |
| cascade | 0 / 0.13 | 2577 / 1 / 0.91 % | 155 (161) | 80/95 · 14/14 · 61/64 | 73/73 · 67/81 · 15/19 | 150 / 76 / 74 / 141 (155) | 10 · 10 · 10 · 10 · 9 (10 · 10 · 10 · 10 · 10) | 18 % |
| A | 0.445 / 0.11 | 2598 / 1 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 160 / 87 / 77 / 152 (164) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 18 % |
| Aai | 0 / 0.165 | 2498 / 1 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 162 / 84 / 79 / 154 (167) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 18 % |

### ép.20 N  (simulées 2855, vraies 173, grilles 800 cadres, séries 50)
| mode | seuils | simulées justes / fausses / hors cat. | vraies (top-1) | coin dehors / bord / visibles | pochette sans / bleue / rouge | grilles 0° / 90° / 180° / 270° (top-1 0°) | séries 1-5 (top-1) | IA utilisée |
|---|---|---|---|---|---|---|---|---|
| colours | 0.66 / 0.09 | 2343 / 1 / 0.98 % | 75 (121) | 31/95 · 7/14 · 37/64 | 34/73 · 36/81 · 5/19 | 130 / 109 / 98 / 129 (174) | 8 · 5 · 7 · 5 · 6 (9 · 7 · 9 · 7 · 8) | — |
| ai | 0.445 / 0.12 | 1325 / 7 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 197 / 193 / 194 / 196 (199) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 100 % |
| cascade | 0.48 / 0.115 | 2501 / 0 / 0.98 % | 131 (138) | 68/95 · 10/14 · 53/64 | 62/73 · 54/81 · 15/19 | 180 / 156 / 161 / 182 (182) | 9 · 7 · 10 · 8 · 9 (9 · 8 · 10 · 8 · 9) | 26 % |
| A | 0.45 / 0.12 | 2512 / 0 / 0.98 % | 169 (173) | 92/95 · 14/14 · 63/64 | 73/73 · 77/81 · 19/19 | 197 / 194 / 197 / 198 (199) | 10 · 10 · 10 · 10 · 9 (10 · 10 · 10 · 10 · 10) | 26 % |
| Aai | 0.53 / 0.15 | 2379 / 0 / 0.98 % | 170 (173) | 93/95 · 14/14 · 63/64 | 73/73 · 78/81 · 19/19 | 196 / 194 / 195 / 195 (199) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 26 % |
| B | 0.45 / 0.12 | 2532 / 0 / 0.98 % | 151 (153) | 79/95 · 14/14 · 58/64 | 73/73 · 61/81 · 17/19 | 185 / 175 / 181 / 187 (188) | 10 · 9 · 10 · 10 · 8 (10 · 9 · 10 · 10 · 9) | 22 % |

### ép.20 C  (simulées 2854, vraies 173, grilles 800 cadres, séries 50)
| mode | seuils | simulées justes / fausses / hors cat. | vraies (top-1) | coin dehors / bord / visibles | pochette sans / bleue / rouge | grilles 0° / 90° / 180° / 270° (top-1 0°) | séries 1-5 (top-1) | IA utilisée |
|---|---|---|---|---|---|---|---|---|
| colours | 0.655 / 0.09 | 2376 / 2 / 0.98 % | 46 (106) | 11/95 · 7/14 · 28/64 | 24/73 · 20/81 · 2/19 | 140 / 119 / 113 / 125 (177) | 9 · 7 · 9 · 3 · 5 (10 · 10 · 10 · 8 · 9) | — |
| ai | 0.475 / 0.13 | 1224 / 3 / 0.98 % | 172 (173) | 94/95 · 14/14 · 64/64 | 73/73 · 80/81 · 19/19 | 195 / 193 / 194 / 196 (199) | 10 · 10 · 10 · 10 · 10 (10 · 10 · 10 · 10 · 10) | 100 % |
| cascade | 0 / 0.125 | 2519 / 2 / 0.98 % | 120 (126) | 54/95 · 13/14 · 53/64 | 58/73 · 49/81 · 13/19 | 183 / 168 / 168 / 176 (183) | 10 · 10 · 10 · 8 · 9 (10 · 10 · 10 · 8 · 9) | 26 % |
| A | 0.47 / 0.11 | 2539 / 2 / 0.98 % | 169 (173) | 92/95 · 14/14 · 63/64 | 73/73 · 77/81 · 19/19 | 196 / 196 / 197 / 196 (199) | 10 · 10 · 10 · 10 · 9 (10 · 10 · 10 · 10 · 10) | 26 % |
| Aai | 0 / 0.165 | 2413 / 3 / 0.98 % | 171 (173) | 93/95 · 14/14 · 64/64 | 73/73 · 79/81 · 19/19 | 196 / 192 / 193 / 193 (199) | 10 · 10 · 10 · 9 · 10 (10 · 10 · 10 · 10 · 10) | 26 % |

Hors catalogue acceptées sur les vraies photos (223, illustration retirée) :
cascade 0, A 0, B 0 ; IA seule 7 (3,1 %), Aai 4 (1,8 %).

**Temps** (processeur du PC, 4 cœurs par banc) : couleurs 61 ms, IA 1 image
131 ms, IA 6 images (3 découpages × 2 sens) 488 ms. La variante A ajoute
≈ 360 ms aux cartes où les couleurs ne sont pas sûres : 16 % des cartes
simulées, 24 % des vraies photos (56 % avec les coins de rot768). En moyenne
≈ +60 à +90 ms par carte. Version économique demandée (découpages présents
parmi les 300 candidats des couleurs) : toujours les 3, aucun gain. Avec les
12 meilleurs candidats (Aeco12) : 1,7 découpage en moyenne (≈ 3,4 images au lieu
de 6), mêmes vraies photos (171) et grilles (161), 2 574 simulées au lieu de
2 580. Un seul sens (celui des couleurs, A1v) : 159 vraies photos, le sens
180° compte. Deuxième passage C : +75 ms de détection et +37 ms de recadrage
par carte.

## Modèle reconstruit : normalisations neutralisées (cause de la chute)

Sur 16 images de l'ancien jeu, le modèle reconstruit en mode évaluation et
avec les BatchNorm en mode entraînement (statistiques du lot) : activations
différentes de 100 à 340 %, coins de la meilleure détection décalés de 22 %
de l'image en moyenne (55 % au pire). Ses BatchNorm ont moyenne 0 et
variance 1 : en entraînement elles normalisent avec les vraies statistiques
du lot et le réseau change complètement. Un entraînement part donc d'un modèle
cassé (chute à 87 vraies photos à l'époque 5 de rot768, 125 pour le témoin).

`model/bn_recalibrate.py` mesure les vraies statistiques de chaque
convolution (128 images de l'ancien jeu) et règle chaque BatchNorm pour que
l'évaluation reste identique (écart max 0,005) : en mode entraînement l'écart
des coins tombe à 1,6 % (rot768 ép. 20, réellement entraîné : 5,7 %).
Départ : `sauvegarde-modeles/detecteur-768/yolo11s-pose-riftbound-768-reconstruit-bn.pt`.

**Témoin** (ancien jeu) époque 5 : vraies 125, grilles 136, écart 0,89 %.

**Témoin** époque 10 : vraies 129, grilles 138 (écart 0,75 %) ; arrêté.

### Une époque depuis le départ recalibré

| Départ | Jeu | Vraies (155) | Grilles (151) | Sans / bleue / rouge |
|---|---|---|---|---|
| BN recalibrées | nouveau (`dataset-rot`) | **87** | 141 | 44 / 42 / 1 |
| BN recalibrées | ancien (`dataset`) | **154** | 150 | 73 / 67 / 14 |

Statistiques des BN seules mises à jour (150 lots augmentés, aucun poids
modifié) : 151 vraies photos avec mosaïque, 153 sans — effet faible.

**Deuxième cause : l'ordre des coins du nouveau jeu.** Sans trier les coins,
le modèle livré numérote les coins dans l'ordre de l'image : sur l'ancien jeu,
son coin k est le coin k de l'étiquette pour 339 cartes sur 339 (0,6 % de la
diagonale). Le nouveau jeu garde les coins de la carte quand elle est tournée
(son coin haut-gauche reste le n° 1, même à l'envers) : 45 % des cartes ont
leurs coins décalés d'un, deux ou trois rangs, 46 % d'erreur sans tri. Le
premier entraînement doit réapprendre une autre numérotation et la précision
s'effondre. Les mesures précédentes triaient les coins (ordre visuel), ce qui
masquait l'écart. L'appli trie aussi les coins (`warpQuadRGBA`) et compare la
vue retournée à 180° : la numérotation propre à la carte ne lui sert pas.

Deux causes donc : le départ (BN neutralisées : témoin) et la numérotation du
nouveau jeu (rot768, test BN recalibrées). Avec le départ recalibré et la
numérotation d'origine, une époque garde 154 vraies photos.

## Renumérotation des coins du nouveau jeu (2026-11-15)

Erreur des coins du modèle actuel selon l'angle de la carte (validation de
l'ancien jeu, 6 900 cartes, tranches de 10°) : 0,4 à 1 % de la diagonale de
−80° à +80°, aucune carte au-delà de 10 %, **pas de pic** : l'ancien jeu
numérotait les coins de la carte (cartes tournées d'au plus ±75°, 85° avec la
perspective) et le modèle l'a appris tel quel ; il n'y avait pas de bascule.

`model/renumber_corners.py` : |angle du bord coin 1 → coin 2| ≤ 85° →
inchangé (l'ancien jeu passe sans aucun changement, 1 carte sur 193 825) ;
au-delà, décalage par quarts de tour vers l'angle le plus proche de 0°
(l'ordre de l'image). `dataset-rot` : 86 648 cartes inchangées, 34 558 /
42 201 / 33 437 décalées de 1 / 2 / 3 quarts de tour ; étiquettes d'origine
dans `sauvegarde-modeles/dataset-rot-etiquettes-avant-renumerotation/`.
Accord modèle actuel / étiquettes, sans tri : 351 cartes sur 375 (94 %, avant
≈ 50 %), erreur médiane 1,0 %.

Une époque depuis le départ recalibré :

| Jeu | Vraies (155) | Grilles (151) | Sans / bleue / rouge (73 / 68 / 14) | Coin dehors / bord / visibles (80 / 14 / 61) |
|---|---|---|---|---|
| nouveau, numérotation d'origine | 87 | 141 | 44 / 42 / 1 | 44 / 11 / 32 |
| ancien | 154 | 150 | 73 / 67 / 14 | 80 / 14 / 60 |
| **nouveau, renuméroté** | **149** | **177** | 71 / 63 / 15 | 77 / 13 / 59 |

## Applis de test : vraie perspective en caméra, variante A

`src/lib/testFeatures.js` (actif seulement dans « Riftbound Test » et
« Riftbound Scanner Test ») : découpe en vraie perspective en mode caméra
(`warpQuadToPortrait`, comme le mode photo et le banc) et variante A limitée
aux découpages des 12 meilleurs candidats des couleurs, seuils Prudent 0 / 0,115,
Rapide 0,405 / 0,045. Test `tests/cropSame.test.mjs` : même recadrage au pixel
près pour l'appli et le banc sur les mêmes coins. Au banc avec le code de
l'appli (`eval-detector --test-features`) : vraies photos 171 (au lieu de 155),
grilles 161 (au lieu de 151), séries en 320 px 49 / 50.

Variante A (12 candidats), 400 scènes (2 857 cartes), seuils recalibrés :

| | Seuils | Simulées justes / fausses / hors cat. | Vraies | Grilles 0° / 90° / 180° / 270° | Séries |
|---|---|---|---|---|---|
| cascade, Prudent | 0 / 0,12 | 2 571 / 0 / 0,98 % | 155 | 151 / 74 / 69 / 143 | 10 · 10 · 10 · 10 · 9 |
| variante A, Prudent | 0 / 0,115 | 2 574 / 0 / 0,98 % | 171 | 161 / 88 / 74 / 152 | 10 · 10 · 10 · 10 · 9 |
| cascade, Rapide | 0 / 0,055 | 2 651 / 14 / 9,49 % | 158 | 153 / 77 / 70 / 145 | 10 × 5 |
| variante A, Rapide | 0,405 / 0,045 | 2 677 / 9 / 9,66 % | 173 | 164 / 89 / 75 / 156 | 10 × 5 |

(Les grilles tournées de 90° et 180° restent basses : le détecteur actuel n'y
trouve que 92 et 81 cartes sur 200.)

### Pic à 85° (époque d'essai, validation du nouveau jeu)

Erreur des coins selon l'angle physique de la carte (son bord du haut,
étiquettes avant renumérotation), contre les étiquettes renumérotées :

| Angle | Cartes | Sans tri (médiane) | > 10 % | Coins triés (médiane) |
|---|---|---|---|---|
| 70–75° | 49 | 2,1 % | 0 | 2,1 % |
| 75–80° | 44 | 3,4 % | 9 | 3,2 % |
| **80–85°** | **234** | **67,8 %** | **191** | 1,9 % |
| 85–90° | 1 640 | 1,2 % | 30 | 1,2 % |
| 90–95° | 1 685 | 1,2 % | 2 | 1,2 % |

Pic net juste sous la bascule : les cartes tournées d'un quart de tour avec
un petit écart (le générateur ajoute ±12°) tombent des deux côtés de 85° et
reçoivent deux numérotations différentes pour la même apparence. rot768rn
arrêté pendant sa première époque.

Accord entre la numérotation du modèle livré et chaque règle (2 214 cartes de la
validation du nouveau jeu) : bascule à 45° 88,3 %, 60° 90,1 %, 75° 92,1 %,
80° 92,7 %, 85° 92,7 %. Le modèle garde les coins de la carte jusqu'à 80°,
pour la moitié des cartes à 80–85° et 20 % à 85–90° : sa propre bascule est
floue vers 85°, là où le nouveau jeu met beaucoup de cartes (≈ 400 cartes à
80–90° sur 2 214, contre ≈ 25 à 40–50°). Une bascule à 45° demande de
réapprendre la numérotation des cartes posées entre 45° et 80° (≈ 4 % des
cartes), mais éloigne la bascule des cartes tournées d'un quart de tour.

### Bascule à 45° : époque d'essai (départ recalibré)

Erreur de position des coins (coins triés, au meilleur décalage près — un
tri simple par angle se trompait vers 45°, où un coin pointe à 180°), médianes :

| Angle | Modèle actuel | Essai bascule 85° | Essai bascule 45° |
|---|---|---|---|
| 30–35° | 0,9 % | 1,4 % | 4,7 % |
| 35–40° | 0,9 % | 1,7 % | 11,5 % |
| 40–45° | 0,9 % | 1,6 % | 15,5 % |
| 45–50° | 0,8 % | 1,7 % | 20,4 % |
| 50–55° | 0,9 % | 1,7 % | 11,5 % |
| 55–60° | 0,9 % | 1,5 % | 6,6 % |
| 75–80° | 1,6 % | 3,4 % | 3,0 % |
| 80–85° | 5,1 % | 1,8 % | 1,8 % |
| 85–90° | 2,5 % | 1,2 % | 1,3 % |
| 90–95° | 1,6 % | 1,1 % | 1,3 % |
| 100–105° | 8,8 % | 2,5 % | — |
| 115–120° | 3,6 % | 5,0 % | — |

Avec la bascule à 45°, le modèle place les coins entre les deux numérotations
possibles pour les cartes de 35 à 55° : erreur de position 11 à 20 %. Le pic
de la bascule à 85° n'était qu'une différence de numérotation (sans tri),
les positions restaient justes.

| Essai (une époque) | 0° cascade | 0° variante A | 90° cascade | 90° variante A |
|---|---|---|---|---|
| modèle actuel | 155 / 151 | 171 / 161 | 122 / 74 | 158 / 88 |
| bascule 85° | 149 / 177 | 171 / 192 | 123 / 161 | 172 / 185 |
| bascule 45° | 138 / 175 | 171 / 197 | 71 / 166 | 159 / 192 |

(vraies photos / grilles). `dataset-rot` est actuellement numéroté avec la
bascule à 45° (`renumber_corners.py --switch 45`).

## Variante A plus légère (banc, détecteur actuel)

| Variante | Images IA par carte hésitante | Vraies | Grilles 0° | Simulées justes / fausses / hors cat. | Seuils |
|---|---|---|---|---|---|
| cascade (appli) | 1 | 155 | 151 | 2 571 / 0 / 0,98 % | 0 / 0,12 |
| 12 meilleurs, 2 sens (APK de test) | 3,40 | 171 | 161 | 2 574 / 0 / 0,98 % | 0 / 0,115 |
| 3 meilleurs, 2 sens | 2,60 | 171 | 161 | 2 577 / 0 / 0,98 % | 0,46 / 0,11 |
| 2 meilleurs, 2 sens | 2,39 | 170 | 161 | 2 580 / 0 / 0,98 % | 0,46 / 0,11 |
| meilleure carte, 2 sens | 2,00 | 169 | 160 | 2 578 / 0 / 0,91 % | 0 / 0,115 |
| 12 meilleurs, sens des couleurs si net | 1,71 | 156 | 150 | 2 555 / 0 / 0,98 % | 0 / 0,115 |

Un seul sens choisi par les couleurs fait perdre tout le gain : pour les
cartes hésitantes, les couleurs se trompent souvent d'orientation. Le gain
vient de la recherche dans tout le catalogue et des deux sens.

Vitesse sur le téléphone (APK de test, « Tester la vitesse ») : détection
320 px 1 349 ms (485 ms le 13/11), cartes hésitantes 1 952 ms dont IA 1 840 ms.
Le modèle, sa taille et les fils sont les mêmes ; la détection de l'APK de test
découpait chaque carte avec `warpQuadToPortrait`, qui relit toute la trame
(`getImageData` complet), et le test de vitesse le fait une seconde fois. Corrigé
pour les applis de test : `warpQuadRegion` ne lit que la zone de la carte (mêmes
pixels, `tests/cropSame.test.mjs`). Pas encore dans l'APK installé.

Hors catalogue réel : le banc compte à part les photos des dossiers `YGO-…`
(toute carte acceptée est une erreur) ; `recognition-report.mjs --min-abs`
impose un score minimal au recalibrage. En attente des photos.

## Candidat `rot85-e1` (époque d'essai, bascule 85°) : banc complet

Poids : `sauvegarde-modeles/rot85-e1/`. Variante A = « meilleure carte seule,
deux sens » (appli de test). Vraies photos / grilles :

| | 320 cascade | 320 A | 416 cascade | 416 A |
|---|---|---|---|---|
| actuel 0° | 156 / 147 | 169 / 162 | 155 / 151 | 169 / 160 |
| rot85-e1 0° | 154 / 177 | 168 / 190 | 149 / 177 | 168 / 192 |
| actuel 90° | 128 / 63 | 163 / 71 | 122 / 74 | 151 / 88 |
| rot85-e1 90° | 132 / 158 | 163 / 177 | 123 / 161 | 163 / 183 |
| actuel 180° | 89 / 56 | 129 / 64 | 108 / 69 | 154 / 74 |
| rot85-e1 180° | 155 / 146 | 171 / 165 | 155 / 168 | 170 / 178 |
| actuel 270° | 93 / 130 | 149 / 141 | 89 / 143 | 143 / 152 |
| rot85-e1 270° | 126 / 176 | 154 / 186 | 102 / 178 | 151 / 190 |
| séries 15/11 (sur 50) | 49 → 48 | 49 → 50 | 49 → 49 | 49 → 50 |

Scènes simulées (400 scènes, seuils recalibrés, hors catalogue ≤ 1 %) :
justes / fausses — 416 : actuel cascade 2 571 / 0, A 2 578 / 0 ; rot85-e1
cascade 2 531 / 0, A 2 523 / 0. 320 : actuel 2 467 / 1 et 2 484 / 1 ;
rot85-e1 2 365 / 1 et 2 378 / 1. Pas de fausse en plus ; moins de justes sur
ces scènes (générées par l'ancien générateur).

Règle d'adoption (variante A) : vraies photos ≥ 167 (168 ✓), grilles nettement
au-dessus de 161 (192 ✓), cartes tournées en hausse (✓ aux trois angles),
aucune fausse en plus sur les scènes (✓).

**rot85 (40 époques)**, contrôle époque 5 : 0° cascade 140 / 177, A 166 / 191 ;
90° cascade 124 / 174, A 162 / 190.

## rot85 : 40 époques (départ recalibré, bascule 85°, 2026-11-15)

Contrôles, 416 px (vraies photos / grilles ; modèle actuel : cascade 155 / 151,
variante A « meilleure carte » 169 / 160 ; à 90° : A 151 / 88) :

| Époque | 0° cascade | 0° variante A | 90° cascade | 90° variante A | A 0° : gagnées / perdues (vraies ; grilles) | A 90° : gagnées / perdues |
|---|---|---|---|---|---|---|
| rot85-e1 | 149 / 177 | 168 / 192 | 123 / 161 | 163 / 183 | +0 −1 ; +32 −0 | +18 −6 ; +95 −0 |
| 5 | 140 / 177 | 166 / 191 | 124 / 174 | 162 / 190 | | |
| 10 | 132 / 179 | 167 / 193 | 136 / 174 | 164 / 190 | +0 −2 ; +34 −1 | +18 −5 ; +102 −0 |
| 15 | 147 / 178 | 169 / 194 | 133 / 173 | 164 / 193 | +0 −0 ; +35 −1 | +18 −5 ; +105 −0 |
| 20 | 146 / 181 | 168 / 193 | 133 / 169 | 166 / 187 | +0 −1 ; +34 −1 | +19 −4 ; +99 −0 |
| 25 | 150 / 178 | 169 / 189 | 124 / 171 | 164 / 188 | +0 −0 ; +30 −1 | +17 −4 ; +100 −0 |
| 30 | 151 / 179 | 169 / 195 | 141 / 167 | 169 / 184 | +0 −0 ; +35 −0 | +19 −1 ; +96 −0 |
| 35 | 151 / 180 | 169 / 194 | 138 / 169 | 169 / 187 | +0 −0 ; +35 −1 | +19 −1 ; +99 −0 |
| 40 | 150 / 183 | 169 / 195 | 139 / 170 | 168 / 190 | +0 −0 ; +36 −1 | +18 −1 ; +102 −0 |

Poids de chaque contrôle : `sauvegarde-modeles/yolo-rot768rn-2026-11-15/epochNN/`.
Entraînement sans validation intégrée (`val=False`, elle se bloquait) : son
`best.pt` n'est pas choisi sur une mesure, il n'est pas un candidat.
Sur 447 images sans carte (fonds et objets du générateur) : aucune carte
acceptée, actuel comme rot85-e1 (rot85-e1 : 8 images avec une détection en
320 px au lieu de 1, toutes refusées).

Scènes simulées 320 px, variante A, rot85-e1 : −106 cartes justes (2 485 → 2 379),
surtout des cartes de moins de 2 % de l'image (grilles −69, scènes −22),
détectées puis refusées. Avec les mêmes seuils pour les deux modèles : −51 ;
le reste vient du seuil recalibré plus strict. Erreur des coins (médiane) :
actuel 0,5 % (cartes ≥ 5 %), 1,4 % (< 2 %) ; rot85-e1 0,7 à 1,1 %, 1,6 %.

Vitesse de l'entraînement : 12 processus de chargement = le maximum utile
(16 : 5,4 à 7,9 it/s au lieu de 7,3 à 9,1, 1,8 Go de mémoire libre).
Banc final des candidats (scènes 320 px variante A comprises) prêt, non lancé.

## Score minimal de la variante A (appli de test, détecteur actuel)

Pas de cartes étrangères au banc : score minimal = le plus haut qui ne fait
perdre aucune vraie photo (173 + 50 séries) ni aucune carte de grille (4
orientations) parmi celles que la variante A reconnaît. 198 cartes justes passent par
l'IA ; la plus basse est à 0,4592 (grille à 270°) → **Prudent 0,459 / 0,115**.
Scènes simulées (400) : 2 578 → 2 573 justes, 0 fausse, hors catalogue
0,91 → 0,84 %. Au banc avec le code de l'appli : 0° 169 / 160, 270° 143 / 152,
inchangés. 447 images sans carte : aucune carte acceptée. Rapide inchangé
(0,40 / 0,045). À refaire si le détecteur change. Dos de cartes : en attente
des photos.

## Banc final : époques 30 et 40 contre le modèle actuel (2026-11-16)

Variante A (seuils de l'appli de test 0,459 / 0,115 ; cascade 0,36 / 0,13).
Scènes simulées (2 864 cartes) — justes / fausses / hors catalogue acceptées :

| | 320 px | 416 px |
|---|---|---|
| actuel | 2 465 / 1 / 0,88 % | 2 573 / 0 / 0,84 % |
| rot85-e1 | 2 417 / 1 / 1,16 % | 2 546 / 0 / 1,15 % |
| époque 30 | 2 484 / 4 / 1,12 % | 2 550 / 0 / 1,26 % |
| époque 40 | 2 486 / 4 / 1,26 % | 2 551 / 0 / 1,02 % |

Cartes perdues / gagnées contre l'actuel (presque toutes < 2 % de l'image,
détectées puis refusées) : 320 px — rot85-e1 −88 / +38, ép. 30 −54 / +73,
ép. 40 −50 / +71 ; 416 px — −41 / +8, −29 / +5, −28 / +6. Les 3 fausses en
plus des époques 30 et 40 en 320 px sont acceptées avec 0,63 à 0,80 : coins.

Vraies photos / grilles, variante A :

| | 0° 416 | 0° 320 | 90° 416 | 180° 416 | 270° 416 | séries 320 |
|---|---|---|---|---|---|---|
| actuel | 169 / 160 | 169 / 162 | 151 / 88 | 154 / 74 | 143 / 152 | 49 |
| rot85-e1 | 168 / 192 | 168 / 190 | 163 / 183 | 170 / 178 | 151 / 190 | 50 |
| époque 30 | 169 / 195 | 169 / 193 | 169 / 184 | 168 / 193 | 160 / 195 | 49 |
| époque 40 | 169 / 195 | 169 / 194 | 168 / 190 | 170 / 194 | 159 / 194 | 49 |

Règle d'adoption stricte : rot85-e1 seul (époques 30 et 40 : +3 fausses en
320 px sur les scènes simulées).

Score minimal de la variante A avec les coins de chaque candidat (vraies
photos, séries, grilles aux 4 orientations) : actuel 0,459, rot85-e1 0,451,
époque 40 0,457. Cartes justes de la voie IA entre 0,45 et 0,55 : actuel 13,
rot85-e1 33, époque 40 26 ; sous 0,50 : 4, 4, 4. Images sans carte : toutes
les détections ont un score ≤ 0,426 et une marge ≤ 0,084 (rot85-e1 17
détections, ép. 40 13, actuel 3) : aucune acceptée, quel que soit le seuil
retenu.

Banc : un des morceaux d'`eval-detector-par` se bloque parfois (modèle
actuel, 416 px) ; relancé avec un autre découpage ou remplacé par les
données déjà mesurées.

### Avant le choix rot85-e1 / époque 40 (2026-11-16)

**Fausses cartes, scènes simulées 320 px** (variante A, seuils de l'appli) —
toutes acceptées par les couleurs « sûres » (pas la voie IA), aucune
réédition, illustrations différentes :

| Modèle | Scène | Taille | Erreur des coins | Attendue → répondue | Score / marge |
|---|---|---|---|---|---|
| actuel | standard 0013 | 0,76 % | 8,7 % | Sett → Palais des ruines | 0,71 / 0,14 |
| ép. 40 | standard 0013 | 0,76 % | 9,1 % | Sett → Palais des ruines | 0,74 / 0,18 |
| ép. 40 | grille 0057 | 1,46 % | 3,8 % | Field Musicians → Aurore éclatante | 0,66 / 0,12 |
| ép. 40 | grille 0244 | 0,88 % | 2,4 % | Darius → Volibear | 0,62 / 0,12 |
| ép. 40 | standard 0289 | 8,27 % | 4,2 % | Galio → Carte du Puisard (découpe sur une carte voisine) | 0,63 / 0,13 |

**Taille minimale d'acceptation automatique** (aire du cadre / image) : sur les
vraies photos, grilles et séries, aucune carte acceptée sous 3 % → 0 perte
jusqu'à 2 %. Scènes simulées 320 px (époque 40) : 0,9 % → 2 197 justes / 3
fausses ; 1,5 % → 1 267 / 1 (au lieu de 2 486 / 4) ; Galio (8,3 %) reste.
Coût trop fort sur les scènes (dominées par de petites cartes), nul sur les photos.

**Variante A recalibrée pour l'époque 40** (hors catalogue ≤ 1 %, score ≥ 0,457) :
320 px 0,457 / 0,15 → scènes 2 428 / 4 / 0,95 % ; 416 px 0,467 / 0,115 →
2 548 / 0 / 0,98 %. Vraies photos / grilles (416) : 0° 169 / 195, 90° 168 / 190,
180° 170 / 194, 270° 159 / 193 ; séries 49 / 50. Pour comparaison, recalibrés :
actuel 0,459 / 0,11 (2 479 / 1 et 2 577 / 0), rot85-e1 0,511 / 0,12 et
0,451 / 0,135 (2 376 / 1 et 2 523 / 0).

**Détections sur les images sans carte** : téléphones (écran rectangulaire,
0,80 à 0,92), pièces de monnaie (0,72 à 0,82), dés (0,61 à 0,92), une texture
de bitume (0,69). Confiance des vraies cartes (époque 40, 416 px) : vraies
photos min 0,919, cartes de grille min 0,812, 1 % sous 0,857. Un seuil au-dessus
de toutes les fausses détections (0,922) ferait perdre 1 vraie photo et 12
cartes de grille (320 px : 4 et 19 ; rot85-e1 416 px : 0 et 4). Pas de seuil de
confiance sans perte ; ces détections sont toutes refusées par la reconnaissance.

## Époque 40 retenue pour l'APK de test (2026-11-16)

Export comme le modèle livré : ONNX 768 × 768 fixe (opset 12) depuis les poids
de l'époque 40, puis `export_yolo_sizes.py --dynamic` (constantes identiques à
768, sorties dynamiques = modèles fixes à 320, 416 et 768 px, écart 0) ; SPPF
sans activation. Coins de l'ONNX contre les poids PyTorch sur 40 images (320 et
416 px) : écart max 0,0001 px.

- `yolo11s-pose-riftbound-ep40-test.onnx` (= dyn de l'époque 40), 38 900 086 o,
  **sha256 06df918b37a7dcb64305c5f4681d02f87904ffac6a67d30af14cbbd13d89f417** (avant le 21/11/2026 : 980a89fd434d01cdbf33d095e649c006d76d4d7c51bcb02bbce048c48be5f0d1, mêmes poids — seule la description des métadonnées, qui contenait un chemin du PC, a changé) ;
  copie dans `sauvegarde-modeles/yolo-rot768rn-2026-11-15/epoch40/onnx/`.
- Le modèle actuel (`yolo11s-pose-riftbound-dyn.onnx`, c3e1f64c…) reste celui
  de l'appli de tous les jours et reste dans l'APK de test (retour arrière).

Applis de test (`src/lib/testFeatures.js`) : détecteur époque 40
(`TEST_MODEL_URL`, hors git : `public/models/*-test.onnx`, retiré de toute
construction qui n'est pas de test — `build-mobile.mjs --test`,
`desktop-exe.mjs`) ; variante A « meilleure carte seule, deux sens » avec seuils
par taille : 320 px 0,457 / 0,15, 416 px 0,467 / 0,115 (Rapide 0,40 / 0,045,
non recalibré) ; mode caméra : carte de moins de 2 % de l'image jamais acceptée
automatiquement ; découpe en perspective par zone ; « Tester la vitesse » :
découpe sur sa propre ligne.

Au banc avec le code de l'appli de test (`eval-detector --test-features
[--camera]`) : photo 416 px 169 / 195 ; caméra 320 px 168 / 191, séries 49 / 50
(10 · 10 · 10 · 10 · 9 acceptées, 50 / 50 en tête). Appli de tous les jours
inchangée : 155 / 151.


## Époque 40 livrée, une seule chaîne (2026-11-17, lot 1.4)

Scanner de test validé par l'utilisateur le 17/11. L'époque 40 remplace
l'ancien détecteur sous le nom du fichier livré :

| Fichier | Octets | SHA-256 |
|---|---|---|
| `yolo11s-pose-riftbound-dyn.onnx` (= époque 40) | 38 900 086 | `06df918b37a7dcb64305c5f4681d02f87904ffac6a67d30af14cbbd13d89f417` |
| `dinov2s-ft-fp16.onnx` | 45 967 436 | `45c10e5eb0c60316499d3b68d14fc51f6dab448e553fa439d9f7273bfc3b1fab` |

- Ancien détecteur (c3e1f64c…) : `sauvegarde-modeles/detecteur-320-416-float32/` ;
  époque 40 : aussi dans `sauvegarde-modeles/detecteur-ep40-2026-11-17/`.
- Une seule chaîne (`src/lib/cardMatcher.js`) : couleurs d'abord ; si elles ne
  sont pas sûres, l'IA sur la découpe de leur meilleure carte, dans les deux
  sens, notée sur tout le catalogue (variante A). L'ancienne cascade sur les
  300 meilleures cartes et la découpe en 48 bandes ne sont plus dans l'appli
  (`eval-recognition` sait encore la rejouer ; `eval-detector --crop strips`
  sait encore refaire les bandes).
- Seuils de la variante A dans l'en-tête du catalogue (`embeddings.decision`,
  par taille d'entrée : 320 → 0,457 / 0,15, 416 → 0,467 / 0,115), avec le nom
  et le SHA-256 du détecteur pour lequel ils ont été calibrés
  (`embeddings.detector`, `embeddings.detectorSha256`,
  `scripts/build-embeddings.mjs --t320 / --t416 / --detector`). L'appli compare
  ce SHA-256 à celui de son détecteur (`src/lib/scanRules.js`) : s'ils
  diffèrent, rien n'est accepté automatiquement quand les couleurs hésitent ; le
  téléphone n'utilise pas un catalogue du PC fait pour un autre détecteur.
  Les bancs (`eval-detector`) mesurent tout détecteur avec les seuils livrés.
- Mode « Rapide » retiré (préférences v5) ; mode caméra : carte de moins de 2 %
  de l'image jamais acceptée automatiquement, dans toutes les applis.
