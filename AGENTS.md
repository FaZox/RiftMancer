# AGENTS.md – RiftMancer

## Règles non négociables pour l'IA

1. Lire `.vibe/INIT.md` puis `.vibe/ai-context.md` en début de session.
2. Questions techniques → `DEV_NOTES.md` (jamais README.md, c'est pour les humains).
3. Un seul skill local à la fois, chargé via `skill <nom>` (`.vibe/skills/<nom>/SKILL.md`).
4. Bug → `grep -r "MOT_CLE" src/` d'abord.
5. Après chaque modification terminée et build OK → lancer `npm run desktop:exe:test` puis lancer l'installeur test généré (règle aussi dans `ai-context.md`).
6. Si le projet change (chemins, commandes, architecture) → mettre à jour `DEV_NOTES.md`.

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `CLAUDE.md` | Point d'entrée Claude Code (wrappers skills dans `.claude/skills/`, gitignoré) |
| `.vibe/INIT.md` | Point d'entrée |
| `.vibe/ai-context.md` | Contexte + règles de session |
| `DEV_NOTES.md` | Référence technique complète |
| `.vibe/skills/*/SKILL.md` | Skills locaux |
| `release/` | Installeurs générés (`*.exe`, `*.apk`) |
