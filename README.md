# RiftMancer

> Based on [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) by Nekoraru22 (MIT licence), heavily modified and extended.

*Version française : [README.fr.md](README.fr.md).*

Scanner and collection manager for the **Riftbound** trading card game (League of Legends TCG).
Two apps that share the same data and sync with each other:

- **PC app (Windows)** — interface designed for the mouse and big screens (1080p, 2K, 4K);
- **Android app** — interface designed for the phone, camera scanning.

Card recognition by artificial intelligence (YOLO11 + colour fingerprints, then DINOv2), offline, no account. The app is in **English or French** (Settings → Display; French by default when the phone or PC is in French).

**Documentation**: [security policy](SECURITY.md) · [friends’ guide](docs/FRIENDS-GUIDE.md) (install, pair, sync, update; [French](docs/LISEZ-MOI-AMIS.md)) · [what’s new per version](docs/WHATS-NEW.md) ([French](docs/NOUVEAUTES.md)) · [roadmap](ROADMAP.md) ([French](ROADMAP.fr.md)) · [changelog](CHANGELOG.md) · studies: [AI models](docs/AI-MODELS-REPORT.md), [detected language](docs/STUDY-LANGUAGE.md), [variants](docs/STUDY-VARIANTS.md) (French versions next to them).

---

## Contents

