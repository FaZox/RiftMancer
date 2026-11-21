/**
 * public/catalog-base.json: the header of the card catalog (grid, AI model,
 * recognition thresholds, detector) WITHOUT any card. It holds nothing from
 * Riot Games, so it is in the public repository: an app built without the
 * card content starts with it and gets the cards on first launch (gallery
 * download or « Import a folder », electron/content.cjs).
 *
 *   npm run catalog:base      (after a change of model or thresholds)
 *
 * tests/catalogBase.test.mjs checks it matches public/card-hashes.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

/** The header of a catalog: everything but the cards and their date. */
export function catalogHeader(catalog) {
  const header = { ...catalog };
  delete header.content;
  return { ...header, generatedAt: null, cards: [] };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const catalog = JSON.parse(readFileSync(join(root, 'public', 'card-hashes.json'), 'utf8'));
  writeFileSync(join(root, 'public', 'catalog-base.json'), JSON.stringify(catalogHeader(catalog), null, 2) + '\n');
  console.log('✓ public/catalog-base.json (en-tête du catalogue, sans carte)');
}
