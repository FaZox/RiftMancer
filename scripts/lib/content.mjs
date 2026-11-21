/**
 * The card content (Riot Games’ pictures, names and texts, riftboundfr.fr’s
 * French texts) is not part of the public repository: it lives in
 * public/card-hashes.json and public/cards/ on the machines that have it, and
 * comes from a content folder (`npm run content:import`) or from the official
 * gallery (`npm run catalog:update`). What is never published:
 * PUBLIC_EXCLUDED (scripts/public-export.mjs).
 */
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

/** Paths kept out of the public repository (prefixes, relative to the root, « / » separators). */
export const PUBLIC_EXCLUDED = [
  ['public/cards/', 'images des cartes (Riot Games)'],
  ['public/card-hashes.json', 'catalogue : noms et textes des cartes (Riot Games, riftboundfr.fr)'],
  ['model/textures/', 'textures DTD (licence de recherche seulement)'],
  ['model/distractors/', 'images d’arrière-plan de licence inconnue'],
  ['model/manual-cards/', 'image d’une carte (Riot Games)'],
  ['docs/maquettes/', 'maquettes avec des captures de cartes'],
];

/** Why `rel` stays out of the public repository, or null. */
export function excludedReason(rel) {
  const hit = PUBLIC_EXCLUDED.find(([p]) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
  return hit ? hit[1] : null;
}

function lfsPointer(file) {
  try {
    const fd = openSync(file, 'r');
    const head = Buffer.alloc(40);
    readSync(fd, head, 0, 40, 0);
    closeSync(fd);
    return head.toString('utf8').startsWith('version https://git-lfs');
  } catch { return true; }
}

/** The card content is here: the catalog and real pictures (not Git LFS pointers). */
export function hasCardContent(root) {
  const catalog = join(root, 'public', 'card-hashes.json');
  const sample = join(root, 'public', 'cards', 'ogn-001-298.webp');
  return existsSync(catalog) && existsSync(sample) && !lfsPointer(sample);
}

/** A test file that reads the card content: it says so (« @needs-card-content » at the top), or loads the catalog. */
export function needsCardContent(src) {
  return /@needs-card-content|loadCatalog\(/.test(src);
}
