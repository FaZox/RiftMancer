// Lot 7.3: versions of a deck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const V = await import('../src/lib/deckVersions.js');
const { computeStats } = await import('../src/lib/matchStats.js');

const deck = { id: 'd1', name: 'Jinx Tempo', legendId: 'L', championId: 'C', format: 'standard',
  cards: [{ cardId: 'a', zone: 'main', quantity: 3 }, { cardId: 'b', zone: 'main', quantity: 2 }, { cardId: 's', zone: 'side', quantity: 1 }] };

test('save a named version; « changed since » follows the list', () => {
  assert.equal(V.currentVersion(deck), 0);
  const d1 = V.saveVersion(deck, '  avant le tournoi ', 1000);
  assert.equal(V.currentVersion(d1), 1);
  assert.deepEqual(d1.versions[0], { n: 1, name: 'avant le tournoi', at: 1000, legendId: 'L', championId: 'C', format: 'standard', cards: deck.cards });
  assert.equal(V.changedSinceVersion(d1), false);
  const edited = { ...d1, cards: [...d1.cards, { cardId: 'c', zone: 'main', quantity: 1 }] };
  assert.equal(V.changedSinceVersion(edited), true);
  assert.equal(V.currentVersion(V.saveVersion(edited, '', 2000)), 2);
  assert.equal(deck.versions, undefined, 'the deck given is not changed');
});

test('compare two versions: added / removed, per zone, by quantity', () => {
  const a = { legendId: 'L', championId: 'C', cards: deck.cards };
  const b = { legendId: 'L', championId: 'C2', cards: [{ cardId: 'a', zone: 'main', quantity: 2 }, { cardId: 'c', zone: 'main', quantity: 3 }, { cardId: 's', zone: 'main', quantity: 1 }] };
  const d = V.diffVersions(a, b);
  assert.deepEqual(d.added, [{ cardId: 'c', zone: 'main', quantity: 3 }, { cardId: 's', zone: 'main', quantity: 1 }, { cardId: 'C2', zone: 'champion', quantity: 1 }]);
  assert.deepEqual(d.removed, [{ cardId: 'a', zone: 'main', quantity: 1 }, { cardId: 'b', zone: 'main', quantity: 2 }, { cardId: 's', zone: 'side', quantity: 1 }, { cardId: 'C', zone: 'champion', quantity: 1 }]);
  assert.deepEqual(V.diffVersions(a, a), { added: [], removed: [] });
});

test('matches keep the version played; win rate per version (deck menu and statistics)', () => {
  const decks = { byId: new Map([['d1', V.saveVersion(V.saveVersion(deck, 'a', 1), 'b', 2)]]) };
  const m = V.withDeckVersion({ deckId: 'd1', result: 'win' }, decks);
  assert.equal(m.deckVersion, 2);
  assert.equal(V.withDeckVersion({ deckId: 'd1', deckVersion: 1 }, decks).deckVersion, 1, 'an edited match keeps its version');
  assert.equal(V.withDeckVersion({ deckId: null }, decks).deckVersion, undefined);
  const matches = [
    { deckId: 'd1', deckVersion: 1, result: 'win' }, { deckId: 'd1', deckVersion: 1, result: 'loss' },
    { deckId: 'd1', deckVersion: 2, result: 'win' }, { deckId: 'd1', result: 'win' }, { deckId: 'd2', deckVersion: 1, result: 'win' },
  ];
  assert.deepEqual([...V.versionStats(matches, 'd1')], [[1, { games: 2, wins: 1, rate: 50 }], [2, { games: 1, wins: 1, rate: 100 }]]);
  const s = computeStats(matches.map((x, i) => ({ id: `m${i}`, ...x })));
  assert.deepEqual(s.byDeckVersion.map(r => r.key), ['d1|1', 'd1|2', 'd2|1']);
});
