# Roadmap — RiftMancer (formerly Riftbound Scanner)

*Version française : [ROADMAP.fr.md](ROADMAP.fr.md).*

Feature tracking file. Updated as development goes.
Key: `[x]` done · `[~]` in progress · `[ ]` to do

## Decisions taken

- **No online hosting.** Data 100 % local, phone ↔ PC sync over Wi-Fi.
- **Platforms**: Android (Capacitor 8) + Windows PC (Electron, SQLite built into Node). iPhone possibly later (same code).
- **Stack**: React + Vite (unchanged), SQLite on the PC, local database on Android. Python stays for the scraper.
- **Devices**: 1 phone + 1 PC paired (QR code).
- **Manual sync** (decision of 05/11/2026): only when the user taps « Sync now » on the phone, so as never to mix in work in progress on the PC. The phone works alone off the network. Record-by-record merge: only a card changed on both sides is in conflict (the most recent wins).
- **Target volume**: several thousand copies → virtualised lists, targeted writes, incremental sync.
- **Data model**: one physical copy = one record (unique id + modification date); the display groups them in stacks.
- **Pictures**: thumbnails included in the Android app, large pictures sent by the PC at the first sync. **No loss of quality**: the original pictures are never changed, the thumbnails are extra files.
- **Storage**: a single level (boxes).
- **Loans**: reusable list of people.
- **Decks**: Riftbound deck-building rules checked.
- **Prices**: Cardmarket, « trend » price, in €, no FR/EN distinction.
- **Interface**: in French at first; **English and French since 21/11/2026** (English by default unless the system is in French).
- **No existing collection to migrate.**
- **GitHub**: private repository FaZox/RiftboundApp; changes in this folder, commit / push only on request.

## Already done

- [x] Language choice (EN/FR) before scanning
- [x] Language shown and filterable in the collection; stacks split by language
- [x] French names and texts of the cards (riftboundfr.fr data, `model/fr/`)
- [x] CardNexus export with the Language column

## Phase 1 — Foundations ✅

- [x] YOLO model copied to `public/models/` (normal + int8 `-q8`); scan tested (97 % on a test card)
- [x] onnxruntime built into the app (no more CDN) — `scripts/copy-ort.mjs`, run by `npm run dev` / `npm run build`
- [x] Fonts built in (no more Google Fonts), unused TensorFlow.js CDN removed
- [x] `card-hashes.json` slimmed from 12 MB to 2.2 MB without loss (field `d` removed, fingerprints as base64 bytes)
- [x] New local IndexedDB database `riftbound-collection` (replaces `localStorage` and the dead code `src/lib/indexedDB.js`)
- [x] « One copy = one record » model (`src/lib/collectionDB.js`, `src/hooks/useCollection.js`) with `updatedAt` + soft deletion for the future sync
- [x] Virtualised collection list (@tanstack/react-virtual) — tested with 5,000 copies
- [x] 300 px thumbnails (`scripts/make-thumbs.mjs`, `npm run thumbs`); originals intact
- [x] PWA caching: thumbnails preloaded, large pictures and models cached on first use
- [x] Interface entirely in French (rarity, type and domain translated)

## Phase 2 — Apps and sync ✅

- [x] Electron PC app (`electron/`, `npm run desktop`): built-in SQLite, local sync server (port 47321)
- [x] Capacitor Android app (`android/`, `npm run android:apk` → APK ≈ 55 MB), camera allowed
- [x] QR code pairing (address + port + secret key) in Settings, or code to paste
- [x] **Manual** incremental sync (button), with the number of changes waiting; the most recent change wins
- [x] If the PC’s IP address changes, the phone finds it again on the local network
- [x] Large pictures and new sets (catalog) sent from the PC to the phone, with progress; option not to download the large pictures
- [x] Automatic backup on the PC (opening, after a sync with changes at most every 10 min, closing; 30 kept) + « Back up now » button
- [x] Tested: sync both ways, deletion, auto sync after a change, refused code (401), real PC app through the Wi-Fi address
- [x] Trial on a real Android phone (Android 16): install, detection model, pairing and sync OK
- [ ] Android app icon (currently Capacitor’s default one)
- [ ] Windows installer (.exe) — for now the PC app starts with `npm run desktop`

