# Phase 10 — Distribution to friends: summary (M0 to M14)

*Version française : [PHASE-10.fr.md](PHASE-10.fr.md).*

From 17 to 20 November 2026. Goal: an app that friends install by themselves (PC app and Android
app, without development tools), that never loses their data, whose content (new cards,
translations, banned cards) is updated from the PC app, and that also serves in tournaments and
to follow prices.

The specification (AMELIORATIONS-APPLI.md) stays outside the repository; its split into modules and
their state are in [ROADMAP.md](../ROADMAP.md) (Phase 10), the details of each module in
[CHANGELOG.md](../CHANGELOG.md). This document sums them up.

**Rule of each module**: Node tests for any new logic, lint without errors, build, test APK,
CHANGELOG and ROADMAP, one pushed commit; no system `confirm()` / `alert()` box, state colours
through tokens, texts of at least 11 px, PC and phone screenshots.

---

## 1. What was done

| Module | What it brings | Where (main) | Tests (at 20/11) | Commit |
|---|---|---|---|---|
| **M0** Design foundations | State tokens `state.ok/warn/bad/info`, shared components (`Dialog`, `Sheet`, `Banner`, `StatusPill`, `EmptyState`…), versioned mock-ups | `src/components/common/`, `docs/maquettes/` | — | `9b507ea` |
| **M1** Banned cards and format | Dated official lists (18 Sept. and 23 Nov. 2026), Standard / 2v2 formats, deck check banner, « Banned » badge | `public/banlist.json`, `src/lib/deckRules.js` | 8 | `068cea2` |
| **M2** Consistent prices | Change only on the real history, foils apart, estimated prices « ≈ », correct gain, promos at their price | `src/lib/prices.js`, `src/lib/valueData.js` | 8 | `ee8c335` |
| **M3** Cardmarket conditions | MT/NM/EX/GD/LP/PL/PO scale, migration NM→NM, LP→EX, MP→GD, HP→PL, D→PO | `src/lib/conditions.js` | 6 | `66bfd90` |
| **M4** Scanner clean-up | A single chain (colours then AI), thresholds in the catalog header, « Fast » mode removed | `src/lib/scanRules.js`, `src/lib/photoScan.js` | 4 | `b14bff5` |
| **M5** Signing and package | Single version 2.1.0, `npm run release`, `npm run release:check`, signed APK, friends’ guide | `scripts/release.mjs`, `docs/LISEZ-MOI-AMIS.md` | 9 | `76b0d84` |
| **M6** Never lose the data | Automatic phone backups (10 kept), sync reminder, extra folder on the PC, visible conflicts | `src/lib/autoBackup.js`, Settings → Backups | 10 | `91f1955` |
| **M7** Up-to-date content from the PC | Content layers; updates of banned cards, translations, new cards (parity checked); Ed25519-signed packs; versions exchanged at the sync; APK without large pictures (252 → 121 MB) | `electron/content.cjs`, Settings → Content | 11 + 8 + 5 + 5 + 5 + 4 | `b8f230a` → `4084d40` |
| **M8** When something breaks | Rescue screen, named startup errors, diagnostic report without personal data | `src/lib/errorLog.js`, `RescueScreen.jsx` | 4 | `037c94f` |
| **M9** Ergonomics | « Hextech forge » loading screen, navigation (Decks \| Matches, counter in one gesture), settings in nine sections, global search and shortcuts, first launch, finishing | `ForgeSplash.jsx`, `settingsSections.jsx`, `GlobalSearch.jsx` | 6 + 3 + 3 + 5 + 3 + 4 | `10847a9` → `caf6bd2` |
| **M10** Decks and competitive play | Deck codes in the common format (Piltover Archive) and registration text, deck versions, notes per opponent, 1v1 / 2v2 / free-for-all counter with history and resume, errata flagged | `src/lib/deckCodes.js`, `deckVersions.js`, `opponentNotes.js`, `scoreGame.js`, `errata.js` | 4 + 3 + 4 + 5 + 4 | `b0f9a23` → `c52520d` |
| **M11** Scanning comfort | Hands-free scan, sounds (off by default), variants (alternate arts, signed); detected language studied but **not shipped** | `src/lib/handsFree.js`, `scanSounds.js`, `variants.js` | 3 + 3 + 3 | `4f169f7` → `30458e0` |
| **M12** Price alerts | Alerts on my cards (± X % over 7 days, minimum value), « Movements » panel in Value, summary after each price update | `src/lib/priceMoves.js`, `MovementsPanel.jsx` | 5 | `c7ebc60` |
| **M13** Between friends | Lists shared as files (duplicates and wishes, without prices paid or locations), possible trades per friend, trade calculator | `src/lib/friendLists.js`, `FriendsView.jsx` | 5 | `531e4b3` |
| **M14** Documentation and quality | Friends’ guide and README up to date, screen tests (`npm run test:e2e`), `useAppController` and `ScanTab` split, light continuous integration | `scripts/e2e.mjs`, `tests/e2e/`, `src/hooks/app/`, `.github/workflows/ci.yml` | 3 journeys | `a763d56` → `3f576dd` |