1. [Features](#features)
   - [Scanner](#scanner)
   - [Collection](#collection)
   - [Card sheet (zoom)](#card-sheet-zoom)
   - [Decks](#decks)
   - [Matches](#matches)
   - [Value and Cardmarket prices](#value-and-cardmarket-prices)
   - [Wish list](#wish-list)
   - [Boxes, loans and trades](#boxes-loans-and-trades)
   - [Phone ↔ PC sync](#phone--pc-sync)
   - [Backups](#backups)
   - [Settings](#settings)
2. [Two interfaces: PC and Android](#two-interfaces-pc-and-android)
3. [Install and build](#install-and-build)
4. [Commands](#commands)
5. [Code layout](#code-layout)
6. [Data and storage](#data-and-storage)
7. [Updating the card catalog](#updating-the-card-catalog)
8. [Known limits](#known-limits)
9. [Translation](#translation)
10. [Technical appendix: detection, recognition and model training](#technical-appendix)

---

## Features

### Scanner

- **Camera (phone or webcam)**: frame the card, one tap scans; optional auto scan, torch, camera switch.
- **Hands-free**: phone on a stand (or webcam), each new card laid down and still is scanned without a tap; optional discreet **sounds** (recognised, to confirm, already scanned), off by default.
- **Grid**: a binder page or several cards laid flat, scanned at once. A frame shows on each card, the page is taken as a full-resolution photo when nothing moves, then you check each card (green: recognised, orange: to choose) and tap « Add · next page »; the same page is never taken twice. Into a **binder** box, each card also gets its **page and pocket** (« p. 4, pocket 7 »), shown in the collection and pocket by pocket in the box screen.
- **Photos (PC first)**: drag and drop or pick **several photos at once**, with one or more cards per photo.
  - Each card found is framed on the photo; the 4 corners of a frame can be moved to correct it.
  - Every recognised card is ticked: « Add N cards and go to the next one », or **« Analyse and add everything »** for all the photos.
- **Recognition**: YOLO11s-pose detection (a single float32 model, shipped with the app; on the PC, the graphics card is used through WebGPU), card straightened in perspective, then compared with the catalog: colours first, and when they hesitate, the AI (fine-tuned DINOv2) on the art, both ways round. In photo mode, when few cards are found (photo taken with the phone flat), the detector tries the picture again turned by 90, 180 and 270°.
  - Decision by **centred score and margin** over the second art: calibrated confidence shown, « Sure / Likely / Uncertain ».
  - As soon as there is a doubt, nothing is added and « which one is it? » offers the 5 best. With the camera, a card too small in the picture (under 2 %) is always asked.
  - **Reprints with the same art** (OGN/RAD/VEN runes, ★ versions…): choice of the set under the card, remembered for the session.
  - Battlefields recognised both ways (tested at 180°).
  - **Alternate arts** recognised as separate cards; a **signed** one is grouped with its regular card and the scanner asks which (`docs/STUDY-VARIANTS.md`). Foil cannot be seen on a photo: say so yourself.
  - « Not the right card »: 5 close cards offered, or search by hand.
  - **It learns from your corrections**: the card you pick yourself becomes an example for the next scans (synced with the PC; Settings → Scanner → « Learn from my corrections », « Forget »).
  - Test bench: `npm run eval:matcher` (simulated photos, false positives outside the catalog < 1 %).
- **Immediate feedback**: « Last card added » card on the camera, animations (green recognised, red not recognised, amber same card), vibrations; « Undo »; no duplicate on a double tap; « Same card as just before? Yes +1 / No ».
- **« To add » list**: nothing enters the collection before « Add everything to the collection ». Per card: language (FR/EN), condition, foil, quantity, delete.
- **« Store in »**: scanned cards go straight into a box or a deck.
- **Card language** (FR/EN) chosen before scanning; **« Search for a card »** by name (FR or EN) or number.
- Scan statistics (successful, corrected, undone).

### Collection

- **One copy = one record**: each physical card has its language, condition, foil, location and purchase price.
- **Grid view** (pictures, name in a gold frame, location, price) or **table** (PC) where language, condition, foil, quantity, location and price paid are edited directly.
- **Card size** S / M / L (PC, L by default); full-definition pictures on the PC.
- **Search** (FR/EN name, number), **filters**: domain, set, type, rarity, language, finish, location; **sort**: set and number, name, rarity, quantity, recently added, price.
- Collection **value** shown (and that of the filtered selection), 7-day change.
- **Multiple selection** and deletion, **« Undo »** after any deletion.
- **CSV import** (CardNexus, Riftmana, FR/EN spreadsheet) and **CSV export** (CardNexus, Riftmana…).
- **Progress** per set: cards owned / missing (variants apart), « Add everything to wishes ».
- **All in French**: names and texts shown in French even for English copies (the real language stays on the copy); by default the card language follows the app’s.

### Card sheet (zoom)

- **PC**: compact window (the collection stays visible behind), card on the left, details on the right; keyboard ← → arrows, Esc to close.
- **Phone**: full screen, **swipe left / right** to go to the next card.
- **Staging**: the card rises from a rift in the ground, in its domain’s colours, sways once then settles straight (sharp to read it) while the scenery keeps moving; **legends and cards worth more than €20** get a lightning scenery and an electric frame in the card’s colours.
- **Large card**: on the phone, the scene takes the whole screen width (≈ 264 px of card on a 412 px screen); on the PC, ≈ 343 × 479 px at 1440 × 900. On the phone, the picture is sharp once the large pictures are received from the PC.
  - « Card animations » option for a simple, still card (legends keep their effects).
- **Tabs**: Info (FR/EN text, keywords coloured as on the cards, energy, might, illustrator) · Prices (trend price, foil, **1-month history**, Cardmarket link) · My collection (copies, locations).
- **From the collection**: « Add a copy FR/EN », ♡ wishes.
- **From a deck**: « In the deck − N + » (the deck is changed, never the collection).

### Decks

- **Legend and champion** highlighted (animated), **official rules checked**: 1 Legend, champion = unit named after the Legend, ≥ 40 cards (40 in tournaments), at most 3 per full name, 12 runes, 3 different battlefields, the Legend’s domains, 8-card sideboard.
- Deck / Runes / Battlefields / Sideboard **counters** and warnings.
- **PC — 3-column editor**:
  - the deck as pictures (3 to 6 per row, 3 by default), sorted by **cost, price or name**; under each card: unit price and **« N missing · total price »**;
  - the **catalog always open** (2 cards per row, resizable): one click adds to the **Deck** or the **Sideboard**;
  - the **preview** on the right: the hovered card large, energy and might with icons, price, « + Deck », « + Sideboard ».
  - Shortcuts: right click on a deck card = one copy fewer; right click / wheel in the catalog = full card.
- **Phone**: list per zone with energy and might, « Sideboard » / « Deck » on each card, bin on the last copy; in « Add cards », **holding a finger** on a card opens its sheet with « − / + » in the deck.
- **Link with your copies**: in the deck / free / missing, « Put my free copies in this deck », « Empty the deck », deck value and cost of the missing cards.
- **Missing cards**: « Missing → wishes », **« Missing → Cardmarket »**, and « What I’m missing » for all decks at once (with a « Buy » button per card).
- **Import / export** of lists (deck website text, FR or EN names, card codes), **common deck codes** (Piltover Archive format, read and written; the former `RB1.…` is still read), « Copy for registration », **tournament deck sheet** (print / PDF on the PC); **lend a whole deck**; energy curve; notes; decks sorted « easiest to build ».
- **Signature cards** (3 in total, of the Legend’s champion) and **banned / limited cards** (`public/banlist.json`) checked.
- **Deck versions** (save the list before a tournament, compare two versions, matches attached to the version played), **notes and sideboard plan per opposing Legend**, cards **with changed text** (errata) flagged.
- **Starting hand** (hand of 4, 2-card mulligan, draw) and **exact probabilities** of having a card or a group of cards on turn N, going first or second.

### Matches

- **Quick entry** after a game (opposing Legend, « I went first », Win / Loss / Draw), or full (Bo1 / Bo3 with games, event, round, notes); synced between phone and PC.
- **Statistics**: overall wins, per deck, per Legend played, against each Legend, **matchup matrix**, going first / second, per event (greyed out under 5 games); **CSV export**.
- Full-screen **score counter**: **1v1, 2v2 (11 points) or free-for-all** (3 or 4), first player drawn at random, Bo3, point-by-point history with « Undo the last point », resume an interrupted game, screen kept on; it saves the match at the end.

### Value and Cardmarket prices

- **Cardmarket prices** (public files, game no. 22), updated once a day, **on the PC as on the phone** (without going through the PC); ~1,303 / 1,408 cards found; foil prices for foils. **Reference price** of your choice: trend, 7-day average or low price; ⚠ when the trend is unstable.
- **Dashboard (PC)**: total value, 7-day change, gain, value chart, value per set, biggest rises and drops, **every card in a sortable table**.
- **Statistics**: domains, rarity, type, language, foils, missing cards per set, scan statistics.
- **Alerts on my cards**: a card that goes up or down by more than X % in 7 days (above a minimum value, Settings → Prices), worked out from the history kept by the app; « Movements » panel at the top of Value and a summary after each price update.
- **« Buy on Cardmarket » links** with **adjustable filters**: seller country (France by default), languages (FR + EN), minimum condition (Good).

### Wish list

- Wanted quantity, owned, to buy with the cost, 7-day change, **price alert** (« under €X », notification at the price update).
- **PC**: table in the style of the collection.
- **« Send to my Cardmarket wants »**: the list is copied in Cardmarket’s format (« 2 Jinx, Demolitionist ») and the Cardmarket wants page opens — you still have to paste.

### Boxes, loans and trades

- Storage **boxes**: each copy is in a single place (box, deck or lent); content, value. A box can be a **binder**: pages pocket by pocket (scanner « Grid »).
- **Loans**: people, date, « who has what », « Returned », history; lend a whole deck.
- **Trades and friends**: everyone exports a file with their duplicates and wishes (without prices paid or locations); a friend’s imported list shows what they have that you are looking for, and the other way round; trade **calculator** with the value gap; trade history with « Apply to my collection ». Nothing is sent automatically.
- Your duplicates (adjustable threshold) can still be shared as FR/EN text with prices.

### Phone ↔ PC sync

- **QR code pairing** (address, port, secret key) on the local network.
- **Encrypted exchanges, one key per phone**: each request is signed (anti-replay) and the data is encrypted (AES-256-GCM). The QR code is only used to pair, and only while it is shown on the PC. « Unpair » cuts off a phone without touching the others; « New QR code » invalidates the QR codes already shown or photographed.
- If the PC’s IP address changes, the phone finds it again through mDNS (`_riftbound._tcp`); otherwise « Search for the PC on the network » button.
- PC setting « Allow sync on the network »: when off, the PC can no longer be reached over Wi-Fi.
- **Always manual**, in the chosen direction: « Send to the PC », « Receive from the PC », « Both ways »; the PC can offer « Send to the phone ».
- Incremental sync (the most recent change wins), sync history; new sets and large pictures go from the PC to the phone.
- Everything is synced: copies, wishes, boxes, decks, people, loans, trades.

### Backups

- **PC**: automatic backup (on opening, after a sync with changes, on closing; 30 kept), « Back up now », **restore**; **extra folder** (USB stick, other drive) where each backup is copied, flagged « Not found » without blocking anything.
- **Phone**: automatic backup (at most one a day when something changed, before any data update and before a restore; 10 kept), restore, export to Documents, **weekly copy to Documents/Riftbound** (kept if the app is uninstalled); backup to a file.
- **Sync reminder** on the phone (« N changes not sent to the PC for X days », 7 days by default); **conflicts** (record changed on both sides) noted in the sync history.

### Settings

- **Language of the app**: English or French (the app restarts; card names and texts follow).
- Scanned cards: default condition, language, foil; all in French display.
- Recognition: AI + colours engine (default) or colours only; learning from corrections.
- Card animations; Cardmarket filters; sync; backup; **demo data** (load / remove without touching the real cards).

---

## Two interfaces: PC and Android

The **same code** for the data and the logic, **two separate interfaces**:

| | PC app | Android app |
|---|---|---|
| Chosen | Electron app, or wide browser (≥ 1024 px) | Capacitor app, or narrow browser |
| Navigation | column on the left (Collection, Decks, Value · Scanner · Boxes, Loans, Trades · Settings) | bottom bar: Collection · Decks · **Scanner** · Value · More |
| Scanner | photos first (several at once), webcam optional | camera first, grid mode |
| Collection | S/M/L grid or editable table | grid or list |
| Card sheet | compact window | full screen, swipe to change card |
| Decks | 3 columns: deck, catalog, preview | list per zone, full-screen adding |
| 2K / 4K screens | automatic scaling (125 % / 150 %), maximised window | — |

Interface in **English or French**, « Hextech » theme (midnight blue and gold, official colours of the 6 domains).

---

## Install and build

**Requirements**: Node.js 20+, **Git LFS** (the `*.onnx` models, the `*.webp` pictures and `model/textures/` are stored in LFS: `git lfs install` before cloning); for the APK: Android SDK (Android Studio); for the model: Python 3.

```bash
npm install
npm run dev            # browser version (development)
npm run desktop        # PC app
npm run desktop:exe    # Windows installer → release/RiftMancer Setup <version>.exe
npm run android:apk    # Android APK → release/RiftMancer.apk (installed if the phone is plugged in)
npm run desktop:exe:test  # TEST version of the PC app → release/RiftMancer Test Setup <version>.exe
npm run release -- 2.2.0  # package for friends → release/v2.2.0/ (see « Releasing a version »)
npm run android:apk:test  # TEST version of the Android app → release/RiftMancer-Test.apk
```

### Card content (not in the public repository)

The card pictures, names and texts belong to Riot Games, and the French texts come from riftboundfr.fr: they are not published with the code. On a machine that has them, they are in `public/cards/` and `public/card-hashes.json`. To get them:

- `npm run content:import -- <folder>` copies them from a content folder (a backup, a USB stick: `public/cards/` and `public/card-hashes.json` inside; default `../sauvegarde-contenu`);
- or `npm run catalog:update` builds them from Riot’s official gallery (Python scraper, see the technical appendix), then `node scripts/build-embeddings.mjs` for the AI signatures.

Without them, the app builds but shows no cards, `npm test` sets aside (and names) the test files that need them, and `npm run release` refuses to build a version. `npm run public:export` makes the public copy of the repository (tracked files only, real files for Git LFS) without this content nor the images of unknown licence (`model/textures/`, `model/distractors/`, `model/manual-cards/`, `docs/maquettes/`), and lists the personal traces left to clean.

### Test version and everyday version

Each app exists in two copies that install **side by side**: a new version is tried on the test app without touching the real collection.

| | Everyday | Test |
|---|---|---|
| PC | « RiftMancer » — data `%APPDATA%\riftmancer`, port 47321 | « RiftMancer Test » — data `%APPDATA%\riftmancer-test`, port 47322 |
| Android | « RiftMancer » (`com.riftmancer.app`) | « RiftMancer Test » (`com.riftmancer.app.test`) |

The test apps show an orange **TEST** badge. Pair the test phone with the test PC (QR code of the test PC): the two pairs are independent. On its first launch, the PC app takes over the data folder of the former « Riftbound Scanner » (`riftbound-scanner`), which is left as it was.

> The APK and the installer are built from the project’s main folder: the card pictures (`public/cards/`) must be there.

### Signed APK (release)

Without a key, `npm run android:apk` builds a **debug** APK (debuggable, signed with this PC’s debug key). For a **release** APK (optimised, not debuggable), create a signing key once and keep it safe (without it, the installed app can no longer be updated):

```bash
keytool -genkeypair -v -keystore android/riftbound-release.jks -alias riftbound -keyalg RSA -keysize 4096 -validity 10000
```

Then create `android/keystore.properties` (ignored by git, like the `.jks`):

```properties
storeFile=riftbound-release.jks
storePassword=…
keyAlias=riftbound
keyPassword=…
```

Or use the environment variables `RB_KEYSTORE`, `RB_KEYSTORE_PASSWORD`, `RB_KEY_ALIAS`, `RB_KEY_PASSWORD`. `npm run android:apk -- --debug` forces a debug APK.

> Going from the debug APK to the release APK changes the signature: Android refuses the update. Sync (or back up) the collection, uninstall the app from the phone, then install the new APK.

The version (`versionName`, `versionCode`) comes from `package.json`.

### Signed content packs (app author)

Once: `npm run pack:keygen` creates the Ed25519 key of the packs.
- The **private key** goes to `%USERPROFILE%\.riftbound\pack-signing-key.pem`, **outside the repository** (never committed, never given, never on the Drive), **encrypted** (AES-256) with a **passphrase** typed twice in the terminal: it is never written to disk or to the history, and `npm run pack:sign` asks for it at each signature. A key created before (in clear) is protected with `npm run pack:keygen -- --chiffrer` (same key, same packs accepted).
- **Backup**: a copy of the encrypted key off the PC (USB stick put away, password manager vault) and the passphrase in the password manager, as for the Android key. Never on the shared Drive.
- The **public keys** are in `electron/packPublicKey.json` (to commit), as a **list**: the app accepts a pack signed by any key of the list that is not revoked. Without a valid key, every pack is refused.
- **Changing key (rotation)**: `npm run pack:keygen -- --out <other file>` creates a new key and adds its public key to the list; release a version of the app with this list, then sign the packs with the new key (`--key <file>`); in a later version, `npm run pack:keygen -- --revoquer <fingerprint>` marks the old one revoked.
- **Lost key** (or forgotten passphrase): no pack can be signed with it any more; create a new key as for a rotation and publish it in a new version of the app (friends can still update their content themselves from Settings → Content).
- **Stolen key**: create a new key, revoke the old one in the same version of the app and tell friends to update the app; until then, do not import a pack from an unknown source.

To give a pack: Settings → Content → « Export my content » (`contenu-YYYY-MM-DD.rbpack`), then `npm run pack:sign -- contenu-YYYY-MM-DD.rbpack` (also checks the signature with the app’s public key), then put it on the Drive. On import, the app refuses a pack that is unsigned or signed with another key, a file that was changed, not listed or with a suspicious name (`..`), a pack made for another recognition model or older than the content in place.

### Releasing a version

`package.json` is the **only source of the version**: About (with the build date), the APK (`versionCode` = 10000 × major + 100 × minor + patch) and the installer read it. Each release raises it, otherwise Android refuses the update.

1. Write the release notes in `docs/WHATS-NEW.md` and `docs/NOUVEAUTES.md` (section `## 2.2.0 — date`, for the users), commit.
2. `npm run release -- 2.2.0`: clean Git tree, version higher than every one already released (tags `v*`), signing key present; then version in `package.json`, tests, lint, PC installer, signed APK (refused if signed with the debug key or debuggable, never installed by adb), and package check. Result in `release/v2.2.0/`: installer, APK, `WHATS-NEW.txt` and `NOUVEAUTES.txt`, `FRIENDS-GUIDE.txt` and `LISEZ-MOI-AMIS.txt`, `LICENSE.txt`, `NOTICE.txt`, `THIRD_PARTY_LICENSES.txt` and `EMPREINTES.txt` (SHA-256). The command creates the « Version 2.2.0 » commit and the `v2.2.0` tag locally: `git push origin main v2.2.0`.
3. Copy the whole folder to the shared Drive. Test versions never go there.

`npm run release -- 2.2.0 --essai` does everything in `release/essai-v2.2.0/` with no commit, tag or version change (to try the chain, not to release). `npm run release:check` checks the `release/v*/` folders again: no `.jks`, `keystore.properties`, `.sqlite` database, `real-photos*`, `sauvegarde-modeles`, `model/runs`, `.pt`, `.env`, bench collection data or trial model, including inside the APK and the PC app (`release/win-unpacked`), the licence present, and the checksums.

The installed PC app does not open the developer tools (except the test app); the release APK is not debuggable, so its WebView cannot be inspected, and `allowBackup` is off.

### Signed Windows installer

The installer is not signed: Windows SmartScreen shows a warning (« More info → Run anyway »). With a code-signing certificate, electron-builder signs automatically when these environment variables are set at `npm run desktop:exe` time (never in the repository):

```bash
set CSC_LINK=C:\path\to\certificate.pfx
set CSC_KEY_PASSWORD=…
```

---

## Commands

| Command | Role |
|---|---|
| `npm run dev` | Vite development server |
| `npm run build` | web version in `dist/` (+ thumbnails, ONNX Runtime) |
| `npm run desktop` | builds then starts the PC app |
| `npm run desktop:exe` | Windows installer (NSIS) in `release/` |
| `npm run build:mobile` | web version for Android in `dist-mobile/` |
| `npm run android:apk` | Android APK in `release/`, installed by adb if a phone is plugged in |
| `npm run release -- <version>` | release package in `release/v<version>/` (`--essai`: without saving anything) |
| `npm run content:import -- <folder>` | copies the card content (pictures, catalog) from a content folder into `public/` |
| `npm run public:export -- <folder>` | public copy of the repository, without the card content (default `../riftmancer-public`) |
| `npm run release:check` | checks that no package holds a key, data or a test version, and that the licence is there |
| `npm run thumbs` | card thumbnails (300 px) |
| `npm run icons` | app icons from `public/icon.svg` |
| `npm run catalog:update` | new set: scraper, names, thumbnails |
| `npm run catalog:enrich` | full English names and French names of the catalog |
| `npm run lint` | code check (ESLint) |
| `npm run eval:matcher` | recognition test bench (`--sample 300`, `--aug 3`; report `model/eval-report.json`) |
| `npm test` | automated tests (decks, CSV import, prices, sync and its encryption, backups, server security, translation) |
| `npm run test:e2e` | screen tests: three journeys in the built app (`dist/`, `--build` to build it first), in a phone-sized Electron window — scan a photo and find the card, invalid deck, back up then restore; screenshots of failures in `test-results/e2e/` |

---

## Code layout

```text
src/
  main.jsx               picks the interface: PC (src/desktop) or Android (src/App.jsx)
  App.jsx                Android interface
  desktop/               PC interface: DesktopApp, Sidebar, pages/ (Collection, Scan, Decks,
                         Value, Boxes / Loans / Trades, Settings)
  components/            Android screens and components, and shared components
                         (card zoom, animated scene, card tiles, dialogs…)
  hooks/                 logic shared by both interfaces:
                         useAppController (all the app’s logic), useCollectionFilter,
                         useDeckEditor, useValueData, useCollection, useWishlist, useRecords…
  i18n/en.js             English texts (the French texts are the keys, src/lib/i18n.js)
  lib/                   cardMatcher (recognition), photoScan, gridScan, yoloDetector, deckRules,
                         prices / priceBuilder (Cardmarket), cardmarket (links, wishes),
                         collectionDB (IndexedDB), syncClient, uiPrefs, i18n, zoomGesture…
electron/                PC app: window, SQLite database, sync server, prices, backups
android/                 Android project (Capacitor)
scripts/                 mobile build, APK, icons, thumbnails, catalog, translation tools
model/                   catalog scraper, dataset generation, YOLO training
public/                  ONNX models, catalog (card-hashes.json), card pictures and thumbnails
tests/                   Node tests (npm test)
```

---

## Data and storage

- **Phone / browser**: IndexedDB `riftbound-collection` (one record per copy, timestamped, soft deletion for the sync).
- **PC**: SQLite (`node:sqlite`) in the app’s folder, local sync server (port 47321); backups in the same folder.
- **Prices**: price table + history (31 days per card), kept on the device, usable offline.
- **Catalog**: `public/card-hashes.json` (cards, FR/EN names, texts, colour fingerprints); original pictures in `public/cards/`, thumbnails in `public/cards/thumbs/`.

---

## Updating the card catalog

**From the PC app, without development tools**: Settings → **Content**.
- *Cards* → « Search »: reads Riot’s official gallery, shows the new and changed cards, then, after « Install », checks fingerprint parity on 50 cards, downloads the pictures, works out colour fingerprints, AI signatures and reprint groups. Weekly check at start (can be turned off).
- *French translations* → « Update » or « Import files… » (riftboundfr.fr).
- *Banned cards* → « Update » (official tournament rules, + an announcement) or « Edit by hand ».

- *Packs* → « Export my content » / « Import a pack… »: a single friend does the update, the others import their pack (even without Internet). A pack is only accepted **signed by the app’s author** (see above).

These updates are layers on top of the shipped content (`userData/catalogue/`), which the phone receives at the sync; « Go back to the original content » removes them. For the shipped app itself (new version), the development chain remains:

```bash
npm run catalog:update   # new set: downloads, updates names and thumbnails
```

Details (scraper, fingerprints, when to retrain the model): see the [technical appendix](#technical-appendix).

---

## Known limits

- **Cardmarket account**: no direct link (Cardmarket’s API is for professional sellers only); wishes go through copy and paste.
- **French pictures**: Riot does not publish card pictures in French; French names and texts come from the catalog data.
- Prices do not distinguish languages (Cardmarket trend price).
- **Unsigned Windows installer** (SmartScreen warning); **debug APK** as long as no key is set up (see « Signed APK »), and `npm run release` then refuses to build.
- The sync goes over HTTP on the local network, but its content is end-to-end encrypted; pictures and the catalog (public data) travel in clear, the catalog being checked by its fingerprint.

---

## Translation

The app is in English and French (`src/lib/i18n.js`). The texts are written in French in the code and are the keys: `tx('Ajouter à la collection')` shows « Add to collection » in English, from `src/i18n/en.js`; `tp(n, '{n} carte', '{n} cartes')` picks the singular or plural. The PC app’s own dialogs use `electron/i18n.cjs`. `npm test` fails if a text has no English version (`tests/i18n.test.mjs`). Tools: `node scripts/i18n-wrap.mjs` (marks the French texts of new screens) and `node scripts/i18n-extract.mjs` (lists the texts still to translate).

---

## Credits

Free, non-commercial fan project.

RiftMancer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

> RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.

Riftbound and League of Legends are trademarks of Riot Games, Inc.

**Licence**: RiftMancer is free software under the **GNU AGPL-3.0** (or later, [LICENSE](LICENSE)): you may copy, modify and redistribute it, provided you share the source code under the same licence. The card detector is trained with Ultralytics YOLO11 (AGPL-3.0), hence this licence. Based on [riftbound-scanner](https://github.com/Nekoraru22/riftbound-scanner) by Nekoraru22 (MIT licence), heavily modified and extended. The parts that come from riftbound-scanner keep their MIT notice (in [NOTICE](NOTICE)). The licence only covers the code: the names, cards, pictures, texts and trademarks of Riot Games are not part of it. Licences of the AI models and of the code taken from others: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

<a id="technical-appendix"></a>

## Technical appendix

### Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        cards_scraper.py                          │
├──────────────────────────────────────────────────────────────────┤
│  1. Fetch gallery HTML                                           │
│  2. Extract card data from __NEXT_DATA__                         │
│  3. Normalize and save to SQLite                                 │
│  4. Download + optimize + rotate images (parallel WebP)          │
│  5. Adaptive crop (per card type) → eq. → 16×16 color grid  ───┐ │
└──────────────────────────────┬─────────────────────────────────│─┘
                               │                                 │
                               ▼                                 ▼
┌────────────────────────────────────────┐  ┌────────────────────────┐
│           data_creator.py              │  │    card-hashes.json    │
├────────────────────────────────────────┤  └───────────┬────────────┘
│  1. Load card images from SQLite       │              │
│  2. Generate synthetic backgrounds     │              ▼
│  3. Place cards with random transforms │  ┌────────────────────────┐
│  4. Apply augmentation pipeline        │  │  Frontend Card Matcher │
│  5. Export YOLO pose dataset           │  │  (color grid cosine,   │
│                                        │  │   then DINOv2 if unsure│
└──────────────────┬─────────────────────┘  └────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│              train.py                  │
├────────────────────────────────────────┤
│  1. Check the local CUDA GPU           │
│  2. Train YOLO11s-pose (416, multi-    │
│     scale)                             │
│  3. Export to ONNX (model/runs/…)      │
│  4. Bench, then ship by hand to        │
│     public/models/                     │
└────────────────────────────────────────┘
```

### How Detection Works

The scanner uses a **dual-layer approach** to scan cards in real time:

| Layer | Model | Question it answers | Details |
|-------|-------|---------------------|---------|
| **Detection** | YOLO11s-pose, one float32 model with a variable input size (`public/models/yolo11s-pose-riftbound-dyn.onnx`), run at **320 px** in camera mode and **416 px** in photo mode (`MODE_SIZES`, `yoloDetector.js`) | *Where* is there a card? | Locates cards in the camera frame and regresses the 4 card corners as keypoints (handles any rotation). Single class (`card`), trained on synthetic data. Out-of-focus crops are filtered out via Laplacian variance so background cards don't get matched. |
| **Identification** | Color grid fingerprint, then AI when the colors hesitate | *Which* card is it? | Crops the detected region to the artwork area (adaptive per card layout), computes a 16×16 color grid with histogram equalization, and finds the best match via cosine similarity. When the colors are not sure, a fine-tuned **DINOv2-small** (`public/models/dinov2s-ft-fp16.onnx`, 168×168 input) scores the 100 best color candidates and a combined score decides (cascade: see `docs/RAPPORT-MODELES-IA.md`). Only one scan mode remains (« Prudent »): a doubtful card is never added without asking. Tests normal, 90°-rotated and horizontally-flipped orientations to handle landscape battlefields and mirrored photos. The user can drag the 4 corner keypoints on screen to manually fine-tune the crop — a perspective warp re-runs the matcher with the corrected quad. |

YOLO alone doesn't know which card it's looking at — it only finds rectangular card-shaped objects. The color grid matcher, helped by the AI model when needed, then takes each crop and identifies the specific card. Réglages → Scanner can switch to colors only (« Couleurs seules »).

### Card Identification Pipeline

#### Artwork Crop (adaptive per card layout)

Before any feature extraction, the card image is cropped to isolate the illustration. Different card types have different art layouts, so the crop bounds are picked per card from a small table — same bounds are used at scrape time (to compute the DB feature) and at match time (to compute the query feature), so cosine similarity stays apples-to-apples.

| Card type                                  | Bottom edge | Why                                                                                                                            |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `unit / spell / gear / rune`               | **0.55**    | Standard layout: art occupies the top half, text/stats below.                                                                  |
| `legend`                                   | **0.85**    | Legends have a smaller text box; the illustration extends further down.                                                        |
| `battlefield` + `*a*` / `*-star-*` variants | **0.95**    | Full-art cards (alt-arts, star variants) and battlefields (landscape art rotated to portrait) — almost the whole card is illustration. |

The horizontal bounds are fixed at 5%–95% across all types to trim the outer black border. Each card stores its `artBottom` in `card-hashes.json`; the matcher reads it and picks the matching query crop per candidate.

```text
Standard card (0.55)            Legend (0.85)             Full-art / battlefield (0.95)
┌──────────────────┐           ┌──────────────────┐      ┌──────────────────┐
│    Card Name     │           │    Card Name     │      │                  │
├──────────────────┤           │                  │      │                  │
│                  │           │                  │      │                  │
│   Illustration   │  ─55%─►   │   Illustration   │      │   Illustration   │
│                  │           │                  │      │   (full bleed)   │
├──────────────────┤           │                  │ ─85%►│                  │
│   Card Text      │           ├──────────────────┤      │                  │
│   Stats / Energy │           │   Card Text      │      │                  │ ─95%►
└──────────────────┘           └──────────────────┘      └──────────────────┘
```

#### Color Grid Matching

Each card's artwork is converted into a compact numerical fingerprint:

```text
Artwork Crop              Histogram Eq.           16×16 Color Grid         Feature Vector
┌────────────────┐       ┌────────────────┐      ┌─┬─┬─┬─┬─┬─┬─┬─┐
│                │       │                │      │ │ │ │ │ │ │ │ │    [0.12, 0.34, 0.56,  ← R,G,B cell 1
│  Illustration  │ ────► │  Normalized    │ ───► ├─┼─┼─┼─┼─┼─┼─┼─┤     0.23, 0.45, 0.67,  ← R,G,B cell 2
│                │  eq.  │  Brightness    │      ├─┼─┼─┼─┼─┼─┼─┼─┤     ...
│                │       │                │      │ │ │ │ │ │ │ │ │     0.89, 0.12, 0.34]  ← R,G,B cell 256
└────────────────┘       └────────────────┘      └─┴─┴─┴─┴─┴─┴─┴─┘
                                                  256 cells             768 values (256 × 3 RGB)
```

1. **Histogram equalization**: Per-channel brightness normalization so dark photos match well-lit references
2. **Resize**: Equalized artwork is resized to 16×16 pixels
3. **Color extraction**: Each pixel's RGB values are normalized to 0-1 range
4. **Cosine similarity**: Query vector is compared against all stored card vectors
5. **Best match wins**: The card with the highest similarity is selected

#### Full-Resolution Cropping

When uploading a multi-card image, the app resizes it to 2048px for YOLO detection (which processes at 416×416 internally), but crops each detected card from the **original full-resolution image**. This ensures each card has maximum pixel detail for the color grid, even when many cards share a single photo.

#### Manual 4-Corner Correction

When YOLO's corner keypoints are off (slight angle error, clipped corner, perspective distortion from photographing at an angle), the user can drag the 4 corner handles on a selected detection to fit the card precisely. The handles appear on whichever detection is selected; dragging any of them deforms the quadrilateral freely — there's no rectangle constraint, so it captures real perspective.

On pointer-up, the app:

1. Geometrically sorts the 4 dragged points into visual TL → TR → BR → BL order (so the warp is robust to whichever corner the user moved past which other corner).
2. Solves an 8×8 linear system for the perspective matrix that maps the destination rectangle to the source quadrilateral.
3. Runs a bilinear-interpolated **perspective warp** over the original full-resolution image — un-distorting the card to an axis-aligned crop. If the user-drawn quad is wider than tall, the warp also rotates 90° to keep the matcher seeing a portrait layout (so `artBottom` still works).
4. Re-runs `identifyCard` on the new crop and updates the side panel with the new top-1 match.

The implementation lives in [src/lib/perspectiveCrop.js](src/lib/perspectiveCrop.js); UI/interaction in [src/components/identify/DetectionCanvas.jsx](src/components/identify/DetectionCanvas.jsx).

#### Sharpness Filter

After YOLO produces oriented bounding boxes, each crop's **Laplacian variance** is measured at 64×64 grayscale. Crops below a configurable threshold (default 100) are dropped before identification — this stops the matcher from confidently labeling out-of-focus cards in the background of a photo as random matches. Sharpness can be tuned via `detector.sharpnessThreshold` from the dev console.

#### Orientation Handling

Cards can be scanned in any rotation, mirrored (selfie cam, scan through glass), or laid out as landscape battlefields. The matcher tests up to three orientations per detection and keeps the best:

```text
┌─────────┐      ┌───────────────┐      ┌─────────┐
│         │      │               │      │         │
│  Card   │      │     Card      │      │  draC   │  (mirrored)
│         │      │               │      │         │
└─────────┘      └───────────────┘      └─────────┘
   Normal       Landscape (rot 90°)     Horizontal flip

Best similarity across the three is used
```

### Synthetic Dataset Generation

`data_creator.py` generates a synthetic YOLO pose training dataset by compositing card images onto randomized backgrounds with heavy augmentation. Each card is labeled with its 4 corners as keypoints. The goal is to train a model that detects cards in real-world camera frames and locates their corners precisely.

```bash
cd model
python data_creator.py
```

Generation is parallelized across all CPU cores using `ProcessPoolExecutor`.

#### Augmentation Pipeline

Each training image goes through the following pipeline:

```text
Background Generation          Card Placement              Global Augmentations
┌───────────────────┐        ┌──────────────────┐        ┌────────────────────┐
│ - Solid color     │        │ - Random scale   │        │ - Brightness       │
│ - Gradient        │  ───►  │ - Random rotation│  ───►  │ - Contrast         │
│ - Perlin noise    │        │ - Perspective    │        │ - Saturation       │
│ - Blurred noise   │        │ - Shadow casting │        │ - Hue shift        │
│ - Two-tone split  │        │ - Overlap avoid  │        │ - Color jitter     │
│ - Real texture    │        │ - Sleeve overlay │        │ - Gaussian noise   │
│ + Lighting grad.  │        │ - 1-5 cards      │        │ - Motion blur      │
│ + Distractors     │        │                  │        │ - JPEG artifacts   │
└───────────────────┘        └──────────────────┘        │ - Vignette         │
                                                         │ - Cutout           │
                                                         └────────────────────┘
```

The generator picks one of four scene modes per image:

- **Standard scene** (~60%): 1–5 cards placed with random transforms and overlap avoidance.
- **Grid layout** (~25%, `GRID_PROB`): cards arranged in a 2×2 up to 5×6 grid with light jitter — simulates organized collection scans, including the dense tiny-card case YOLO previously failed at.
- **Close-up** (~15%, `CLOSEUP_PROB`): a single card scaled 0.85×–1.30× of the frame, optionally clipped by the image edges — teaches the model to keep detecting cards that fill or overflow the camera view.
- **Mosaic** (~25% of train images, `MOSAIC_PROB`): YOLOv4-style 4-quadrant composition with independent sub-scenes.

**Sleeve simulation** (`SLEEVE_PROB = 0.30`): before placement, ~30% of cards get a sleeve overlay — colored border, diagonal glare streak, and 0–3 specular highlights — so the detector learns the look of cards through plastic sleeves with reflections.

#### Optional Assets

Place these in the `model/` directory before running the generator:

| Directory | Contents | Effect |
| --- | --- | --- |
| `textures/` | JPG/PNG photos of real surfaces (desks, mats, tables) | Used as backgrounds 40% of the time |
| `distractors/` | PNG objects with alpha (dice, tokens, sleeves) | Placed randomly to teach the model to ignore non-card objects |

#### Configuration

Key settings at the top of `data_creator.py`:

| Setting               | Default     | Description                                                                  |
| --------------------- | ----------- | ---------------------------------------------------------------------------- |
| `IMAGES_PER_CARD`     | 150         | Synthetic images generated per card                                          |
| `OUTPUT_SIZE`         | 768         | Image dimensions (768×768); training draws its input size from them (`imgsz=416`, multi-scale) |
| `MAX_CARDS_PER_IMAGE` | 5           | Maximum cards per standard scene                                             |
| `TRAIN_RATIO`         | 0.85        | Train/val split ratio                                                        |
| `CARD_SCALE_MIN/MAX`  | 0.10 / 0.95 | Card size range relative to image — high max lets cards fill the frame      |
| `ROTATION_RANGE`      | -75 to 75   | Rotation angle range in degrees                                              |
| `MOSAIC_PROB`         | 0.25        | Probability of YOLOv4-style 4-quadrant mosaic                                |
| `GRID_PROB`           | 0.25        | Probability of a grid layout (up to 5×6)                                     |
| `CLOSEUP_PROB`        | 0.15        | Probability of a single oversized card (possibly clipped by edges)           |
| `SLEEVE_PROB`         | 0.30        | Probability of applying sleeve overlay per card                              |

#### Generated Dataset Structure

```
model/dataset/
├── data.yaml
├── train/
│   ├── images/
│   │   └── synth_000000.jpg, synth_000005.jpg, ...
│   └── labels/
│       └── synth_000000.txt, synth_000005.txt, ...
└── val/
    ├── images/
    └── labels/
```

| File/Folder | Description |
| --- | --- |
| `data.yaml` | YOLO config file. Points to train/val paths, defines class count (`nc: 1`), class names (`['card']`) and keypoint shape (`kpt_shape: [4, 2]`). Rewritten by `train.py` with remote paths during cloud training. |
| `train/` | 85% of the dataset. Used by YOLO to learn during training. |
| `val/` | 15% of the dataset. Used by YOLO during training to measure progress and pick the best checkpoint. |
| `images/` | Synthetic 768×768 JPG images generated by `data_creator.py`. Each contains 1–30 cards (single card up to a 5×6 grid) on randomized backgrounds. |
| `labels/` | One `.txt` per image (same name). Each line is one card detection in YOLO pose format. |

#### Label Format (YOLO pose)

Labels are generated automatically by `data_creator.py` alongside each image. Since the cards are placed synthetically, the script knows the exact position, rotation, and scale of every card it composites — so it writes the corresponding label file with the precise corner coordinates. No manual annotation is needed.

Each line in a label file describes one card with an axis-aligned bounding box plus its 4 corner keypoints:

```
class cx cy w h x1 y1 x2 y2 x3 y3 x4 y4
```

Example: `0 0.612 0.418 0.647 0.583 0.288 0.399 0.508 0.138 0.935 0.434 0.705 0.721`

| Field | Meaning |
| --- | --- |
| `0` | Class ID (always `0` = card, since there's only one class) |
| `cx cy w h` | Center, width and height of the axis-aligned bounding box enclosing the 4 corners, normalized to 0-1. |
| `x1 y1` ... `x4 y4` | The 4 card corners as keypoints, normalized to 0-1, in TL → TR → BR → BL order relative to the card art. `kpt_shape: [4, 2]` means each keypoint carries only `(x, y)` — no visibility flag, since card corners are always considered visible. |

### Training (local GPU)

`model/train.py` trains on a local NVIDIA graphics card (it refuses to start without CUDA). Setup and commands are in its header:

```bash
python model/data_creator.py                       # dataset → model/dataset/ (once)
model/.venv-train/Scripts/python model/train.py    # train + export
model/.venv-train/Scripts/python model/train.py --resume
model/.venv-train/Scripts/python model/train.py --export-only
```

Same hyper-parameters as the former cloud training (Modal, A100, `imgsz=768`), except **`imgsz=416` with multi-scale training** (input drawn in 208–650 px at each batch), so that one model works well from 320 to 768 px and the phone can run the detector on small images.

| Setting | Value |
|---------|-------|
| `imgsz` | 416, `multi_scale=0.5` (the dataset images stay 768×768, `OUTPUT_SIZE` in data_creator) |
| `task` / `kpt_shape` | `pose` / `[4, 2]` (4 corner keypoints, x/y only) |
| `epochs` | 80 with `patience=40`, `cos_lr=True` |
| `close_mosaic` | 15 |
| `pose` / `box` / `cls` | 25.0 / 7.5 / 0.3 (keypoint loss weighted high for tight corner localization) |
| `hsv_v` / `mixup` / `degrees` | 0.6 / 0.2 / 3.0 |
| `fliplr` / `flipud` | 0.0 / 0.0 (no flips — see dataset notes above) |

The export goes to `model/runs/train/weights/export/`; `public/models/` is never touched by the script: a model is shipped only after it has been measured on the bench (`scripts/eval-detector.mjs`) and chosen. Trial models are kept outside Git LFS (only shipped models go there).

### Models shipped

| File | Role | Format |
|------|------|--------|
| `public/models/yolo11s-pose-riftbound-dyn.onnx` | card detector (4 corners) | float32, variable input size (320 / 416 px) |
| `public/models/dinov2s-ft-fp16.onnx` | AI recognition (illustration embedding) | DINOv2-small fine-tuned, float16, 168×168 |

Both ship with the app (PC and Android) and are checked by their SHA-256 (`scanRules.js`). The former choice « Normal (float32) / Rapide (int8) » no longer exists: one detector model for everyone (preferences v4 removed the old keys and the models once downloaded from the PC).

### Updating the Card Database

When a new RiftBound set drops or new promos are added to the official gallery, you only need to refresh the local card data — **you do not need to retrain YOLO** to recognize new cards. The detector finds "cards" generically (single class); the matcher is what identifies a specific card, and it only needs `card-hashes.json` updated.

#### Quick update — most common case

Run the full scraper once. It re-fetches the gallery, downloads any new card images, and regenerates `card-hashes.json` from scratch:

```bash
cd model
python cards_scraper.py
```

That's it. After the run finishes, hard-refresh the web app (`Ctrl+Shift+R`) and the new cards will be matchable immediately.

What the scraper does, in order:

1. Fetches `https://riftbound.leagueoflegends.com/en-us/card-gallery/` and parses `__NEXT_DATA__`.
2. Inserts new rows into `model/riftbound.db` (`INSERT OR REPLACE`, so existing rows are updated).
3. **Wipes and recreates** `public/cards/` with all current cards as WebP. Landscape battlefields are rotated to portrait at this step.
4. Regenerates `public/card-hashes.json` with adaptive crop per card type.

#### Just regenerate hashes (no re-download)

If you only changed feature-extraction code (`_compute_color_grid`, `_equalize_histogram`, `ART_REGIONS`, `GRID_SIZE`, etc.) and the card images on disk are already up to date:

```bash
cd model
python cards_scraper.py --only-hashes
```

This skips the network fetch and the image download/optimization pass and reuses the existing `public/cards/*.webp`. About 30 seconds for ~950 cards.
Use `npm run build` to rebuild the web app with the new hashes.

#### Card thumbnails

`npm run build` also creates small previews (`public/cards/thumbs/`, 300 px wide) used by the collection list. The original images in `public/cards/` are never modified and are still used for detail views. Run `npm run thumbs` to (re)generate them manually (`npm run thumbs -- --force` to rebuild all).

#### Offline runtime

The ONNX runtime is bundled with the app (no CDN): `npm run dev` / `npm run build` copy its WASM files to `public/ort/`. The models must be in `public/models/` (`yolo11s-pose-riftbound-dyn.onnx` and `dinov2s-ft-fp16.onnx`, see « Models shipped »).

#### PC app and Android app (local sync)

The collection is local-first: the phone works on its own data and syncs with the PC app when the user taps « Synchroniser maintenant » (manual by design), both on the same Wi-Fi. Nothing is hosted online. Synced collections: `copies`, `wishlist`, `boxes`, `decks`, `people` (with the friends' lists), `loans`, `trades`, `matches`, `learned`.

- **PC app (Electron)** — `npm run desktop` (builds the web app, then opens it). The PC keeps the collection in SQLite (`%APPDATA%/riftbound-scanner/collection.sqlite`), runs a local sync server on port **47321** and makes automatic backups (`backups/`, last 30). Windows asks once to allow the app on the network: allow **private networks**.
- **Android app (Capacitor)** — `npm run build:mobile` builds `dist-mobile/` (thumbnails and the two models, without the full-size images: APK ≈121 MB) and syncs it into `android/`; `npm run android:apk` also builds the APK (release when `android/keystore.properties` exists, otherwise debug; needs the Android SDK; set `ANDROID_HOME` if Gradle can't find it). Full-size images and newer sets are downloaded from the PC during sync.
- **Pairing** — PC app: Réglages → QR code. Phone: Réglages → « Scanner le QR code du PC ». The QR contains the PC address, port and a secret; if the PC's IP changes, the phone finds it with mDNS (`_riftbound._tcp`, `electron/mdns.cjs` + the app's `DiscoveryPlugin.java`), or with a manual, throttled /24 scan.
- **Sync protocol v3** (`electron/syncCrypto.cjs`, `src/lib/syncProtocol.js`) — secrets never travel in clear; HKDF-SHA256 derives an AES-256-GCM key and an HMAC key from each. The QR code secret only signs `/api/pair`, accepted for 5 min while the QR code is shown; the PC answers with a per-phone key (and its PC secret). Every other request carries `X-RB-Device` and is signed with that phone's key: `X-RB-Time`, `X-RB-Nonce`, `X-RB-Sig` (HMAC of method, path, time, nonce, body hash; ±5 min, nonces remembered 10 min); bodies are encrypted and bound to the request nonce. Unpairing deletes the phone's key. `/api/hello` is public and only returns `{ app, proto, pcIdHash }` — a fingerprint that changes every UTC day (phones accept yesterday / today / tomorrow). Catalog and banlist integrity: full SHA-256. CORS is limited to the app WebView origin; 20 failed authentications per minute and IP → 429.
- **Sync logic** — the phone pushes its unsynced records and pulls what changed on the PC since its last sync (sequence number). Conflicts: most recent `updatedAt` wins; deletions are tombstones.

#### Cardmarket prices

The PC app downloads Cardmarket's public Riftbound files (`productCatalog/productList/products_singles_22.json` and `priceGuide/price_guide_22.json`) at most once a day and links products to cards (`electron/prices.cjs`; full English names from the Riftcodex API, cached a week). Trend price in EUR, foil price for foil copies. Stored in `%APPDATA%/riftbound-scanner/prices.json`, a daily collection value snapshot in SQLite (`valueHistory`), and sent to the phone at sync (`GET /api/prices`).

#### Collection storage

The collection is stored in IndexedDB (`riftbound-collection`), one record per physical copy (card id, language, finish, condition…), with `updatedAt` and a `deleted` tombstone for the phone ↔ PC sync. On the PC app the same records live in SQLite (see above). See `ROADMAP.md` for planned features.

#### French card names and texts

Riot's `fr-fr` gallery only translates UI labels, so French names and rules texts come from the two static files published by [riftboundfr.fr](https://riftboundfr.fr/cartes) (thanks to them). The site is behind a bot checkpoint, so download them **from your browser** into `model/fr/` (these two files are currently committed in the private repository — see CHANGELOG « Hygiène du dépôt » before making it public):

- `https://riftboundfr.fr/repertoire-cartes.json` → `model/fr/repertoire-cartes.json`
- `https://riftboundfr.fr/textes-cartes.json` → `model/fr/textes-cartes.json`

Then regenerate the hashes (`python cards_scraper.py --only-hashes`). Each card in `card-hashes.json` gains `nameFr` / `textFr` (joined on the card id; `ogn-299*-298` star slugs are mapped to `ogn-299-star-298`). Without the files the scraper simply skips French data. Not every card has a French text (runes, some recent cards): the app falls back to English.

In the app, pick **EN / FR** at the top of the Scan tab before scanning — new cards get that language (it is the same setting as *Settings → Language*). Each card can still be switched individually in its detail panel or in the collection. French and English copies of the same card are kept as separate stacks, the collection can be filtered by language, and the CardNexus export writes the copy's language in its `Language` column.

#### When you actually do need to retrain YOLO

You only need to re-run training if you change something that affects detection (not identification). New cards alone do not require a retrain — they're just more rows in the matcher's lookup table.

| Change | Do you need to retrain YOLO? |
|--------|------|
| New cards added (new set / promos) | **No** — just `python cards_scraper.py` |
| New artwork style with very different shape/colors | Usually no, unless the model misses detecting them |
| Change `OUTPUT_SIZE`, `imgsz`, or model arch | Yes — `modal run --detach train.py` |
| New augmentation (sleeves, grids, close-ups, etc.) | Yes — regenerate dataset + train |

Retrain workflow when needed:

```bash
cd model
python data_creator.py            # Regenerate synthetic dataset locally (CPU)
modal run --detach train.py       # Upload + train on Modal A100, ~1–2 h
# When training finishes:
modal run train.py --export-only  # Download exported ONNX to public/models/
```