## Phase 3 — Collection ✅

- [x] Sort (set and number, name, rarity, quantity, recently added) and filters: set, type, rarity, domain, language, finish
- [x] Filter by location (box / deck / lent / no location)
- [x] Card zoom: large original picture, FR/EN name and text (energy, rune, exhaust, might icons), copies owned, quick add, wish list
- [x] Progress per set (base cards + variants apart) and missing / owned cards as a grid
- [x] Tradeable cards: adjustable threshold (3 by default), extra copies per card
- [x] Synced wish list (wanted quantity, « obtained » when owned, adding all the missing cards of a set)

## Phase 4 — Organisation ✅

- [x] « Organise » tab: Decks, Boxes, Loans (all synced with the PC)
- [x] Storage boxes (one level): create, rename, delete (the cards go back to « no location »), content as a grid
- [x] Each copy is in a single place: box, deck, lent (a lent deck keeps its deck); « Store » button on each Collection line (quantity of your choice)
- [x] Decks: Legend, chosen champion, main deck, runes, battlefields; adding by searching the whole catalog (the Legend’s domains, « only my cards »)
- [x] Rule check (`src/lib/deckRules.js`, adjustable in `RULES`), **checked against the official rules**: 1 Legend, champion = unit named after the champion, ≥ 40 cards (exactly 40 in tournaments: warning), max 3 per full name (« Jinx - Demolitionist » ≠ « Jinx - Rebel », champion included), 12 runes, 3 different battlefields, the Legend’s domains, 8-card sideboard
- [x] Link with the real copies: in the deck / free / missing per card, « Put my free copies in this deck », « Empty the deck », « Missing → wishes » (a copy cannot be in two decks)
- [x] Scan straight into a box or a deck (menu next to EN/FR, visible as soon as a box or a deck exists)
- [x] Loans: reusable list of people, date, « Returned », « who has what » view, history
- [x] « Location » filter in the Collection; CSV export merges the locations
- [x] Import/export of deck lists: deck website text (Legend / Champion / MainDeck / Battlefields / Runes / Sideboard), English or French names, card codes, « 3x » / « x3 »; export in English or French, copy or .txt
- [x] Lend a whole deck in one gesture (« Lend the deck » → « Returned »)
- [x] Sideboard in the decks
- [x] Energy curve and split by type of a deck
- [x] Decks sorted « easiest to build » (missing cards) and « buildable with your collection » mention

## Phase 5 — Prices ✅

- [x] Source: Cardmarket’s public files for Riftbound (game no. 22: product catalog + price guide, updated every day, no account)
- [x] Cards ↔ Cardmarket products matching (`electron/prices.cjs`, `src/lib/priceBuilder.js`): each printing’s product from rifthunt (cached 7 days; by full English name through Riftcodex when rifthunt does not answer, set by common names, variants in Cardmarket’s order of addition) — **1,408 / 1,408 cards** found, promo printings and promo prices included
- [x] Fetched by the PC at start then every 3 h (downloaded at most once a day); « Update the prices » button; sent to the phone at the sync (then works offline)
- [x] « Trend » price; foil price for foil copies; no FR/EN distinction
- [x] Price per card (zoom + « See on Cardmarket » link), per Collection line, sort by price, total value (filtered)
- [x] « Value » view: total, per set, the most expensive, value chart
- [x] Value of the decks and cost of the missing cards; estimated cost of the wish list
- [x] Value history: one point per day (kept 2 years), computed on the PC
- [x] Cardmarket link: direct product page, normal and promo (`Singles/Unleashed/Mutated-Mouser`, `Singles/Unleashed-Promos/Mutated-Mouser`), names and versions written as Cardmarket does
- [x] Price history of each card over 1 month (one point per day, on the PC, sent to the phone) + 7-day / 30-day change (Cardmarket averages while the history fills up)
- [x] Price history kept beyond a month (every day of the last month, then one a week), older versions’ files taken back, days missed filled from rifthunt’s copy of Cardmarket’s trend price, merged with the phone’s
- [ ] Price chart: 1 month, 3 months, 6 months, all (card sheet and Value)
- [x] Biggest rises / drops of your cards over 7 days (Value view)
- [x] Price alerts on the wish list (« Alert under €X », notification when the prices are updated)
- [x] Purchase price per copy (« Paid » field) and gain
- [ ] Improve the matching of Radiance cards when Riftcodex has them