### Touch-ups requested after the trials (20/11)

| Touch-up | Why | Commit |
|---|---|---|
| Loading screen with a fixed duration (2.4 s) | see the whole animation, even when the app starts fast | `193159b` |
| Smooth loading gauge | it stuttered while the phone loads the models: it now turns by itself (browser animation), full at 2.4 s or as soon as the app is ready | `f2fc8a7` |
| Sharp card in the sheet | a turned picture is always a little blurry: a single sway, then the card settles straight | `a8aaad0` |
| Bigger card in the sheet (phone then PC) | too small: ≈ 264 px instead of 200 on a 412 px phone; 343 × 479 instead of 267 × 372 on a 1440 × 900 screen | `42f5eb4`, `e5375c2` |

## 2. Decisions taken

- **Promos**: price of the card’s promo on Cardmarket, « ≈ » if there are several or none (M2).
- **Conditions**: usual mapping to Cardmarket’s scale, without a price coefficient per condition (M3).
- **« Fast » mode**: removed (M4).
- **Android signing key**: created by the author (appendix A of the specification), never in the repository (M5).
- **Weekly check** of new cards and translations: on by default, nothing installed without a click (M7).
- **Signed content packs** (Ed25519): only the author makes packs; public key in `electron/packPublicKey.json` (M7e).
- **APK without the large pictures**: received from the PC at the first sync (M7f).
- **Loading screen A « Hextech forge »** (18/11), then a fixed 2.4 s duration (20/11).
- **Detected language**: set aside, not reliable enough (M11c, below).
- **Light continuous integration, without the Git LFS files** (20/11): the free LFS quota would not be enough.

## 3. What is not shipped

- **Detected language (M11c)**: measured on the bench on 173 real photos; a simple reader reads « • FR » on a sharp photo, but the result depends too much on its tuning (0 to 5 errors for ~100 decisions depending on the tuning) and decides nothing for ~45 % of the app’s photos. Report: [STUDY-LANGUAGE.md](STUDY-LANGUAGE.md); script: `scripts/study-language.mjs`.
- **Lot 12, later**: native recognition engine on Android, collecting photos at friends’.
- **Continuous integration**: without the pictures and models, 25 tests are set aside on GitHub (23 for lack of the LFS files, 2 for lack of Python + OpenCV). Recognition, screen tests and the APK are checked locally.

## 4. Checks

| Check | Command | State at 20/11 |
|---|---|---|
| Tests | `npm test` | 259 passed, 1 set aside (bench export, without trial models) |
| Lint | `npm run lint` | no errors |
| Screen tests | `npm run test:e2e` (after `npm run build`) | 3 journeys passed |
| Continuous integration | GitHub’s Actions tab | passed (234 passed, 25 set aside, audit: 0 vulnerabilities) |
| Release package | `npm run release:check` | to run on the version’s package |

**To check on the devices** (I do not drive the phone):

- hands-free scan with a real camera (trigger, only once per card);
- « Prices updated: … » summary after a real price update; « Movements » panel once there are 7 days of history;
- export then import of a friends’ list (Documents/Riftbound, Android file picker);
- card sheet sharp once the large pictures are received from the PC.

## 5. Releasing version 2.1.0

No version had been released yet (no `v*` tag): 2.1.0 was the first. (Since then: 2.1.1, with the licence and the grid scanner.)

1. The 2.1.0 release notes are written in [NOUVEAUTES.md](NOUVEAUTES.md) (shown in the app after an update, and copied as `NOUVEAUTES.txt`); in English since 21/11: [WHATS-NEW.md](WHATS-NEW.md).
2. `npm run release -- 2.1.0` (or `--essai` to try the chain without saving anything): tests, lint, PC installer, signed APK, `release/v2.1.0/` with the guide and the checksums, commit and tag locally.
3. `npm run release:check`, then `git push origin main v2.1.0`, and put the `release/v2.1.0/` folder on the shared Drive.

## 6. Working files outside the repository

Deliberately never versioned: `AMELIORATIONS-APPLI.md`, `AMELIORATIONS-MODELES.md`,
`AMELIORATIONS-NATIF.md`, `CORRECTIONS.md`, `CORRECTIONS-v2.md`, `MODULE-BANC.md`, the bench photos
(`model/real-photos-raw/`), the Android signing key (`android/keystore.properties`, `*.jks`) and the
packs’ private key (`%USERPROFILE%\.riftbound\`).
