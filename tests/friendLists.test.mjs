// Lot 10: lists shared between friends by file, possible trades, calculator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const {
  buildMyList, parseFriendList, personForList, tradeMatches, tradeGap, spareCards, listFileName, listDate, count, itemsValue,
} = await import('../src/lib/friendLists.js');

const card = (id) => ({ id, set: 'OGN' });
// a × 5, b × 2, c × 4 (one in a box, with a purchase price), d × 1
const stacks = [
  { cardData: card('ogn-001-298'), quantity: 5, paid: 3.5, boxId: 'box1', location: 'Classeur' },
  { cardData: card('ogn-002-298'), quantity: 2 },
  { cardData: card('ogn-003-298'), quantity: 3 },
  { cardData: card('ogn-003-298'), quantity: 1, foil: true, boxId: 'box2' },
  { cardData: card('ogn-004-298'), quantity: 1 },
];
const wish = [{ cardId: 'ogn-010-298', quantity: 2, maxPrice: 4 }, { cardId: 'ogn-004-298', quantity: 3 }, { cardId: 'ogn-002-298', quantity: 1 }];

test('my list: doubles above the kept copies, and the wishes still missing — nothing else', () => {
  const l = buildMyList({ name: ' Léa ', stacks, wishItems: wish, keep: 3, id: 'abc', now: 1000 });
  assert.deepEqual(l.haves, [{ cardId: 'ogn-001-298', quantity: 2 }, { cardId: 'ogn-003-298', quantity: 1 }]);
  assert.deepEqual(l.wants, [{ cardId: 'ogn-004-298', quantity: 2 }, { cardId: 'ogn-010-298', quantity: 2 }]);
  assert.equal(l.name, 'Léa');
  // no purchase price, place, box or note leaves the app
  const text = JSON.stringify(l);
  for (const word of ['paid', 'box', 'location', 'Classeur', 'maxPrice', 'foil', 'note']) assert.ok(!text.includes(word), word);
  assert.deepEqual(spareCards(stacks, 1).map(s => s.quantity), [4, 1, 3]);
  assert.equal(listFileName('Léa Dupont', Date.parse('2026-11-20')), 'liste-riftbound-lea-dupont-2026-11-20.json');
  assert.equal(listDate(Date.parse('2026-11-12T12:00:00Z')), 'liste du 12 nov.');
});

test('reading a friend\'s file: checked, bad lines skipped, clear messages', () => {
  const ok = parseFriendList(JSON.stringify({
    format: 'riftbound-liste', version: 1, id: 'p1', name: 'Paul', exportedAt: 5,
    haves: [{ cardId: 'ogn-010-298', quantity: 3 }, { cardId: '<img src=x>', quantity: 1 }, { cardId: 'ogn-011-298', quantity: -2 }, { cardId: 'ogn-010-298', quantity: 1 }],
    wants: [{ cardId: 'ogn-001-298', quantity: 1 }, { cardId: 'ogn-003-298', quantity: 500 }],
  }));
  assert.deepEqual(ok.haves, [{ cardId: 'ogn-010-298', quantity: 4 }]);
  assert.deepEqual(ok.wants, [{ cardId: 'ogn-001-298', quantity: 1 }, { cardId: 'ogn-003-298', quantity: 99 }]);
  assert.throws(() => parseFriendList('pas du json'), /pas une liste Riftbound/);
  assert.throws(() => parseFriendList(JSON.stringify({ format: 'autre' })), /pas une liste Riftbound/);
  assert.throws(() => parseFriendList(JSON.stringify({ format: 'riftbound-liste', version: 9, haves: [], wants: [] })), /plus récente/);
  assert.throws(() => parseFriendList(JSON.stringify({ format: 'riftbound-liste', version: 1, wants: [] })), /incomplet/);
});

test('one entry per person, replaced at each new import', () => {
  const list = { id: 'p1', name: 'Paul', exportedAt: 9, haves: [], wants: [] };
  const first = personForList([], list);
  assert.equal(first.created, true);
  assert.equal(first.record.name, 'Paul');
  const people = [{ id: 'x', name: 'Marie', note: 'club' }, { id: 'y', name: 'paul', note: 'voisin', list: { id: 'p1', at: 1 } }];
  const again = personForList(people, { ...list, exportedAt: 20 });
  assert.equal(again.created, false);
  assert.equal(again.record.id, 'y');
  assert.equal(again.record.note, 'voisin');
  assert.equal(again.record.list.at, 20);
  // same name without id (accents and case ignored) → the same person; a renamed sender is still found by id
  assert.equal(personForList(people, { name: 'MARIE', haves: [], wants: [] }).record.id, 'x');
  assert.equal(personForList(people, { ...list, name: 'Paulo' }).record.id, 'y');
});

test('possible trades: his doubles I want, my doubles he wants, up to the quantities', () => {
  const paul = { haves: [{ cardId: 'ogn-010-298', quantity: 5 }, { cardId: 'ogn-004-298', quantity: 1 }, { cardId: 'ogn-099-298', quantity: 1 }],
    wants: [{ cardId: 'ogn-001-298', quantity: 4 }, { cardId: 'ogn-002-298', quantity: 1 }] };
  const m = tradeMatches(paul, stacks, wish, 3);
  assert.deepEqual(m.forMe, [{ cardId: 'ogn-010-298', quantity: 2 }, { cardId: 'ogn-004-298', quantity: 1 }]);
  assert.deepEqual(m.forThem, [{ cardId: 'ogn-001-298', quantity: 2 }]); // b: I keep my 2 copies
  assert.equal(count(m.forMe), 3);
  const price = { 'ogn-010-298': 6.1, 'ogn-004-298': 2.4, 'ogn-001-298': 12.4 };
  assert.equal(Math.round(itemsValue(m.forMe, id => price[id]) * 100) / 100, 14.6);
  assert.deepEqual(tradeMatches(null, stacks, wish), { forMe: [], forThem: [] });
});

test('calculator: the gap, fair under 10 %', () => {
  assert.deepEqual(tradeGap(10, 10.5), { diff: 0.5, share: 0.5 / 10.5, fair: true });
  assert.equal(tradeGap(13.5, 9.3).fair, false);
  assert.equal(Math.round(tradeGap(13.5, 9.3).diff * 100) / 100, -4.2);
  assert.deepEqual(tradeGap(0, 0), { diff: 0, share: 0, fair: true });
});