## Phase 6 — Extras ✅

- [x] Show every card in French (« FR » button of the Collection or Settings), even English copies; the real language stays on the copy
- [x] Catalog: full English names (Riftcodex) and French names completed from the other prints; « (Alternate Art) » suffixes removed — `npm run catalog:enrich`
- [x] New set in one command: `npm run catalog:update` (scraper, names, thumbnails)
- [x] Import a CSV collection (CardNexus, Riftmana, spreadsheet in French or English)
- [x] « Stats » view: domains, rarity, type, language, foils, missing cards per set
- [x] Trades: list of duplicates to share (FR/EN text with prices), trade tracking with the value difference and « Apply to my collection » (synced)
- [x] PC: restore a backup (the phone receives the restored state at its sync), sync history (PC and phone)
- [x] Automated tests: `npm test` (decks, CSV import, prices, sync and restore)
- [x] Mascot removed; temporary neutral icon (`public/icon.svg`, `npm run icons`) until the design
- [x] Android icon and Windows installer (`npm run desktop:exe` → `release/` folder)
- [x] `npm run android:apk` builds the APK and installs it if the phone is plugged in

## Phase 7 — « Hextech » design ✅

- [x] 3 proposals compared (Hextech, Grimoire, Nexus) — chosen: **A · Hextech**
- [x] Colours: midnight blue + gold, contrasted texts; official colours of the 6 domains (fixes the former wrong table)
- [x] Shapes: sharp corners, bevelled buttons, titles in Cinzel, segmented tabs, filter chips
- [x] 5-tab navigation: Collection · Decks · **Scanner** (central hexagon) · Value · More
- [x] Collection: header with value and 7-day change, Cards / Progress / Wishes, filters by domain in one gesture, **grid view** (default) or list (to edit)
- [x] Value: Value + Statistics; More: Trades, Boxes, Loans, Settings
- [x] Scanner: header (mode, FR/EN language, « Store in »), golden frame, « To add » panel
- [x] Deck: 40 / 12 / 3 counters, golden energy curve, cost in a hexagon, « Add cards » button
- [x] Icon of the app and the PC app: golden hexagon with the scan frame (`public/icon.svg`, `npm run icons`)
- [x] Loading screen and « About » with this icon; « Made by » mention and GitHub link removed
- [x] Camera off: no more grey Android icon behind (video hidden + empty picture)

- [x] Collection (grid): name centred in an orange frame, location under the name (« Deck: … », « Lent to … », « Box: … ») above the price
- [x] Collection on PC: number of columns by width (cards ~150 px instead of 3 giant cards)
- [x] Battlefields shown in landscape, the right way up and uncropped (Value, grids, zoom)
- [x] Wishes / Trades: the thumbnail no longer overlaps the text

- [x] Value: 1) collection value (+ chart), 2) 7-day changes with small pictures, 3) every card (from the most expensive, by pages), 4) gain at the bottom
- [x] Zoom: card text and price chart in the same orange frame; keywords coloured as on the cards (Accelerate dark green, Assault pink…, adjustable in `KEYWORD_COLORS`, `src/lib/cardLocale.js`)

