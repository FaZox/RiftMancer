// Lot 1.2 (AMELIORATIONS-APPLI.md): one test per line of the table (a to g),
// plus the promo prices. Values computable by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers.mjs'; // build-time globals of the app

const { priceChange, priceInfo, unitPrice, cardHistory, stacksValue, pct } = await import('../src/lib/prices.js');
const { valueData } = await import('../src/lib/valueData.js');
const { updateHistory, buildPromoPrices } = await import('../src/lib/priceBuilder.js');
const { DEFAULT_BATCH, resetBatchDefaults } = await import('../src/lib/batchDefaults.js');
const pc = createRequire(import.meta.url)('../electron/prices.cjs');

const DAY = 86400000;
const NOW = Date.parse('2026-11-17T12:00:00Z');
const ago = (n) => new Date(NOW - n * DAY).toISOString().slice(0, 10);
const card = (id, set = 'OGN') => ({ id, set, setName: set });

test('a · no « 7-day change » until the own history covers the period', () => {
  // trend 12, Cardmarket 7-day average 10: that is NOT a change over time
  const short = { cards: { a: [12, null, 1, 10, 8] }, hist: { days: [ago(3), ago(0)], cards: { a: [11, 12] } } };
  assert.equal(priceChange(short, 'a', 7, 'trend', false, NOW), null);
  const none = { cards: { a: [12, null, 1, 10, 8] } };
  assert.equal(priceChange(none, 'a', 7, 'trend', false, NOW), null);
  // 6 days back is enough for 7 days (one day of tolerance): 6 € → 12 € = +100 %
  const ok = { cards: { a: [12, null, 1, 10, 8] }, hist: { days: [ago(6), ago(3), ago(0)], cards: { a: [6, 9, 12] } } };
  assert.equal(priceChange(ok, 'a', 7, 'trend', false, NOW), 100);
  assert.equal(priceChange(ok, 'a', 30, 'trend', false, NOW), null);
});

test('b · foil copies: foil history and foil change', () => {
  const prices = {
    cards: { a: [2, 10, 1] },
    hist: { days: [ago(7), ago(0)], cards: { a: [1, 2] }, foil: { a: [8, 10] } },
  };
  assert.equal(priceChange(prices, 'a', 7, 'trend', false, NOW), 100); // 1 → 2
  assert.equal(priceChange(prices, 'a', 7, 'trend', true, NOW), 25); // 8 → 10
  assert.deepEqual(cardHistory(prices, 'a', 'trend', true).map(p => p.v), [8, 10]);
  // No foil price: no foil change (the card sheet says the foil is estimated)
  const noFoil = { cards: { b: [2, null, 1] }, hist: { days: [ago(7), ago(0)], cards: { b: [1, 2] } } };
  assert.equal(priceChange(noFoil, 'b', 7, 'trend', true, NOW), null);
  // The price table builders now keep a foil history, on the phone and on the PC
  for (const update of [updateHistory, pc.updateHistory]) {
    const h = update(null, '2026-11-17', { a: [2, 10, 1, 2.5, 3, 1.5, 9, 11] });
    assert.deepEqual([h.cards.a, h.foil.a, h.avg7Foil.a, h.lowFoil.a], [[2], [10], [11], [9]]);
  }
});

test('c · a price taken from the other finish is flagged as estimated', () => {
  const prices = { cards: { onlyNormal: [4, null, 1], onlyFoil: [null, 6, 2], both: [4, 6, 3] } };
  assert.deepEqual(priceInfo(prices, 'onlyNormal', true, 'trend'), { value: 4, estimated: 'from-normal' });
  assert.deepEqual(priceInfo(prices, 'onlyFoil', false, 'trend'), { value: 6, estimated: 'from-foil' });
  assert.deepEqual(priceInfo(prices, 'both', true, 'trend'), { value: 6, estimated: null });
  assert.deepEqual(priceInfo(prices, 'none', true, 'trend'), { value: null, estimated: null });
  // other reference missing: the trend of the same finish, not estimated
  assert.deepEqual(priceInfo(prices, 'both', true, 'avg7'), { value: 6, estimated: null });
  const v = stacksValue(prices, [{ cardData: card('onlyNormal'), quantity: 2, foil: true }, { cardData: card('both'), quantity: 1, foil: false }], 'trend');
  assert.deepEqual(v, { value: 12, priced: 3, unpriced: 0, estimated: 2 });
});

