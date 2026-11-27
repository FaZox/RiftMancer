---
name: riftmancer-tests
description: Guide d'exécution des tests pour RiftMancer. Couvre les tests
  Node.js, E2E, les pré-requis et les commandes de lint/benchmark
---
## Tests Node.js

```bash
npm test              # Tous les tests Node
npm run test:e2e     # Tests end-to-end

Fichiers de test

    tests/*.test.mjs / *.test.cjs - Tests unitaires
    tests/e2e/ - Tests end-to-end
    Voir scripts/run-tests.mjs pour la liste complète

Tests avec contenu cartes

Certains tests nécessitent public/card-hashes.json et public/cards/:

npm run content:import -- <dossier>  # Importe contenu
npm run catalog:update               # Met à jour catalogue

Tests spécifiques
node --import ./tests/lang-fr.mjs --test tests/nom.test.mjs
Lint
npm run lint
```

