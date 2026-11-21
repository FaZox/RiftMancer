# Security policy

*Version française plus bas.*

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub’s private reporting instead: the **Security** tab of this repository → **Report a vulnerability**. Describe what you found, how to reproduce it and what it allows; you will get an answer as soon as possible.

## What matters most

RiftMancer runs on your own devices and sends nothing to a server of ours. The sensitive parts are:

- **Phone ↔ PC sync** (`electron/server.cjs`, `electron/syncCrypto.cjs`, `src/lib/syncClient.js`): a local HTTP server, one key per paired phone, every request signed (anti-replay) and the data encrypted (AES-256-GCM); pairing only while the QR code is shown on the PC.
- **Content packs** (`electron/pack.cjs`): Ed25519-signed by the app’s author, signature checked before anything else is read, no compressed entry, revocable keys.
- **Content downloads** (`electron/contentFetch.cjs`): allowed addresses only, redirects checked again at each hop, size limit while reading.
- **The PC app’s window** (`electron/main.cjs`, `electron/csp.cjs`): content security policy, only web links (http, https) handed to the browser.

The security of the sync does not depend on the code being secret: keys are made per device, and no secret value is in this repository. If you find one, please report it as above.

## Supported versions

Only the latest released version gets fixes.

---

# Politique de sécurité

## Signaler une faille

Merci de **ne pas ouvrir de ticket public** pour un problème de sécurité. Utilisez le signalement privé de GitHub : onglet **Security** de ce dépôt → **Report a vulnerability**. Décrivez ce que vous avez trouvé, comment le reproduire et ce que cela permet ; vous aurez une réponse au plus vite.

## Ce qui compte le plus

RiftMancer fonctionne sur vos propres appareils et n’envoie rien à un serveur à nous. Les parties sensibles sont :

- **la synchronisation téléphone ↔ PC** (`electron/server.cjs`, `electron/syncCrypto.cjs`, `src/lib/syncClient.js`) : serveur HTTP local, une clé par téléphone appairé, chaque requête signée (anti-rejeu) et les données chiffrées (AES-256-GCM) ; appairage seulement pendant que le QR code est affiché sur le PC ;
- **les packs de contenu** (`electron/pack.cjs`) : signés Ed25519 par l’auteur de l’appli, signature vérifiée avant de lire le reste, aucune entrée compressée, clés révocables ;
- **les téléchargements de contenu** (`electron/contentFetch.cjs`) : adresses autorisées seulement, redirections revérifiées à chaque étape, limite de taille pendant la lecture ;
- **la fenêtre de l’appli PC** (`electron/main.cjs`, `electron/csp.cjs`) : politique de sécurité du contenu, seuls les liens web (http, https) sont confiés au navigateur.

La sécurité de la synchronisation ne repose pas sur le secret du code : les clés sont créées par appareil, et aucune valeur secrète n’est dans ce dépôt. Si vous en trouvez une, signalez-la comme ci-dessus.

## Versions suivies

Seule la dernière version publiée reçoit des corrections.
