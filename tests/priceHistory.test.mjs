// Price history beyond a month: thinned to a day a week, histories merged
// without doubles (older versions' files, the phone and the PC, rifthunt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers.mjs'; // build-time globals of the app

const phone = await import('../src/lib/priceBuilder.js');
const { cardHistory } = await import('../src/lib/prices.js');
const pc = createRequire(import.meta.url)('../electron/prices.cjs');

const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);

test('a history keeps every day of the last month and one a week before, on the phone and on the PC', () => {
  for (const { updateHistory } of [phone, pc]) {
    let h = null;
    for (let n = 0; n < 120; n++) h = updateHistory(h, day(n), { a: [n + 1, n + 2, 1] });
    const old = h.days.filter(d => d < day(120 - 31));
    assert.equal(h.days.length - old.length, 31);
    assert.ok(old.length >= 12 && old.length <= 13, `${old.length} weeks`);
    assert.equal(h.days[0], day(6)); // 2026-01-07, end of the first week (weeks from a Thursday)
    assert.equal(h.cards.a.length, h.days.length);
    assert.equal(h.foil.a.at(-1), 121);
  }
});

test('two histories merge without doubles, the first one winning', () => {
  for (const { mergeHistory } of [phone, pc]) {
    const mine = { days: [day(1), day(3)], cards: { a: [1, 3] }, foil: { a: [null, 30] } };
    const other = { days: [day(0), day(1), day(2)], cards: { a: [0, 99, 2], gone: [5, 5, 5] }, foil: { a: [10, 11, 12] } };
    const h = mergeHistory(mine, other);
    assert.deepEqual(h.days, [day(0), day(1), day(2), day(3)]);
    assert.deepEqual(h.cards.a, [0, 1, 2, 3]); // own value on day 1, not 99
    assert.deepEqual(h.foil.a, [10, 11, 12, 30]); // own null filled
    // only some cards taken from the other one
    assert.equal(mergeHistory(mine, other, new Set(['a'])).cards.gone, undefined);
    assert.deepEqual(mergeHistory(null, mine), phone.thinHistory(mine));
  }
});

test('the card curve can be limited to its last days', () => {
  const prices = { hist: { days: [day(0), day(20), day(29)], cards: { a: [1, 2, 3] } } };
  const now = Date.parse(`${day(29)}T12:00:00Z`);
  assert.deepEqual(cardHistory(prices, 'a', 'trend', false, 10, now).map(p => p.v), [2, 3]); // 10 days: day 20 to 29
  assert.deepEqual(cardHistory(prices, 'a', 'trend', false, 9, now).map(p => p.v), [3]);
  assert.deepEqual(cardHistory(prices, 'a', 'trend', false, null, now).map(p => p.v), [1, 2, 3]);
});

test('rifthunt: ids, missing days, history kept only when it agrees with our prices', () => {
  assert.equal(pc.rifthuntId('ogn-303-star-298'), 'ogn-303*-298');
  assert.equal(pc.rifthuntId('ogn-001-298'), 'ogn-001-298');
  assert.equal(pc.rifthuntId('opp-255-298-metal'), null); // our own id: rifthunt's would be another printing
  const own = { days: ['2026-11-11', '2026-11-12'], cards: { c: [0.05, 0.06] }, foil: { c: [null, null] } };
  const data = (n) => ({ dates: ['2026-11-10', '2026-11-11', '2026-11-12'], series: { cardmarket: { normal: n, foil: [0.15, 0.17, 0.17] }, tcgplayer: { normal: [9, 9, 9] } } });
  const h = pc.fromRifthunt('c', data([0.04, 0.05, 0.06]), own);
  assert.deepEqual(h.cards.c, [0.04, 0.05, 0.06]);
  assert.deepEqual(h.foil.c, [0.15, 0.17, 0.17]); // Cardmarket's, never TCGplayer's
  assert.equal(pc.fromRifthunt('c', data([0.04, 0.05, 0.6]), own), null); // another product
  assert.equal(pc.fromRifthunt('d', data([0.04, 0.05, 0.06]), own), null); // nothing to check it against
  assert.equal(pc.fromRifthunt('c', null, own), null);
  // missing days: only the last month, from rifthunt's first day
  assert.deepEqual(pc.missingDays({ days: ['2026-11-10', '2026-11-12'] }, '2026-11-12'), ['2026-11-11']);
  assert.equal(pc.missingDays({ days: [] }, '2026-12-31').length, 31);
});
