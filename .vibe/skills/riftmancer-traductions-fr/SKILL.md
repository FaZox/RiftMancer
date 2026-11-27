---
name: riftmancer-traductions-fr
description: Load when adding or updating French translations of Riftbound content (FAQ rulings in public/rulings-fr.json, unofficial card texts in public/card-texts-fr.json): workflow, validation and app behavior.
---

# Traductions françaises de contenu Riftbound

Deux fichiers statiques servis depuis `public/` (donc embarqués dans le build et sur mobile) :

| Fichier | Contenu | Clé |
|---------|---------|-----|
| `public/rulings-fr.json` | Traductions FR complètes des rulings de la Riftbound FAQ (CC BY-SA 4.0, dérivé avec attribution) | `cards[faqCardName][rulingId] = { q, a }` |
| `public/card-texts-fr.json` | Textes FR **non officiels** des cartes absentes de riftboundfr.fr | `texts[oracle] = "texte"` (repli: id) |

Affichage : rulings → bascule FR/EN dans `RulingsList.jsx` (curaté > vue terminologique > anglais) ; textes de cartes → `cardLocale.js` (`getLocalizedText` : textFr officiel > `card-texts-fr.json` marqué « Traduction française non officielle » > anglais), bascule FR/EN existante dans `CardZoom.jsx`.

## Workflow pour traduire de nouveaux rulings (FAQ mise à jour)

1. Lire la couche rulings installée : `%APPDATA%\riftmancer(-test)\catalogue\couches\rulings\layer.json` (`data.cards` ou racine `.cards`, chaque entrée `{ name, rulings: [{ id, question, html }] }`).
2. `missingCuratedRulings(faq, fr)` (`src/lib/rulingsFr.js`) liste ceux sans traduction. Côté PC, `electron/content.cjs → rulingsFrMissing()` alimente la notification Electron et le badge « Réglages → Contenu » (`status().rulingsFrMissing`).
3. Traduire en gardant **tous les liens** `<a href="...">` et `<sup>` exactement identiques à l'anglais, et la terminologie officielle (mots-clés `[Flow]`, `[Deathknell]`… en anglais comme dans l'officiel FR ; « sort », « unité », « champ de bataille », « défausse », « puissance », « coût »…). Noms de cartes : `nameFr` du catalogue quand il existe, sinon le nom anglais (l'officiel FR le garde souvent).
4. Écrire le lot dans un fichier de batch et fusionner avec validation automatique des href :
   - marqueurs `{R:355.10}` → lien FAQ, `{C:url|Label}` → lien carte ;
   - validation : chaque entrée doit exister dans la couche (name + id) et avoir exactement les mêmes href que la source anglaise.
5. Vérifier la couverture : `167/167` actuellement (71 cartes). Un id inconnu retombe automatiquement sur la vue terminologique.

## Workflow pour les nouveaux textes de cartes sans textFr

1. Lister les cartes avec texte EN mais sans `textFr` dans la couche `cartes`, groupées par `oracle` (les variantes partagent le texte).
2. Traduire en texte brut : `\n` pour les sauts de ligne, garder `:rb_...:` et `[Mot-clé]`, `[>]` pour la flèche. Validation : mêmes symboles `:rb_...:` que l'anglais, oracle existant avec `text` et sans `textFr`.
3. Fusionner dans `public/card-texts-fr.json` (`texts[oracle]`). Couverture actuelle : 390/390 oracles (toutes les impressions sans textFr officiel du catalogue servi). Les promos/variantes héritent automatiquement de la traduction de la carte originale via l'oracle.

## Règles

- Jamais de traduction mot à mot de la grammaire anglaise (franglais) : rulings = phrases traduites ; sinon repli terminologique.
- Toujours marquer le contenu non officiel et garder la licence/attribution (CC BY-SA 4.0 pour les rulings).
- Tests : `tests/rulingsFr.test.mjs`, `tests/cardTextsFr.test.mjs` (`npm test`). Build + installeur test après modification : `npm run desktop:exe:test` puis lancer `release/RiftMancer Test Setup <version>.exe`.