## Phase 8 — Scan reliability and trials ✅
- [x] Scan without duplicates: immediate lock during the analysis + 1 s pause after each result (a double tap no longer scans twice)
- [x] Animations: golden sweep « Analysing the card… », greyed spinning button; green frame (recognised), red (not recognised), amber (same card); different vibrations
- [x] Immediate result card on the camera: picture, name, % confidence; « Undo »; « Not the right card » (5 close cards or search)
- [x] Same card within 3 s: « Same card as just before — Yes, +1 / No »
- [x] Scanner: « Accuracy » setting removed (fixed 80 % threshold), bottom bar hidden while scanning (✕ button to leave), bigger and lower frame, result card on the frame, « Scanning… » loading as soon as tapped
- [x] Scanner option A: « AI ready » strip + location + torch / auto scan / camera under the header; permanent « Last card added » card (×N in the list); compact « To add » list (quantity, condition, foil, delete)
- [x] Android back button (closes window, zoom, editor, camera… then Collection, then quits); « Store in » menu in the app’s theme
- [x] Collection: multiple selection + deletion, « Undo » after any deletion; Scanner: « Search » for a card by hand, FR/EN language per card in « To add »; Decks: « What I’m missing » for all decks; backup to a file (without PC); scan statistics
- [x] Big Scanner button on the camera; the bottom bar’s Scanner button also scans when the Scanner screen is open

- [x] **Battlefields**: they were compared upside down (reference pictures turned the other way); the recognition also tests the card turned by 180° — simulation: 14/77 → **77/77** recognised, no regression on 222 other cards
- [x] « Normal (Float32) » model also available on Android (Settings → Model); APK ≈ 90 MB
- [x] Sync in the chosen direction, never automatic: phone « Send to the PC » / « Receive from the PC » / « Both ways »; PC « Send to the phone » (the phone shows « Receive » when it opens and you confirm)
- [x] `npm run android:apk` copies the APK to `release/` (next to the PC installer)
- [x] Demo data (More → Settings → « Load / Remove the demo »), identified by « demo- », removed without touching the real cards

