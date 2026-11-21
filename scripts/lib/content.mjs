/**
 * The card content (Riot Games’ pictures, names and texts, riftboundfr.fr’s
 * French texts) is not part of the public repository: it lives in
 * public/card-hashes.json and public/cards/ on the machines that have it, and
 * comes from a content folder (`npm run content:import`) or from the official
 * gallery (`npm run catalog:update`). What is never published:
 * PUBLIC_EXCLUDED (scripts/public-export.mjs).
 */
import { existsSync, openSync, readSync, closeSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Paths kept out of the public repository (prefixes, relative to the root, « / » separators). */
export const PUBLIC_EXCLUDED = [
  ['public/cards/', 'images des cartes (Riot Games)'],
  ['public/card-hashes.json', 'catalogue : noms et textes des cartes (Riot Games, riftboundfr.fr)'],
  ['public/sym/', 'symboles du jeu : gemmes de rareté, puissance (Riot Games)'],
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
/**
 * Public build (GitHub release): the built app (`dist/`, `dist-mobile/`)
 * without the card content — pictures and catalog. It starts with
 * catalog-base.json and gets the cards on first launch (NoCards.jsx).
 * Returns the number of files removed.
 */
export function stripCardContent(dir) {
  if (!existsSync(join(dir, 'catalog-base.json'))) throw new Error(`${dir}/catalog-base.json absent : l’appli sans cartes ne démarrerait pas (npm run catalog:base).`);
  let removed = 0;
  const cards = join(dir, 'cards');
  if (existsSync(cards)) {
    const count = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(d, e.name)) : 1), 0);
    removed += count(cards);
    rmSync(cards, { recursive: true, force: true });
  }
  if (existsSync(join(dir, 'card-hashes.json'))) { rmSync(join(dir, 'card-hashes.json')); removed++; }
  // the game's symbols (Riot Games, public/sym): out of the public build too; the app keeps its former signs
  const sym = join(dir, 'sym');
  if (existsSync(sym)) { removed += readdirSync(sym).length; rmSync(sym, { recursive: true, force: true }); }
  return removed;
}

/** Card content inside a built app: paths under `prefix` (« assets/public/ » in the APK, « dist/ » in the PC app). */
export function cardContentIn(paths, prefix) {
  return paths.filter(p => p.startsWith(prefix) && (p.startsWith(`${prefix}cards/`) || p.startsWith(`${prefix}sym/`) || p === `${prefix}card-hashes.json`));
}

export function needsCardContent(src) {
  return /@needs-card-content|loadCatalog\(/.test(src);
}
