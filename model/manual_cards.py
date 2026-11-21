"""
Manual additions to the card catalog (model/manual-cards/manual-cards.json):
real cards that the official Riftbound gallery does not publish (yet).

    python model/manual_cards.py        (run by npm run catalog:update and refresh_prod.sh,
                                          after the scraper and enrich-catalog)

For every manual card:
  - if the official gallery now has the same printed code → the manual card
    is REMOVED from manual-cards.json (message in the log): the official card
    replaces it at once;
  - otherwise its image goes to public/cards/<id>.webp, its colour
    fingerprint is computed exactly like the scraper's (same crop, same
    grid), and it is added to public/card-hashes.json with `manual: true`.
    The price table skips manual cards (no price).
Idempotent: manual cards already in the catalog are replaced.
Then: thumbnails, AI signatures, art groups (the next steps of catalog:update).
"""
import json
import os
import shutil
import sys

import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards_scraper as cs  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
# Environment overrides: tests only (tests/manualCards.test.mjs)
MANUAL_DIR = os.environ.get("RB_MANUAL_DIR") or os.path.join(BASE, "manual-cards")
MANUAL_FILE = os.path.join(MANUAL_DIR, "manual-cards.json")
CATALOG = os.environ.get("RB_CATALOG") or os.path.join(ROOT, "public", "card-hashes.json")
CARDS_DIR = os.environ.get("RB_CARDS_DIR") or os.path.join(ROOT, "public", "cards")

# Fields copied into the catalog (the others are notes for the editor).
FIELDS = ("id", "name", "nameFr", "number", "code", "set", "setName", "domains", "rarity",
          "type", "superTypes", "energy", "might", "tags", "illustrator", "text", "orientation")


def main():
    with open(MANUAL_FILE, encoding="utf-8") as f:
        manual = json.load(f)
    with open(CATALOG, encoding="utf-8") as f:
        catalog = json.load(f)

    cards = [c for c in catalog["cards"] if not c.get("manual")]
    official = {str(c.get("code", "")).upper().split("/")[0] for c in cards}
    official_ids = {c["id"] for c in cards}

    kept, added = [], 0
    for m in manual["cards"]:
        code = m["code"].upper()
        if code in official or m["id"] in official_ids:
            print(f"[ajouts manuels] {code} est maintenant publiée par la galerie officielle : ajout manuel retiré de manual-cards.json")
            own = m.get("image", {}).get("file")
            if own and os.path.exists(os.path.join(MANUAL_DIR, own)):
                os.remove(os.path.join(MANUAL_DIR, own))
            continue
        kept.append(m)

        img = m.get("image", {})
        src = os.path.join(CARDS_DIR, f"{img['fromCard']}.webp") if img.get("fromCard") else os.path.join(MANUAL_DIR, img["file"])
        if not os.path.exists(src):
            raise SystemExit(f"[ajouts manuels] image introuvable pour {code} : {src}")
        dst = os.path.join(CARDS_DIR, f"{m['id']}.webp")
        if os.path.abspath(src) != os.path.abspath(dst):
            shutil.copyfile(src, dst)
        image = cv2.imread(dst)
        if image is None:
            raise SystemExit(f"[ajouts manuels] image illisible : {dst}")
        top, bottom = cs._resolve_art_region(m["type"], m["id"])
        card = {k: m[k] for k in FIELDS if m.get(k) not in (None, "", [])}
        card["domain"] = (m.get("domains") or [None])[0]
        card["artBottom"] = round(bottom, 3)
        card["f"] = cs._compute_color_grid(cs._crop_artwork(image, top=top, bottom=bottom))
        card["manual"] = True
        cards.append(card)
        added += 1
        todo = m.get("aVerifier")
        print(f"[ajouts manuels] {code} {m['name']} ({m['nameFr']}) ajoutée" + (f" — à vérifier : {', '.join(todo)}" if todo else ""))

    if len(kept) != len(manual["cards"]):
        manual["cards"] = kept
        with open(MANUAL_FILE, "w", encoding="utf-8") as f:
            json.dump(manual, f, ensure_ascii=False, indent=2)
            f.write("\n")

    cards.sort(key=lambda c: (c.get("set", ""), c.get("number") or 0))
    catalog["cards"] = cards
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[ajouts manuels] {added} carte(s) ajoutée(s) au catalogue ({len(cards)} cartes)")


if __name__ == "__main__":
    main()
