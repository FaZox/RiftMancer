// Collection statistics (PC « Salle du trésor », set pages, Chronique): pure functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setProgress, nextMilestone, masterpiece, recentAdds, activity, collectionSummary, setArt, localDay } from '../src/lib/collectionStats.js';

const card = (id, set, rarity = 'common', domains = ['fury']) => ({ id, set, setName: set, rarity, domains });
const catalog = [card('a1', 'OGN'), card('a2', 'OGN', 'rare', ['calm']), card('a3', 'OGN', 'showcase'), card('a4', 'OGN'), card('s1', 'SFD')];

test('setProgress: totals, rarity, domain, order', () => {
  const p = setProgress(new Map([['a1', 2], ['a2', 1]]), catalog);
  assert.deepEqual(p.map(s => s.code), ['OGN', 'SFD']);
  assert.equal(p[0].owned, 2); assert.equal(p[0].total, 4); assert.equal(p[0].pct, 0.5);
  assert.deepEqual(p[0].byRarity.common, [1, 2]);
  assert.deepEqual(p[0].byDomain.calm, [1, 1]);
});
test('setProgress: complete set and empty catalog', () => {
  const full = setProgress(new Map(catalog.map(c => [c.id, 1])), catalog);
  assert.ok(full.every(s => s.pct === 1));
  assert.deepEqual(setProgress(new Map(), []), []);
});

test('nextMilestone', () => {
  assert.deepEqual(nextMilestone(0, 100), { pct: 0.25, missing: 25 });
  assert.deepEqual(nextMilestone(49, 100), { pct: 0.5, missing: 1 });
  assert.deepEqual(nextMilestone(50, 100), { pct: 0.75, missing: 25 });
  assert.equal(nextMilestone(100, 100), null);
  assert.equal(nextMilestone(0, 0), null);
});

test('masterpiece: priciest, tie, no price, showcase fallback', () => {
  const st = (c, scanTimestamp = 0) => ({ cardData: c, quantity: 1, scanTimestamp });
  const stacks = [st(catalog[0]), st(catalog[1]), st(catalog[2], 5)];
  assert.equal(masterpiece(stacks, c => ({ a1: 3, a2: 9, a3: 1 }[c.id])).id, 'a2');
  assert.equal(masterpiece(stacks, () => 4).id, 'a1'); // tie: the first
  assert.equal(masterpiece(stacks, () => null).id, 'a3'); // no price: the showcase
  assert.equal(masterpiece([st(catalog[0])], () => null).id, 'a1'); // no showcase: the latest added
  assert.equal(masterpiece([], () => null), null);
});

test('recentAdds: local days (midnight), first, source absent', () => {
  const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
  const copies = [
    { cardId: 'a1', createdAt: at(2026, 11, 20, 10) },
    { cardId: 'a1', createdAt: at(2026, 11, 27, 23, 59), source: 'scan' },
    { cardId: 'a2', createdAt: at(2026, 11, 28, 0, 1), source: 'manual' },
    { cardId: 'a2', createdAt: at(2026, 11, 28, 0, 2), source: 'manual' },
  ];
  const now = at(2026, 11, 28, 12);
  const r = recentAdds(copies, { now, priceOf: () => 1 });
  assert.deepEqual(r.map(d => d.day), ['2026-11-28', '2026-11-27', '2026-11-20']);
  assert.equal(r[0].count, 2); assert.equal(r[0].value, 2);
  assert.equal(r[0].cards[0].quantity, 2); assert.equal(r[0].cards[0].first, true);
  assert.equal(r[1].cards[0].first, false); // an older copy exists
  assert.equal(r[2].cards[0].source, null);
  assert.deepEqual(recentAdds(copies, { now, days: 2 }).map(d => d.day), ['2026-11-28', '2026-11-27']);
  assert.equal(recentAdds(copies.map(c => ({ ...c, deleted: true })), { now }).length, 0);
});

test('activity: 14 days, oldest first', () => {
  const now = new Date(2026, 10, 28, 12).getTime();
  const a = activity([{ cardId: 'x', createdAt: now }, { cardId: 'y', createdAt: now }], { now });
  assert.equal(a.length, 14);
  assert.equal(a.at(-1).day, localDay(now)); assert.equal(a.at(-1).n, 2); assert.equal(a[0].n, 0);
});

test('collectionSummary and setArt', () => {
  const now = new Date(2026, 10, 28, 12).getTime(); // Saturday
  const s = collectionSummary([{ cardData: catalog[0], quantity: 2 }, { cardData: catalog[1], quantity: 1 }], {
    catalogSize: 4, value: 50, now, copies: [{ createdAt: now }, { createdAt: now - 20 * 86400000 }], valueAt: () => 40,
  });
  assert.equal(s.total, 3); assert.equal(s.different, 2); assert.equal(s.pct, 0.5);
  assert.equal(s.addedWeek, 1); assert.equal(s.valueSinceMonday, 10);
  assert.equal(setArt('OGN', catalog).id, 'a3');
  assert.equal(setArt('XXX', catalog), null);
});

test('printsOf: a promo without oracle is linked to the original by name and stats', async () => {
  const { printsOf } = await import('../src/lib/prints.js');
  const base = { id: 'b', set: 'OGN', oracle: 'o1', nameEn: 'Jinx - Rebel', type: 'unit', energy: 3, might: 4 };
  const promo = { id: 'p', set: 'OGN', variant: 'promo', nameEn: 'Jinx - Rebel', type: 'unit', energy: 3, might: 4 };
  const other = { id: 'x', set: 'OGN', variant: 'promo', nameEn: 'Jinx - Demolitionist', type: 'unit', energy: 3, might: 4 };
  const all = [promo, other, base];
  assert.deepEqual(printsOf(base, all).map(c => c.id), ['b', 'p']);
  assert.deepEqual(printsOf(promo, all).map(c => c.id), ['b', 'p']);
  assert.deepEqual(printsOf(other, all).map(c => c.id), ['x']);
});
