#!/usr/bin/env bash
# Recomputes the recognition fingerprints from the card images already
# downloaded (no new download), then rebuilds the web app.
# Uses model/venv when it exists, otherwise the system Python
# (pip install -r model/requirements.txt).
set -euo pipefail
cd "$(dirname "$0")/model"
if [ -f venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
elif [ -f venv/Scripts/activate ]; then
  # shellcheck disable=SC1091
  source venv/Scripts/activate
fi
PY=$(command -v python3 || command -v python)
"$PY" cards_scraper.py --only-hashes
cd ..
node scripts/enrich-catalog.mjs
# manual additions (model/manual-cards/), removed as soon as the official gallery publishes them
"$PY" model/manual_cards.py
node scripts/build-embeddings.mjs
# after the AI signatures: same-name reprints are also grouped by them
node scripts/catalog-groups.mjs
npm run build
