# Study · language read on the card (lot 8.3, M11c)

*Version française : [ETUDE-LANGUE.md](ETUDE-LANGUE.md).*

**Question.** Can the scanner tell whether a card is French or English, to fill in the language by itself (« Auto ») without ever overwriting a manual choice?

**Verdict (20/11/2026): not shipped.** Reading « FR » works well on a sharp photo, but the reader’s tuning decides too much of the result (from 0 to 5 errors for ~100 decisions depending on the tuning), and a third of the app’s photos allow no decision at all. Nothing was wired into the app.

## What is printed

Bottom line, on the left, after the collector number:

| Card | Mention |
|---|---|
| French, every set | `OGN • 030/298 • FR` |
| English, recent sets (RAD, VEN) | `RAD • 098/167 • EN` |
| English, older sets (OGN, SFD, UNL) | nothing: `UNL • 036/219` |
| runes, battlefields | no mention at this place |

## Method

1. Corners of each card on the bench’s 173 real single-card photos (`model/real-photos-raw/`), app detector at 416 px: `node scripts/eval-detector.mjs --scenes 0 --no-identify --dump corners.json`.
2. Card straightened as in the app (`perspectiveCrop.warpQuadRGBA`), bottom strip (`OGN • 030/298 • FR`) brought to 480 × 64 px in grey.
3. **Truth read by eye** on these strips: 61 FR, 4 EN, 65 with no mention, 23 unreadable (dark or blurry photo), 20 runes / battlefields. Stored in `model/real-photos-raw/_langues.json` (local, like the photos).
4. Simple reader, no model: ink lighter than the background, frame lines removed (long horizontal strokes), text line, words split by the gaps; the number is the widest word; a small word right after it = a mention. Rules: on older sets a mention means FR (they never print EN), and a sharp number with nothing after it means English; runes and battlefields left out.
5. `node scripts/study-language.mjs corners.json` redoes the figures.

## Figures

Best tuning (`gap 7, run 36, add 35, num 55`), runes, battlefields and recent sets left out:

| | FR said | right | English said | right | nothing said |
|---|---|---|---|---|---|
| every photo (173) | 53 | 53 / 61 | 51 | 51 / 65 | the rest |
| app photos, 720 p (107) | 29 | 29 / 35 | 22 | 22 / 28 | ~45 % |

But this tuning was chosen on these same photos. Of the **144 neighbouring tunings** tried, 43 make 0 errors, 49 make 1, 27 make 2, and up to 5. The error that matters is a French card said English (or the other way round), set to « Auto » without anyone looking.

- Recent sets (RAD, VEN): telling « FR » from « EN » by the shape of the letters goes wrong (1 EN card out of 4 read FR); too few examples to do better.
- Dark or blurry photos: the mention disappears, even by eye.

## To go further

- More labelled photos (especially English cards of recent sets and app photos at 720 p), then separate tuning and measuring (tune on one half, measure on the other).
- A small learned reader (recognising the two letters) rather than hand-set thresholds.
- Or read the language from the card’s text (French / English words), bigger than the mention.