## Phase 9 — Review corrections (CORRECTIONS.md)
- [x] Lot 1.1: PC backup restore fixed (`fs` missing → list always empty); backup names validated (`electron/backups.cjs`) + tests
- [x] Lot 1.2: local server — strict path check (neighbouring folders like `dist-mobile` are no longer served) + tests
- [x] Lot 2: security — Electron 45 / Vite 8 (0 high/critical vulnerability), hardened window + CSP, card text sanitised, encrypted and signed sync (protocol v2, re-pairing), anonymous hello, restricted CORS, limiter, « network sync » setting, mDNS + manual search, signed/minified release APK, no Android backup
- [x] Lot 3: recognition test bench (`npm run eval:matcher`), centred score + margin (false positives outside the catalog 100 % → 0.9 %, cards wrongly accepted 14.3 % → 0.1 %), « Uncertain card — which one? », reprints grouped with a choice of set
- [x] Lot 4: Signature cards + ban list, synced matches + statistics + matchups + CSV, score counter, starting hand + probabilities, printable deck sheet + share code, reference price (trend / 7-day average / low)
- [x] Lot 5: ONNX Runtime 1.31 (WebGPU on PC: 1,220 → 19 ms; WASM 4 threads), APK without the normal model (downloaded from the PC, checked), clock correction at the sync, ESLint (`npm run lint`), large files split
- [x] v2 Lot A: « Careful » by default (preference migration), no more simulation mode (visible error + Try again), learning measured honestly (penalty 0.3, safeguard)
- [x] v2 Lot B: champion in the Champion Zone (draw pile of 39), matchups grouped by Legend
- [x] v2 Lot C: portable Linux/Windows test, lint 71 → 0 warnings (rules as errors)
- [x] v2 Lot D: one key per phone (protocol v3, pairing window), daily fingerprint, hardened mDNS, SHA-256
- [x] v2 Lot E: startup 818 → 155 KB (pages on demand), WebGPU engine only when useful, model downloaded in chunks
- [x] v2 Lot F: duplicate models removed, model/fr out of git, Git LFS
- [x] AI models — step 1: engine interface, comparative bench, photos:prepare
- [x] AI models — step 2: DINOv2 / MobileNetV4 / SigLIP 2 measured (`model/MODELS.md`)
- [x] AI models — step 2.5: DINOv2 int8 + fingerprint chosen (65 real photos: 69 → 91 % accepted right)
- [x] AI models — step 4: AI built in (colours → AI cascade), signatures in the catalog, setting, visible fallback, speed test
- [x] AI models — step 4.6: fingerprint 5× faster, 1 AI picture of 168 px, multi-core Android
- [ ] AI models — step 4.6: new speed measure on the phone and the PC
- [x] Slow YOLO detection on the phone (≈ 2 s): 320 px camera, 416 px photo (2026-11-13). On the phone: 485 ms of detection, 557 ms per scan. Models shipped since 2026-11-14: dynamic float32 YOLO and DINOv2-small fine-tuned on the cards (fp16). Native engine (step 2 of the native plan): to decide
- [ ] v2 D.5: Android CSP restricted to the ports — to test on the phone
- [ ] v2 A.3: accuracy on real photos — photos to provide
- [x] Test bench collection in the app (developer mode): single card / grid, confirmation of each card, « My collection set », ZIP export + `npm run bench:import`, doubtful scans option
- [ ] Bench: « accuracy on the collected photos per source » line and respecting the `split` field (other session, step 5)
- [ ] Bench collection: to try on the phone (camera picture, doubtful scans, export to Documents/Riftbound)
- [x] GitHub Actions CI (lint, tests, build, audit) — light, without the LFS files (M14d)
- [x] Lot 6: documentation inconsistencies fixed; removing duplicate models / Git LFS / `model/fr` out of git — proposed, to decide

## Phase 10 — Distribution to friends, split into modules

Order of the specification (from the most to the least important). Each
module: tests, lint, build, test APK if Android, CHANGELOG, one pushed commit.

- [x] **M0 · Design foundations** (B.1, B.2): state tokens, `.chip` / `.toggle`, shared components (`Dialog`, `Sheet`, `Banner`, `StatusPill`, `SectionCard`, `Field`, `DiffList`, `Stepper`, `ProgressRow`, `EmptyState`), versioned mock-ups
- [x] **M1 · Banned cards and deck format** (lot 1.1)
- [x] **M2 · Consistent prices** (lot 1.2) — promo: separate price (decided)
- [x] **M3 · Cardmarket conditions** (lot 1.3) — usual mapping NM→NM, LP→EX, MP→GD, HP→PL, D→PO (decided)
- [x] **M4 · Scanner clean-up** (lot 1.4): a single chain, thresholds in the catalog header, Fast mode removed — test scanner approved on 17/11
- [x] **M5 · Signing and release package** (lot 2) — key created by the user; `npm run release -- <version>`, `npm run release:check`, single version 2.1.0
- [x] **M6 · Never lose the data** (lot 3): automatic backups, sync reminder, extra folder, conflicts
- [x] **M7 · Up-to-date content from the PC** (lot 4) — M7a layers and Content screen ✓, M7b banned cards ✓, M7c translations ✓, M7d new cards ✓, M7e signed packs ✓, M7f versions and light APK ✓: layers (4.1), new cards with parity (4.2), translations (4.3), bans (4.4), packs (4.5, Ed25519-signed — decided), versions and APK without large pictures (4.6)
- [x] **M8 · When something breaks** (lot 5): rescue screen, startup errors, diagnostic report
- [x] **M9 · Ergonomics** (lot 6, B.3, B.4, B.6.9 to B.6.13) — loading screen A « Hextech forge » (chosen on 18/11); M9a loading screen ✓, M9b navigation ✓, M9c settings in sections ✓, M9d search and shortcuts ✓, M9e first launch ✓, M9f finishing ✓
- [x] **M10 · Decks and competitive play** (lot 7) — M10a common deck codes and registration ✓ · M10b versions ✓ · M10c notes per opponent ✓ · M10d counter ✓ · M10e errata ✓
- [x] **M11 · Scanning comfort** (lot 8) — M11a hands-free ✓ · M11b sounds ✓ · M11c detected language: studied, not shipped (docs/STUDY-LANGUAGE.md) · M11d variants ✓ (docs/STUDY-VARIANTS.md)
- [x] **M12 · Price alerts** (lot 9) — alerts on my cards (± X % over 7 days, minimum value, on the real history) ✓ · « Movements » panel in Value ✓ · summary after each price update ✓
- [x] **M13 · Between friends** (lot 10) — lists shared as files (duplicates and wishes, without prices paid or locations) ✓ · possible trades per friend ✓ · savable calculator ✓
- [x] **M14 · Documentation and quality** (lot 11) — M14a friends’ guide and README ✓ · M14b screen tests (npm run test:e2e) ✓ · M14c useAppController / ScanTab split ✓ · M14d light continuous integration, without LFS ✓
- [x] **Touch-ups after the trials** (20/11): fixed 2.4 s loading screen with a smooth gauge (animated by the browser), card sheet card settling straight (sharp), bigger card in the sheet on the phone and the PC
- [ ] Later (lot 12): native engine, collection at friends’

