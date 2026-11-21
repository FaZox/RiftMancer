/* public/catalog-base.json: the catalog header shipped without any card (first launch). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { catalogHeader } from '../scripts/catalog-base.mjs';

const root = join(import.meta.dirname, '..');
const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

test('catalog-base.json: no card, the AI model and thresholds are there', () => {
  const base = read('public/catalog-base.json');
  assert.deepEqual(base.cards, []);
  assert.equal(base.generatedAt, null);
  assert.equal(typeof base.gridSize, 'number');
  assert.match(base.embeddings.modelSha256, /^[0-9a-f]{64}$/);
  assert.match(base.embeddings.detectorSha256, /^[0-9a-f]{64}$/);
  assert.ok(Object.keys(base.embeddings.decision).length > 0);
});

test('catalog-base.json matches the header of the card catalog (npm run catalog:base)', { skip: !existsSync(join(root, 'public/card-hashes.json')) }, () => {
  assert.deepEqual(read('public/catalog-base.json'), catalogHeader(read('public/card-hashes.json')));
});

test('catalogHeader keeps the header, drops the cards, their date and the layers', () => {
  const h = catalogHeader({ gridSize: 16, embeddings: { dim: 384 }, generatedAt: '2026-01-01', content: {}, cards: [{ id: 'a' }] });
  assert.deepEqual(h, { gridSize: 16, embeddings: { dim: 384 }, generatedAt: null, cards: [] });
});
