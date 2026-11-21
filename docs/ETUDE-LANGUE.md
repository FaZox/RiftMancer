# Étude · langue lue sur la carte (lot 8.3, M11c)

*English version: [STUDY-LANGUAGE.md](STUDY-LANGUAGE.md).*

**Question.** Le scanner peut-il savoir si une carte est française ou anglaise, pour remplir la langue tout seul (« Auto ») sans jamais écraser un choix manuel ?

**Verdict (20/11/2026) : pas livré.** Lire « FR » marche bien sur une photo nette, mais le réglage du lecteur décide trop du résultat (de 0 à 5 erreurs pour ~100 décisions selon le réglage), et un tiers des photos de l'appli ne permet aucune décision. Rien n'a été branché dans l'appli.

## Ce qui est imprimé

Ligne du bas, à gauche, après le numéro de collection :

| Carte | Mention |
|---|---|
| française, tous les sets | `OGN • 030/298 • FR` |
| anglaise, sets récents (RAD, VEN) | `RAD • 098/167 • EN` |
| anglaise, anciens sets (OGN, SFD, UNL) | rien : `UNL • 036/219` |
| runes, champs de bataille | pas de mention à cet endroit |

## Méthode

1. Coins de chaque carte sur les 173 vraies photos à une carte du banc (`model/real-photos-raw/`), détecteur de l'appli à 416 px : `node scripts/eval-detector.mjs --scenes 0 --no-identify --dump corners.json`.
2. Carte redressée comme dans l'appli (`perspectiveCrop.warpQuadRGBA`), bande du bas (`OGN • 030/298 • FR`) ramenée à 480 × 64 px en gris.
3. **Vérité lue à l'œil** sur ces bandes : 61 FR, 4 EN, 65 sans mention, 23 illisibles (photo sombre ou floue), 20 runes / champs de bataille. Rangée dans `model/real-photos-raw/_langues.json` (local, comme les photos).
4. Lecteur simple, sans modèle : encre plus claire que le fond, filets du cadre retirés (traits horizontaux longs), ligne de texte, mots séparés par les blancs ; le numéro est le mot le plus large ; un petit mot juste après = une mention. Règles : sur les anciens sets une mention veut dire FR (ils n'impriment jamais EN), et un numéro net sans rien après veut dire anglaise ; runes et champs de bataille écartés.
5. `node scripts/study-language.mjs corners.json` refait les chiffres.

## Chiffres

Meilleur réglage (`gap 7, run 36, add 35, num 55`), runes, champs de bataille et sets récents écartés :

| | FR dit | juste | anglaise dite | juste | rien dit |
|---|---|---|---|---|---|
| toutes les photos (173) | 53 | 53 / 61 | 51 | 51 / 65 | le reste |
| photos de l'appli, 720 p (107) | 29 | 29 / 35 | 22 | 22 / 28 | ~45 % |

Mais ce réglage a été choisi sur ces mêmes photos. Sur les **144 réglages voisins** essayés, 43 font 0 erreur, 49 en font 1, 27 en font 2, et jusqu'à 5. L'erreur qui compte est une carte française dite anglaise (ou l'inverse), posée en « Auto » sans que l'on regarde.

- Sets récents (RAD, VEN) : distinguer « FR » de « EN » par la forme des lettres se trompe (1 carte EN sur 4 lue FR) ; trop peu d'exemples pour mieux faire.
- Photos sombres ou floues : la mention disparaît, même à l'œil.

## Pour aller plus loin

- Plus de photos étiquetées (surtout des cartes anglaises de sets récents et des photos de l'appli en 720 p), puis séparer réglage et mesure (régler sur une moitié, mesurer sur l'autre).
- Un petit lecteur appris (reconnaissance des deux lettres) plutôt que des seuils à la main.
- Ou lire la langue d'après le texte de la carte (mots français / anglais), plus gros que la mention.