Phase summary (what was done, decisions, what is not shipped, checks, releasing 2.1.0): [docs/PHASE-10.md](docs/PHASE-10.md).

## Phase 11 — Corrections v3, before releasing 2.1.0

Feature freeze until 2.1.0 and the friends’ first feedback: only these corrections.

- [x] **Lot A · Electron and audit**: Electron 45.4.1, full audit in the CI, `npm run check:electron`
- [x] **Lot B · Content packs**: signature checked before reading the rest, no compressed entry; encrypted private key, list of revocable keys
- [x] **Lot C · Fetching from the Internet**: redirects checked again, size limit while reading
- [x] **Lot D · Phone backups**: weekly copy to Documents/Riftbound
- [x] **Lot E · Small fixes**: test of the cards added by hand; loading screen kept at 2.4 s (decision of 20/11)
- [ ] After 2.1.0 (lot F): bans per circuit, signed checksums of the version, lighter JavaScript chunks for settings and home, native Android engine

## Licence and publication

- [x] **Part 1 · MIT licence of the original project**: `LICENSE`, credits (README, third-party licences, guide, About), Riot notice FR/EN, licence in every copy, blocking `release:check`; released with 2.1.1
- [x] **Licence: GNU AGPL-3.0** (21/11): the detector is trained with Ultralytics YOLO11 (AGPL-3.0); MIT notice of the original project kept
- [x] **Part 2 · Renamed RiftMancer** (21/11): name shown everywhere, Android id `com.riftmancer.app`, PC data folder taken over on first launch
- [x] Part 2 · Card content out of the public copy (`npm run public:export`, `npm run content:import`, tests and release without / with content) — content backed up in `../sauvegarde-contenu` (21/11)
- [x] Part 2 · Personal data cleaned, secrets search (gitleaks: nothing real), **public repository https://github.com/FaZox/RiftMancer** published on 21/11/2026 (fresh history, masked e-mail address, 465 files)
- [x] **Cards on first launch** (21/11): an app without the card content starts with the catalog header only (`public/catalog-base.json`) and offers « Download the cards » (official gallery) or « Import a folder… » (a backup, a USB key); the phone gets them from the PC
- [x] **rifthunt first** (21/11): cards, banned cards and Cardmarket links from api.rifthunt.com, the former sources (Riot gallery, tournament rules page, Riftcodex) as fallback
- [x] **Prints and promos** (21/11): the 318 missing printings (promo sets PR, OPP, JDG, RWB, SGN, KDA; signatures, showcases, alternates), a « Prints & variants » section in the card sheet, own Cardmarket price per printing
- [x] **Rulings** (21/11): riftboundfaq.com rulings (via rifthunt, CC BY-SA 4.0, unofficial, English) in the card sheet, questions that open to show the answer
- [ ] Optional: French translations: ask riftboundfr.fr