test('d · purchase price: copies without a Cardmarket price are left out, and counted', () => {
  const prices = { cards: { a: [5, null, 1] } };
  const stacks = [
    { cardData: card('a'), quantity: 2, foil: false, paid: 3 }, // paid 6, worth 10
    { cardData: card('x'), quantity: 4, foil: false, paid: 2 }, // no price: not a loss of 8 €
  ];
  const d = valueData(prices, stacks, 'trend');
  assert.equal(d.paid, 6);
  assert.equal(d.paidValue, 10);
  assert.equal(d.paidCopies, 2);
  assert.equal(d.paidUnpriced, 4);
});

test('e · « all cards » table: one line per finish, with its own unit price', () => {
  const prices = { cards: { a: [1, 5, 1] } };
  const stacks = [
    { cardData: card('a'), quantity: 3, foil: false },
    { cardData: card('a'), quantity: 1, foil: true },
    { cardData: card('a'), quantity: 2, foil: false }, // other language: same line
  ];
  const rows = valueData(prices, stacks, 'trend').all;
  assert.deepEqual(rows.map(r => [r.foil, r.n, r.unit, r.v]), [[false, 5, 1, 5], [true, 1, 5, 5]]);
});

test('f · one percentage format', () => {
  assert.equal(pct(12.4), '+12 %');
  assert.equal(pct(-3.44), '−3,4 %');
  assert.equal(pct(5), '+5 %');
  assert.equal(pct(0.04), '0 %');
  assert.equal(pct(null), '—');
});

test('g · one source for the default values (French)', () => {
  assert.deepEqual({ ...DEFAULT_BATCH }, { condition: 'Near Mint', language: 'French', foil: false });
  assert.deepEqual(resetBatchDefaults({ language: 'English', foil: true, target: 'box:1' }), { ...DEFAULT_BATCH, target: 'box:1' });
  assert.deepEqual(resetBatchDefaults({ language: 'English' }), { ...DEFAULT_BATCH });
});

test('promo copies: own price of the promo, estimated when several or none', () => {
  // Products: our card in the set's expansion (10), its promos in other expansions (20, 30)
  const products = [
    { idProduct: 1, idExpansion: 10, idMetacard: 100 }, // card a (mapped)
    { idProduct: 2, idExpansion: 20, idMetacard: 100 }, // promo of a
    { idProduct: 3, idExpansion: 10, idMetacard: 200 }, // card b (mapped)
    { idProduct: 4, idExpansion: 20, idMetacard: 200 }, // promo 1 of b
    { idProduct: 5, idExpansion: 30, idMetacard: 200 }, // promo 2 of b
    { idProduct: 6, idExpansion: 30, idMetacard: 200 }, // promo 3 of b
    { idProduct: 7, idExpansion: 10, idMetacard: 300 }, // card c, no promo
  ];
  const guide = new Map([
    [1, { trend: 1 }], [2, { trend: 7, 'trend-foil': 9 }], [3, { trend: 2 }],
    [4, { trend: 4 }], [5, { trend: 6 }], [6, { trend: 20 }], [7, { trend: 3 }],
  ]);
  const mapping = { a: 1, b: 3, c: 7 };
  for (const build of [buildPromoPrices, pc.buildPromoPrices]) {
    assert.deepEqual(build(mapping, products, guide), { a: [7, 9, 1], b: [6, null, 3] }); // b: median of 4, 6, 20
  }
  const prices = { cards: { a: [1, null, 1], b: [2, null, 3], c: [3, null, 7] }, promo: { a: [7, 9, 1], b: [6, null, 3] } };
  assert.deepEqual(priceInfo(prices, 'a', false, 'trend', true), { value: 7, estimated: null });
  assert.deepEqual(priceInfo(prices, 'a', true, 'trend', true), { value: 9, estimated: null });
  assert.deepEqual(priceInfo(prices, 'b', false, 'trend', true), { value: 6, estimated: 'promo-several' });
  assert.deepEqual(priceInfo(prices, 'c', false, 'trend', true), { value: 3, estimated: 'promo-none' });
  assert.equal(unitPrice(prices, 'a', false, 'trend', false), 1); // not promo: the normal card
  // The PC's daily value history uses the same rule (promo a 7 + a 1 + c foil 3)
  assert.equal(pc.copiesValue([{ cardId: 'a', promo: true }, { cardId: 'a' }, { cardId: 'c', foil: true }], prices), 11);
});
