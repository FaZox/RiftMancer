# RiftMancer — notes for Claude Code

Riftbound card scanner + collection app: React 18 + Vite + Tailwind, plain JS (`src/`), Electron PC (`electron/`), Capacitor Android (`android/`). AGPL-3.0. User speaks French: answer in French, short. UI texts use « vous ».
Details in skills (on demand): riftmancer-tests, riftmancer-scanner, riftmancer-ui, riftmancer-release, appliquer-consignes.

## Working economically
- Short answers: what changed, result, what's left. No preamble, no step recap, no long reports unless asked.
- Read only needed files (Grep first, then nearby lines; large files by line range). No re-reading a file just read or edited.
- Don't open `public/cards/`, `dist*/`, `release/`, `android/app/build/`, `model/` data folders, `node_modules/` unless asked.
- No screenshots unless layout is the point.
- Long jobs (builds, benches): background, output to log file; quote key lines only.
- Focused tests first (skill riftmancer-tests), full run at end. Small targeted edits, never rewrite whole file.
- Patch scripts, multi-line edits: write to scratch file, then run (inline `node -e` with backticks/`$` breaks in bash).
- Some source files use lone `\r` or CRLF: normalise with `/\r\n?/g` before string replacements.
- User instruction files in `docs/claude/` (local, never committed; skill appliquer-consignes). Progress: `docs/claude/SUIVI.md`.

## Commands
- Tests: `node scripts/run-tests.mjs` (`npm test`). Lint: `npx eslint src scripts tests`.
- i18n: `tx('French text')`, English in `src/i18n/en.js`; `tests/i18n.test.mjs` fails on missing or unused English text, and duplicate keys.
- Build: `npm run build`. Test apps: `npm run desktop:exe:test`, then `npm run build:mobile -- --test && node scripts/android-apk.mjs --test --no-install`.
- Install (only when user asks): PC `release/RiftMancer Test Setup <v>.exe /S` (close « RiftMancer Test » first, ask before closing it); phone `adb install -r release/RiftMancer-Test.apk` (adb in `%LOCALAPPDATA%/Android/Sdk/platform-tools`).
- PC app trial: `RIFTBOUND_DATA_DIR=<scratch dir> ./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333`, driven over CDP. Add `RB_VARIANT=test` only when user's RiftMancer Test is closed (port 47322); without it app uses port 47321.
- Release: `npm run release -- X.Y.Z` (friends' package + public package).

## Rules
- Test in the test app (`com.riftmancer.app.test`) before the everyday app.
- When a piece of work is done: commit in the main folder, then publish to the only GitHub repo, the public FaZox/RiftMancer (`npm run public:export -- <empty folder>`, copy into `../riftmancer-public` keeping its `.git`, commit, push; tag `v<version>` for a release). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never commit: `docs/claude/` (`CORRECTIONS*.md`, `AMELIORATIONS-*.md`, `MODULE-BANC.md`, `LICENCE-ET-PUBLICATION.md`, `REPRODUIRE-SCANNER-OPENRIFT.md`…), `model/500266617.jpg`, `android/Nouveau Document texte.txt`, keystores, `*.jks`, `*.pem`.
- Never read `android/keystore.properties` or the pack signing key; never ask for, show or write passwords.
- Riot content (card pictures, catalog, `public/sym`) stays out of the public repo and the public builds.
- Give a time estimate when starting a long task. Update `CHANGELOG.md` (English) and tick `ROADMAP.md`.

## Where things are
- PC `src/desktop/` · Android + shared `src/App.jsx`, `src/components/` · logic `src/hooks/` (`useAppController`), `src/lib/` · `electron/` SQLite, sync, backups.
- Recognition: skill riftmancer-scanner. Printing per artwork, remembered: `src/lib/printingChoice.js`. Prints, rulings: `prints.js`, `rulings.js`; rifthunt sources `rifthunt.js`.
- Help tours + « ? » mode: `src/lib/help.js` (`data-help` markers), `src/components/common/HelpLayer.jsx`.
- Content layers (cards, translations, bans, rulings): `electron/content.cjs`; Settings → Content in `src/components/settings/`.

## Compact instructions
When compacting keep: current task + acceptance criteria, files changed and why, test results, decisions made with user, what's left. Drop file contents, old tool output.
