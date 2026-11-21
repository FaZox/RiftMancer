/* Phone: an older or incompatible catalog received from the PC never replaces the bundled one. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseCatalog } from '../src/lib/catalogChoice.js';

const cards = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));
const fp16 = { modelSha256: 'a'.repeat(64) };
const bundled = { generatedAt: '2026-11-14T10:00:00Z', embeddings: fp16, cards: cards(1415) };

test('newer catalog from the PC, same AI model → used (new sets)', () => {
  assert.deepEqual(chooseCatalog(bundled, { generatedAt: '2026-12-01T10:00:00Z', embeddings: fp16, cards: cards(1500) }), { use: 'downloaded', reason: null });
});

test('older PC app: catalog without AI signatures → bundled one, said so', () => {
  const r = chooseCatalog(bundled, { cards: cards(1408) });
  assert.equal(r.use, 'bundled');
  assert.match(r.reason, /pas de signatures IA/);
});

test('signatures of another model, or an older date, or fewer cards → bundled one', () => {
  assert.equal(chooseCatalog(bundled, { generatedAt: '2026-12-01', embeddings: { modelSha256: 'b'.repeat(64) }, cards: cards(1500) }).use, 'bundled');
  assert.equal(chooseCatalog(bundled, { generatedAt: '2026-11-01T00:00:00Z', embeddings: fp16, cards: cards(1415) }).use, 'bundled');
  assert.equal(chooseCatalog(bundled, { embeddings: fp16, cards: cards(1415) }).use, 'bundled', 'no date: older than a dated one');
  const undated = { embeddings: fp16, cards: cards(1415) };
  assert.equal(chooseCatalog(undated, { embeddings: fp16, cards: cards(1400) }).use, 'bundled');
  assert.equal(chooseCatalog(undated, { embeddings: fp16, cards: cards(1420) }).use, 'downloaded');
});

test('nothing received from the PC → bundled catalog, no message', () => {
  assert.deepEqual(chooseCatalog(bundled, null), { use: 'bundled', reason: null });
});
