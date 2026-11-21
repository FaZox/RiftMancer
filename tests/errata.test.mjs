// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
// Lot 7.6: errata — a text changed by a content update keeps its former version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { erratumFor, errataLabel } from '../src/lib/errata.js';

const require = createRequire(import.meta.url);
const { createContent, textChanges, applyErrata } = require('../electron/content.cjs');

const base = {
  gridSize: 16, generatedAt: '2026-11-17T19:00:00.000Z',
  cards: [
    { id: 'ogn-001-298', name: 'A', text: '<p>Deal 2.</p>', textFr: 'Inflige 2.', f: 'AAA' },
    { id: 'ogn-002-298', name: 'B', text: '<p>Draw 1.</p>', f: 'BBB' },
  ],
};

test('changed texts are errata; a text that appears, or only changes its spaces, is not', () => {
  const after = { cards: [
    { id: 'ogn-001-298', text: '<p>Deal 3.</p>', textFr: 'Inflige  2. ' },
    { id: 'ogn-002-298', text: '<p>Draw 1.</p>', textFr: 'Pioche 1.' },
    { id: 'ogn-003-298', text: 'new card' },
  ] };
  assert.deepEqual(textChanges(base, after, 'T'), [{ id: 'ogn-001-298', field: 'text', old: '<p>Deal 2.</p>', new: '<p>Deal 3.</p>', at: 'T' }]);
});

test('an erratum is kept only while the card still has the changed text', () => {
  const errata = { 'ogn-001-298': [{ field: 'text', old: 'x', new: '<p>Deal 2.</p>', at: 'T1' }, { field: 'text', old: 'y', new: 'other', at: 'T2' }] };
  const out = applyErrata(base, errata);
  assert.deepEqual(out.cards[0].errata, [{ field: 'text', old: 'x', at: 'T1' }]);
  assert.equal(out.cards[1].errata, undefined);
  assert.equal(base.cards[0].errata, undefined, 'base untouched');
});

test('installing an update records the errata and serves them with the catalog', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-errata-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'card-hashes.json'), JSON.stringify(base));
  const content = createContent({ dir: path.join(root, 'catalogue'), distDir: dist });
  content.rebuild();
  // French texts: a new one for b (not an erratum), a changed one for a
  let s = content.install('traductions', { createdAt: '2026-11-18T10:00:00.000Z', data: { names: {}, texts: { 'ogn-001-298': 'Inflige 3.', 'ogn-002-298': 'Pioche 1.' } } });
  assert.equal(s.errata, 1);
  // English text changed by a correction of the cards layer
  s = content.install('cartes', { createdAt: '2026-11-19T10:00:00.000Z', data: { cards: [], patches: [{ id: 'ogn-002-298', text: '<p>Draw 2.</p>' }] } });
  assert.equal(s.errata, 2);
  const served = JSON.parse(fs.readFileSync(content.resolve('/card-hashes.json'), 'utf8'));
  const byId = new Map(served.cards.map(c => [c.id, c]));
  assert.deepEqual(byId.get('ogn-001-298').errata.map(e => [e.field, e.old]), [['textFr', 'Inflige 2.']]);
  assert.deepEqual(byId.get('ogn-002-298').errata.map(e => [e.field, e.old]), [['text', '<p>Draw 1.</p>']]);
  // « Restaurer la liste précédente » brings the old text back: no erratum shown any more
  content.restorePrevious('cartes');
  const back = JSON.parse(fs.readFileSync(content.resolve('/card-hashes.json'), 'utf8'));
  assert.equal(back.cards.find(c => c.id === 'ogn-002-298').errata, undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the sheet shows the erratum of the text it shows (French or English)', () => {
  const card = { errata: [{ field: 'textFr', old: 'Inflige 2.', at: '2026-11-18T10:00:00.000Z' }] };
  assert.deepEqual(erratumFor(card, { text: 'Inflige 3.', isHtml: false, translated: true }, 'French'), { old: 'Inflige 2.', at: '2026-11-18T10:00:00.000Z', isHtml: false });
  assert.equal(erratumFor(card, { text: '<p>x</p>', isHtml: true, translated: true }, 'English'), null);
  assert.equal(erratumFor({ errata: null }, { text: 'x' }, 'French'), null);
  assert.match(errataLabel('2026-11-18T10:00:00.000Z'), /^Texte modifié le 18 nov\. 2026$/);
});
