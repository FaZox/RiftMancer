# What’s new in RiftMancer

Text for the app’s users, one section per released version
(« ## 2.2.0 — date »), shown in the app when it is in English (the French
version is docs/NOUVEAUTES.md). `npm run release -- <version>` takes
`WHATS-NEW.txt` from it and refuses to build a package until the section of the
version is written, in both files.

## 2.4.3 — price chart

- **Price chart**: in a card's sheet and in Value, the curve over 1 month, 3 months, 6 months or all, with the price of a day under your finger.
- **Longer history**: one price a day for the last month, then one a week; missed days are filled in, and the PC and phone histories are merged at sync.

## 2.4.2 — direct Cardmarket links

- **Cardmarket links**: each card opens its own page (…/Singles/Unleashed/Mutated-Mouser), and its promo the promo page (…/Unleashed-Promos/Mutated-Mouser).
- **Prices**: card and promo prices are right again; they update as soon as the app starts.

## 2.4.1 — price paid, phone tab bar

- **Price paid and purchase date**: in a card's sheet, Price tab → « My purchase », say how much you paid and when; it shows on the right of the rarity.
- **Phone tab bar**: Collection · Cards · Value · Scanner · Decks · Boxes · More.
- **Cards tab**: bigger cards on the PC, and the price under each card on the phone.

## 2.4.0 — the Cards tab

- **New « Cards » tab**: the whole Riftbound catalog, owned or not, with ×N on the cards you have. On the phone it sits between Collection and Scanner; **Value moves to « More »**. In the Collection, the « Cards » view is now « My cards ».
- **One search bar**: a name, a number, or keys such as `t:unit d:mind e<=3 own:0` (the « ? » gives the whole syntax). The filters (domains, sets, type, energy, **might**, rarity…) write their key in the bar.
- **Missing cards stay in colour**: « Dim missing cards » fades them if you wish.
- **Quick actions**: the card sheet in one click or tap, add a copy (with « Undo »), several cards at once to wishes or a deck, « Missing → wishes », CSV export. On the phone, the Scanner icon of the search finds a card without adding it.
- **Memory**: the tab keeps your search, your filters and your place.

## 2.3.0 — prints and promos, rulings, a handier collection

- **Every printing of every card**: Settings → Content → Cards → « Search » now brings the promos (Organized Play, Judge, Launch, Metal…), the K/DA cards and every variant (alternate art, overnumbered, signature, showcase), with their pictures and, as soon as they are installed, the French name of the same card. In a card's sheet, « Prints & variants » lists them all with their price and how many you own.
- **Rulings**: the questions and answers of Riftbound FAQ in each card's sheet (tap a question to read the answer, with links to the rules). Install them from Settings → Content → Rulings; unofficial, in English.
- **The game's symbols**: rarity gem before the card's name, runes, « any rune », Exhaust and Might as printed on the cards, domain icons, and the recycle cost (runes) next to the energy.
- **Collection**: an « Add » button next to the sort (a card by its name or number), the domains in a dropdown, no more coloured line above the cards. Opening a card shows how many you own, with − and + to remove or add one, and « Promo » to mark promos (PROMO badge and « Promo » filter).
- **PC scanner**: the « Grid » mode of the phone (a binder page under the webcam).
- **Content**: the card list and the banned cards come from rifthunt.com first (Riot's pages when it does not answer); Settings → Content → « Cardmarket prices » shows their date and can update them at once.

## 2.2.0 — RiftMancer, in English, cards on first launch

- **New name: RiftMancer.** The app has a new name and a new Android identity: it installs as a new app. Sync your phone with the PC first, then uninstall the old « Riftbound Scanner » app.
- **English and French**: the whole app is in English, or in French when your phone or PC is in French. Change it in Settings → Display → « Language · Langue ». Card names and texts follow the app's language.
- **Cards on first launch**: the version published on GitHub comes without the cards (they belong to Riot Games). On the PC, « Get the cards » offers « Download the cards » from the official gallery (about 170 MB, ten minutes or so) or « Import a folder… » (a folder of cards already downloaded, a USB key). The phone receives them from the PC at the sync.
- **Official gallery**: Riot moved it to playriftbound.com; « Search for new cards » works again.
- **Free software**: RiftMancer is under the GNU AGPL-3.0 licence; its code is at github.com/FaZox/RiftMancer.

## 2.1.1 — grid scanner, binder, credits

- **Grid scanner**: new « Grid » mode in the Scanner tab (button with four squares). Hold the phone above a binder page or cards laid flat: a frame shows on each card, the photo is taken by itself when nothing moves, then you check the page (green: recognised, orange: to choose) and tap « Add · next page ». The same page is never taken twice.
- **Binder**: when « Store in » is a box, each card is stored there with its page and pocket (« p. 4, pocket 7 »). The page number can be corrected with − / +, a page already taken is flagged, and the box screen shows each page pocket by pocket.
- **Brighter camera**: in Camera mode, the card is no longer darkened; only the outside of the frame is.
- **Scanner header**: it now fits the screen of narrow phones.
- **Credits and licence**: Settings → About says the app is based on riftbound-scanner by Nekoraru22 (MIT licence) and shows Riot Games’ official notice; « Licences » also shows the app’s licence. The LICENSE.txt and THIRD_PARTY_LICENSES.txt files come with the version.

## 2.1.0 — first released version

- **Scanner**: cards are recognised by artificial intelligence and by their colours; when the app hesitates, it asks you. Hands-free mode (phone on a stand) and optional discreet sounds; alternate arts and signed cards recognised.
- **Collection and decks**: wishes, boxes, loans; Standard and 2v2 decks with the banned cards, deck versions, notes against each opposing Legend, deck codes to share and text for tournament registration.
- **Matches**: score counter in 1v1, 2v2 or free-for-all, with the point-by-point history and resuming an interrupted game.
- **Cardmarket prices**: collection value, 7- and 30-day changes, foil and promo versions; an estimated price is marked « ≈ ». Alerts when one of your cards goes up or down sharply, and a summary after each price update.
- **Between friends**: swap your lists (duplicates and wishes) as files, see what each can give the other and prepare the trade with the calculator.
- **Sync**: encrypted between the phone and the PC, over your Wi-Fi; a reminder when changes are waiting; records changed on both sides are flagged.
- **Backups**: automatic on the PC (and, if you like, on a USB stick) and on the phone, with restore.
- **Up-to-date content without reinstalling**: new cards, French translations and banned cards are updated from the PC app, then reach the phone at the sync.
- **Lighter app**: the large card pictures reach the phone at the first sync with the PC.
- **If something goes wrong**: a rescue screen keeps your cards safe, and « Create a report » (Settings → Help) prepares a file to send, without any personal data.
