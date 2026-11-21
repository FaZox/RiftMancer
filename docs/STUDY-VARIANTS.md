# Study · variants of a card (lot 8.4, M11d)

*Version française : [ETUDE-VARIANTES.md](ETUDE-VARIANTES.md).*

**Question.** What does the recognition already tell apart between a card and its variants (alternate art, signed, foil), and how to show it?

## What the catalog holds

| Variant | Number | Picture | How the scanner handles it |
|---|---|---|---|
| Alternate art (`OGN-066a`) | 126 | another art (mean gap to the regular card: 43 grey levels out of 255) | a separate card, recognised as such |
| Signed (`OGN-299*`) | 45 | the same picture, with the golden signature (mean gap: 2 grey levels) | in the same « same art » group as the regular card: the scanner asks which one |
| Foil | — | no separate picture | cannot be seen on a photo: to state yourself |

## On the bench (real photos, app detector at 416 px)

- Every photo: 97.7 % of single-card photos and 97.5 % of grid cards identified, **0 % wrongly accepted**.
- 17 photos of cards that have a variant: the **6 alternate arts** are recognised and accepted correctly; a regular card was offered as its « a » version, **to confirm** (not accepted); two runes reprinted identically (OGN-042 / UNL-R02) are one and the same drawing, not a variant.
- No signed card on the bench: the measure comes from the catalog (nearly identical pictures). Telling signed from regular by the picture would mean looking for the signature, on photos where it may be faint or in a reflection; it is not attempted.

## Shown in the app

- The scan result says « Alternate art » or « Signed » under the name.
- The « Same art » choice shows « OGN » / « OGN signed » (instead of two « OGN », one of them with ★).
- Settings → Scanner → Foil: « A photo does not show whether a card is foil: say so yourself. »

`tests/variants.test.mjs` checks that every signed card of the catalog is grouped with its regular card and that alternate arts stay separate cards.
