/**
 * Test helpers: load the real card catalog into the matcher without a
 * browser (no fetch, no model).
 */
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';

globalThis.__BUILD_TIME__ = 'test';
globalThis.__APP_VERSION__ = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export async function loadCatalog() {
  const { getMatcher } = await import('../src/lib/cardMatcher.js');
  const m = getMatcher();
  if (!m.cards.length) {
    const json = JSON.parse(readFileSync(new URL('../public/card-hashes.json', import.meta.url), 'utf8'));
    m.cards = json.cards;
    m.byId = new Map(json.cards.map(c => [c.id, c]));
  }
  return m;
}

/**
 * Git LFS files not downloaded (light CI, .github/workflows/ci.yml: checkout
 * without LFS): the card images and the models are then small text pointers.
 * A reason to skip the tests that need them, or false.
 */
function lfsPointer(rel) {
  try {
    const fd = openSync(new URL(`../${rel}`, import.meta.url), 'r');
    const head = Buffer.alloc(40);
    readSync(fd, head, 0, 40, 0);
    closeSync(fd);
    return head.toString('utf8').startsWith('version https://git-lfs');
  } catch { return false; }
}
export const NO_LFS = lfsPointer('public/cards/ogn-001-298.webp') || lfsPointer('public/models/yolo11s-pose-riftbound-dyn.onnx')
  ? 'fichiers Git LFS absents (images des cartes, modèles)' : false;

/**
 * Source as written before the translation (src/lib/i18n.js): tests that read
 * the code look for the French texts, now inside tx(). aria-label={tx('X')} →
 * aria-label="X", tx('X') → 'X'.
 */
export function untx(src) {
  return src.replace(/=\{tx\('((?:[^'\\]|\\.)*)'\)\}/g, '="$1"').replace(/\btx\(('(?:[^'\\]|\\.)*')\)/g, '$1');
}
