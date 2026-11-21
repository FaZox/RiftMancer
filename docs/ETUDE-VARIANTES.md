# Étude · variantes d'une carte (lot 8.4, M11d)

*English version: [STUDY-VARIANTS.md](STUDY-VARIANTS.md).*

**Question.** Que distingue déjà la reconnaissance entre une carte et ses variantes (illustration alternative, signée, foil), et comment le présenter ?

## Ce que contient le catalogue

| Variante | Nombre | Image | Comment le scanner la traite |
|---|---|---|---|
| Illustration alternative (`OGN-066a`) | 126 | une autre illustration (écart moyen à la carte normale : 43 niveaux de gris sur 255) | une carte à part, reconnue comme telle |
| Signée (`OGN-299*`) | 45 | la même image, avec la signature dorée (écart moyen : 2 niveaux de gris) | dans le même groupe « même illustration » que la carte normale : le scanner demande laquelle |
| Foil | — | pas d'image à part | ne se voit pas sur une photo : à indiquer soi-même |

## Au banc (photos réelles, détecteur de l'appli à 416 px)

- Toutes photos : 97,7 % des photos à une carte et 97,5 % des cartes des grilles identifiées, **0 % acceptée à tort**.
- 17 photos de cartes qui ont une variante : les **6 illustrations alternatives** sont reconnues et acceptées justes ; une carte normale a été proposée comme sa version « a », **à confirmer** (pas acceptée) ; deux runes réimprimées à l'identique (OGN-042 / UNL-R02) sont un même dessin, pas une variante.
- Aucune carte signée dans le banc : la mesure vient du catalogue (images quasi identiques). Distinguer signée / normale par l'image demanderait de chercher la signature, sur des photos où elle peut être pâle ou dans un reflet ; ce n'est pas tenté.

## Présenté dans l'appli

- Le résultat du scan dit « Illustration alternative » ou « Signée » sous le nom.
- Le choix « Même illustration » montre « OGN » / « OGN signée » (au lieu de deux « OGN », l'un avec ★).
- Réglages → Scanner → Foil : « Une photo ne montre pas si une carte est foil : à indiquer vous-même. »

`tests/variants.test.mjs` vérifie que chaque carte signée du catalogue est groupée avec sa carte normale et que les illustrations alternatives restent des cartes à part.
