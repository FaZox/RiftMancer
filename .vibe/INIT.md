# INIT.md – Point d'entrée OBLIGATOIRE

À chaque nouvelle session dans RiftMancer :

1. **Lire `.vibe/ai-context.md`** (règles + contexte complet).
2. **Question technique** → `DEV_NOTES.md` uniquement (jamais README.md).
3. **Tâche spécifique** → charger le skill local via `skill <nom>` (`.vibe/skills/<nom>/SKILL.md`) : `riftmancer-install`, `riftmancer-build`, `riftmancer-features`, `riftmancer-git`, `riftmancer-structure`, `riftmancer-tests`.
4. **Bug** → `grep -r "MOT_CLE" src/` avant de lire le moindre fichier.
