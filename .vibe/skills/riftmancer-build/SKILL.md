---
name: riftmancer-build
description: "Description : Référence complète des commandes de build, release
  et déploiement pour RiftMancer. Inclut les pré-requis et la structure des
  packages générés."
---
## Développement

```bash
npm run dev          # Serveur Vite (web)
npm run desktop      # Build + Electron PC
npm run desktop:start # Electron sans build
```

```typescript
Build Mobile

npm run build:mobile    # Build pour Android
npm run android:apk     # Génère APK
npm run android:apk:test # APK test

Build PC

npm run desktop:exe     # EXE installer
npm run desktop:exe:test # EXE test

Release

npm run release -- <version>      # Package complet (PC + Android)
npm run release -- <version> --essai # Test sans commit/tag
npm run release:check              # Vérifie pré-requis release

Pré-requis release

    Arbre Git propre
    Version > toutes les tags v*
    Notes dans docs/NOUVEAUTES.md et docs/WHATS-NEW.md
    Contenu cartes présent (public/cards/, public/card-hashes.json)
    Clé de signature Android (android/keystore.properties ou RB_KEYSTORE)
    Fichiers LICENSE, NOTICE, docs/LISEZ-MOI-AMIS.md, docs/FRIENDS-GUIDE.md

Sortie

    release/v<version>/ - Package complet
    release/v<version>-public/ - Package public (sans contenu cartes)
```