## Phase 12 — Grid scanner

A binder page or cards laid flat, scanned at once.

- [x] **Step 1 · Live aiming, automatic photo**: frame on each card, full-resolution photo when nothing moves, no duplicate before the next page
- [x] **Step 2 · Check and next page**: pockets numbered in reading order, green / orange, « Add · next page », series counter
- [x] **Step 3 · Binder**: each card stored with its page and pocket (from its position on the photo), page number offered and correctable, page already taken flagged, « p. 4, pocket 7 » location in the collection, binder pages pocket by pocket in the box screen
- [ ] Step 4 · Accuracy with sleeves: not needed for now (trial of 20/11: no card bothered by reflections); to pick up again if friends report it
- [x] Trial on the phone with a real binder (20/11): fast enough, photo taken at the right time, no card bothered by reflections

## Phase 13 — English and French (21/11)

The app in English by default (French when the phone or PC is in French), French to choose in Settings → Display.

- [x] **Lot 1 · Engine and language choice**: `src/lib/i18n.js` (French text as the key, `tx` / `tp`), « Language · Langue » in Settings → Display and on the first-launch screen, card language follows
- [x] **Lot 2 · Screens**: 1,328 texts in English (`src/i18n/en.js`), `tests/i18n.test.mjs`
- [x] **Lot 3 · Sentences with numbers and internal modules**: 1,644 texts
- [x] **Lot 4 · Dates, prices, conditions, tournament sheet, PC app dialogs** (`electron/i18n.cjs`): 1,676 texts; tests always in French
- [x] **Lot 5 · Documentation**: README (+ README.fr.md), friends’ guide, release notes (app and package), studies, AI report, roadmap in English, French versions kept; CHANGELOG in English from now on
- [ ] Check on the phone and the PC in both languages

## Phase 14 — Help on the screens (22/11)

- [x] Guided tour the first time each page is opened (spotlight, Previous / Next / Skip)
- [x] « ? » help mode: a label under every explained button (PC sidebar, phone round button)
- [x] Settings → Help: replay the explanations
- [ ] Check the tours on the phone

## Phase 15 — Scanner after OpenRift (REPRODUIRE-SCANNER-OPENRIFT.md, 22/11)

- [x] Phase A: pixel check ported and measured — not better than the app, not wired (docs/AI-MODELS-REPORT.md § 9)
- [x] Phase C: printing pick ported and measured — no setting with 0 wrong printing, not wired (§ 10)
- [x] Instead: the set chosen per artwork remembered on the device, every scan mode; sets to choose in « À ajouter »
- [ ] Phase E: exact outlines (the crop sometimes cuts the bottom of the card) — then measure A and C again
- [ ] Real pictures of the 6 UNL runes (no source yet)

## Phase 16 — « Cartes » tab, the whole catalog (ONGLET-CARTES.md, design A, 22/11)

- [x] Search line with keys (cardQuery.js) and its tests
- [x] Filters ↔ text (domains, sets, type, energy, might, rarity, others), ownership with counts, chips
- [x] Navigation: PC « Explorer », phone tab (Valeur in « Plus »), « Mes cartes », links from Progression and the global search
- [x] PC page and phone tab (design A), printings grouped, « Griser les manquantes » off by default
- [x] Quick add with « Annuler », multiple selection, wishes, add to a deck, CSV of the view
- [ ] Measure the filtering time on the phone; screenshots of the test apps for the user

## Other ideas (later)

- [x] Starting hand simulator (Lot 4, finally requested)
