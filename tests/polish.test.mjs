// Lot 6 a, f, h: themed dialogs (or « Annuler »), text of 11 px at least, labels on icon buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { untx } from './helpers.mjs';

const root = new URL('../', import.meta.url);
const walk = (d) => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(`${d}${e.name}/`) : [`${d}${e.name}`]));
const sources = walk('src/').filter(f => /\.(js|jsx)$/.test(f));
const read = (f) => untx(readFileSync(new URL(f, root), 'utf8'));

test('no system confirm() / alert() left (themed dialogs, or « Annuler » for simple deletions)', () => {
  const found = [];
  for (const f of sources) {
    read(f).split('\n').forEach((l, i) => {
      if (/^\s*(\*|\/\/)/.test(l)) return; // comments
      if (/(^|[^\w.])(window\.)?(confirm|alert)\(/.test(l)) found.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(found, []);
});

test('simple deletions offer « Annuler »', async () => {
  const { offerUndo, onUndo } = await import('../src/lib/undo.js');
  let shown = null;
  const off = onUndo((u) => { shown = u; });
  let restored = false;
  offerUndo({ message: 'Match supprimé', run: () => { restored = true; } });
  assert.equal(shown.message, 'Match supprimé');
  shown.run();
  assert.equal(restored, true);
  off();
  assert.match(read('src/components/matches/MatchesView.jsx'), /offerUndo\(\{ message: 'Match supprimé'/);
  assert.match(read('src/components/collection/TradesView.jsx'), /offerUndo\(\{ message: 'Échange retiré de l’historique'/);
});

test('no text under 11 px (developer bench aside)', () => {
  const small = sources.filter(f => f.endsWith('.jsx') && !f.includes('/bench/') && /text-\[(7|8|9|10)(\.5)?px\]/.test(read(f)));
  assert.deepEqual(small, []);
});

test('every icon-only button has an accessible label', () => {
  const missing = [];
  for (const f of sources.filter(x => x.endsWith('.jsx'))) {
    const s = read(f);
    const re = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g;
    let m;
    while ((m = re.exec(s))) {
      if (/aria-label/.test(m[1])) continue;
      const text = m[2].replace(/<[A-Z][\w.]*[^>]*\/>/g, '').replace(/<\/?[a-z][^>]*>/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
      if (text === '' && /<[A-Z]/.test(m[2])) missing.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(missing, []);
});
