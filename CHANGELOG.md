# Changelog

Entries are in English from 21/11/2026; the earlier history is in French (*l’historique antérieur est en français*).


## [Unreleased] - 2026-11-22 · Direct Cardmarket links, prices of every card and promo again

- **Cardmarket links**: card pages open directly, as on Cardmarket: `…/Products/Singles/Unleashed/Mutated-Mouser` for the normal card, `…/Singles/Unleashed-Promos/Mutated-Mouser` for the promo (no minimum condition: promos are few), instead of `Products?idProduct=…` or a search. Set and card names written as Cardmarket does (« Kai'Sa, Survivor » → `KaiSa-Survivor`, « B.F. Sword » → `BF-Sword`), with Cardmarket's versions (`KSante-Dauntless-V2-Showcase`). Card sheet → Price: a second button « Voir la promo sur Cardmarket » when Cardmarket has one. Wishes, missing cards for the decks and the card sheet use the same pages; the catalog's promo printings (« opp-036-219 ») open their promo page.
- **Prices fixed**: since 21/11 the Cardmarket products were found by name with Riftcodex's names, which answer in ~50 s a page and were stuck in an old cache without Radiance: 105 cards without a price (Radiance champions, some Proving Grounds legends, tokens) and K'Sante's alternate art swapped with the normal one. rifthunt's product of each printing is used again (1,408 of 1,408 cards priced; by name with Riftcodex only when rifthunt does not answer); the links no longer come from its ids.
- **Promo prices fixed**: the catalog's promo printings (225, « opp-036-219 ») were matched by name (58, some wrongly) and then counted as sets, so the promo expansions they sat in were left out of the promo prices (192 cards). They now take rifthunt's product only and are left out of that count, and each set's expansion is the one holding most of its cards: 371 cards have a promo price, 180 of the 225 promo printings their own price. With the catalog of this PC: 1,675 of 1,726 cards priced (1,372 before).
- Prices table: `links: { cardId: [normalPath, promoPath] }` (PC and phone, built the same way).

## [Unreleased] - 2026-11-22 · Price paid and purchase date, phone tab bar, Cards tab polish

- **Card sheet**: the price paid and the purchase date show on the right of the rarity (« Payé 4,50 € · le 12/11/2026 », the average when copies were bought at different prices). They are set in the Price tab → « Mon achat », for every copy of the card; copies get a `paidAt` field (YYYY-MM-DD) next to `paid`.
- **Phone tab bar**: Collection · Cartes · Valeur · Scanner · Decks · Boîtes · Plus (Valeur back in the bar, Boîtes moved out of « Plus »).
- **Cards tab**: one tile less per row on the PC (bigger, readable card texts); the price under each card on the phone too.
- « Impressions et variantes » and rulings missing in 2.4.0 on the PC: the everyday app had never installed the content layers (only the test app had them, and its current « cartes » layer came from Riot's gallery, without the printing links). Fixed on this PC by copying the layers; on another device, Settings → Content → Cards and Rulings → « Rechercher ».

## [Unreleased] - 2026-11-22 · « Cartes » tab: the whole catalog, owned or not (ONGLET-CARTES.md, design A « Bibliothèque »)

- **New main tab « Cartes »** — PC: first item of the sidebar (« Explorer »), Ctrl+F searches the page (Ctrl+K stays the global search), Ctrl+9 opens it; phone: Collection · **Cartes** · Scanner · Decks · Plus, **Valeur moved to « Plus »** (first entry). The Collection view « Cartes » is renamed « Mes cartes »; Progression has « Voir les manquantes dans Cartes » and the global search « Voir tous les résultats dans Cartes ».
- **One search line** (`src/lib/cardQuery.js`): FR/EN name, number, or keys in the style of OpenRift / Scryfall with French aliases — `t:` type, `d:` domain, `e:` energy, `p:` might, `r:` rarity (ordered: `r>=rare`), `s:` set, `o:` card text, `n:` number, `is:` foil/promo/signature/bannie/champion/deck, `own:` copies owned; operators `: = != < <= > >=`, `-` reverses, quotes group words; an unknown key is plain text. « ? » shows the syntax.
- **Filters ↔ text**: domains (hexagons), sets with their progress, type, energy, **might** (0–6, 7+, several at once, only cards that have a might), rarity, others; a click writes the key in the line (« p:4,5 »), a typed key lights its filter (« e<=3 » lights 0–3). Active filters as chips with ✕ and « Tout effacer ». Ownership Toutes · Possédées · Manquantes with their counts.
- **Tiles**: real pictures, ×N in gold when owned, missing cards **in normal colours by default**; « Griser les manquantes » (off by default, remembered) dims them with the word « Manquante ». Printings grouped by default (« +2 impressions »), set titles with « owned / total of this selection », price on the PC, sorts of the collection plus energy, S/M/L on the PC, 3 columns on the phone; virtual grid (`@tanstack/react-virtual`).
- **Actions**: click = card sheet (swipe / arrows walk through the results); PC: hover « + » adds a copy in the default language with « Annuler », Ctrl/Shift = multiple selection; phone: long press starts the selection; selection → wishes, « Ajouter à un deck… », one copy each; « Manquantes → souhaits » (confirmation with the count); « Exporter la vue » (CSV). Phone: the scanner icon of the search finds a card (its sheet opens, nothing is added).
- **Memory**: search, filters, sort, size, grouping, dimming and scroll position kept between tabs and launches (`localStorage` `rm.cards.view.v1`).
- **Speed**: filtering + sorting the 1 415 printings takes about 2 ms on the PC (`tests/cardsBrowser.test.mjs`); **to measure on the phone** (goal < 50 ms).
- Tests: `tests/cardQuery.test.mjs` (every key, operator, negation, quotes, aliases, accents, unknown key, empty query, filters ↔ text), `tests/cardsBrowser.test.mjs` (acceptance queries on the real catalog, grouping, counts, sorts, deck, CSV); 351 of 353 pass, 1 skipped (the rifthunt test that already failed before this change is unchanged). Checked in the PC app and in a phone-sized window; **not yet on the phone itself**.

## [Unreleased] - 2026-11-22 · Choosing the set of an artwork printed several times

- **The set chosen for an artwork is remembered on the device** (`src/lib/printingChoice.js`), per artwork (runes of every set, « signée » cards, reprinted tokens), for every scan mode — camera, photos, grid, auto — and the next sessions (it was the camera only, until the app closed). A card searched by hand or corrected keeps exactly the one chosen.
- **« À ajouter »** (PC and phone): an artwork printed several times shows its sets under the card (« Même illustration : OGN · RAD · UNL · VEN »): one tap changes the printing, remembered for the next scans.
- Why not read the set on the photo: measured in docs/AI-MODELS-REPORT.md § 10 — even at the photo's full resolution no real photo of the bench tells the printings apart; on one of them the detector's crop cuts off the bottom of the card, where the code is.
- The 6 UNL runes keep the VEN runes' picture (same art): no source has the UNL picture (rifthunt serves the OGN rune under that number, the official gallery has no UNL rune); noted in `model/manual-cards/manual-cards.json`.
- Checked in the PC app: a Calm Rune searched on the Scanner page shows OGN · RAD · UNL · VEN in « À ajouter », RAD chosen and remembered. Tests: 337 passed.

## [Unreleased] - 2026-11-22 · Reading the printing measured (scanner, phase C)

- `src/lib/printingPick.js`: OpenRift's printing pick (name, code and stamp bands, tournament on the pixels where two printings differ, « unanimous » rule), adapted from OpenRift (AGPL-3.0, NOTICE), plus two variants of ours (each band looked for within ±4 % of the card; code strip searched per printing). Bench `node scripts/eval-printings.mjs`.
- Result (docs/AI-MODELS-REPORT.md § 10): on the 53 artworks printed several times, no setting gives 0 wrong printing while finding some (best: 18 % of the simulated photos, 0.6 % wrong; none of the 11 real photos). **Not wired into the scanner.**
- Found: the pictures of the 6 UNL runes are the VEN runes' files.

## [Unreleased] - 2026-11-22 · OpenRift's pixel check measured (scanner, phase A)

- `src/lib/alignedVerify.js` and `src/lib/edgeSnap.js`: OpenRift's pixel check (40 × 56 grey, 10 × 10 patches, best correlation within ±2 px, median; winner ≥ 0.60 and 0.15 ahead) and outline snapping, adapted from OpenRift (AGPL-3.0, credited in NOTICE). Tests: `tests/alignedVerify.test.mjs`.
- Bench: `eval:matcher … --verify K[,K] --verify-opts score/margin,…` measures the check alone, then the app's decision with the check as veto or rescue (signatures cached in `model/cache/aligned-<n>.json`).
- Result (docs/AI-MODELS-REPORT.md § 9): alone, the check does worse than the app (simulated photos: 64 % right and 0.5 % wrong against 84.5 % and 0.2 %); added as a rescue it gains at most 0.5 point without more cards outside the catalog. **Not wired into the scanner.**

## [Unreleased] - 2026-11-22 · Help on the screens: guided tour and « ? » mode

- **Guided tour** the first time a page is opened (Collection, Scanner, Decks, Value, Settings → Content, and a card's sheet): its buttons one at a time in a spotlight, with a short explanation, « Previous », « Next » and « Skip » (Esc closes). It waits for the welcome and what's new windows. The pages seen are kept on the device.
- **Help mode** (« ? »): a label under every explained button of the screen; a label opens its explanation, « Guided tour » replays the page's tour. PC: « Help on this screen » in the sidebar; phone: a small round « ? » above the tab bar.
- **Progress and Wishes** have their own tour (a set and its filters, « Add all to wishes »; wanted quantity, price alert, sending to Cardmarket), and the Collection tour starts with its three views. The first time, Progress opens its first set so that its tour shows everything.
- Settings → Help → « Show the button explanations again » replays every tour.
- Buttons are marked with `data-help` in the JSX; texts and tour order in `src/lib/help.js`, the layer in `src/components/common/HelpLayer.jsx`.
- Checked in the PC app: the Collection tour (8 steps), the help mode labels, the card sheet's tour, the Scanner tour (5 steps). Tests: 321 passed.

## [2.3.0] - 2026-11-21

- Released: friends' package `release/v2.3.0/`, public package `release/v2.3.0-public/` (GitHub release), tag `v2.3.0`.
- The public build also leaves out the game's symbols (`public/sym`, Riot Games), like the card content, and `release:check` refuses a public package holding one; the public package of 2.3.0 was rebuilt this way after the tag (same code but for this build step).

## [Unreleased] - 2026-11-21 · Recycle cost, prices refreshed from Settings → Content

- **Recycle cost on the card sheet**: next to the energy, the runes to recycle to play the card (« power »), as many icons of the card's domain as runes, as rifthunt shows them (Icathian Rain: 7 energy, 3 Fury runes). Card field `power`, from rifthunt, written with the next « Search » without being listed as a change (like the print links); allowed in the content layers.
- **Settings → Content → « Cardmarket prices »**: date of the prices, how many cards have one, and « Update » to download them now (PC and phone), as for the cards or the French translations.
- Checked in the PC app: Icathian Rain's sheet; prices updated from Settings → Content (1,303 of 1,415 cards priced with the links by name, against 1,408 with rifthunt's ids). Tests: 321 passed.

## [Unreleased] - 2026-11-21 · Cardmarket links back by name, the game's icons

- **Cardmarket links and prices: back to the former way** (Riftcodex's full names, products found by name in Cardmarket's files): the links given by rifthunt's Cardmarket ids did not work. A cache made from rifthunt's ids is not used any more (`card-index.json` / `cardIndex`); the cards, banned cards, printings and rulings still come from rifthunt first.
- **Every symbol of the card texts with the game's icon** (from rifthunt.com/sym, like its card pages): the runes in their domain's colours (fury, calm, mind, body, chaos, order), « any rune » (the rainbow one), Exhaust and Might in the colour of the text (CSS mask, as printed); the energy stays a number in a circle (rifthunt draws it the same way). The « [>] » after a keyword is shown as the small arrow printed on the card. The card sheet's domain tags carry the domain's icon. Same in the rulings. All in `public/sym/`, kept out of the public repository; without them, the former signs.
- Checked in the PC app: Malzahar, Fanatic (Exhaust, two « any rune »), Akali, Deadly Weapon (fury rune, Might, the arrow), the domain icons in the tags. Tests: 320 passed.

## [Unreleased] - 2026-11-21 · Collection: « Add », domains, game symbols

- **« Add » button** (gold) right of the sort, on the PC and the phone: opens the search in « add » mode — a card by its French or English name or its number (« OGN-066 »), added to the collection at once.
- **Domains in a dropdown** (PC: first of the filters; phone: next to the sort) instead of the row of chips.
- **The game's symbols**: the rarity gem (common, uncommon, rare, epic, showcase) before the card's name in its sheet, and the Might icon in the sheet's stats and in the card texts and rulings (instead of ⚔). Files from rifthunt.com/sym in `public/sym/`; like the card pictures (Riot Games) they stay out of the public repository, and an app without them keeps its former signs (`src/lib/symbols.js`, checked once at start).
- Checked in the PC app (test variant, demo data): button and dropdown in the toolbar, « OGN-066 » found in the add search, Jinx's sheet with the rare gem and the Might icon. Tests: 320 passed.

## [Unreleased] - 2026-11-21 · Rulings

- **Card sheet → Infos → « Rulings »**: the questions of Riftbound FAQ (riftboundfaq.com, by Christian « Near » Ivicevic) about the card or another printing of it; a tap on a question shows or hides the whole answer, with its links to the Core Rules and the cards, and the game symbols as icons (`symbolsHtml`, shared with the card texts). Under the list: unofficial, in English, link to the FAQ page, author, licence (CC BY-SA 4.0, as rifthunt gives it). `RulingsList.jsx`.
- **Settings → Content → Rulings**: « Install » / « Update » reads rifthunt's file `/bulk/rulings` (167 rulings on 71 cards) and finds the cards through rifthunt's printings (by name when its card file does not answer); all printings of a card follow. New content kind « rulings » (`electron/content.cjs`): checked, kept when the app is updated, written into the served catalog (`rulings`), so **the phone gets them at the sync** without anything new; friends' packs can carry them.
- **The answers' HTML is sanitized twice** (when installed and when shown): plain tags, links to riftboundfaq.com, rifthunt.com (its relative card links) and playriftbound.com only, every other tag, attribute or address removed (`sanitizeRulingHtml`); a lone « < » in a text is no longer taken for a tag.
- Checked in the PC app: 167 rulings installed on 71 cards (all found; 5 would have been missed by name alone), Lux, Crownguard's ruling opened with its links and the energy icon. Tests: 319 passed (`tests/rulings.test.mjs`).

## [Unreleased] - 2026-11-21 · Prints and promos

- **Every printing in the catalog**: « Search » (Settings → Content → Cards) now proposes the 318 printings it lacked — the promo sets (Organized Play 204, Promotional 11, Judge 4, Worlds Bundle 4, Secret Garden 3, K/DA 5) and the variants of the sets (Radiance signatures and showcases, alternate arts, alternate runes) — plus the 6 Unleashed runes added by hand, replaced by the official ones (324 new cards). Their pictures come from rifthunt's image server (`images.rifthunt.com`, 744 × 1039 WebP) when Riot's has none; a missing picture no longer stops the install (the card is proposed again).
- **Printings sharing a number** get their own id: `opp-255-298` and `opp-255-298-metal`, `… -champion`, `… -top-8` (`printingIds`), the same for the prices.
- **Prints of one card linked**: card fields `oracle` (rifthunt's oracle id), `variant` (base, alternate, overnumbered, signature, showcase, promo) and `printLabel` (« Metal », « Top 8 », « Launch Exclusive »…); written for the 1,408 cards already there with the next « Search » (« N cards linked to their other printings », not listed as changes). Allowed as corrections in `electron/content.cjs`.
- **Card sheet → Infos → « Prints & variants »**: every printing of the card (normal first), with set, number, kind, copies owned and price; a tap shows that printing in the same sheet (`PrintsList.jsx`, `src/lib/prints.js`). E.g. Jinx, Demolitionist: Origins #030 (0.22 €), #030a alternate art (2.64 €), Vendetta #168 overnumbered (148.99 €).
- **French at once**: new printings take the French name and text of another printing of the same card when they are installed (oracle link, `frenchFromPrints`), without waiting for the translations update: 311 of the 324 (the others are Radiance tokens and one promo); the translations update matches printings by the oracle link first, then by type and English name.
- **Promo printings** show the PROMO badge on the tiles and count in the « Promo » finish filter; each printing gets its own Cardmarket price through rifthunt's ids.
- Checked on real data and in the PC app: summary « 324 new cards (11 sets), 304 changed », pictures downloaded by the app (about 100 KB each), the prints section after installing links (the 324 pictures were not downloaded in the trial). Tests: 313 passed.

## [Unreleased] - 2026-11-21 · rifthunt first

- **rifthunt.com (api.rifthunt.com) is the first source** of the cards, the banned cards and the Cardmarket links; the former sources take over when it does not answer (`src/lib/rifthunt.js`). Free, no key, any use allowed by its terms; its data comes from Riot's.
- **Cards** (Settings → Content → Cards, weekly check, first launch): rifthunt's card file (`/bulk/cards`), Riot's gallery when rifthunt does not answer or cannot be read. Its printings are put in the catalog's shape (names, codes, lower-case values, Legends named by their title); a field rifthunt does not have is never a change; a new card needs its picture on Riot's server; a manual addition stays when rifthunt has no Riot picture of it. Promo sets are left for « Prints and promos ». The summary says the source. The gallery comparison is shared (`catalogChanges`) and ignores the order of tags and capitals in names.
- **Banned cards**: rifthunt's searches `banned:standard`, `banned:2v2`, `banned:upcoming`, each ban with its own date (the announced ones included); Riot's tournament rules page when rifthunt does not answer. « Dreaming Tree » and « The Dreaming Tree » are the same card.
- **Prices**: each card is linked to its Cardmarket product by the id rifthunt gives, then by name for the rest (rifthunt's full names, Riftcodex's when rifthunt does not answer). The prices themselves still come from Cardmarket's files. Cache `card-index.json` (PC) / `cardIndex` (phone), a week.
- The weekly check takes a fallback address (`content:weeklyCheck`), so Riot's gallery is read at once when rifthunt does not answer. Allowed addresses: rifthunt's card file and the three ban searches only.
- Checked on real data and in the PC app: 303 card corrections proposed then installed (tags, full names, illustrators, domains/types/texts of Radiance), no false new card; ban list identical to the current one; **1,408 of 1,408 official cards priced** (1,356 by name before; the overnumbered Ahri and its signature among the 52 gained, two Radiance prints no longer swapped). Tests: 310 passed (`tests/rifthunt.test.mjs`).

## [Unreleased] - 2026-11-21 · Collection, PC grid scanner, promos (feedback on 2.2.0)

- **Collection tiles**: no more coloured line above the card (it followed the domain: Fury, Calm…).
- **Card sheet opened from the collection**: the action bar shows how many copies you have in the language shown, with **−** (one copy less; a bin at the last one) and **+**; « Cancel » for a few seconds after a deletion. In « My collection », each stack has its own **−** and a **Promo** switch, and « Add a promo ». (`handleRemoveCopy` in `useAppController.js`, `onRemoveCopy` / `onUpdateCard` of `CardZoom`.)
- **Promos easier to mark and to see**: « Promo » column in the PC table, « Promo » choice in the Finish filter (Standard = neither foil nor promo), **PROMO** badge on the tiles and in the value lists.
- **PC scanner: « Grid » mode**, the same as the phone's: a binder page or cards laid flat under the webcam, the photo taken by itself when nothing moves, the page checked then added to the collection (with page and pocket when « Store in » is a binder). The single-card automatic scan is turned off in this mode; switching between Webcam and Grid keeps the webcam on.
- Checked in the PC app (test variant, demo data): tiles without the line, − / + and « Cancel », Promo switch and badge, Grid tab. Not checked: the grid capture itself (no webcam on this PC). Tests: 305 passed.
- Promo cards in the catalog: Riftcodex lists 149 (sets PR, JDG, OPP) with their own number and picture on Riot's image server; to do next.

## [Unreleased] - 2026-11-21 · Data and database documentation

- **`docs/DATABASE.md`** (English) and **`docs/BASE-DE-DONNEES.md`** (French): where the data lives and in what shape, written from the code. SQLite schema of the PC and IndexedDB stores of the phone (with their versions), rules common to every record (`updatedAt`, `deleted`, `dirty`), the nine synced collections field by field, links between them (diagram), the card catalog and the content layers, every `meta` key, the sync step by step (merge, conflicts, clock skew), backups and restore on both devices, other files (`prices.json`, `localStorage` keys), where everything is on disk, and how to change the schema.
- README (both languages): the « Data and storage » section sums it up and links to it; link in the documentation line.
- Two `meta` keys added after measuring a real database: `pcSecret` (PC) and `revokedDevices` (no longer used, may remain in an old database).

## [Unreleased] - 2026-11-21 · Public package for the GitHub releases

- **`npm run release -- <version>` now builds two packages**: `release/v<version>/` for the friends (with the cards, as before; never on GitHub) and `release/v<version>-public/` for a GitHub release: the same app and APK **without any card picture nor catalog** (`--public` of `desktop-exe.mjs` and `build-mobile.mjs`, `stripCardContent()` in `scripts/lib/content.mjs`), starting with `catalog-base.json`. `release:check` looks inside the public APK and PC app: no file of the cards, the catalog header present.
- electron-builder no longer tries to upload to GitHub by itself when started from `npm run release` (`publish: 'never'`), and is run once more when its icon tool crashes on exit.
- Release notes of **2.2.0** written (English and French): new name, English, cards on first launch, gallery address, AGPL. Friends' guides: the version from GitHub and its first launch, the address of the source code. README: « Download » section (Releases page, SmartScreen, the cards on first launch).
- Trial `npm run release -- 2.2.0 --essai`: both packages built and checked. Public: APK 82.5 MB (121.3 MB with the cards), installer 203.5 MB (372.3 MB), 0 card file inside; the public PC app starts on a blank profile with 0 card and the « Get the cards » panel. Tests: 305 passed.

## [Unreleased] - 2026-11-21 · Cards on first launch

- **An app built without the card content works**: it ships only the catalog header, `public/catalog-base.json` (grid, AI model, recognition thresholds, detector; no card, nothing from Riot Games), made by `npm run catalog:base` and checked against the full catalog by a test. The scanner, the PC (`electron/content.cjs`) and the phone fall back to it when `card-hashes.json` is missing.
- **« Get the cards » panel** (PC, as long as there is no card): **« Download the cards »** runs the usual gallery flow on the empty catalog (summary, then pictures, fingerprints and AI signatures of every card; about 170 MB); a French app then offers the French translations. **« Import a folder… »** takes a folder holding `card-hashes.json` and `cards/` (or `public/` inside, like the content backup): the cards, their French names and texts and their pictures become the cards layer, checked like any update and refused when made for another AI model or detector. Also in Settings → Content. Phone: « No cards yet: sync with the PC app ».
- **The official gallery moved** to `https://playriftbound.com/en-us/card-gallery/` (the former address redirects there and was refused by the allowed-address list): new address in the app, the scraper and the README; both allowed.
- Checked in the real PC app built without the content, on a blank profile: the panel shows; the import of the backup takes 4 s (1,415 cards, 1,415 French names, 880 French texts, pictures and thumbnails); « AI ready »; a test photo of Ahri is recognised at 100 % with its French name and text; the gallery download reaches its summary (1,408 new cards, Unleashed included). The full download was not run. Tests: 304 passed, lint OK.

## [Unreleased] - 2026-11-21 · LICENSE and NOTICE

- **`LICENSE` now holds the GNU AGPL-3.0 text alone**, identical to the FSF's, so that GitHub recognises the licence (it showed « Other »). **`NOTICE`** holds the rest: the app's notice (Copyright (C) 2026 FaZox, AGPL-3.0 or later), the MIT notice of riftbound-scanner (Nekoraru22) word for word, the note on the detector and the Riot sentence (EN/FR).
- Both are shipped: in the app (`public/LICENSE.txt`, `public/NOTICE.txt`; Settings → About → « Licences » shows the notice, the licence, then the third-party licences), next to the installed PC app, and in the release package (`LICENSE.txt`, `NOTICE.txt`). `npm run release` and `release:check` require the AGPL text in LICENSE and the original line in NOTICE, inside the APK and the PC app too. Guides, README and tests updated.

## [Unreleased] - 2026-11-21 · Public repository

- **https://github.com/FaZox/RiftMancer** published: one commit with a fresh history (`npm run public:export`), authored with the masked GitHub address, 465 files, the two models through Git LFS; no card content, no personal trace, no secret (gitleaks on the history and the files); 204 tests passed (14 files set aside without the card content), build and lint OK before publishing. This private repository keeps the full history and the content.
- `SECURITY.md` (English and French): private reporting through GitHub, the sensitive parts. Secrets search: the only finding in 127 commits was the invented key of the diagnostic test (`gitleaks:allow`).
- This repository now commits with the masked address too (GitHub blocks pushes that expose the personal one).

## [Unreleased] - 2026-11-21 · Personal data out of the public files

- **YOLO detector**: its metadata held the training path on the author's PC; the description now reads 'model/dataset-rot/data.yaml'. Same weights: identical outputs, checked bit for bit on 3 input sizes. New SHA-256 `06df918b…`; the former one (`980a89fd…`) is accepted as the same detector (`DETECTOR.sameWeights`, `sameDetector()` in `src/lib/scanRules.js`, same list in `electron/pack.cjs`), so catalogs, packs and bench proposals made for it keep their thresholds.
- No path of the author's PC left: `model/MODELS.md` (backup folder as a relative path), the bench's « where the photos go on the PC » (`model\real-photos-raw`), the diagnostic test (an invented user name).
- `npm run public:export` reads the files as UTF-8 and ignores placeholders and the anonymising regexes: **0 personal trace** in the public copy (464 files, 88.6 MB).
- Tests: same detector with both SHA-256, shipped file without any path, same list for the packs. 298 passed, lint and screen tests OK.

## [Unreleased] - 2026-11-21 · Card content out of the public repository

- **The public repository holds no card content** (`scripts/lib/content.mjs`): the pictures (`public/cards/`, 2,830 files) and the catalog with the names and texts (`public/card-hashes.json`, Riot Games and riftboundfr.fr) stay on the machines that have them. Also kept out: `model/textures/` (DTD, research-only licence), `model/distractors/` (unknown licence), `model/manual-cards/` (a card picture), `docs/maquettes/` (screenshots with cards). The private repository keeps everything; the public one will start from a fresh history.
- **`npm run public:export [-- <folder>]`**: copy of the tracked files (never the untracked working files), real files for Git LFS, without that content, into a folder outside the repository (default `../riftmancer-public`); report of what is kept out, the size (459 files, 88.6 MB) and the personal traces left (paths of this PC in `model/MODELS.md`, the bench code and the YOLO model’s metadata — next step).
- **`npm run content:import [-- <folder>]`**: copies the content from a content folder (default `../sauvegarde-contenu`, the backup made on 21/11: 3,265 files checked by SHA-256, plus a Git bundle of the private repository).
- **`npm test`** now goes through `scripts/run-tests.mjs`: without the content, the 14 test files that need it (marked `@needs-card-content`) are set aside and named; a test checks that every test file is listed. **`npm run release`** refuses to build without the content.
- Checked on a real public copy: 203 tests passed, 0 failed (14 files set aside), build and lint OK.

## [Unreleased] - 2026-11-21 · Licence: GNU AGPL-3.0

- **RiftMancer is now free software under the GNU AGPL-3.0 (or later)**, decision of 21/11/2026: the card detector is trained with Ultralytics YOLO11, under the AGPL-3.0, and Ultralytics considers trained models covered by it, so the app that ships it follows. You may copy, modify and redistribute it, provided the source code is shared under the same licence.
- `LICENSE`: notice (Copyright (C) 2026 FaZox), the **MIT notice of riftbound-scanner (Nekoraru22) kept word for word**, as its licence requires, the note on the detector, the Riot sentence (EN/FR), then the **full AGPL-3.0 text**, identical to the FSF’s (taken from the copy shipped with Ultralytics, no download). `package.json`: `"license": "AGPL-3.0-or-later"`.
- `THIRD_PARTY_LICENSES.md`: « Ultralytics YOLO11 — AGPL-3.0 » section. Settings → About: « free software under the GNU AGPL-3.0 », source code available from the author and on GitHub once published. README (EN/FR) and friends’ guides updated.
- `npm run release:check` also refuses a package whose `LICENSE.txt` lacks the AGPL text. Tests updated (LICENSE content, AGPL text complete, About).

## [Unreleased] - 2026-11-21 · English and French

- **The app in English or French** (`src/lib/i18n.js`): English by default, French when the phone or PC is set in French; « Language · Langue » in Settings → Display and on the first-launch screen (the app restarts). Card names and texts follow the language (the « Display » option still changes them).
- **French texts as keys**: `tx('Ajouter à la collection')` shows « Add to collection » from `src/i18n/en.js`; `tp(n, '{n} carte', '{n} cartes')` picks singular / plural per language. 1,676 texts: screens, sentences with numbers, internal modules (deck rules, sync, backups, prices, sorts, countries, search), condition labels, label tables, tournament deck sheet.
- **Dates and prices** in the language’s format (`locale()`: fr-FR / en-GB), French words around them translated.
- **Card names** in the display language instead of always French (deck rules, values, wishes, friends…); the French deck list export stays French.
- **PC app**: its own dialogs and the pack / content messages follow the language (`electron/i18n.cjs`, language sent by the window); the content download now says « RiftMancer/<version> ».
- **Tools**: `scripts/i18n-wrap.mjs` marks the French texts of new screens (keeps the outer sentence, skips class names and values), `scripts/i18n-extract.mjs` lists what is left to translate.
- **Tests**: `tests/i18n.test.mjs` (no text without English, no unused English, same values, language rules, main process); every test runs in French whatever the machine (`tests/lang-fr.mjs`, the CI is in English).
- **Documentation in English**, French kept next to it: README (README.fr.md), friends’ guide (docs/FRIENDS-GUIDE.md), release notes (docs/WHATS-NEW.md, shown in the app in its language, both in the package), studies and AI report, roadmap (ROADMAP.fr.md). The release package holds the notes and the guide in both languages and requires both.
- Checked in the built app in English (phone and PC widths): no French left on Collection, Decks, Scanner, More / Settings. Not checked on the phone and the PC in daily use.

## [Non publié] - 2026-11-21 · L'appli s'appelle RiftMancer (LICENCE-ET-PUBLICATION.md 2.2)

- **Nouveau nom, choisi le 21/11** : « RiftMancer » partout où le nom s'affiche — appli Android (et « RiftMancer Test »), fenêtre, installeur et raccourci PC (et « RiftMancer Test »), écran de chargement, barre latérale du PC, premier lancement, À propos (mention Riot comprise), messages (sauvegarde, QR d'appairage, pare-feu, rapport, fiche de deck), manifeste de l'appli web, README, guide pour les amis, nouveautés. Fichiers de la version : `RiftMancer-Setup-<version>.exe`, `RiftMancer-<version>.apk`.
- **Identifiant Android `com.riftmancer.app`** (test : `com.riftmancer.app.test`), décision du 21/11 : aucun ami n'a encore installé l'appli. Pour Android, c'est **une autre appli** que « Riftbound Scanner » : elle s'installe à côté, sans reprendre les données du téléphone ; la collection revient par la synchronisation avec le PC (appairer de nouveau). Code Java déplacé dans `com/riftmancer/app`. Même clé de signature.
- **Appli PC** : identifiant `com.riftmancer.app`, données dans `%APPDATA%\riftmancer` (test : `riftmancer-test`). **Au premier lancement**, le dossier de « Riftbound Scanner » (`riftbound-scanner`, `riftbound-scanner-test`) est **copié** dans le nouveau, sans les caches ; l'ancien est laissé tel quel (c'est la sauvegarde) ; rien n'est repris si le nouveau dossier contient déjà des données ; une seule fois (`electron/dataFolder.cjs`). La collection, les appareils appairés, les sauvegardes et les réglages suivent. L'ancienne appli reste installée à côté : la désinstaller une fois RiftMancer vérifié (même port 47321 : les deux ne peuvent pas tourner ensemble, le message d'erreur le dit).
- **Noms internes gardés** pour la compatibilité (synchro, fichiers déjà faits) : identifiant de l'appli dans la synchro (`riftbound-scanner`), annonce réseau `_riftbound._tcp`, format des sauvegardes (`riftbound-scanner-backup`), des listes d'amis (`riftbound-liste`) et des packs (`.rbpack`), variable `RIFTBOUND_DATA_DIR`.
- 2 tests (`tests/dataFolder.test.cjs`) : reprise du dossier (sans caches, une seule fois, ancien dossier intact), rien d'écrasé si le nouveau contient déjà des données, appli de test à part. Écran de chargement mesuré : « RIFTMANCER » tient à 360, 412 et 1280 px de large.

## [Non publié] - 2026-11-21 · Licence et crédits (LICENCE-ET-PUBLICATION.md, partie 1)

- **`LICENSE`** à la racine : texte MIT du projet d'origine **mot pour mot** (lu dans son dépôt et confirmé le 21/11), sa ligne « Copyright (c) 2026 Nekoraru22 » inchangée, puis « Copyright (c) 2026 FaZox » ; après la licence, hors du texte MIT, la phrase « Cette licence couvre uniquement le code source… Riot Games ». La condition de la licence MIT (l'avis dans toute copie) n'était pas remplie jusqu'ici, y compris dans le paquet 2.1.0.
- **Crédits** : README (sous le titre et dans « Mentions »), `THIRD_PARTY_LICENSES.md` (section « riftbound-scanner (Nekoraru22) — MIT » avec le texte complet), guide pour les amis (section 11 « Mentions »).
- **Réglages → À propos** (téléphone et PC) : « Basé sur riftbound-scanner de Nekoraru22 (licence MIT), largement modifié et étendu » avec le lien ; « Projet de fan gratuit et non commercial » ; mention officielle de Riot Games en français, avec la version anglaise en dessous. **« Licences »** affiche maintenant la licence de l'appli, puis les licences tierces.
- **Dans chaque copie** : `LICENSE.txt` est copié dans l'appli (`public/`, donc l'appli PC et l'APK) et à côté de l'appli PC installée (`extraResources`, avec `THIRD_PARTY_LICENSES.md`) ; `npm run release` joint `LICENSE.txt` et `THIRD_PARTY_LICENSES.txt` au dossier de la version et refuse de construire sans `LICENSE` (ou sans la ligne d'origine).
- **`npm run release:check`** échoue si `LICENSE.txt` manque au paquet ou n'a pas la ligne d'origine, si `THIRD_PARTY_LICENSES.txt` manque, ou si la licence manque dans l'APK ou l'appli PC. Le paquet 2.1.0 déjà construit est donc refusé : **ne pas le distribuer**, la 2.1.1 le remplace.
- 3 tests (`tests/release.test.mjs`) : contenu de `LICENSE` (texte MIT complet, ligne d'origine, phrase sur Riot après la licence), refus d'un paquet sans licence ou sans la ligne d'origine, écran « À propos » (crédit, lien, mention Riot FR et EN, licences).
- Partie 2 (nouveau nom, dépôt public) : pas commencée, attend le nom choisi et votre demande.

## [Non publié] - 2026-11-20 · Retouches du scanner

- **Caméra plus claire** (mode Caméra) : un voile noir à 40 % couvrait toute l'image, y compris l'intérieur du cadre de visée, et l'ombre du cadre en ajoutait un second autour (≈ 64 % plus sombre à l'extérieur). Le voile est retiré : la carte est vue à pleine luminosité, seul l'extérieur du cadre reste assombri (40 %), comme le mode Grille.
- **En-tête du scanner sur les téléphones étroits** : avec le 3e mode (Grille), la ligne titre + recherche + modes + EN/FR débordait de l'écran (le bouton FR sortait à droite). Boutons un peu plus étroits (40 px), titre « Scanner » affiché seulement s'il tient en entier (sous 440 px de large, la barre du bas dit déjà « Scanner »), et laissé de côté quand la caméra tourne. Mesuré à 412 et 360 px de large, caméra allumée et éteinte, dans les trois modes : plus rien ne dépasse.

## [Non publié] - 2026-11-20 · Scanner par grille, étape 3 : le classeur

- **Page et case de chaque carte** : en mode Grille, quand « Ranger dans » est une boîte, chaque carte ajoutée y est rangée avec sa **page** et sa **case** (« Classeur rouge · p. 4, case 7 »). Case à cocher « Noter la page et la case » sous la visée (cochée par défaut, réglage gardé) ; sans boîte choisie, rien ne change.
- **Numéro de page** : la page suivant la dernière déjà enregistrée dans ce classeur (page 1 pour un classeur vide), puis +1 à chaque « page suivante » ; il se corrige avec − / + sur l'écran de vérification. **Page déjà prise** : si ce numéro contient déjà des cartes, un message orange le dit (« Déjà 9 cartes à la page 4 : changez le numéro si c'est une autre page »).
- **Cases** (`gridSlots`, `src/lib/gridScan.js`) : calculées d'après la position des cartes sur la photo (rangées et colonnes), pas d'après leur ordre ; une case vide garde la numérotation, et les pages de 12 cases (4 colonnes) sont reconnues. Le numéro affiché sur la photo est celui de la case.
- **Collection** : l'emplacement d'une carte indique sa page et sa case (« Boîte : Classeur Origins · p. 1, case 4 » ; plusieurs exemplaires : « p. 4, cases 2 et 7 »).
- **Écran de la boîte** (téléphone et PC, `BinderPages.jsx`) : chaque page telle qu'elle est dans le classeur, case par case, cases vides en pointillés ; les cartes sans page viennent ensuite (« Sans page »).
- **Déplacer une carte** vers une autre boîte, un deck ou un prêt lui retire sa page et sa case ; supprimer la boîte aussi. Les champs (`binderPage`, `binderSlot`, `binderCols`) suivent la synchronisation et les sauvegardes comme le reste de l'exemplaire.
- 5 tests (`tests/binder.test.mjs`) : textes, page suivante et page déjà prise, carte déplacée, écran du classeur, cases d'une page pleine, à trous ou de 12 cases.
- Essayé dans l'appli construite (fausse caméra) : boîte créée, choisie dans « Ranger dans », page scannée → 5 cartes en « p. 1, cases 1, 3, 4, 5, 6 » (la case 2, à choisir, non ajoutée), écran de la boîte avec la page 1 et ses cases vides, page suivante proposée : 2.

## [Non publié] - 2026-11-20 · Scanner par grille (étapes 1 et 2)

- **Nouveau mode « Grille »** dans l'onglet Scanner (bouton à quatre carrés, entre Caméra et Importer) : une page de classeur ou plusieurs cartes posées à plat, scannées d'un coup.
- **Visée en direct, photo automatique** (`src/lib/gridScan.js`, `src/components/scan/useGridScan.js`) : un cadre s'affiche sur chaque carte trouvée (seules les cartes nettes comptent) ; quand les mêmes cartes restent au même endroit pendant environ 1 s, la page est prise en photo **pleine résolution** (sans flash, pour éviter les reflets sur les pochettes ; image vidéo si le téléphone ne sait pas), avec le son « reconnue ». Le bouton rond la prend tout de suite. Il faut au moins 2 cartes (une seule : mode Caméra). Pas de reconnaissance en continu : identifier 9 cartes prend 1,5 à 2,5 s sur un téléphone, ce ne serait pas fluide.
- **Vérification de la page** (même écran que l'import de photo) : les cartes sont numérotées dans l'ordre de lecture (rangées de haut en bas, puis de gauche à droite : cases 1 à 9 d'une page), **vertes** si reconnues et déjà cochées, **orange** s'il faut choisir (toucher la carte) ; les coins se déplacent comme avant. En bas : « 5 / 6 cochées » et **« Ajouter 5 · page suivante »**, qui ajoute à la collection (emplacement « Ranger dans » respecté) et revient à la caméra. « Reprendre la photo » recommence la même page sans rien ajouter.
- **Pas de doublon** : après une page, l'appli attend que l'image change (la page tournée) avant de reprendre une photo (« Page prise : tournez la page »).
- **Compteur de la série** : « Page 3 · 21 cartes ajoutées », remis à zéro par « Terminer la série ».
- 5 tests (`tests/gridScan.test.mjs`) : mêmes cartes au même endroit (tremblement toléré, téléphone déplacé non), photo prise une seule fois puis attente de la page suivante, moins de 2 cartes, ordre de lecture d'une page penchée, textes.
- Essayé dans l'appli construite avec une fausse caméra filmant une vraie photo de 6 cartes : 6 cartes trouvées, photo prise seule en 2 s, 5 reconnues et cochées, la 6e en orange ; « page suivante » ajoute les 5 cartes et la même page n'est pas reprise.
- **Essayé sur le téléphone avec un vrai classeur (20/11)** : visée assez rapide, photo prise au bon moment, aucune carte gênée par les reflets des pochettes. L'étape 4 (précision avec les pochettes) n'est donc pas nécessaire pour l'instant ; l'étape 3 (classeur : page et case enregistrées) reste à faire.

## [Non publié] - 2026-11-20 · Corrections v3 (avant la publication de la 2.1.0)

### Lot E · Petits correctifs

- **Test des cartes ajoutées à la main** (`tests/manualCards.test.mjs`) : il vérifie maintenant toutes les dépendances Python des deux scripts (`cv2`, `numpy`, `PIL`, `requests`, `tqdm`) et se met de côté en nommant le module manquant (« module Python manquant : tqdm »), au lieu d'échouer quand `cv2` est présent mais pas les autres. Un test vérifie que cette liste correspond exactement aux imports de `model/cards_scraper.py` et `model/manual_cards.py`.
- **Écran de chargement** : la revue proposait une animation courte hors premier lancement ; **décision du 20/11 : garder l'animation entière (2,4 s) à chaque ouverture**. Rien ne change.
- Lot F (après la 2.1.0) noté dans la ROADMAP : bannissements par circuit, empreintes de la version signées, blocs JavaScript des réglages et de l'accueil plus légers, moteur natif Android.

### Lot D · Sauvegardes du téléphone

- **Copie hebdomadaire dans Documents/Riftbound** : les 10 sauvegardes automatiques sont dans le dossier privé de l'appli, qu'une désinstallation, une réinitialisation ou un téléphone perdu effacent toutes. Une fois par semaine, et seulement si les données ont changé, une copie va dans `Documents/Riftbound/` (`riftbound-copie-<date>-<exemplaires>.json`), qui reste si l'appli est désinstallée ; les **3** plus récentes y sont gardées, les plus anciennes supprimées de ce dossier seulement (les autres fichiers n'y sont jamais touchés). C'est un fichier de sauvegarde ordinaire : il se restaure comme les autres.
- **Données sur des tiers** : ce dossier est lisible par d'autres applis ; les **notes sur les adversaires** (plans de réserve contre chaque Légende) n'y sont pas copiées. Elles restent dans les sauvegardes privées et sur le PC.
- Réglages → Sauvegardes (téléphone) : « Copie hebdomadaire dans Documents/Riftbound », **activée par défaut**, avec la date et l'endroit de la dernière copie, « Copier maintenant », et la phrase « Ce dossier reste sur le téléphone si vous désinstallez l’appli ». Si l'écriture échoue (permissions, Android récent), un **bandeau rouge** le dit avec « Réessayer » ; l'appli réessaie aussi le lendemain. Rien dans un navigateur (ce serait un téléchargement chaque semaine).
- 2 tests (`tests/backups.test.mjs`) : copie seulement si changement et au plus une fois par semaine, 3 gardées, notes d'adversaires absentes, échec signalé et réessayé.
- Non vérifié sur le téléphone : l'écriture dans Documents sur votre version d'Android (même mécanisme que le bouton « Exporter », déjà en place).

### Lot C · Récupération de contenu sur Internet

- **Redirections** (`electron/contentFetch.cjs`) : elles ne sont plus suivies automatiquement ; l'appli PC en suit au plus 3, et **chaque nouvelle adresse est revérifiée** contre la liste des adresses autorisées (règlement Riot, annonces, galerie et ses images, fichiers de riftboundfr.fr). Une redirection vers une autre adresse est refusée (« Adresse non autorisée ») ; si un de ces sites change d'adresse, la nouvelle sera ajoutée à la liste après vérification, sans élargir la règle. Au-delà de 3 : « Le site renvoie vers trop d’adresses successives : refusé. »
- **Limite de 30 Mo appliquée avant et pendant la lecture** : une taille annoncée trop grande est refusée sans rien lire ; sans taille annoncée, la lecture s'arrête dès que la limite est dépassée (avant, tout était déjà en mémoire).
- 5 tests (`tests/contentFetch.test.mjs`) : redirection interdite refusée sans contacter l'autre site, redirection autorisée suivie, plus de 3 redirections, taille annoncée trop grande, flux sans fin interrompu près de la limite.
- Pas encore vérifié sur les vrais sites (pas d'accès réseau pour ce lot) : la première mise à jour du contenu depuis l'appli PC le dira.

### Lot B · Packs de contenu

- **Un pack piégé ne peut plus faire planter l'appli PC** (`electron/pack.cjs`) : la lecture ne décompresse plus rien — une entrée compressée est refusée (« format inattendu »), l'appli n'écrit que des entrées stockées — et la **signature du manifeste est vérifiée d'abord**, en ne lisant que `manifest.json` et `manifest.sig` ; chaque autre fichier n'est lu que s'il est listé dans le manifeste signé. Une entrée dont la position ou la taille sort du fichier est refusée explicitement (« fichier tronqué »).
- **Clé privée chiffrée** : `npm run pack:keygen` chiffre la clé (AES-256) avec une phrase de passe tapée deux fois dans le terminal, sans écho, jamais en argument ni dans l'historique ; `npm run pack:sign` la redemande. Une clé existante en clair se protège avec `npm run pack:keygen -- --chiffrer` (même clé : les packs restent acceptés) ; `pack:sign` prévient tant qu'elle est en clair.
- **Liste de clés publiques** (`electron/packPublicKey.json` : `{ keys: [{ publicKey, fingerprint, createdAt, revoked }] }`, l'ancien format toujours lu) : un pack signé par une clé non révoquée de la liste est accepté ; rotation avec `npm run pack:keygen -- --out <autre fichier>`, révocation avec `--revoquer <empreinte>`. L'écran d'import montre l'empreinte de la clé qui a signé.
- README (packs) : sauvegarde de la clé et de la phrase de passe hors du PC, rotation, clé perdue ou volée.
- 5 tests de plus (`tests/pack.test.cjs`) : entrée compressée refusée sans décompression, pack non signé de 1 000 entrées refusé sans lire les fichiers, entrée hors du fichier, clé chiffrée (bonne et mauvaise phrase), liste de clés (2e clé acceptée, clé révoquée refusée, ancien format lu).

### Lot A · Electron et audit

- **Electron 45.2.3 → 45.4.1** (dernière 45.x, sortie le 19/11, même version majeure) : correctifs de Chromium (156.0.8078.100), de `net.fetch` et des certificats de confiance ; aucun changement cassant dans les notes de version 45.3.0 à 45.4.1. Vérifié : démarrage de l'appli PC sur des données jetables (serveur de synchro, catalogue, cartes bannies, base, WebGPU), les 3 parcours d'écran (scan d'une photo compris), les tests des packs et des sauvegardes.
- **Audit de la CI** : audit **complet** (`npm audit --audit-level=high`, bloquant) — Electron est une dépendance de développement mais il est livré dans l'appli PC, `--omit=dev` ne le voyait pas ; les failles modérées (9, toutes dans la chaîne de construction : electron-builder, glob, minimatch) sont affichées sans bloquer.
- **`npm run check:electron`** (lancé par la CI et par `npm run release:check`) : échoue si la version majeure d'Electron n'est plus parmi les 3 maintenues, ou si un correctif de la même version majeure est sorti depuis plus de 30 jours ; hors ligne, un avertissement seulement (`scripts/check-electron.mjs`, `scripts/lib/electronCheck.mjs`).
- 3 tests (`tests/electronCheck.test.mjs`).

## [Non publié] - 2026-11-17 au 2026-11-20 · Phase 10 : distribution aux amis (M0 à M14)

Synthèse, décisions et vérifications : [docs/PHASE-10.md](docs/PHASE-10.md) ; texte pour les utilisateurs : [docs/NOUVEAUTES.md](docs/NOUVEAUTES.md) (2.1.0). Les entrées vont de la plus récente à la plus ancienne.

### Fiche d'une carte : carte plus grande sur le PC aussi

- Même taille de carte dans la scène que sur le téléphone (250 / 390), colonne de la carte de 520 à 600 px, fenêtre de la fiche jusqu'à 1 000 px de haut (au lieu de 860) et 1 240 px de large : sur un écran 1440 × 900, la carte passe de 267 × 372 à 343 × 479 px ; en 1920 × 1080, à 385 × 537 ; en 1280 × 720, de 212 à 266 px de large. L'image fait 744 px de large : nette à ces tailles.

### Fiche d'une carte : carte plus grande sur le téléphone

- La scène de la fiche prend toute la largeur de l'écran (jusqu'à 70 % de sa hauteur au lieu d'un plafond de 560 px), et la carte y occupe 250 / 390 au lieu de 200 / 390 : sur un téléphone de 412 px de large, la carte passe d'environ 200 à 264 px (≈ 64 % de la largeur, +70 % de surface). Elle reste sous les boutons Retour et FR / EN, cadre des Légendes compris. Le PC ne change pas.

### Fiche d'une carte : carte nette une fois posée

- Après être sortie de la faille, la carte se balançait sans fin en tournant de −1,5° à +1,5°. Une image tournée d'un angle qui n'est pas droit est toujours un peu adoucie (chaque pixel est recalculé à partir de ses voisins), ce qui rendait le petit texte flou.
- Maintenant : un seul balancement, puis la carte se pose parfaitement droite et reste immobile, donc nette pour la lire. Le décor (fissures, étincelles, éclairs, halo, cadre électrique des légendes) continue de bouger. Même chose pour la Légende et le champion d'un deck.

### Écran de chargement : jauge fluide

- La jauge dorée ne saccade plus pendant le démarrage : ce sont maintenant deux demi-anneaux que le navigateur fait tourner lui-même (animation planifiée une fois, exécutée à part), au lieu d'un arc redessiné par l'appli toutes les 100 ms pendant que le téléphone charge les modèles. Plus aucun rafraîchissement par minuterie pendant le chargement.
- Elle avance à vitesse constante et est pleine à 2,4 s si l'appli est prête ; sinon elle s'arrête presque pleine (92 %), avance très lentement, et se termine en 0,35 s dès que l'appli est prête — jamais pleine avant, jamais de saut. L'écran part une fois la jauge pleine.
- Mesuré dans Electron avec le fil principal bloqué 250 ms sur 300 : la jauge suit le temps (56 % lue à 1,37 s, 83 % à 1,99 s). « Réduire les animations » garde un arc immobile qui montre la vraie progression.
- 1 test de plus (`tests/splash.test.mjs`).

### M14d · Intégration continue légère (lot 11.4)

- `.github/workflows/ci.yml` : à chaque envoi sur main (hors documentation) et à chaque pull request, sur GitHub : lint, tests, construction et audit des dépendances livrées, **sans les fichiers Git LFS** (images des cartes, modèles), pour ne pas consommer le quota LFS gratuit (1 Go/mois).
- Sans ces fichiers, les 23 tests qui en ont besoin se mettent de côté en le disant (« fichiers Git LFS absents », `NO_LFS` dans `tests/helpers.mjs`) ; vérifié sur un clone sans LFS : 236 réussis, 23 mis de côté, 0 échec. Avec les fichiers, rien ne change (258 réussis). La construction saute les miniatures.
- L'audit signale une faille sans bloquer. Les vérifications complètes restent locales : `npm test`, `npm run build`, `npm run test:e2e`.

### M14b · Tests d'écran (lot 11.3)

- `npm run test:e2e` : trois parcours de bout en bout dans l'appli construite (`dist/`, servie en local), dans une fenêtre Electron de la taille d'un téléphone, profil vide à chaque fois, sans rien télécharger :
  1. **scanner une photo** (une carte du catalogue posée de travers sur une table, fabriquée par le script) → « Ajouter à la collection » → la carte est dans la Collection ;
  2. **créer un deck sans Légende** → « 1 problème · Choisissez une Légende. » ;
  3. **sauvegarder** (Réglages → Sauvegardes) → créer un deck → **restaurer** → le deck créé après la sauvegarde a disparu.
- ≈ 30 s au total. Les captures d'un parcours en échec vont dans `test-results/e2e/` (ignoré par Git). Vérifié aussi en sens inverse : avec une mauvaise carte attendue, le premier parcours échoue bien.

### M14c · Découpage de useAppController.js et ScanTab.jsx (lot 11.5)

- Sans changement de comportement. `useAppController.js` (754 → 600 lignes) : le démarrage passe dans `hooks/app/useStartup.js`, les messages et le résumé des prix dans `hooks/app/useNotifications.js`, la liste « À ajouter » gardée entre deux lancements dans `hooks/app/appStorage.js`.
- `ScanTab.jsx` (756 → 364 lignes) : le mode photo passe dans `scan/usePhotoScan.js` (état et traitements, toujours appelé par ScanTab : une photo reste quand on passe à la caméra et qu'on revient) et `scan/PhotoScanView.jsx` (l'écran).
- Vérifié par les 258 tests, le lint, la construction et les trois parcours d'écran.

### M14a · Guide pour les amis et README (lot 11.1, 11.2)

- `docs/LISEZ-MOI-AMIS.md` (copié en `LISEZ-MOI-AMIS.txt` dans chaque version par `npm run release`) : nouvelles sections **Mettre à jour le contenu** (Réglages → Contenu : cartes, traductions, cartes bannies, packs ; puis synchroniser) et **Échanger avec les amis** ; chemins des menus remis à jour (téléphone : Plus → Réglages → Synchronisation ; « Synchroniser les deux sens » ; rapport dans Réglages → Aide).
- README : le détecteur est décrit tel qu'il est livré (un seul modèle float32 à taille d'entrée variable, 320 px en caméra, 416 px en photo, entraîné en 416 multi-échelles sur GPU local), l'identification par couleurs puis DINOv2 affiné, les deux modèles livrés ; le choix « Normal / Rapide » et l'entraînement Modal en 768 px sont retirés. Fonctions ajoutées depuis M10 (mains libres, sons, variantes, codes de deck communs, versions, notes par adversaire, compteur 2v2 / chacun pour soi, alertes de prix, listes d'amis).

### Écran de chargement : animation entière à chaque lancement

- L'écran « Forge hextech » dure maintenant **un temps fixe de 2,4 s** dès le lancement (plus longtemps seulement si l'appli en a besoin), puis 0,3 s de sortie : l'animation se joue en entier (nom, hexagone, cadre de scan, un balayage du faisceau) même quand l'appli démarre vite. Avant, il n'apparaissait qu'après 300 ms et pouvait repartir au bout de 900 ms.
- L'arc doré se remplit sur ces 2,4 s, sans jamais aller plus vite que le vrai chargement.
- L'écran n'est plus remonté quand l'appli devient prête : l'intro ne recommence plus en cours de route.
- « Réduire les animations » garde l'ancienne règle (rien sous 300 ms, 900 ms au moins).
- Tests mis à jour (`tests/splash.test.mjs`).

### M13 · Entre amis, sans serveur (lot 10)

- « Échanges et amis » (Plus sur le téléphone, menu Organiser sur le PC) passe à trois segments : **Amis | Échanges | Calculateur**.
- **Partager ses listes** : « Exporter ma liste » enregistre un petit fichier `liste-riftbound-<nom>-<date>.json` (Documents/Riftbound sur le téléphone, téléchargement sur le PC) avec **vos doubles** (au-delà des exemplaires gardés, réglage « Mes doubles ») et **vos souhaits encore manquants**. Il ne contient que des numéros de cartes et des quantités : ni prix payés, ni emplacements, ni boîtes, ni notes. Votre nom est demandé une fois.
- « Importer la liste d'un ami… » : **une entrée par personne**, remplacée à chaque nouvel import (reconnue par l'identifiant de sa liste, sinon par son nom). Le fichier est vérifié : une liste d'une version plus récente est refusée avec un message clair, les lignes invalides sont ignorées, quantités plafonnées à 99. Les listes suivent la synchronisation téléphone ↔ PC comme les autres personnes.
- **Amis** : une ligne par personne (initiale dans un hexagone, « liste du 12 nov. », « 3 cartes pour vous », « 2 cartes pour Paul »). **Fiche** : « Paul a, vous cherchez » et « Vous avez en double, Paul cherche », avec les prix et les totaux, et « Préparer un échange ». Sur le PC, la liste et la fiche côte à côte.
- **Calculateur** : « Je donne » / « Je reçois », total de chaque côté, l'écart au centre dans un hexagone (vert sous 10 % d'écart, ambre au-delà). « Enregistrer l'échange » le range dans l'historique (Échanges), sans toucher à la collection : on l'applique ensuite comme avant.
- Rien n'est envoyé par l'appli : chacun dépose le fichier où il veut (Drive, message…).
- 5 tests (`tests/friendLists.test.mjs`) : contenu de la liste (et ce qu'elle ne contient pas), lecture d'un fichier abîmé ou trop récent, une entrée par personne, échanges possibles dans la limite des quantités, écart du calculateur.

### M12 · Alertes de prix (lot 9)

- **Alertes sur les cartes possédées** : une carte de votre collection qui monte ou baisse de plus de X % en 7 jours est signalée, pour les cartes de plus de Y €. Réglages → Prix → « Alertes sur mes cartes » : « Me prévenir quand une de mes cartes bouge de plus de [20] % en 7 jours, pour les cartes de plus de [2] €. » (10, 20, 30 ou 50 % ; 0,50 à 10 €), ou les couper. La ligne d'état de la section dit « Tendance · alertes à 20 % ».
- Calculé **seulement sur l'historique des prix gardé par l'appli** (règle du lot 1.2 a) : une carte n'est signalée qu'une fois qu'elle a 7 jours de prix. Les prix estimés d'après l'autre finition (≈) et les promos ne déclenchent pas d'alerte. Un foil suit son propre prix foil.
- **Valeur** (téléphone et PC) : en tête de l'écran, un panneau « Mouvements » qui n'apparaît que s'il y a quelque chose : « ▲ Jinx, Démolisseuse +34 % en 7 jours · 12,40 € », « ▼ … », « ◆ Souhait : Ahri est passée sous 8 € ». Chaque ligne ouvre la fiche.
- **Résumé après chaque mise à jour des prix** : « Prix mis à jour : 2 cartes en forte hausse, 1 en forte baisse, 1 alerte de souhait (Valeur) », une seule fois par mise à jour (et non à chaque démarrage, comme l'ancien message des souhaits), rien quand il n'y a rien à dire. Il remplace l'ancien message limité aux souhaits.
- 5 tests (`tests/priceMoves.test.mjs`) : seuil et valeur minimale, pas d'alerte sans 7 jours d'historique, ni pour une promo, réglages par défaut, textes du résumé et des lignes, un seul résumé par mise à jour.

### M11d · Variantes (lot 8.4)

- Étude (`docs/ETUDE-VARIANTES.md`) : les **illustrations alternatives** (126) sont des cartes à part, reconnues comme telles au banc (6 sur 6) ; les **signées** (45) sont la même image avec la signature dorée, groupées avec la carte normale — le scanner demande laquelle ; le **foil** ne se voit pas sur une photo.
- Le résultat du scan dit « Illustration alternative » ou « Signée » sous le nom ; le choix « Même illustration » montre « OGN » / « OGN signée » au lieu de deux « OGN ». Réglages → Scanner rappelle que le foil est à indiquer soi-même.
- 3 tests (`tests/variants.test.mjs`), dont le groupement de chaque signée avec sa carte normale dans le catalogue.

### M11c · Langue détectée : étude, pas livrée (lot 8.3)

- Mesuré au banc sur les 173 vraies photos (vérité lue à l'œil) : une carte française porte « • FR » après le numéro, une anglaise des sets récents « • EN », une anglaise des anciens sets rien du tout.
- Un lecteur simple lit bien « FR » sur une photo nette, mais le résultat dépend trop de son réglage (0 à 5 erreurs pour ~100 décisions sur 144 réglages voisins) et ne décide pas pour ~45 % des photos de l'appli. Selon la consigne (« si ce n'est pas fiable, ne pas le livrer »), **rien n'est branché dans l'appli**.
- Rapport : `docs/ETUDE-LANGUE.md` ; script : `scripts/study-language.mjs` (refait les chiffres à partir des coins du banc et de `model/real-photos-raw/_langues.json`, local).

### M11b · Sons du scan (lot 8.2)

- Trois sons courts et discrets, en plus des vibrations : **reconnue** (deux notes qui montent), **à confirmer** (une note tenue), **déjà scannée** (la même note grave deux fois). « Non reconnue » et une table vide restent muets. Faits par l'appli (Web Audio), sans fichier son.
- **Coupés par défaut.** Réglages → Scanner → Sons : les activer, volume Faible / Moyen / Fort, boutons « Écouter » pour chacun. Le haut-parleur de la bande d'options du scanner les coupe ou les remet d'un geste.
- Ils servent aussi en mains libres (M11a), où l'on ne regarde pas forcément l'écran.
- 3 tests (`tests/scanSounds.test.mjs`).

### M11a · Scan mains libres (lot 8.1)

- Nouveau bouton **Mains libres** (icône main) dans la bande d'options du scanner, à côté de la lampe et du scan automatique ; sur PC, à côté de « Scan automatique » (webcam). Les deux modes s'excluent.
- Le téléphone posé sur un support regarde la table : quand une **nouvelle** carte est posée et ne bouge plus (≈ 450 ms), le scan part tout seul, sans appui. Le déclencheur hexagonal devient un anneau doré qui pulse lentement (« Posez une carte »), puis se remplit (« Ne bougez plus… ») ; le résultat s'affiche comme d'habitude (reconnue, à confirmer, déjà scannée, non reconnue).
- Une carte laissée sur la table n'est jamais scannée deux fois ; une autre carte posée au même endroit l'est. Retirer la carte ne fait ni son ni message : une table vide n'est pas un échec.
- Il regarde de petites signatures en gris de l'image (`cornerCache.js`, ≈ 1 ms toutes les 150 ms), et le scan réutilise le chemin habituel (`handleSnapScan`).
- 3 tests (`tests/handsFree.test.mjs`). Le réglage des seuils sur une vraie table reste à vérifier sur le téléphone.

### M10a · Codes de deck communs, inscription (lots 7.1 et 7.2)

- **Codes de deck au format commun**, celui de Piltover Archive (`@piltoverarchive/riftbound-deck-codes` 1.5.0, licence Apache 2.0 vérifiée, dérivée des codes de Legends of Runeterra) : réécrit dans `src/lib/deckCodes.js` (versions 1 à 6 du format, runes « R », cartes « SP », variantes a / b / signées), le paquet n'est pas installé. Attribution dans `THIRD_PARTY_LICENSES.md`.
- « Partager » partage ce code ; « Importer une liste » le lit (la Légende, les runes et les champs de bataille retrouvent leur zone d'après le catalogue, le champion choisi aussi). Les anciens codes `RB1.` restent lisibles. Une carte que le format ne connaît pas est nommée, et le code de l'appli est donné à la place.
- Un seul bouton **Partager** (téléphone et PC) : code de deck · liste en texte (anglais / français) · **Copier pour l'inscription** · feuille de tournoi. « Copier pour l'inscription » copie la liste anglaise par sections (Legend, Champion, MainDeck, Battlefields, Runes, Sideboard) et reste grisé tant que le deck a une erreur de règle ou une carte bannie, avec la raison.
- Le format exact attendu par le site officiel n'a pas pu être vérifié : l'aide de carde.io n'est plus en ligne et playriftbound.com, qui a remplacé le locator le 14 sept. 2026, ne le documente pas.
- 4 tests (`tests/deckCodes.test.mjs`), dont les deux codes d'exemple de la documentation de Piltover Archive.

### M10e · Errata (lot 7.6)

- Quand une mise à jour du contenu (cartes, traductions, pack) change le texte d'une carte, le PC garde l'ancien texte et la date (`errata.json` à côté des couches, 5 changements par carte au plus) et les sert avec le catalogue : le téléphone les reçoit à la synchro.
- Sur la fiche d'une carte, `TEXTE MODIFIÉ` à côté du texte, avec « le 18 nov. 2026 » ; un appui déplie l'ancien texte, barré, en `rift-400`, sous le nouveau. Le texte affiché compte : l'erratum du texte français si la fiche est en français, de l'anglais sinon.
- Un texte qui apparaît (nouvelle traduction) ou qui ne change que d'espaces n'est pas un erratum ; après « Restaurer la liste précédente », l'ancien texte revenu n'est plus signalé. Réglages → Contenu indique combien de cartes ont un texte modifié.
- 4 tests (`tests/errata.test.mjs`).

### M10d · Compteur de points : modes, historique, reprise (lot 7.5)

- Avant de commencer, le mode en `1v1 | 2v2 | Chacun pour soi` (objectif 8, 11 et 8 points, modifiable). **2v2** : une moitié par équipe, deux portraits de Légende par moitié (« Légende partenaire », « 2e Légende adverse »). **Chacun pour soi** : 3 ou 4 zones, celles d'en face retournées.
- **Historique point par point** : une frise de losanges au centre, un par point, de la couleur du joueur, et des losanges sous chaque score. Un appui long ouvre la liste (score après chaque point) et « Annuler le dernier point ». « − » retire le dernier point de ce joueur : le score vient toujours de l'historique.
- **Partie interrompue** : la partie en cours est gardée à chaque point ; au retour, « Reprendre la partie en cours (5 – 3) ? » (Reprendre / Nouvelle partie), pendant 24 h.
- Le match enregistré garde le mode, les Légendes des équipes et les points de chaque manche. Statistiques : tableau « Par mode » ; les duels Légende contre Légende et premier / second ne comptent que le 1v1. Historique et CSV indiquent le mode.
- 5 tests (`tests/scoreGame.test.mjs`).

### M10c · Notes par adversaire (lot 7.4)

- Onglet **Adversaires** dans un deck (téléphone et PC, `Deck | Adversaires`) : une ligne par Légende rencontrée avec ce deck (portrait, nombre de parties, taux de victoire en vert ou rouge), plus celles préparées à l'avance (« Préparer un plan contre une Légende »). Les illustrations d'une même Légende comptent ensemble.
- Un appui ouvre les **notes et le plan de réserve** en deux colonnes « Sortir » (cartes du deck) / « Rentrer » (cartes de la réserve), puis « Modifier » : notes libres, − / + par carte dans la limite des exemplaires présents. Une ligne d'avertissement si le plan ne s'équilibre pas (« 2 cartes sorties, 1 rentrée ») ou si une carte n'est plus dans le deck.
- Bouton **Notes** dans le compteur de points : le plan contre la Légende adverse choisie, en lecture.
- Gardé dans le deck (`opponents`) : synchronisé et sauvegardé avec lui. 4 tests (`tests/opponentNotes.test.mjs`).

### M10b · Versions d'un deck (lot 7.3)

- Bouton « v3 ▾ » à côté du format, dans l'éditeur de deck (téléphone et PC) : la liste des versions (nom, date, taux de victoire et nombre de parties), « Enregistrer » la liste actuelle sous un nom (« après le tournoi »), et « Comparer » deux versions ou une version et la liste actuelle — cartes ajoutées et retirées sur deux colonnes, par zone et par nombre d'exemplaires. « v3* » quand la liste a changé depuis la dernière version.
- Les versions sont gardées dans le deck : synchronisées et sauvegardées avec lui. **Un match garde la version jouée** (saisie rapide, formulaire, compteur de points) ; les statistiques des matchs ont un tableau « Par version de deck ».
- 3 tests (`tests/deckVersions.test.mjs`).

### M9f · Finitions (lot 6 a, f, h)

- **Plus aucun `confirm()` ni `alert()` du système** (21 restants, avec l'adresse technique de la page sur Android) : les suppressions simples se font tout de suite avec la barre **« Annuler »** (un match, une personne de la liste, un échange de l'historique — `src/lib/undo.js`) ; les autres passent par la boîte de dialogue de l'appli (supprimer une boîte, un deck ou toute la collection — leurs exemplaires perdent leur place —, mettre la collection à jour après un échange, oublier l'apprentissage, remettre les statistiques à zéro, champion impossible, souhaits ajoutés).
- **Textes de 11 px au moins** : les 63 textes encore entre 9 et 10 px (le cahier en comptait environ 180 ; les autres avaient été corrigés avec les modules précédents) passent à 11 px, sans refaire la mise en page.
- **Libellés accessibles** : les derniers boutons à icône sans libellé en reçoivent un (supprimer une personne, la boîte, l'échange, retirer une carte, vider « À ajouter »…).
- Un test garde ces trois règles pour la suite : aucun `confirm()` / `alert()`, aucun texte sous 11 px (hors banc d'essai), aucun bouton à icône sans libellé (`tests/polish.test.mjs`, 4 tests).

### M9e · Premier lancement (lot 6 g, B.6.9)

- **Téléphone** : trois écrans plein cadre (maquettes tel-10 à tel-12) — « Scannez vos cartes », « Rien n’est ajouté sans vous », « Gardez vos données en sécurité » — avec l'hexagone doré et l'icône de chaque étape, les losanges de progression, « Passer » en haut à droite ; au dernier : « Appairer avec mon PC » (ouvre Réglages → Synchronisation), « Plus tard », « Essayer avec des données de démonstration ».
- **PC** : une fenêtre d'accueil (maquette pc-12) avec le QR code d'appairage, le chemin à suivre sur le téléphone et l'explication du pare-feu Windows (« cochez Réseaux privés »), « Plus tard » et les données de démonstration.
- Montrée seulement à une **installation neuve** (aucun exemplaire, aucune liste « À ajouter », aucun appareil appairé) : jamais après une mise à jour. Rejouable : Réglages → Aide → « Revoir la présentation ».
- **Installation neuve vide** vérifiée : mode développeur désactivé, présentation non vue, données de démonstration chargées seulement à la demande (deux endroits), rien de personnel dans les fichiers livrés.
- 3 tests (`tests/welcome.test.mjs`).

### M9d · Recherche globale et raccourcis (lot 6 e et i, B.6.11)

- **Une seule recherche** pour les cartes, decks, boîtes, personnes et réglages : sur PC, fenêtre de 640 px en haut (`Ctrl+K`, ou le champ « Rechercher… » en haut de la colonne), flèches et Entrée ; sur le téléphone, plein écran, par la loupe de l'en-tête de Collection et de Decks. Résultats groupés (titres de 11 px) : cartes avec miniature et « ×3 possédées » (impressions regroupées, possédées d'abord), decks (« 40 cartes »), boîtes, personnes, sections des réglages (par mot-clé : « QR », « sauvegarde », « texte »…). Accents et majuscules ignorés, codes imprimés acceptés (« OGN-030 »). Sans saisie : les cinq dernières recherches ; rien trouvé : « Rien trouvé pour « … » » et « Chercher dans toutes les cartes ».
- Un résultat ouvre ce qu'il désigne : la fiche de la carte, le deck dans Decks, la page des boîtes ou des prêts, la section des réglages.
- **Raccourcis clavier (PC)** : `Ctrl+K` rechercher, `Ctrl+N` ajout rapide d'une carte à la collection, `Ctrl+1` à `Ctrl+8` les pages dans l'ordre de la colonne, `Ctrl+,` réglages, `?` la liste (aussi dans Réglages → Aide), `Échap` ferme ; « ? » reste un caractère dans un champ de saisie.
- 5 tests (`tests/globalSearch.test.mjs`).

### M9c · Réglages en sections (lot 6 d, B.4)

- **Les mêmes neuf sections sur le PC et le téléphone**, dans l'ordre de B.4 (ce qui protège les données d'abord) : Synchronisation, Sauvegardes, Contenu, Scanner, Prix, Affichage, Jeu, Aide, À propos — « Développeur » en dixième, en mode développeur seulement. Une seule liste (`settingsSections.jsx`) pour les deux applis.
- **Téléphone** : la longue page devient une liste (icône, titre, ligne d'état : « PC-Salon · il y a 2 h », « Dernière : hier, 21 h 14 », « IA active », « Tendance »…) ; chaque section s'ouvre en pleine page avec la flèche de retour (bouton Retour d'Android compris). **PC** : la colonne des sections montre les mêmes lignes d'état.
- Regroupements : Scanner = moteur, apprentissage et valeurs des cartes scannées ; Prix = prix de référence et liens Cardmarket ; Aide = « Créer un rapport » et données de démonstration.
- **Affichage → Taille du texte Normal / Grand** (nouveau) : zoom de la plateforme, sans casser la mise en page — zoom de texte de la WebView sur Android (`RiftboundScreen.setTextZoom`), zoom de la fenêtre sur PC.
- **Jeu** (nouveau) : format par défaut des nouveaux decks, objectif de points du compteur (8 en 1v1 selon les règles officielles), main de départ rappelée (4 cartes, mulligan de 2 au plus — règle officielle, non modifiable).
- 3 tests (`tests/settingsSections.test.mjs`).

### M9b · Navigation (lot 6 c, B.3)

- **Téléphone** : l'onglet Decks a deux segments `Decks | Matchs` (le choix est retenu) ; les matchs quittent « Plus ». Le **compteur de points s'ouvre en un geste** : bouton hexagonal doré « Compteur » en bas à droite de l'onglet Decks (sur les deux segments) et dans un deck ouvert, où le deck et sa Légende sont déjà choisis.
- « Plus » : Échanges et amis · Boîtes · Prêts · Réglages. Un point doré sur l'onglet « Plus » et sur la ligne « Réglages » quand quelque chose attend (changements non envoyés depuis le délai du rappel, envoi proposé par le PC, synchro en échec).
- **PC** : la colonne de gauche passe aux cinq groupes de B.3 — Ma collection (Collection, Valeur), Jouer (Decks, Matchs), Ajouter (Scanner), Organiser (Boîtes, Prêts, Échanges et amis), puis Réglages — et une **zone d'état** en bas : « ● Téléphone : synchronisé il y a 2 h » (vert, ou orange au-delà de 7 jours / jamais), « ◆ 12 nouvelles cartes disponibles » seulement s'il y a quelque chose à faire, et la version ; chaque ligne ouvre la bonne section des réglages.
- 3 tests (`tests/navigation.test.mjs`).

### M9a · Écran de chargement « Forge hextech » (B.6.13, proposition A choisie le 18/11)

- Nouvel écran de chargement en CSS et SVG seuls (`ForgeSplash.jsx`, `src/styles/splash.css`) : hexagone doré, cadre de scan, deux anneaux qui tournent en sens inverse, étincelles, fond hexagonal qui défile. **L'arc doré suit les vraies étapes du démarrage** (« Ouverture de la collection… », « Chargement des cartes… », « Préparation du scanner… »), jamais une minuterie ; version en bas en mono 11 px.
- Durées : rien si l'appli est prête en moins de 300 ms ; sinon au moins 900 ms, puis sortie en 300 ms (l'emblème grandit, l'écran se fond dans l'appli). L'attente fixe de 400 ms à la fin du démarrage est supprimée. Une étape en échec laisse la place à l'écran d'erreur de démarrage (M8).
- « Animations des cartes » coupées ou `prefers-reduced-motion` : emblème fixe, avancement seul.
- Continuité avec l'écran du système : l'écran de lancement natif d'Android était encore l'image **blanche** par défaut de Capacitor (éclair blanc au démarrage) ; il passe au fond `#070d18` avec le même hexagone doré, à la même place, pour toutes les densités, plus l'écran système d'Android 12+ (`windowSplashScreenBackground`, icône hexagone). Fond de la WebView Android et de la fenêtre PC : `#070d18`.
- Temps de démarrage enregistré (`rb.startupMs`) et repris dans le rapport de diagnostic : de quoi comparer avant / après sur votre ancien téléphone (B.6.13 règle 5) — mesure à faire par vous, je ne pilote pas le téléphone.
- Lot 6 b : « Session restaurée — N cartes » n'apparaît plus à chaque lancement ; seulement quand une liste « À ajouter » attendait (« Liste « À ajouter » retrouvée — N cartes en attente »).
- 3 tests (`tests/splash.test.mjs`).

### M8 · Quand quelque chose casse (lot 5)

- **Écran de secours** (B.6.10, maquette tel-14) : barrière d'erreur à la racine des deux interfaces et autour de chaque page (la navigation reste utilisable ; changer de page réessaie). Hexagone rouge, « Un problème est survenu », « Vos cartes ne sont pas perdues », puis « Recharger », « Sauvegarder mes données dans un fichier », « Créer un rapport », et le détail technique replié (`TypeError · DeckEditor · v2.1.0`).
- **Erreurs de démarrage visibles** : l'étape en cause est nommée — « Le contenu des cartes n’a pas pu être chargé. » (catalogue), « Votre collection n’a pas pu être ouverte. » (base), « Le scanner n’a pas pu démarrer. » (détecteur, avec « Continuer sans le scanner ») — avec « Réessayer », au lieu d'ouvrir l'appli à moitié chargée.
- **Rapport de diagnostic** (fichier, sans réseau) : Réglages → À propos → « Créer un rapport », et depuis l'écran de secours. Il contient versions, plateforme (système seulement), moteur de reconnaissance et raison d'un repli, versions du contenu, dernière synchro, **nombre** de fiches par type, les 200 dernières erreurs (nettoyées), statistiques du scan et dernier « Tester la vitesse » (désormais gardé). Jamais : clés et jetons d'appairage, adresses IP, nom du PC ou du téléphone, contenu de la collection, noms des personnes, des decks ou des boîtes, photos — les textes passent par un nettoyage, puis le fichier est revérifié contre les noms et secrets connus de l'appareil avant d'être écrit.
- Journal des erreurs (`src/lib/errorLog.js`) : erreurs non gérées, promesses rejetées, écrans en panne, étapes de démarrage ; 200 gardées, nettoyées dès l'enregistrement.
- 4 tests (`tests/diagnostic.test.mjs`) dont le rapport fait sur la **base de démonstration** : aucun nom, aucune carte, aucune adresse, aucun secret.

### M7f · Versions de l'appli et APK plus léger (lot 4.6)

- **Compatibilité PC ↔ téléphone** : le téléphone envoie sa version à chaque synchro et reçoit celle du PC (jamais dans la réponse publique du PC sur le réseau). Protocole différent : « L’appli du PC est plus ancienne. Mettez-la à jour pour synchroniser. » (ou celle du téléphone), au lieu de « PC injoignable ». Versions différentes : un bandeau dit quoi mettre à jour, sur le téléphone (Synchronisation) et sur le PC (pour chaque téléphone). `catalogChoice.js` inchangé.
- **À propos** : la version de l'autre appareil vue à la dernière synchro (« PC : v2.1.0 (vu le 18 nov.) », ou chaque téléphone sur le PC) et « Nouveautés de cette version ».
- **Écran « Nouveautés »** (maquette tel-13) au premier lancement après une mise à jour, tiré de `docs/NOUVEAUTES.md` (« **Titre** : texte ») ; une première installation n'affiche rien (les écrans d'accueil viendront avec le lot 6). Section 2.1.0 réécrite dans ce format.
- **APK plus léger (décidé)** : plus de grandes images dans l'APK (`scripts/build-mobile.mjs`, `--full-images` pour les garder) ; le téléphone les reçoit toutes du PC à la première synchro (mécanisme existant, réglage « grandes images » respecté). Avant cette synchro, le zoom montre la miniature agrandie avec « Image en haute définition après la première synchro ». **APK de 252,0 Mo → 121,2 Mo** (1 415 images, 125 Mo de fichiers retirés).
- Clé publique des packs commitée (`electron/packPublicKey.json`, empreinte ad2dc14ad8eb638e) : les packs signés avec `npm run pack:sign` sont acceptés.
- 4 tests (`tests/versionCompat.test.mjs`).

### M7e · Packs de contenu signés (lot 4.5)

- Réglages → Contenu → **Packs** : « Exporter mon contenu » (les couches actives dans `contenu-<date>.rbpack` : manifeste avec version de l'appli, modèle IA et détecteur attendus, SHA-256 de chaque fichier) et « Importer un pack… » (résumé avant d'installer, « Pack signé par l'auteur de l'appli », « Dernier pack importé : … · signé ✓ »). Un ami fait la mise à jour, les autres importent son pack, même sans Internet.
- **Signature Ed25519 (décidé)** : `npm run pack:keygen` crée la paire de clés — privée hors du dépôt (`%USERPROFILE%\.riftbound\`, refusée dans le dépôt, jamais écrasée), publique dans `electron/packPublicKey.json` ; `npm run pack:sign` signe un pack exporté et vérifie la signature. Refusés, avec la raison exacte : pack non signé, signature invalide, fichier altéré, non listé, manquant ou au nom inattendu (`..`, autre dossier, autre extension), fait pour un autre modèle de reconnaissance, plus ancien que le contenu en place, trop gros. Chaque couche passe ensuite les mêmes contrôles qu'une mise à jour faite sur place.
- `*.pem` ignoré par Git et refusé par `npm run release:check`.
- **À faire par l'auteur** : créer la clé (`npm run pack:keygen`), la sauvegarder hors du PC, et commiter `electron/packPublicKey.json` ; d'ici là, l'appli refuse tout pack (« cette version de l'appli n'a pas de clé pour vérifier les packs »).
- 5 tests (`tests/pack.test.cjs`, clés d'essai créées par le test) : aller-retour export → signature → import sur un autre PC, refus (non signé, autre clé, fichier ou manifeste altéré, fichier non listé, noms dangereux, autre modèle, pack plus ancien).

### M7d · Rechercher de nouvelles cartes (lot 4.2)

- Réglages → Contenu → Cartes → **« Rechercher »** : la chaîne Python (scraper, ajouts manuels, signatures IA, groupes de rééditions) est portée en JavaScript dans l'appli PC, sans Python ni outils de développement. L'appli lit la galerie officielle de Riot (même source et mêmes champs que l'ancien scraper), et montre les nouvelles cartes, les cartes modifiées et les ajouts manuels devenus officiels (retirés).
- **« Installer »** : d'abord la **parité** — empreintes couleurs et signatures IA de 50 cartes du catalogue livré recalculées depuis leurs images et comparées (sinon rien n'est installé) —, puis les images officielles téléchargées (champs de bataille tournés comme avant), WebP + miniature, empreinte couleurs (`fingerprint.js`), signature IA (modèle livré), groupes de rééditions recalculés. Les cartes s'ajoutent à celles déjà installées ; leurs prix arrivent à la mise à jour de prix suivante (le PC lit maintenant le catalogue avec ses couches pour les prix).
- **Noms anglais complets** des champions tirés de la galerie (« Riven, Broken Blade ») : 59 cartes (Radiance surtout) en manquaient, ce qui empêchait de reconnaître un nouveau bannissement à leur nom.
- **Vérification hebdomadaire, activée par défaut** (désactivable) : au démarrage du PC, au plus une fois par semaine, « N nouvelles cartes disponibles » dans Contenu et dans le menu des réglages ; rien n'est téléchargé sans clic.
- Mesures du 18/11 dans le moteur de l'appli (Chromium, ONNX Runtime Web) : galerie relue = catalogue livré (1 408 cartes, 0 différence de champ) ; parité sur 50 cartes : 99,997 % des valeurs d'empreinte identiques (écart maximal 1/255), signatures IA cosinus ≥ 0,99998 ; groupes de rééditions recalculés identiques (118 cartes) ; chaîne complète depuis l'image officielle (3 cartes) : écart d'empreinte ≤ 3/255 (encodeur WebP différent), cosinus ≥ 0,996, 42 s avec la vérification et les groupes.
- 6 tests (`tests/galleryCards.test.mjs` : galerie simulée avec 3 nouvelles cartes et 1 modifiée, structure inattendue, parité, groupes) et 1 de plus dans `tests/content.test.cjs` (couches cumulées, corrections vérifiées).

### M7c · Mettre à jour les traductions françaises (lot 4.3)

- Réglages → Contenu → Traductions françaises : **« Mettre à jour »** (téléchargement simple des deux fichiers de riftboundfr.fr, l'appli disant qui elle est) et **« Importer des fichiers… »** (choix ou glisser-déposer de `repertoire-cartes.json` et `textes-cartes.json`). Même jointure que l'ancien scraper (numéro de carte, impressions « étoile », suffixe d'impression retiré, impressions sans traduction complétées par une autre impression) ; textes passés par `sanitizeHtml`, noms en texte brut ; cartes absentes du catalogue ignorées et comptées. Résumé avant d'installer : « 2 noms et 0 texte nouveaux ou modifiés ». Merci à riftboundfr.fr, affiché avec la source et la date.
- **Vérification hebdomadaire, activée par défaut** (« Vérifier chaque semaine », désactivable) : au plus une fois par semaine au démarrage du PC, requête conditionnelle (ETag / Last-Modified) une fois les traductions à jour ; s'il y a du nouveau, « N traductions nouvelles ou modifiées » dans Contenu et dans le menu des réglages, installé seulement après un clic. Site qui refuse ou indisponible : pas de nouvel essai avant la semaine suivante, et au plus un rappel par mois avec l'import manuel.
- **Constat du 18/11** : riftboundfr.fr répond « 402 Payment required / DEPLOYMENT_DISABLED » (site désactivé chez son hébergeur, pas un contrôle anti-robot). L'appli le dit (« Le site est indisponible pour l’instant ») ; l'import des fichiers déjà téléchargés reste possible. Vérifié avec les fichiers du 5/11 : traductions identiques au catalogue livré, à 2 doubles espaces près.
- 5 tests (`tests/frTranslations.test.mjs`) : fichiers valides, autre format refusé, HTML actif assaini, carte inconnue ignorée et comptée, site indisponible.

### M7b · Mettre à jour les cartes bannies (lot 4.4)

- Réglages → Contenu → Cartes bannies → **« Mettre à jour »** : l'appli PC lit la page officielle du règlement des tournois de Riot (« Constructed Format Legality », « 2v2 Constructed Legality » : cartes, champs de bataille, légendes, date), et, si vous collez son adresse, une **annonce de bannissement** de playriftbound.com (« Effective: … », cartes ajoutées). Le règlement est mis à jour après les annonces : les bannissements annoncés depuis sont gardés, une page plus récente qui ne cite plus une carte la lève.
- Déroulé B.6.2 dans un panneau (Recherche → Résumé → Installation → Terminé) : différence avec la liste actuelle (« + Riven, Broken Blade »), source et date, **rien n'est modifié avant « Installer »**. Chaque nom est cherché dans le catalogue (impressions listées pour les champions) ; un nom absent est signalé. Une liste vide ou deux fois plus courte est traitée comme une erreur de lecture. La liste précédente reste restaurable.
- Repli **« Modifier à la main »** : ajouter (recherche dans le catalogue) ou retirer une carte, par format, avec la date d'effet saisie.
- Réseau (`electron/contentFetch.cjs`) : seulement depuis le processus principal du PC, vers les adresses autorisées du lot 4 ; l'appli dit qui elle est (nom et version), requête conditionnelle possible ; un refus (contrôle anti-robot, 403, 429) est signalé, jamais contourné, avec « Ouvrir dans mon navigateur ».
- Vérifié sur les vraies pages du 18/11 : la liste reconstruite est identique à `public/banlist.json`.
- 8 tests (`tests/banUpdate.test.mjs`) : page simulée, structure inattendue, nom inconnu, liste vide refusée, annonce, modification à la main, téléchargements (adresse interdite, refus, hors ligne, 304).

### M7a · Contenu en couches (lot 4.1)

- Le contenu livré avec l'appli (catalogue, images, signatures IA, cartes bannies) reste la **base** ; les mises à jour faites depuis l'appli PC sont des **couches** dans `userData/catalogue/couches/` (cartes, traductions, cartes bannies), chacune avec sa date, sa source et l'empreinte SHA-256 de ses fichiers (`electron/content.cjs`).
- Le PC fusionne base et couches et le serveur local sert le résultat (`card-hashes.json`, `banlist.json`, images des nouvelles cartes) : la fenêtre du PC le recharge aussitôt, et le téléphone le reçoit à la synchro par le mécanisme existant (version = SHA-256, `catalogChoice.js` inchangé).
- Une couche illisible ou altérée est **ignorée avec un message**, jamais en silence ; une nouvelle version de l'appli dont la base est plus récente retire proprement les couches devenues inutiles ; la liste de cartes bannies précédente reste restaurable.
- **Réglages → Contenu** (B.6.1) : cartes (nombre, dernière extension, source et date), traductions françaises (noms, textes, merci à riftboundfr.fr), cartes bannies (« Standard : 15 cartes, 7 champs de bataille · 2v2 : +1 », date) ; « Revenir au contenu d’origine ». Sur le téléphone, la même section en lecture seule, avec « Reçu du PC le … ». Les boutons de mise à jour arrivent avec M7b à M7d.
- Réglages PC : ordre de B.4 (Synchronisation, Sauvegardes, Contenu en tête).
- 11 tests (`tests/content.test.cjs`, résumé des bannissements).

### M6 · Ne jamais perdre les données (lot 3)

- **Sauvegardes automatiques du téléphone** (`src/lib/autoBackup.js`) : au plus une par jour, seulement quand quelque chose a changé (au démarrage et quand l'appli passe en arrière-plan), et toujours avant une mise à jour de la base (lue avec l'ancienne version) ou des données (échelle des états) et avant une restauration. Les **10** dernières sont gardées dans le dossier de l'appli. Réglages → Sauvegardes : la liste (date, exemplaires, taille), « Restaurer », « Exporter » (copie dans Documents/Riftbound), « Sauvegarder maintenant ».
- **Rappel de synchro** : bandeau sur la Collection du téléphone, « 23 changements non envoyés au PC depuis 9 jours » → « Synchroniser » ; refermable, il revient après le délai ; délai réglable (3, 7, 14, 30 jours ou jamais ; 7 par défaut) dans Réglages → Synchronisation.
- **Dossier supplémentaire sur le PC** (clé USB, autre disque) : « Choisir un dossier… » ; chaque sauvegarde y est copiée (30 gardées) ; « Introuvable (clé USB retirée ?) » sans rien bloquer. Réglages → Sauvegardes regroupe désormais les sauvegardes du PC (avec le nombre d'exemplaires de chacune) ; restaurer passe par une boîte de dialogue de l'appli au lieu de `confirm()`.
- **Conflits visibles** : une fiche modifiée sur le téléphone et sur le PC (ou un autre téléphone) entre deux synchros est notée dans l'historique des synchros, des deux côtés : « 2 fiches modifiées des deux côtés : la plus récente a été gardée », dépliable avec le nom des cartes et la version gardée. Une même modification faite des deux côtés n'est pas un conflit ; la première synchro après l'appairage non plus.
- 10 tests (`tests/backups.test.mjs`, `tests/conflicts.test.cjs`) : rotation à 10, pas de sauvegarde sans changement, restauration d'une sauvegarde automatique, conflit consigné, dossier supplémentaire absent.

### M5 · Signature et paquet de distribution (lot 2)

- **Une seule version** : `package.json` (passé à **2.1.0**, le numéro qu'affichait déjà À propos) ; `src/lib/appVersion.js` ne contient plus de numéro écrit à la main. À propos affiche la version et la date de construction (« v2.1.0 · construite le 17 novembre 2026 »).
- **`npm run release -- <version>`** : arbre Git propre, version plus haute que celles déjà distribuées, nouveautés écrites (`docs/NOUVEAUTES.md`), clé présente ; puis tests, lint, installateur PC, APK signé ; `release/v<version>/` avec l'installeur, l'APK, `NOUVEAUTES.txt`, `LISEZ-MOI-AMIS.txt` et `EMPREINTES.txt` (SHA-256) ; commit « Version » et tag en local. `--essai` pour essayer la chaîne sans rien enregistrer.
- **`npm run release:check`** : refuse un paquet qui contient la clé de signature, une base de données, des photos ou données du banc, des fichiers d'entraînement, un `.env`, une version de test, ou un fichier qui ne correspond plus à `EMPREINTES.txt` — y compris à l'intérieur de l'APK et de l'appli PC.
- **APK de distribution** (`android-apk.mjs --release`) : refusé sans clé de signature, jamais installé par adb ; vérifie qu'il est signé avec la clé de distribution (pas celle de debug) et non débogable.
- **Appli PC installée** : outils de développement fermés (Ctrl+Maj+I ne fait plus rien), sauf dans l'appli de test.
- **Guide pour les amis** (`docs/LISEZ-MOI-AMIS.md`, première version du lot 11.1) : vérifier les empreintes, installer le PC (SmartScreen) et l'APK, appairer, synchroniser, sauvegarder, mettre à jour sans désinstaller.
- 9 tests (`tests/release.test.mjs`).

### M4 · Nettoyage du scanner (lot 1.4)

- Le scanner de l'appli de test, validé le 17/11, devient celui de toutes les applis ; **une seule chaîne de reconnaissance** : couleurs d'abord, et quand elles hésitent l'IA sur la découpe de leur meilleure carte, dans les deux sens, notée sur tout le catalogue. L'ancienne cascade (300 cartes) et la découpe en 48 bandes sont retirées ; le drapeau `testFeatures.js` disparaît (`src/lib/scanRules.js` garde les règles du scan).
- **Détecteur époque 40** livré (`yolo11s-pose-riftbound-dyn.onnx`, sha256 980a89fd…) ; l'ancien est sauvegardé hors du dépôt.
- **Seuils dans l'en-tête du catalogue**, par taille d'entrée (caméra 320 : 0,457 / 0,15 ; photo 416 : 0,467 / 0,115), avec le SHA-256 du détecteur pour lequel ils sont calibrés. Avec un autre détecteur, rien n'est accepté automatiquement quand les couleurs hésitent, et le téléphone ignore un catalogue du PC fait pour un autre détecteur.
- **Mode « Rapide » retiré** (il acceptait près de 10 % des cartes hors catalogue) : réglage supprimé sur PC et Android, préférences v5 (tout le monde en Prudent).
- Caméra : une carte de moins de 2 % de l'image n'est jamais acceptée automatiquement. « Tester la vitesse » : découpe sur sa ligne.
- 4 tests (`tests/scanRules.test.mjs`) ; tests du catalogue, des préférences et de la découpe mis à jour.

### M3 · États Cardmarket (lot 1.3)

- Les exemplaires passent à l'échelle d'état de **Cardmarket** (celle des prix et des liens) : Neuve (MT), Quasi neuve (NM), Excellente (EX), Bonne (GD), Légèrement jouée (LP), Jouée (PL), Abîmée (PO) — `src/lib/conditions.js`, seule source.
- **Migration** avec la table validée : NM → Near Mint, LP → Excellent, MP → Good, HP → Played, D → Poor. Elle se fait au chargement de la collection, sur le PC comme sur le téléphone, une seule fois par exemplaire ; l'ancien état reste dans la fiche (`conditionOld`) et la modification passe par la synchro comme une autre. Un exemplaire reçu d'un appareil pas encore à jour est converti à son arrivée.
- « État minimum » des liens Cardmarket : mêmes libellés que la collection (le filtre « Bonne (GD) » correspond enfin à un état de la collection).
- **CSV** : l'import lit les deux échelles (noms anglais, libellés français, abréviations ; « LP » = Light Played de Cardmarket) ; l'export CardNexus garde l'échelle américaine, et un exemplaire migré y retrouve exactement son ancien état. Riftmana n'exporte pas d'état.
- Pas de coefficient de prix par état. 6 tests (`tests/conditions.test.mjs`) : migration d'une collection de démonstration, aller-retour CSV sans perte.

### M2 · Prix cohérents (lot 1.2)

- **Variation sur 7 / 30 jours** : seulement d'après l'historique de prix de l'appli, quand il remonte assez loin ; sinon « — » et « L'historique se remplit jour après jour ». Avant, l'écart entre le prix tendance et la moyenne des ventes de Cardmarket s'affichait comme une hausse ou une baisse de la semaine.
- **Foils** : historique et variation foil (nouvelles séries `foil`, `avg7Foil`, `lowFoil` des tables de prix, PC et téléphone) ; courbe `Normal | Foil` sur la fiche quand les deux prix existent ; la fiche dit quand vos foils sont estimés faute de prix foil.
- **Prix estimés** : un prix pris sur l'autre finition est affiché « ≈ » en couleur d'avertissement, avec la raison (fiche, tableaux, valeur, collection) ; `priceInfo()` dit si un prix est estimé.
- **Plus-value** : un exemplaire payé mais sans prix Cardmarket n'est plus compté pour 0 € (fausse perte) ; « dont N exemplaires sans prix, non comptés ».
- **Toutes les cartes** (Valeur) : une ligne par finition (et par promo), avec le badge FOIL et son propre prix à l'unité.
- **Promo** (décision : prix séparé) : un exemplaire promo prend le prix de la promo de cette carte sur Cardmarket (même métacarte, extension promo) ; « ≈ » quand Cardmarket a plusieurs promos de la carte (médiane) ou aucune (prix de la carte normale). Sur les données du 17/11 : 274 cartes ont un prix promo, dont 194 unique.
- Un seul format de pourcentage (`pct` de `prices.js`) ; les valeurs par défaut des nouveaux exemplaires et le bouton « Rétablir » ont une seule source (`src/lib/batchDefaults.js`), en français.
- Calcul de la page Valeur sorti dans `src/lib/valueData.js` ; 8 tests (`tests/prices.test.mjs`), un par ligne du tableau du cahier et un pour les promos.

### M1 · Cartes bannies et format de deck (lot 1.1)

- La liste des bannissements était vide (constat vérifié) : `public/banlist.json` passe en version 2, remplie depuis les pages officielles de Riot, avec deux listes datées : celle du 18 sept. 2026 (12 cartes) et celle de Radiance, **en vigueur le 23 nov. 2026** (10 cartes). Chaque bannissement porte sa date d'effet ; avant cette date, la carte n'est pas bannie mais l'éditeur prévient (« sera bannie le 23 nov. 2026 »).
- Champions : seul le titre banni est touché (ex. Ekko, Recurrent banni, les autres Ekko non), grâce aux numéros d'impression explicites (vérifiés sur les images des cartes).
- Format du deck : Standard ou 2v2 (Maître Yi, Wuju Bladesman banni comme légende en 2v2 seulement), choisi par une puce à côté du nom du deck, PC et téléphone.
- Bandeau de contrôle du deck (`DeckCheckBanner`) : « Deck valide en Standard · bannissements au … » ou « N problèmes » avec le détail ; badge **Bannie** et carte assombrie dans l'éditeur, la collection et l'aperçu du catalogue (« Bannie en Standard depuis le … »).
- `src/lib/deckRules.js` : `banStatus`, `banListInfo`, `deckFormats`, `isBanned` selon le format et la date ; 7 tests (`tests/banlist.test.mjs`).

### M0 · Fondations du design (AMELIORATIONS-APPLI.md, B.1 et B.2)

- Jetons de couleur d'état `state.ok / warn / bad / info` (Tailwind) ; le message court (toast) les utilise.
- `.chip` était défini deux fois dans `src/index.css` : les deux règles sont fusionnées dans le rendu qu'elles donnaient ensemble (aucun écran ne change) ; nouvelle classe `.toggle` pour les boutons à bascule ; contour de focus clavier doré visible partout.
- Composants communs (`src/components/common/`) : `Dialog` (+ `DialogProvider` / `useDialog()` : `ask()` et `inform()` remplaceront `confirm()` et `alert()`), `Sheet`, `Banner`, `StatusPill`, `SectionCard`, `Field` (sorti de la page Réglages du PC), `Stepper`, `ProgressRow`, `DiffList`, `EmptyState`. `src/lib/pcInterface.js` : une seule règle pour choisir l'interface PC ou téléphone.
- Maquettes versionnées dans `docs/maquettes/` ; cahier découpé en modules M0 à M14 (`ROADMAP.md`).

## [Non publié] - 2026-11-15

### Détecteur YOLO : réentraînement en cours (rien ne change dans l’appli)

- Le modèle livré a été reconstruit en PyTorch depuis son ONNX (`model/onnx_to_pt.py`), sorties identiques, pour servir de point de départ. Piège corrigé : sa première convolution du SPPF n’a pas d’activation, alors que la version récente d’Ultralytics en remet une.
- Nouveau jeu d’entraînement (`model/data_creator.py`) : cartes tournées, photos en paysage, grilles aux orientations mélangées, gros plans qui remplissent l’image. Étiquettes et proportions vérifiées ; aucune vraie photo dedans.
- Essais abandonnés : rot-ft (416 px, coins décalés, vraies photos 154 → 111), rot-scratch.
- **rot768** (768 px, depuis le modèle livré) en pause à l’époque 11 sur 40 : grilles 179 / 200 (actuel 146), vraies photos 121 / 173 (actuel 154) et en remontée. Adopté seulement s’il fait au moins aussi bien sur les vraies photos et mieux sur les grilles et les cartes tournées.
- Ultralytics figé en 8.4.211 ; `train.py` : nom, poids de départ, lot, workers, cache, optimiseur, `--set`, `fliplr=0`. Bancs : en paquets parallèles (`eval-detector-par.mjs`), DirectML pour les essais exploratoires.

## [Non publié] - 2026-11-14

### Photos prises téléphone à plat, cascade à 300 candidats

- **Cartes couchées sur les photos** (téléphone posé à plat, photo en paysage) : quand la photo droite trouve peu de cartes, le détecteur réessaie l’image tournée de 90, 180 et 270° et garde l’orientation qui trouve nettement plus de cartes. Sur les grilles réelles : 170 cartes reconnues sur 200 au lieu de 141, sans rien perdre sur les 1 000 scènes simulées ni sur les 173 vraies photos. PC, téléphone et module de collecte.
- **Reconnaissance** : la fusion couleurs + IA porte sur les 300 meilleurs candidats des couleurs au lieu de 100 (seuils Prudent 0,36 / 0,13). De bout en bout : +40 et +34 cartes justes sur 6 897 (320 et 416 px), sans fausse en plus.
- Bancs : calcul des seuils des centaines de fois plus rapide (même résultat), option `--orient` / `--merge` / `--rotate` / `--conf` / `--grid-dir` de `eval:detector`, détail des grilles dans `--dump`.

### Reconnaissance : DINOv2-small affiné sur les cartes

- Le modèle d’image est maintenant **DINOv2-small affiné sur les cartes Riftbound** (`dinov2s-ft-fp16.onnx`, 46 Mo au lieu de 44, même architecture), entraîné en 53 min sur RTX 5070 avec `model/train_embedder.py`. Les 20 % des illustrations gardées hors de l’entraînement mesurent les cartes jamais vues. Seuils Prudent 0,40 / 0,14, calibrés pour garder le taux de cartes hors catalogue acceptées de l’ancien modèle (0,966 %). Mode Rapide : 0,28 / 0,06.
- Banc de bout en bout (1 000 scènes simulées) : +3,3 points de cartes justes en 320 px (fausses 6 → 4) et +2,5 en 416 px (3 → 2). Sur les cartes jamais vues à l’entraînement : +3,3 et +2,4 points. Sur 173 vraies photos : 155 au lieu de 147 en 320, et 153 au lieu de 145 en 416. Sur les grilles réelles (200 cartes) : 137 au lieu de 129, et 141 au lieu de 131.
- L’ancien modèle `dinov2s-fp16.onnx` quitte l’appli et Git LFS (sauvegardé hors du dépôt). Licence : modèle dérivé de DINOv2 (Apache 2.0), voir `THIRD_PARTY_LICENSES.md`.

### Correctif : catalogue du téléphone

- Le téléphone utilisait toujours le catalogue reçu du PC lors de la synchro, même plus ancien que celui de l’APK. Avec une appli PC pas à jour, son catalogue sans signatures IA coupait l’IA : toutes les photos de la collecte du 14/11 ont été reconnues aux couleurs seules (`engine: grid16`). Désormais, le catalogue du PC n’est utilisé que s’il est au moins aussi récent (nouveau champ `generatedAt` du catalogue) et fait pour le même modèle IA. Sinon, le téléphone utilise le catalogue de l’APK et le dit dans Réglages → Moteur de reconnaissance (`src/lib/catalogChoice.js`, 4 tests).

### Collecte banc d’essai : retours après essai sur le téléphone

- « Image caméra » : le viseur reste actif après chaque capture (plus besoin de repasser par « Photo »).
- Grille : source « Appareil photo » avec viseur dans l’écran et photo pleine résolution (ImageCapture), en plus de « Photo du téléphone ».
- Export : seules les photos pas encore exportées par défaut (une photo corrigée redevient « nouvelle ») ; case « Tout réexporter ».
- `bench:import` : dossiers comparés sans tenir compte de la casse (Windows) ; un dossier existant garde son nom. Codes à suffixe écrits comme dans le catalogue (`UNL-150a`). 1 test de plus.

### Collecte pour le banc d’essai, dans l’appli (mode développeur)

- **Mode développeur** : 7 appuis sur le numéro de version (Réglages → À propos), sur le téléphone et sur le PC ; il se désactive dans la nouvelle section « Développeur ». Rien ne change pour un utilisateur normal.
- **Collecte banc d’essai** : photos de test prises dans l’appli et étiquetées par le scanner (même chaîne : YOLO 320 px pour l’image caméra, 416 px pour la photo, cascade couleurs → IA, seuils actuels). **Chaque carte doit être confirmée ou corrigée** (candidats, recherche par nom ou par code, ou code hors catalogue saisi à la main) ; aucune option « tout accepter ». La réponse du scanner et la réponse finale sont gardées toutes les deux.
  - Carte seule : source « Photo » ou « Image caméra », mode rafale, photo sans carte détectée gardée si l’on indique la carte, proposition d’enregistrer comme grille quand YOLO voit plusieurs cartes. Sur le PC : import de photos ou d’un dossier.
  - Grille : cartes encadrées et numérotées, confirmées une à une, « Ajouter une carte non détectée », « Pas une carte », doublons permis, résumé avant d’enregistrer.
  - « Ma collecte » : liste avec miniature, cartes, date, source et statut ; revoir, corriger ou supprimer une photo ; compteurs (photos, cartes, corrigées, hors catalogue). Photos dans le dossier privé de l’appli (pas la galerie), sans position GPS ni informations de l’appareil (seule l’orientation est gardée, l’image n’est pas recompressée).
  - Option « Proposer de garder les scans hésitants pour le banc » (désactivée par défaut) : sur « laquelle est-ce ? », un appui garde l’image caméra, étiquetée par la carte choisie.
- **Export ZIP** au format du banc : `<CODE>/<nom>.jpg` (identifiant de la carte quand le code ne suffit pas, ex. cartes signées), `grilles/<nom>.jpg` + `.txt`, `_collecte.json` (sources, détecteur, moteur, seuils, tirage test / calib fait à la création). Noms date-heure + 4 caractères, jamais en collision. Sur le PC : `npm run bench:import -- <fichier.zip>` range l’export dans `model/real-photos-raw/` en fusionnant `_collecte.json` (chemins, JPEG et absence de GPS vérifiés ; une photo corrigée depuis un export précédent est déplacée).
- `photos:prepare` ignore le dossier `grilles/` (il le signalait comme carte inconnue). La recherche de cartes accepte le code complet (« OGN-042 »).
- 10 tests (`tests/bench.test.mjs`), dont un export lu tel quel par `eval-detector.mjs` (cartes seules et grilles, avertissement « hors catalogue » attendu) et par `photos-prepare.mjs`.

### Seuils Prudent recalibrés : 0,42 / 0,14

- Les seuils sont recalibrés sur les 4 224 photos simulées, avec le catalogue actuel (ajouts manuels, runes regroupées). Avec ce catalogue, l’ancien réglage 0,38 / 0,13 dépassait la limite de 1 % de cartes hors catalogue acceptées. Nouveau réglage : 0,42 / 0,14, ce qui donne 79,6 % de cartes justes, 0,02 % de fausses et 0,97 % de cartes hors catalogue acceptées. Sur les 65 vraies photos : 84,6 % de justes, aucune fausse, aucune hors catalogue. Le mode Rapide ne change pas (−0,2 / 0,07). L’en-tête du catalogue est mis à jour.
- Étape 5.1 (contrôle par la couleur du cadre) : mesurée et mise en pause (−3 points de cartes justes au banc recalibré, sans aucune fausse en moins ; un test équitable de bout en bout reste à faire) ; voir `model/MODELS.md`.


### Modèles livrés : YOLO float32 à entrée dynamique et DINOv2 fp16

- **Détection** : un seul fichier YOLO float32 à entrée dynamique, `yolo11s-pose-riftbound-dyn.onnx` (39 Mo), exécuté en 320 px pour la caméra et en 416 px pour la photo. Il remplace les deux int8. **Reconnaissance** : DINOv2 fp16, `dinov2s-fp16.onnx` (44 Mo), au lieu de l’int8 (24 Mo). Les signatures du catalogue sont recalculées en fp16, avec les seuils Prudent 0,38 / 0,13 calibrés sur 4 224 photos simulées. L’en-tête porte le SHA-256 du modèle fp16. Un catalogue fait pour un autre modèle est refusé, et le scanner affiche le bandeau « Reconnaissance IA indisponible, mode léger utilisé » (test ajouté).
- Banc de bout en bout, sur 1 000 scènes simulées (6 897 cartes), comparé à l’ancien couple int8 + int8. En 320 px : 5 690 cartes justes au lieu de 5 603 (+1,3 point), 6 acceptées à tort au lieu de 8. En 416 px : 5 993 au lieu de 5 943 (+0,7 point), 6 → 3 acceptées à tort. Sur les 66 vraies photos et les 72 cartes en grilles, aucune carte n’est acceptée à tort, avant comme après. Vitesse mesurée sur le téléphone : détection 320 px 487 ms (485 ms en int8), modèle IA 401 ms (382 ms en int8).
- Modèles de l’APK : 83 Mo, au lieu de 45 Mo. APK d’environ 250 Mo : modèles 74 Mo compressés, images des cartes 131 Mo et miniatures 37 Mo (déjà dans l’APK auparavant), moteurs ONNX Runtime 4 Mo, reste 5 Mo.
- **Choix « Normal / Rapide » du modèle de détection supprimé** (réglages téléphone et PC), ainsi que le téléchargement des modèles depuis le PC (`downloadModel`, `models/manifest.json`, bouton des réglages). Préférences v4 : les anciennes clés du choix sont effacées et, sur Android, les modèles déjà téléchargés depuis le PC sont supprimés.
- « Tester la vitesse » : mesure la caméra (320 px) ou la photo (416 px) ; les comparaisons de variantes de l’APK de test sont retirées.
- Git LFS : seuls les modèles livrés y sont (+83 Mo) ; les int8 et les autres essais sont dans le dossier de sauvegarde, hors du dépôt (`model/MODELS.md`). `eval:detector` mesure par défaut le modèle de l’appli en 320 et 416 px (`--models fichier.onnx@taille`).

## [Non publié] - 2026-11-13

### Fiabilité d’abord : modèles plus précis mesurés, ajouts manuels au catalogue

- **Ajouts manuels au catalogue**, pour des cartes réelles absentes de la galerie officielle. Ils sont listés dans `model/manual-cards/manual-cards.json` : les runes UNL-R01 à R06 (vérifiées sur les cartes) et le jeton SFD-T02 Soldat de sable (Sand Soldier), dont l’image est recadrée depuis une photo. Ils sont fusionnés par `model/manual_cards.py`, appelé dans `catalog:update` et `refresh_prod.sh`, et marqués `manual: true`, sans prix. Un ajout est retiré automatiquement, avec un message dans le log, dès que la galerie officielle publie le même code. Les runes UNL sont regroupées avec les runes OGN, RAD et VEN de même illustration. 3 tests.
- **YOLO float32 à entrée dynamique** (`export_yolo_sizes.py --dynamic`) : un seul fichier sert pour le 320 et le 416, avec des sorties identiques au bit près à celles des modèles à taille fixe. Sur le téléphone, il va aussi vite que l’int8 en 320 (487 ms).
- **Bancs** : DINOv2 int8, fp16 et fp32 (même vitesse sur le téléphone ; le fp16 gagne 1,2 point sur 4 224 photos, sans fausse de plus) ; banc de bout en bout sur 1 000 scènes ; compte des cartes acceptées à tort ; options `--ai-model`, `--report`, `build-embeddings --model`. Résultats et tailles d’APK dans `model/MODELS.md`.
- « Tester la vitesse » (APK de test) : YOLO à entrée dynamique en 320 et 416 px, et modèle IA en int8, float16 et float32.

### Avant l’étape 2 : scan auto, image IA, catalogue

- **Le scan auto réutilise les coins de la carte quand l’image est immobile.** YOLO (≈ 0,5 s sur le téléphone) ne tourne alors plus, et la carte est simplement réidentifiée. YOLO repart dans ces cas : l’image entière ou la zone de la carte a changé par rapport à l’image où les coins ont été trouvés (une autre carte posée au même endroit donne un écart de 30, pour un seuil de 8) ; les coins ont déjà servi 5 fois de suite ; la carte reconnue avec ces coins diffère de la précédente ou n’est pas reconnue ; la carte est floue. Le module est `src/lib/cornerCache.js`, couvert par 7 tests sur des images de synthèse (bruit, exposition, autre carte, carte retirée, décalage, dérive lente).
- **« Tester la vitesse »** : ajout de la ligne « Scan auto, image immobile » (coins réutilisés, sans YOLO) et d’une case qui compare le modèle IA seul en 168 px et en 140 px.
- **Image IA en 140 px : mesurée, pas encore adoptée.** Sur le banc de reconnaissance, on passe de 78,4 % à 77,0 % sur les photos simulées et on reste à 83,1 % sur les vraies photos. De bout en bout, à calibration égale, on perd environ 0,5 point sur les scènes et une carte sur 58 dans les grilles. Le calcul passe de 57 à 41 ms sur PC. La décision attend la mesure sur le téléphone (`model/MODELS.md`).
- **Rééditions regroupées aussi grâce aux signatures IA** (même nom et similarité ≥ 0,95). Les runes OGN, RAD et VEN ont la même illustration avec une autre teinte, et les couleurs ne les regroupaient pas : désormais, le scanner demande l’édition au lieu de répondre une rune d’une autre édition. `catalog-groups` passe après `build-embeddings` (dans `catalog:update` et `refresh_prod.sh`).
- Banc : `build-embeddings --engine/--out/--prudent/--fast` construit un catalogue de banc sans toucher à celui de l’appli. `eval:detector --catalog` mesure avec ce catalogue. Le détail par photo de grille liste aussi les cartes reconnues absentes de la liste.
- Modèles : seuls les int8 sont dans git (LFS) ; les float32 se régénèrent au bit près (`export_yolo_sizes.py --src/--out`). Les poids sources sont sauvegardés hors du dépôt (`model/MODELS.md`).

### Détection plus rapide — étape 1 (une taille d’image par mode)

Mesure de l’utilisateur avant ce changement : sur le téléphone, la détection YOLO en 768 px prend environ 2 090 ms (un seul cœur).
- **Détection en 320 px pour la caméra et en 416 px pour la photo et les grilles**, au lieu de 768 px. C’est le même modèle de détection : les fichiers sont redimensionnés (`model/export_yolo_sizes.py`), sans réentraînement. Sur PC (Node, 1 cœur), le calcul passe de 287 ms à 49 ms (320) et 86 ms (416). Sur 65 vraies photos, en int8 (la version livrée), 320 et 416 reconnaissent **aussi bien que le 768** (92,3 % et 90,8 %, contre 86,2 %). L’écart de quelques photos sur 65 ne suffit pas pour conclure que c’est mieux. Sur les grilles simulées, le 320 perd environ 6 points (cartes petites dans l’image), d’où le 416 pour le mode photo. Sur 6 vraies grilles (57 cartes), le 416 int8 en reconnaît 51, contre 52 pour le 768 et 47 pour le 320. Sur le téléphone de l’utilisateur, la détection en 320 int8 prend **485 ms au lieu d’environ 2 090 ms**, et le scan complet **557 ms**. Le float32 ne gagne que 3 % (468 ms) : l’int8 reste livré.
- La taille d’entrée est lue dans le modèle lui-même (`yoloCore.modelInputSize`), elle n’est plus codée en dur. Le pré- et post-traitement (`src/lib/yoloCore.js`, sans DOM) est partagé par l’appli, le banc et `photos:prepare`. Il est testé sur des coins connus à 320, 416 et 768 px.
- Correctif : sur Android, un modèle normal inclus dans l’APK est détecté par une requête GET, car le serveur local de l’appli ne répond pas aux requêtes HEAD.
- **APK** : il contient les modèles int8 320 et 416 (2 × 10 Mo, au lieu d’un int8 768). Les modèles normaux (float32, 2 × 39 Mo) ne sont pas dans git : ils se régénèrent au bit près (`model/MODELS.md`), et le PC les sert au téléphone, qui les vérifie avec `public/models/manifest.json` (SHA-256, versionné). L’APK de test garde le float32 320.
- **« Tester la vitesse »** : choix du modèle de détection mesuré (caméra 320, photo 416, 320 int8, 320 float32). Le résultat indique la taille et le format utilisés.
- **Banc de détection** `npm run eval:detector` : il mesure toute la chaîne (détection, redressement, identification) sur 200 scènes simulées (`model/make_detector_eval.py`), sur les vraies photos et sur les vraies photos de grilles (`model/real-photos-raw/grilles/<nom>.jpg` + `<nom>.txt`). Il mesure aussi le temps sur 1 et 4 cœurs. Il donne le détail par photo de grille (cartes manquées). Les cartes absentes du catalogue comptent pour la détection seulement. Les résultats sont dans `model/MODELS.md`.
- Android : les en-têtes COOP / COEP de `MainActivity.java` sont retirés. La WebView ne les applique pas, et androidx.webkit 1.14.0 n’offre aucune API d’isolation. Le nombre de cœurs reste décidé par `canShareMemory()`.
- **Réentraînement à 416 px multi-échelle essayé puis rejeté.** `model/train.py` permet maintenant d’entraîner en local sur une carte graphique CUDA. Sur les vraies photos, le nouveau modèle reconnaît 54 à 78 % des cartes, contre 85 à 92 % pour l’ancien. Ses coins sont décalés quand la carte remplit l’image. Il est archivé dans `model/archive/`, avec le diagnostic et la piste « cartes plein cadre » pour `data_creator.py` dans `model/MODELS.md`.

## [Non publié] - 2026-11-11

### Modèles d’IA pour la reconnaissance — étape 4.6 (vitesse)

Mesures de l’utilisateur avant ces changements : sur PC, 271 ms d’identification et 260 ms de modèle IA quand il sert ; sur le téléphone, 490 ms d’identification, 1 984 ms de modèle IA et 2 145 ms de détection YOLO.
- **Empreinte couleurs 5 à 6× plus rapide**, avec un résultat identique au bit près : moyenne par zones en deux passes (lignes puis colonnes). Calcul des 12 vues (4 orientations × 3 cadrages) : 276 → 55 ms en pleine résolution.
- **Photo réduite à 480 × 670 avant l’identification**, la taille sur laquelle le banc calibre les seuils : 55 → 22 ms.
- **Modèle IA : une seule image de 168 px** au lieu de 3 images de 224 px, soit environ 5× moins de calcul. Le modèle regarde le cadrage et l’orientation de la carte la plus probable selon les couleurs. Banc (`--cascade 100 --single`, tailles 224 / 168 / 140 / 112 comparées) : cartes acceptées justes 77,3 % sur photos simulées et 84,6 % sur 65 vraies photos (au lieu de 79,8 % et 87,7 %), toujours 0 fausse carte sur les vraies photos. À 112 px, on perd 6 points et 1,5 % de cartes hors catalogue sont acceptées : écarté.
- **Android sur plusieurs cœurs** : l’appli envoie les en-têtes d’isolation (COOP / COEP, `MainActivity.java`) comme le serveur PC. Comme la WebView d’Android ne gère pas COOP, le nombre de cœurs ne dépend plus de `crossOriginIsolated` mais de la mémoire partagée elle-même (`canShareMemory`), testée directement. Jusqu’à 4 cœurs pour ONNX Runtime, détection YOLO comprise. « Tester la vitesse » affiche les cœurs utilisés, la mémoire partagée et l’isolation de la page. PC (mesure de l’utilisateur, 4 cœurs) : identification 44 ms, modèle IA 69 ms quand il sert.
- Banc : configurations `dinov2s-int8-mean-168/140/112`, option `--single`.

### Modèles d’IA pour la reconnaissance — étape 4 (intégration)

- **Reconnaissance par IA dans l’appli** (PC et Android) : DINOv2-small int8 (24 Mo, inclus dans l’installeur et l’APK) combiné à l’empreinte couleurs, **en cascade**. Les couleurs décident seules quand elles sont sûres. Sinon (≈ 30 % des photos), l’IA regarde la carte dans la meilleure orientation et avec les cadrages des 100 meilleures cartes selon les couleurs (≈ 3 images au lieu de 6), et le score combiné départage. Banc (`--cascade 100`) : cartes acceptées justes **70,3 → 79,8 %** sur photos simulées et **69,2 → 87,7 %** sur 65 vraies photos, **sans aucune fausse carte** sur les vraies photos (0,2 % sur les simulées) et ≤ 1 % de cartes hors catalogue acceptées.
- **Signatures IA du catalogue** : `scripts/build-embeddings.mjs` calcule le vecteur de chaque carte (int8 + échelle, ≈ 0,7 Mo) et les écrit dans `card-hashes.json`, avec un en-tête : modèle (SHA-256), poids de chaque moteur et seuils calibrés. Lancé par `npm run catalog:update` (étape 5/5) et `refresh_prod.sh`. Les signatures arrivent sur le téléphone avec le catalogue (même synchro, même contrôle SHA-256).
- **Contrôles** : le modèle est vérifié par SHA-256 au chargement, et refusé s’il ne correspond pas aux signatures. Des signatures absentes ou incomplètes sont refusées aussi. Dans ces cas, le scanner utilise l’empreinte couleurs **et l’affiche** (bandeau « Reconnaissance IA indisponible, mode léger utilisé » + « Réessayer »).
- **Réglages → Scanner → « Moteur de reconnaissance »** : IA (recommandé, par défaut, préférences v3) ou Empreinte couleurs (léger). On y trouve l’état de l’IA et le bouton **« Tester la vitesse »** (20 cartes du catalogue : temps YOLO, identification, temps quand l’IA est nécessaire).
- **Apprentissage** : chaque correction garde aussi le vecteur IA de la photo (par moteur). Les anciens exemples, sans vecteur IA, restent utiles par leurs couleurs.
- Scan : l’identification est maintenant asynchrone. Un seul calcul du modèle à la fois : le scan automatique ne s’empile pas et les photos attendent leur tour.
- **Réglages → À propos → « Licences »** : `THIRD_PARTY_LICENSES.md` (Apache 2.0, attributions des modèles) est livré avec l’appli.
- Banc : options `--cascade` et seuils du mode Rapide (`thresholdsFast`). Tests : codage int8 des vecteurs, signatures du catalogue faites par le modèle livré, moteur IA dans `CardMatcher` (score combiné, cascade, apprentissage), modèle différent refusé avec repli visible, migration des préférences v3.

### Modèles d’IA pour la reconnaissance — étape 2 (mesures)

- Modèles récupérés, tous sous licence Apache 2.0 : DINOv2-small et sa variante « with registers », téléchargés tels quels (ONNX de onnx-community), ainsi que MobileNetV4-Conv-Small et SigLIP 2 Base, exportés depuis les poids **safetensors** de timm (`model/export_embedders.py`, environnement `model/requirements-embed.txt`). Chaque export contrôle la parité PyTorch / ONNX et produit une version int8.
- `model/MODELS.md` donne pour chaque fichier l’URL, la révision, le SHA-256 et la licence, ainsi que les résultats du banc. `THIRD_PARTY_LICENSES.md` contient les attributions et le texte de la licence Apache 2.0.
- Les binaires `.onnx` (≈ 710 Mo) restent hors de git pour ne pas dépasser le quota Git LFS. Ils se retrouvent à l’identique grâce aux révisions et SHA-256 notés.
- Résultat sur photos simulées : aucun modèle seul ne bat l’empreinte actuelle. Combiné à elle, DINOv2 int8 (24 Mo) passe de 70,3 % à 80,0 % de cartes acceptées justes, sans aucune fausse. Décision en attente de photos réelles.

### Modèles d’IA pour la reconnaissance — étape 1 (banc comparatif)

- **Moteurs de reconnaissance** (`src/lib/engines/`) : interface commune navigateur / Node. `grid16` = l’empreinte couleurs actuelle (inchangée) ; `onnxEngine` = modèles d’image ONNX (DINOv2, MobileNetV4, SigLIP 2), avec le prétraitement de chaque modèle (carte entière redimensionnée, **sans recadrage central** qui couperait nom, coûts et Might ; moyenne / écart-type du modèle ; jeton CLS ou moyenne des patchs). Régions testées : `art` (illustration) et `full` (carte entière, cadre compris).
- `MatchIndex` accepte des vecteurs de n’importe quelle taille (la partie « grille » n’est utilisée que pour l’empreinte couleurs) et donne le score de chaque carte (`scoreAll`, pour combiner deux moteurs).
- **Banc comparatif** : `npm run eval:matcher -- --compare grid16,dinov2s@full,… [--fusion 0.5,0.7,0.85]` — mêmes photos simulées pour tous les moteurs, seuils calibrés **par moteur** (≤ 1 % hors catalogue, ≤ 0,5 % faux), top-1 / top-5, acceptée juste / fausse, rejetée, hors catalogue, confusions de rééditions, ms par carte, taille du modèle ; photos réelles toujours à part ; rapport `model/eval-compare.json` ; vecteurs du catalogue mis en cache (`model/cache/`, ignoré par git). Simulateur de photos partagé (`scripts/lib/simulate.mjs`). `onnxruntime-node` ajouté en dépendance de développement.
- **Photos réelles** : `npm run photos:prepare` passe les photos de `model/real-photos-raw/<carte>/` par **la même chaîne que l’appli** (YOLO + redressement, `perspectiveCrop.warpQuadRGBA` désormais utilisable hors navigateur) et écrit les cartes recadrées dans `model/real-photos/<id>/`.
- Tests : `tests/engines.test.mjs` (index générique, moteur grid16 identique à l’empreinte, prétraitement des modèles).

### Prix de référence appliqué partout

- Avec « Moyenne 7 jours » ou « Prix bas » choisi, la fiche d’une carte montrait encore la **tendance** pour le prix foil, l’**évolution 7 j / 30 j** et la courbe, et la courbe de valeur de la collection (PC) était calculée sur la tendance. Corrigé : l’historique quotidien garde maintenant les trois prix (tendance, moyenne 7 jours, prix bas) par carte, la valeur de la collection est enregistrée pour les trois, et évolutions et courbes utilisent le prix choisi. Les courbes « moyenne 7 jours » et « prix bas » se remplissent à partir d’aujourd’hui (jamais mélangées avec la tendance).

### Corrections v2 — Lot F (dépôt, accord de l’utilisateur)

- Supprimés : `model/0.onnx` et `model/yolo11s-pose-riftbound.onnx`, copies exactes (vérifié octet par octet) de `public/models/…`, utilisées par aucun script.
- `model/fr/*.json` (données de riftboundfr.fr) retirés du suivi Git et ajoutés au `.gitignore` ; les fichiers restent sur le disque.
- **Git LFS** pour `*.onnx`, `*.webp` et `model/textures/**` (3 240 fichiers) : les prochaines versions de ces fichiers ne grossiront plus `.git`. L’historique n’est pas réécrit : `.git` garde sa taille actuelle (≈ 270 Mo).

### Corrections v2 — Lot E (performances)

- **Code au démarrage : 818 Ko → 155 Ko** (bloc initial) : seule l’interface utilisée (PC ou téléphone) est chargée, et les pages lourdes (Scanner, Decks, Valeur, Matchs, Plus / Réglages, Boîtes / Prêts / Échanges) le sont à leur première ouverture (`React.lazy`). Avertissement `INEFFECTIVE_DYNAMIC_IMPORT` corrigé.
- **Moteurs ONNX** : les deux sont nécessaires sur PC (WASM simple pour le modèle Rapide ou sans carte graphique, WebGPU pour le modèle Normal), mais le détecteur ne charge plus que celui qui sert — le moteur WebGPU de 29 Mo seulement avec une carte graphique et le modèle Normal (`yoloDetector.loadOrt`).
- **Téléchargement du modèle Normal sur le téléphone** : par morceaux d’environ 1 Mo écrits au fur et à mesure (`Filesystem.appendFile`) et vérifiés par un SHA-256 incrémental (`src/lib/sha256.js`) — plus de 52 Mo de texte base64 en mémoire ; fichier temporaire supprimé si la vérification échoue.
- Tests : SHA-256 incrémental identique à node:crypto quel que soit le découpage, moteur WebGPU non chargé pour le modèle Rapide.

### Corrections v2 — Lot D (sécurité)

> **Ré-appairage nécessaire** (protocole v3) : installez le nouveau logiciel PC et le nouvel APK, puis scannez à nouveau le QR code du PC avec chaque téléphone. Le téléphone l’indique lui-même (« Nouvelle version de la synchronisation »).

- **Une clé par téléphone** : le QR code ne sert plus qu’à l’appairage, accepté seulement pendant qu’il est affiché sur le PC (fenêtre de 5 min, renouvelée tant que la page est ouverte ; sinon 403). Le PC crée alors une clé propre au téléphone et un identifiant (choisi par le PC, pas par le téléphone) ; toutes les autres requêtes portent `X-RB-Device` et sont signées / chiffrées avec cette clé. **« Dissocier » supprime la clé : le téléphone est réellement coupé**, même s’il invente un autre identifiant, sans toucher aux autres. « Nouveau QR code » (ex-« Régénérer la clé ») invalide les QR codes déjà affichés ou photographiés. Les clés restent dans le processus principal (jamais envoyées à l’interface).
- **Empreinte du PC du jour** : `/api/hello` et mDNS publient `HMAC(secret du PC, « hello|AAAA-MM-JJ »)` — elle change chaque jour (le PC ne peut plus être suivi d’un lieu à l’autre) ; le téléphone accepte la veille, le jour et le lendemain ; ré-annonce mDNS à minuit (UTC).
- **mDNS durci** : réponses seulement aux machines des réseaux locaux du PC (RFC 6762 §11), paquets > 1 500 octets et plus de 16 questions ignorés, au plus une annonce multicast par seconde et 10 réponses directes par seconde et par machine.
- **Intégrité** du catalogue et de la liste de bannissement en **SHA-256 complet** (au lieu de SHA-1 tronqué).
- CSP Android : `http:` gardé et documenté, en attendant un essai de `http://*:47321 http://*:47322` sur le téléphone.
- Tests : appairage (fenêtre fermée → 403, mauvais QR → 401), téléphone dissocié → 401 même avec un autre identifiant, les autres continuent, empreinte du jour (veille / lendemain acceptés, avant-veille non), mDNS (paquet tronqué, boucle de pointeurs, 65 535 questions, source hors réseau).

### Corrections v2 — Lot C (tests et lint)

- **Test portable** : les chemins avec antislash (`..%5C`) attendent 403 sous Windows, 403 ou 404 ailleurs (sous Linux l’antislash est un caractère de nom de fichier) ; le contenu du dossier voisin n’est jamais servi. Les cas avec `/` restent stricts (403).
- **Lint : 71 avertissements → 0**, et les deux règles passent en erreur (`no-unused-vars`, `react-hooks/exhaustive-deps`).
  - 21 dépendances de hooks corrigées une à une : fonctions stables des hooks déstructurées (`addEntries`, `initDetector`…), `toEntry` / `targetPlace` mémorisés, `useRef` pour les rappels passés à chaque rendu (`onMatchChange`, `runDetection` — qui évite aussi d’utiliser une version périmée —, redémarrage de la caméra), dépendances inutiles retirées ; une mesure de mise en page volontairement sans liste de dépendances est documentée.
  - 50 variables / imports inutilisés supprimés (dont une fonction morte `togglePendingCheck`).
- Vérifié dans l’app (PC et téléphone) : pages Collection, Decks, Matchs, Valeur, Scanner, Réglages sans erreur.
- CI GitHub Actions : proposée, non ajoutée (à décider).

### Corrections v2 — Lot B (règles du jeu)

- **Main de départ et probabilités** : le champion choisi commence en Champion Zone (Core Rules 103.2.a.1) — la pioche fait **39 cartes** pour un deck de 40 et contient une copie de moins du champion (`expandLibrary`). Le simulateur affiche le champion « En Champion Zone » à part ; le calculateur compte sur la pioche et précise « + 1 en Champion Zone, toujours disponible » ; avertissement si aucun champion n’est choisi.
- **Matchups** : les 145 cartes Légende (illustrations alternatives, versions ★) sont ramenées à **58 Légendes** (`src/lib/legends.js`, clé = titre de la Légende — le premier tag n’est pas fiable, une impression de Nasus est taguée « Dog »). Statistiques, matrice et menus regroupent les illustrations alternatives ; une Légende de deck en illustration alternative s’affiche correctement dans les menus. Matchs existants inchangés.
- Tests : pioche de 39 avec 2 copies du champion, probabilité sur 39 cartes, deux matchs avec deux illustrations de Jinx → une seule ligne de 2 parties.

### Corrections v2 — Lot A (scanner)

- **« Prudent » redevient le mode par défaut** (`DECISION = DECISION_PRUDENT`), « Rapide » reste au choix, présenté honnêtement (« peut se tromper sur les cartes récentes ou absentes du catalogue »). Migration unique des préférences (`prefsVersion: 2`, `migratePrefs`) : ceux qui avaient déjà « Rapide » enregistré passent à « Prudent » une fois, leur choix ultérieur est respecté. Banc d’essai (1 000 photos **simulées**, aucune photo réelle) :

  | Défaut | prise juste | carte FAUSSE prise | carte absente du catalogue prise | demande |
  |---|---|---|---|---|
  | avant : Rapide | 79,2 % | 4,6 % | 22,9 % | 16 % |
  | après : Prudent | 70,6 % | 0,1 % | 0,8 % | 29 % |

- **Plus de « mode simulation »** : si le modèle ne se charge pas, le détecteur ne « détecte » plus de fausse carte au centre de l’image. Chaîne de repli explicite (modèle choisi en WebGPU → WASM → modèle Rapide, avec « Modèle Normal indisponible : modèle Rapide utilisé ») puis état d’erreur : bandeau « L’IA de reconnaissance n’a pas pu démarrer » + « Réessayer » + détail technique, sur PC et Android (`DetectorStatus.jsx`). Code TF.js et simulation supprimés (`yoloDetector.js` 648 → 438 lignes).
- **Apprentissage mesuré honnêtement** : `--learn` corrige des photos simulées dans d’autres conditions que les photos testées ensuite (autre série aléatoire, autre plage de difficulté), en mode Prudent. Avec l’ancienne pénalité (0,06), les cartes absentes du catalogue prises montaient de 0,3 % à 1,3 % ; pénalité portée à **0,3** : 0,3 % → 0,3 %, et gain conservé (bonne carte en premier 77,0 → 79,3 %, prise juste 58,3 → 62,3 %, demandes 41,5 → 37,5 %). **Garde-fou** : une photo nettement plus proche (≥ 0,1) d’une autre illustration que de la carte choisie n’est pas apprise (message en console).
- Rapport : ligne « photos réelles » toujours séparée des photos simulées. **Photos réelles : à fournir** (`model/real-photos/<id-carte>/*.jpg`).
- Tests : `tests/detector.test.mjs` (échec de chargement → erreur sans détection, repli sur le modèle Rapide), migration des préférences, garde-fou d’apprentissage.

### Le scanner apprend de vos corrections

- Quand vous choisissez vous-même la carte (« Pas la bonne carte », « laquelle est-ce ? », une autre carte proposée sur une photo), l’empreinte de la photo devient un **exemple de cette carte** (nouvelle collection synchronisée `learned`, sauvegardée avec le reste). Les scans suivants comparent la photo au catalogue **et** à ces exemples : votre téléphone, votre lumière, vos protège-cartes. Rien n’est appris des ajouts automatiques ; 5 exemples maximum par carte ; les exemples pèsent un peu moins que le catalogue (pénalité 0,06).
- Banc d’essai `npm run eval:matcher -- --learn` (400 cartes, 2ᵉ photo de chaque carte après correction de la 1ʳᵉ) : bonne carte en premier **71,8 → 80,8 %**, prise juste **64,8 → 74,5 %**, demandes **29 → 20 %**, cartes fausses prises 6,0 → 5,8 %.
- Réglages → Scanner → « Apprendre de mes corrections » (activé), nombre d’exemples appris, « Oublier ».
- Dissocier un téléphone depuis le PC, raison précise quand l’appairage échoue, règle réseau de l’APK corrigée (`http:` au lieu de `http://*:47321`, qui bloquait aussi le port de l’app de test).

### Scan moins bavard + versions de test

- **Scan** : la carte au plus haut pourcentage est prise ; la liste « laquelle est-ce ? » n’apparaît que si l’écart avec la deuxième illustration est faible (marge 0,04). Banc d’essai (1 000 photos simulées, nettes à difficiles) : 80 % prises justes, 3,4 % fausses (« Pas la bonne carte » pour corriger), 17 % demandées — contre 71 % / 0,2 % / 29 % avant. L’ancien comportement reste dans Réglages → « Quand demander quelle carte ? » → Prudent. `npm run eval:matcher -- --try "abs:marge,…"` compare des seuils.
- **Apps de test** installables à côté de celles de tous les jours : PC « Riftbound Scanner Test » (`npm run desktop:exe:test` : autre dossier d’installation, données `%APPDATA%
iftbound-scanner-test`, port 47322) et Android « Riftbound Test » (`npm run android:apk:test`, `com.riftbound.scanner.test`, flavors Gradle daily / beta). Badge **TEST** orange et « (TEST) » dans le titre.

### Hygiène du dépôt — Lot 6 (propositions, rien n’a été supprimé)

- Corrigé : version du manifeste PWA lue dans `package.json` (était « 2.0.0 ») ; ROADMAP (« Pas de GitHub » → dépôt privé FaZox/RiftboundApp) ; README (`model/fr/` est en fait suivi par git) ; `refresh_prod.sh` robuste (venv facultatif, `set -e`, regroupe aussi les rééditions).
- **À décider** (aucune action faite) :
  1. `.git` pèse ~269 Mo. `model/yolo11s-pose-riftbound.onnx` et `model/0.onnx` sont des copies exactes (vérifié octet par octet) de `public/models/…` ; `model/train.py` n’en a pas besoin (il copie `best.onnx` vers `public/models/`). Proposition : les supprimer de `model/` et passer `*.onnx`, `*.webp` et `model/textures` en Git LFS pour la suite — sans réécrire l’historique.
  2. `model/fr/*.json` (données de riftboundfr.fr) sont suivis par git : proposition `git rm --cached model/fr/*.json` + `model/fr/` dans `.gitignore` (les fichiers restent sur le disque). Le dérivé dans `card-hashes.json` reste : question de droits si le dépôt devient public.

### Performance et qualité — Lot 5

- **Moteur d’inférence** : onnxruntime-web 1.19 → **1.31.1**. PC / navigateur : build **WebGPU** (carte graphique) avec repli WASM **multi-thread** (4 fils, grâce aux en-têtes COOP/COEP ajoutés au serveur du PC) ; Android : build WASM simple (un fil, la WebView Capacitor ne peut pas être isolée). Le modèle int8 reste sur le processeur (plus rapide qu’en WebGPU). Copies inutiles des .wasm retirées du build.
  Temps de détection mesurés sur ce PC (image 768×768, médiane de 5) :

  | | modèle int8 | modèle normal |
  |---|---|---|
  | Avant (1.19, WASM 1 fil) | 881 ms | 1 220 ms |
  | 1.31, WASM 4 fils | 330 ms | 429 ms |
  | 1.31, **WebGPU** | 754 ms | **19 ms** |

  Téléphone : non mesuré (à faire sur l’appareil) ; le build et le modèle par défaut y sont inchangés côté vitesse.
- **Taille de l’APK : 218 → 186 Mo** : le modèle normal (39 Mo) et le build WebGPU (29 Mo) ne sont plus dans l’APK. Le modèle normal se télécharge depuis le PC appairé (Réglages → Modèle → « Télécharger depuis le PC »), vérifié par son SHA-256 écrit dans l’APK (`models/manifest.json`) ; en attendant, le modèle int8 est utilisé.
- **Matcher** : empreintes dans un seul `Float32Array`, liste des meilleurs candidats par insertion triée (voir Lot 3).
- **Horloges** : le téléphone envoie son heure (`clientNow`) ; le PC corrige les dates des fiches reçues de l’écart (au-delà de 30 s, borné à 7 jours, jamais dans le futur) et le téléphone convertit les dates reçues ; avertissement dans Réglages au-delà de 2 min. Test : téléphone en avance d’une heure → la restauration faite sur le PC n’est plus écrasée.
- **Qualité du code** : ESLint 9 (`npm run lint`, règles JS + React + hooks : 0 erreur, 70 avertissements — variables inutilisées et dépendances de hooks, laissés pour ne pas changer le comportement) ; corrections : échappements inutiles, caractère BOM invisible dans une expression régulière, `Buffer` en navigateur. Découpage sans changement de comportement : `CollectionTab.jsx` 879 → 136 lignes (+ `CardsView`, `ProgressView`, `WishlistView`, `ValueView`, `collectionShared`), `DecksPage.jsx` 600 → 136 (+ `DeckWorkspace`, `DeckCatalog`), `CollectionPage.jsx` 564 → 85 (+ `CollectionCards`, `CollectionWishlist`). `useAppController.js` n’est pas découpé (trop lié à l’état de l’app pour un découpage sans risque). Nouveaux modules de `src/lib/` documentés en JSDoc.
- **CI GitHub Actions** : non ajoutée (à décider, voir ci-dessous).

### Fonctions de joueur compétitif — Lot 4

- **Règles de deck** : cartes **Signature** (3 au total, avec le tag du champion de la Légende — Core Rules 103.2.d, vérifié sur RiftJudge / riftbound.gg). Le catalogue porte maintenant `superTypes` et `signature` (champ `cardType.superType` de la galerie officielle : 60 cartes Signature) ; le scraper Python les enregistre. **Cartes bannies / limitées** : `public/banlist.json` (listes **vides** : à remplir depuis les annonces officielles de Riot), vérifiées par `validateDeck`, envoyées au téléphone à la synchro (vérifiées par empreinte).
- **Matchs** (nouvelle collection synchronisée `matches`, sauvegardée avec le reste ; PC : menu « Matchs », téléphone : Plus → Matchs) : saisie en 1 à 3 touches après une partie (Légende adverse, « J’ai commencé », résultat), formulaire complet (Bo1 / Bo3 avec manches, événement, ronde, adversaire, notes), statistiques (victoires globales, par deck, par Légende jouée, contre chaque Légende, **matrice de matchups**, en premier / en second, par événement ; grisé sous 5 parties), **export CSV**.
- **Compteur de points** plein écran (moitié adverse à l’envers sur téléphone) : +1 / −1, objectif réglable (8 par défaut en 1 contre 1), tirage du premier joueur, Bo1 / Bo3, écran maintenu allumé (plugin Android `ScreenPlugin`, Wake Lock ailleurs), « Enregistrer le match ».
- **Éditeur de deck** (PC et téléphone) : « Main de départ » (main de 4, mulligan de 2 cartes max remises sous le deck, « Piocher », « Nouvelle main ») et **probabilités exactes** (loi hypergéométrique, `src/lib/probability.js`) d’avoir au moins X exemplaires d’une carte ou d’un groupe au tour N, en premier / en second. Règles dans `GAME` (modifiables).
- **Export** : feuille de deck pour tournoi (joueur, Légende, champion, zones, totaux) — « Imprimer / PDF » sur PC, fichier .html sur Android ; **code de partage** `RB1.…` reconnu par « Importer une liste ». (Le format communautaire Piltover Archive n’est pas intégré : ajout de dépendance refusé, voir les décisions en attente.)
- **Prix** : le guide Cardmarket contient `low`, `trend`, `avg1/7/30` (+ foil) ; le prix bas et la moyenne 7 j foil sont maintenant stockés. Réglage **« Prix de référence »** (tendance / moyenne 7 jours / prix bas) ; ⚠ dans le zoom quand la tendance s’écarte de plus de 30 % de la moyenne 7 j.
- **Tests** : `tests/play.test.mjs` (hypergéométrique vérifiée à la main, main de départ, code de partage, statistiques, prix), Signature et liste de bannissement dans `decks.test.mjs`, synchro des matchs dans `syncproto.test.cjs`.

### Reconnaissance des cartes — Lot 3

- **Banc d’essai** `npm run eval:matcher` (`scripts/eval-matcher.mjs`) : photos simulées depuis `public/cards` (rotation ±5°, perspective, recadrage décalé, luminosité ±30 %, balance des blancs, flou, reflet de pochette, JPEG, bruit ; intensité aléatoire de nette à difficile), mesure du top-1 / top-5, des cartes acceptées à tort et des **faux positifs hors catalogue** (leave-one-out), proposition de seuils, rapport `model/eval-report.json`. Photos réelles possibles dans `model/real-photos/<id>/` (ignoré par git).
- **Empreinte partagée** (`src/lib/fingerprint.js`) : même calcul exact que le catalogue (égalisation + moyenne par zone comme `cv2.INTER_AREA`, écart ≤ 0,5/255), utilisée par l’app et le banc d’essai ; les deux chemins (caméra et photos) passent maintenant par le même code.
- **Score centré + décision par marge** (`src/lib/matchIndex.js`) : empreintes centrées sur la moyenne du catalogue (deux cartes sans rapport ≈ 0 au lieu de 0,84), acceptation si score ≥ 0,44 **et** avance ≥ 0,11 sur la meilleure autre illustration ; confiance affichée = probabilité calibrée + niveau « Sûr / Probable / Incertain ». Empreintes en un seul `Float32Array`, insertion triée (5.3).
- **Carte incertaine** : rien n’est ajouté, l’écran « Carte incertaine — laquelle est-ce ? » propose les 5 meilleures cartes (+ Chercher) ; sur photo, les détections incertaines ne sont plus cochées d’office.
- **Rééditions à illustration identique** : `artGroup` dans le catalogue (`scripts/catalog-groups.mjs`, lancé par `catalog:update`) — 53 groupes / 110 cartes (runes OGN/RAD/VEN, Sprite, versions ★…) ; plus de pile ou face : choix de l’extension (OGN · RAD · VEN) sous la carte scannée, mémorisé pour la session.
- **Chiffres** (catalogue complet, 2 816 photos simulées, graine de validation distincte de la calibration) :

  | | top-1 | top-5 | accepté juste | accepté **à tort** | rejeté (choix proposé) | faux positifs hors catalogue |
  |---|---|---|---|---|---|---|
  | Avant (cosinus brut ≥ 0,80) | 85,7 % | 90,0 % | 85,7 % | **14,3 %** | 0 % | **100 %** |
  | Après | 85,9 % | 90,9 % | 72,6 % | **0,1 %** | 27,3 % | **0,9 %** |

  Testé aussi : comparaison multi-échelle (16+8+4) — pas de gain, non retenue.

### Sécurité — Lot 2

> **Ré-appairage nécessaire** : le protocole de synchro change (v2). Installez le nouveau logiciel PC et le nouvel APK, puis sur le PC « Régénérer la clé » et rescannez le QR code avec le téléphone (l’ancienne clé a circulé en clair).

- **Dépendances** : Electron 38 → **45.2.3**, electron-builder 26.18, Vite 5 → **8**, @vitejs/plugin-react 5, plugin-basic-ssl 2, vite-plugin-pwa 2, sharp 0.35.5, postcss 8.5. `npm audit` complet : 34 vulnérabilités (1 critique, 21 high) → **0 high/critical** (reste 11 moderate/low dans les outils de build). `node:sqlite` vérifié sous le Node d’Electron 45 (24.22).
- **Fenêtre PC** : `sandbox` et `webSecurity` explicites ; liens externes limités à `http(s)` (plus de `file:`, `smb:`, `ms-…`) ; navigation hors de l’app bloquée ; **Content-Security-Policy** (en-tête HTTP sur PC, `<meta>` dans l’APK — `electron/csp.cjs`), `X-Content-Type-Options: nosniff`.
- **Texte des cartes** : le HTML venant de la galerie officielle est assaini par liste blanche (`src/lib/sanitizeHtml.js` : b, i, em, strong, br, p, span, u, ul, ol, li, sans aucun attribut) **avant** l’ajout des pastilles de l’app.
- **Synchro chiffrée (protocole v2)** : la clé du QR code ne circule plus. HKDF-SHA256 → clé AES-256-GCM + clé HMAC ; chaque requête est signée (`X-RB-Time`, `X-RB-Nonce`, `X-RB-Sig`, ±5 min, nonces mémorisés 10 min → anti-rejeu) ; corps de `/api/sync`, `/api/status`, `/api/prices` chiffrés et liés à la requête. Le téléphone s’aligne une fois sur l’heure du PC si son horloge est décalée. Le catalogue reçu du PC est vérifié par son empreinte. Ancien mode « Bearer » supprimé (`electron/syncCrypto.cjs`, `src/lib/syncProtocol.js`).
- **Exposition réseau** : `/api/hello` ne renvoie plus le nom ni l’identifiant du PC (`{ app, proto, pcIdHash }`) ; CORS limité à la WebView de l’app (plus de `*`) ; corps limité à 16 Mo ; 20 échecs d’authentification / min / IP → 429 ; réglage PC **« Autoriser la synchronisation sur le réseau »** (désactivé → écoute sur 127.0.0.1 seulement, appliqué à chaud) ; rappel « Régénérer la clé » quand un appareil a été appairé récemment.
- **Découverte du PC** : annonce **mDNS** `_riftbound._tcp` côté PC (`electron/mdns.cjs`, sans dépendance, seule l’empreinte est publiée) et plugin Android `NsdManager` (`DiscoveryPlugin.java`). Le balayage du /24 n’est plus automatique : bouton « Rechercher le PC sur le réseau » (8 requêtes à la fois).
- **Android** : `allowBackup="false"` + `data_extraction_rules` (ni sauvegarde cloud ni transfert d’appareil) ; signature release via `android/keystore.properties` ou variables `RB_KEYSTORE*` (git-ignorés) ; `android:apk` construit un APK **release** (minifié, `shrinkResources`) quand une clé existe, sinon debug avec avertissement (`--debug` pour forcer) ; `versionCode`/`versionName` lus dans `package.json` (1.0.0 → 10000). Testé sur téléphone : APK release minifié démarre, non débogable.
- **Windows** : signature de l’installateur documentée (`CSC_LINK` / `CSC_KEY_PASSWORD`), sinon avertissement SmartScreen (README).
- **Tests** : `tests/sanitize.test.mjs`, `tests/syncproto.test.cjs` (signature valide → 200, fausse → 401, nonce rejoué → 401, horloge > 5 min → 401 puis rattrapage, corps altéré → 400, CORS, 429, hello anonyme) ; `syncmodes` passe par le client réel.

### Corrections — Lot 1 (bugs bloquants)

- **Restauration des sauvegardes sur PC** : `electron/main.cjs` utilisait `fs` sans l'importer ; l'erreur était avalée, donc la liste des sauvegardes était toujours vide et « Restaurer » échouait toujours. La logique est maintenant dans `electron/backups.cjs` (liste triée du plus récent au plus ancien, nom validé par `/^collection-[\w.-]+\.sqlite$/` et chemin confiné au dossier des sauvegardes).
- **Serveur local** : `serveStatic` acceptait les dossiers voisins dont le nom commence comme `dist` (ex. `/..%2Fdist-mobile/…`). Le chemin est maintenant résolu et doit rester sous `dist/` (`root + path.sep`), sinon 403.
- **Tests** : `tests/security.test.cjs` (liste/validation des sauvegardes, requêtes `..%2F` et `..%5C` → 403).

## [2.1.0] - 2026-06-12

### Riftmana Export + Pluggable Export Formats

Added a second CSV export format for the [Riftmana](https://riftmana.com/) deckbuilder, and refactored the exporter into a small per-format registry so new formats are easy to add.

#### New Features

- **Riftmana CSV export**
  - Columns: `Card ID, Normal, Foil` (e.g. `OGN-001,4,0`)
  - Card ID is `${set}-${collectorNumber}`, preserving letter suffixes (`OGN-003a`) and `*` star variants (`OGN-299*`) verbatim — unlike the CardNexus format which strips the asterisk
  - Cards are grouped by Card ID; standard and foil copies of the same card collapse into a single row with separate Normal/Foil counts
  - Filename suffixed with `-riftmana`

- **Export format menu**
  - The Collection tab "CSV" button is now a dropdown offering both **CardNexus / PowerTools** and **Riftmana**
  - Rendered from the format registry, so new formats appear automatically

#### Refactor — pluggable export formats

`src/lib/csvExporter.js` was split into `src/lib/exporters/`, one file per format plus a registry. Adding a format is just dropping in a new file and registering it on one line:

```text
src/lib/exporters/
├── index.js       # registry: EXPORT_FORMATS, downloadCSV, validateForExport, getFormat
├── csvUtils.js    # shared escapeCSV/titleCase + ExportFormat/ScannedCard typedefs
├── cardnexus.js   # CardNexus / PowerTools descriptor (incl. Runes/Type/Rarity columns)
└── riftmana.js    # Riftmana descriptor
```

Each format default-exports a descriptor (`id`, `label`, `description`, `filenameSuffix`, `generate`). `downloadCSV(cards, formatId)` resolves the format from the registry and falls back to the default for unknown ids.

#### Files Modified

| File | What changed |
|------|-------------|
| `src/lib/exporters/*` | New: per-format modules + registry (replaces `src/lib/csvExporter.js`) |
| `src/components/collection/CollectionTab.jsx` | Export button replaced with a format-picker dropdown rendered from `EXPORT_FORMATS` |
| `src/App.jsx` | `handleExport` accepts the chosen format; toast label comes from the registry |
| `src/components/scan/ScanTab.jsx` | Updated import path to `lib/exporters/` |

## [2.0.0] - 2026-06-02

### YOLO11s-pose — Corner Keypoint Detection

Switched the detection model from YOLO11s-OBB (oriented bounding boxes) to YOLO11s-pose, which regresses the 4 card corners as keypoints (TL, TR, BR, BL). This gives sub-pixel corner localization and enables a proper perspective-correct crop with no OBB angle approximation.

#### Model Changes

- **New model**: `yolo11s-pose-riftbound.onnx` / `yolo11s-pose-riftbound-q8.onnx` replace the OBB variants
- **Output format**: 13-channel tensor `[cx, cy, w, h, conf, kp0x, kp0y, …, kp3x, kp3y]` instead of 6-channel OBB
- **Keypoints** are mapped from letterbox space back to source image coords alongside the bounding box
- **Training**: YOLO11s-pose on an A100 at `imgsz=768`, `kpt_shape=[4,2]`, horizontal flips disabled (corner convention is fixed), `pose=25.0` loss weight for tight corner localization
- **Dataset**: labels converted from OBB rotation angle to 4-corner keypoint format; `--resume` flag added to `train.py` so interrupted runs can pick up from `last.pt` on the volume

#### Detection & Crop Pipeline

- **`_cropPerspective`** replaces `_cropRotated` — performs a perspective-correct warp using 48 horizontal affine strips, no per-pixel JS loop
- **`_solveAffine`** — closed-form 3-point affine solver (Cramer's rule) used per strip
- **`ScanTab`** — detection loop now calls `warpQuadToPortrait(originalImage, scaledKeypoints)` when keypoints are present; falls back to `cropRotated` for the simulation mode

#### Other

- **SettingsTab**: version bumped to `v2.0.0`; mascot now fades out when scrolling back up (fade-in / fade-out CSS transitions)
- **README**: architecture section and cloud-training docs updated; `--resume` usage documented

#### Files Modified

| File | What changed |
|------|-------------|
| `src/lib/yoloDetector.js` | Pose output parsing (13 ch), `_cropPerspective`, `_solveAffine`, removed `_cropRotated` |
| `src/components/scan/ScanTab.jsx` | `warpQuadToPortrait` crop from keypoints, `corners` in detection result instead of `angle` |
| `src/components/settings/SettingsTab.jsx` | Version 2.0.0, mascot fade-out animation |
| `model/train.py` | Pose task, `--resume` flag |
| `model/data_creator.py` | Pose label format, no horizontal flips |
| `README.md` | Pose model docs, `--resume` command |

---

## [1.4.0] - 2026-05-26

### Dataset Overhaul, Sleeve Simulation & Improved Card Matching

Major improvements to synthetic data generation (close-ups, sleeves, larger grids), per-card artwork crop regions in the matcher, interactive corner correction, and richer CSV export.

#### New Features

- **Sleeve simulation** (`SLEEVE_PROB = 0.30`)
  - New `apply_sleeve_overlay()` augmentation: colored border, diagonal glare streak, and 0–3 specular highlights blended over the card before compositing
  - Applied in standard scenes, grid layouts, close-up scenes, and mosaic quadrants
  - Trains the detector to keep finding cards through plastic sleeves with reflections

- **Close-up scene mode** (`CLOSEUP_PROB = 0.15`)
  - New `generate_closeup_image()` — single card at 0.85×–1.30× of the frame height
  - When scale > 1.0 the card is intentionally clipped by the image edges, teaching the model to detect partially-visible cards
  - Addresses the previous failure mode where very large or edge-clipped cards were missed

- **Larger grid layouts**
  - Grid choices expanded from `{2×2, 2×3, 3×3}` to up to `5×6` (30 cards)
  - Smaller margins and gaps for dense grids (≥4 rows/cols)
  - Addresses the failure mode where very small cards in large grids were missed

- **Interactive corner correction** (DetectionCanvas)
  - Selected detections now show 4 draggable handles at the card corners
  - Dragging any handle deforms the quad freely — no rectangle constraint
  - On pointer-up: `warpQuadToPortrait` re-runs on the original full-res image and `identifyCard` is called with the corrected crop
  - New `perspectiveCrop.js`: `obbToCorners`, `solvePerspectiveMatrix`, `warpQuadToPortrait` (bilinear-interpolated perspective warp)

- **Per-card artwork crop in matcher**
  - `card-hashes.json` now carries `artBottom` per card (0.55 standard / 0.85 legend / 0.95 full-art)
  - Matcher pre-computes one query feature per distinct `artBottom` value and picks the matching one per candidate — fairer comparison between card types
  - Horizontal flip tested automatically for every crop (handles mirror-image photos); no additional identify calls needed

- **Richer CSV export**
  - Added `Runes`, `Type`, and `Rarity` columns to exported CSV
  - `Runes` is derived from the card's `domains` array (e.g. `Shadow/Noxus`)

#### Changes

- **Dataset image size**: `OUTPUT_SIZE` 640 → 768 (matches training `imgsz` and detector input size)
- **Card scale range**: `CARD_SCALE_MIN/MAX` widened to 0.10–0.95 (cards can now fill almost the entire frame)
- **Corner clipping threshold**: `inside < 3` → `inside < 2` (allows 2 corners off-frame for close-ups and large-grid edge cards)
- **Augmentation tuning**: `MOTION_BLUR_PROB` 0.15 → 0.05, `JPEG_ARTIFACT_PROB` 0.25 → 0.10 (edge-degrading augmentations reduced to preserve keypoint signal)
- **Pooled canvas in matcher**: `_flipCanvas`, `_eqCanvas`, `_tmpCanvas` reused across calls to avoid leaking canvas elements on multi-card uploads

#### Files Modified

| File | What changed |
|------|-------------|
| `model/data_creator.py` | `apply_sleeve_overlay`, `generate_closeup_image`, larger grids, widened scale, 768px, clipping threshold, augmentation tuning |
| `src/lib/perspectiveCrop.js` | **New** — `obbToCorners`, `solvePerspectiveMatrix`, `warpQuadToPortrait` |
| `src/components/identify/DetectionCanvas.jsx` | Draggable corner handles, pointer events, `onCornersChange` callback |
| `src/components/scan/ScanTab.jsx` | `onCornersChange` handler, re-identification on corner edit, `warpQuadToPortrait` integration |
| `src/lib/cardMatcher.js` | Per-card `artBottom`, query pre-computed per crop region, pooled flip canvas |
| `src/lib/csvExporter.js` | Added `Runes`, `Type`, `Rarity` columns |

---

## [1.3.0] - 2025-02-13

### Promo Cards Support & Manual Card Selection

Added promo card support with OGNX set export and manual card search for misidentified cards.

#### New Features

- **Promo toggle**
  - Added promo toggle button to both CardDetailPanel (scan results) and ScannerCardRow (collection)
  - When enabled, cards export with set "OGNX" instead of "OGN" in CSV

- **Manual card search & replace**
  - Added search functionality in CardDetailPanel for manually selecting cards
  - Click "Search" button (or "Wrong card? Search manually") to open search panel
  - Type-ahead search filters all 664 cards by name (minimum 2 characters)
  - Shows up to 8 results with domain color indicator, card name, and set
  - Selected cards show "Manually selected" banner with "Search again" and "Reset" options
  - Manually selected cards override scanner matches and persist through add-to-collection

- **Condition abbreviations legend**
  - Added legend at bottom of Collection tab: "NM = Near Mint · LP = Lightly Played · MP = Moderately Played · HP = Heavily Played · D = Damaged"
  - Condition dropdowns show abbreviations for space efficiency

#### Changes

- **Language options reduced** — Only English and Chinese remain (removed all other languages for being innecessary)
- **Improved text contrast** — Changed label colors from `text-rift-500` to `text-rift-400` throughout CardDetailPanel for better readability
- **Number input improvements** — Changed from `type="number"` to `type="text"` with `inputMode="numeric"` to hide browser arrows, added dynamic width in Collection rows

#### Files Modified

| File | What changed |
|------|-------------|
| `src/components/identify/CardDetailPanel.jsx` | Added search state/panel, promo toggle, manual card override, improved text contrast |
| `src/components/scanner/ScannerCardRow.jsx` | Added promo toggle, removed variant selector, condition dropdowns show abbreviations |
| `src/components/collection/CollectionTab.jsx` | Added condition abbreviations legend |
| `src/lib/csvExporter.js` | Changed promo export logic: set = "OGNX" when promo = true |
| `src/data/sampleCards.js` | Reduced LANGUAGES to English and Chinese only |

## [1.2.0] - 2025-02-09

### Card Identification Simplification & Quality Improvements

Removed the DCT re-ranking stage (which was hurting accuracy) and improved crop quality for multi-card images.

#### Changes

- **Removed DCT re-ranking** — The two-pass pipeline (color grid + DCT) was causing wrong cards to rank first because DCT similarity was unreliable on real photos. Reverted to pure color grid cosine similarity, which is more robust.

- **Full-resolution cropping** — When uploading a multi-card image, the app now crops each detected card from the **original full-resolution image** instead of the resized 2048px version. YOLO detection still runs on the resized image (640×640 internally), but coordinates are scaled back to original space for cropping. This gives each card more pixel detail for matching.

- **Optimized `cropRotated`** — The intermediate canvas now uses the card diagonal instead of the full image diagonal, reducing memory usage from ~2900×2900 to ~860×860 per card crop.

- **Removed dead code** — Deleted `phash.js` (DCT features), `cardDatabase.js` (unused IndexedDB interface), and `ensurePortrait` (redundant with `cropRotated`).

- **PNG for resize** — `resizeImage` now uses `toDataURL('image/png')` instead of JPEG at 92% quality, eliminating compression artifacts that affected color grid matching.

#### Files Modified

| File | What changed |
|------|-------------|
| `src/components/scan/ScanTab.jsx` | Removed DCT re-ranking from `identifyCard()`, added full-res cropping via `originalImageRef`, optimized `cropRotated` to use card diagonal, removed `ensurePortrait`, PNG resize |
| `src/lib/cardMatcher.js` | Removed DCT imports and re-ranking logic, pure color grid matching |
| `src/lib/phash.js` | **Deleted** — DCT feature extraction no longer used |
| `src/lib/cardDatabase.js` | **Deleted** — Dead code, never imported by any active module |
| `README.md` | Updated all pipeline docs to reflect single-pass color grid |

## [1.1.0] - 2025-02-08

### Card Identification Pipeline Overhaul

Replaced the single-pass 8×8 color grid matcher with a 16×16 color grid with histogram equalization, significantly improving card identification accuracy.

#### New Features

- **Artwork crop**
  - All feature extraction now operates only on the illustration region (5%-55% height, 5%-95% width)
  - Excludes shared card frame, name bar, text box, and stats (~60% of the card area)
  - Dramatically improves discrimination between cards that share similar frames

- **Histogram equalization**
  - Per-channel (R, G, B) brightness normalization before feature extraction
  - Dark photos now produce features comparable to well-lit reference images
  - Applied at full resolution before downscaling to preserve quality

#### Changes

- Color grid increased from 8×8 (192 features) to 16×16 (768 features)
- Added `--only-hashes` flag to `cards_scraper.py` (replaces `--skip-download`) — regenerates hashes without re-downloading images
- `cardMatcher.js` refactored with artwork crop and histogram equalization
- `ScanTab.jsx` upload mode updated to match (with rotation support)

#### Files Modified

| File | What changed |
|------|-------------|
| `model/cards_scraper.py` | Grid 16×16, `_crop_artwork()`, `_equalize_histogram()`, `--only-hashes` flag |
| `src/lib/cardMatcher.js` | Artwork crop, histogram equalization, full-res equalization before grid |
| `src/components/scan/ScanTab.jsx` | `cropArtwork()`, artwork crop in `identifyCard()` |
| `README.md` | Updated architecture diagrams, pipeline docs, project structure |
