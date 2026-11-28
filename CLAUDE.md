# CLAUDE.md – RiftMancer (point d'entrée Claude Code)

Ce fichier complète `AGENTS.md` (lu nativement par Codex, Cursor, GitHub Copilot…). Règles identiques.

## Règles de session (non négociables)

1. Lire `.vibe/INIT.md` puis `.vibe/ai-context.md` en début de session.
2. Questions techniques → `DEV_NOTES.md` uniquement (jamais `README.md`).
3. Un seul skill local à la fois. Skills du projet : `.vibe/skills/<nom>/SKILL.md`
   (wrappers locaux pour la découverte native Claude Code : `.claude/skills/<nom>/SKILL.md`, gitignorés — le contenu canonique reste `.vibe/skills/`).
4. Bug → `grep -r "MOT_CLE" src/` avant de lire le moindre fichier.
5. Après chaque modification terminée et build OK → `npm run desktop:exe:test` puis lancer
   `release/RiftMancer Test Setup <version>.exe` (jamais la version production automatiquement).
6. Si le projet change (chemins, commandes, architecture) → mettre à jour `DEV_NOTES.md`.

## Pièges connus (ne pas retomber dedans)

- **`CardZoom` et le cœur des souhaits** : toujours passer `byCard={wishlist.byCard}` en plus de `wanted=...`,
  sinon le cœur d'une variante reflète la carte d'origine (bug corrigé dans CardsTab, CardsPage, CollectionPage, MoreTab, OrganizeTab, ValueTab). Sur PC, la fiche `CardReliquary` est ouverte via le hook `useReliquary`, qui passe déjà `byCard`.
- **Variantes** : regroupées par `oracle` (`src/lib/prints.js`, `groupKey()` dans `src/lib/cardsBrowser.js`).

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `AGENTS.md` | Règles non négociables (lu aussi par Codex / Cursor / Copilot) |
| `.vibe/INIT.md` | Point d'entrée |
| `.vibe/ai-context.md` | Contexte + règles de session |
| `DEV_NOTES.md` | Référence technique complète |
| `.vibe/skills/*/SKILL.md` | Skills locaux (liste ci-dessous) |
| `release/` | Installeurs générés (`*.exe`, `*.apk`) |

- Racine : `C:\Users\bower\Documents\RiftMancer` · Code React : `src/` · Backend Electron : `electron/` · Android : `android/`
- Cartes : `public/cards/` · Catalogue : `public/card-hashes.json` · Modèles IA : `public/models/`
- Installeurs : `release/` · Données PC : `%APPDATA%\riftmancer(-test)\collection.sqlite`

## Skills disponibles (`.vibe/skills/<nom>/SKILL.md`)

| Skill | Quand le charger |
|-------|------------------|
| `riftmancer-build` | Build / release / déploiement, pré-requis, structure des packages générés |
| `riftmancer-features` | Feature → fichiers sources (scanner, collection, decks, sync…) |
| `riftmancer-git` | Convention Git, format des commits, branches, releases, PR |
| `riftmancer-install` | Installation PC (production et test) |
| `riftmancer-structure` | Architecture : emplacement de chaque composant, module, service |
| `riftmancer-tests` | Tests Node.js / E2E, lint, benchmarks, pré-requis |
| `riftmancer-traductions-fr` | Traductions FR de contenu Riftbound (`public/rulings-fr.json`, `public/card-texts-fr.json`) : workflow, validation, comportement app |
