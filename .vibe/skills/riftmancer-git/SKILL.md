---
name: riftmancer-git
description: Convention Git et workflow pour RiftMancer. Inclut le format des
  commits, la gestion des branches, les releases et les PR
---
## Branches

- `main` - Branche principale
- `vibe/*` - Branches de travail (créées par les agents)

## Commit

```bash
# Format des commits
<type>(<scope>): <description>

# Types: feat, fix, refactor, docs, chore, test
# Exemples:
git commit -m "feat(scanner): amélioration détection"
git commit -m "fix(prices): correction calcul valeur"
git commit -m "chore: mise à jour dépendances"

Push

# Pour une nouvelle branche
 git checkout -b feature/nom
 git push -u origin feature/nom

# Pour main (protégée, nécessite PR)
 git push origin main  # Bloqué par protection

Release (après npm run release)

# Après exécution de npm run release -- <version>
git push origin main
 git push origin v<version>  # Tag de version

PR GitHub

    Toujours cibler main
    Titre: [type] description (ex: [feat] scanner amélioré)
    Description: Changelog + vérification
    Closes #<numero> si applicable
```

## Cartes (copyright Riot — jamais dans git)

- `public/cards/` (images + miniatures) est dans `.gitignore` : **ne jamais forcer un ajout** (`git add -f` interdit sur ce dossier).
- Seul le catalogue `public/card-hashes.json` (métadonnées, sans images) est versionné.
- Les installeurs produits ne doivent pas embarquer les images de cartes.

## Build production après chaque commit

Après chaque commit (build OK) :

```bash
node scripts/desktop-exe.mjs --public   # exe production SANS les cartes (strip de public/cards/)
node scripts/build-mobile.mjs --public && node scripts/android-apk.mjs   # apk production SANS les cartes
```

(Attention : `npm run desktop:exe` / `npm run android:apk` seuls embarquent les cartes si `public/cards/` est présent localement — c'est le paquet « amis ». Les variantes `--public` retirent le contenu des cartes. `npm run release -- <version>` produit d'ailleurs les deux paquets, le public dans `release/v<version>-public/`.)

