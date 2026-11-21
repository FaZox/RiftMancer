// Lot 7.4: notes and sideboard plan per opposing Legend, kept in the deck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opponentRows, planFor, setPlan, planChoices, adjust, planIssues, hasPlan } from '../src/lib/opponentNotes.js';

const deck = {
  id: 'd1',
  cards: [
    { cardId: 'fury', zone: 'main', quantity: 3 },
    { cardId: 'blade', zone: 'main', quantity: 1 },
    { cardId: 'counter', zone: 'side', quantity: 2 },
    { cardId: 'rune', zone: 'rune', quantity: 12 },
  ],
};

test('one line per Legend met with the deck, win rate and games; alternate arts merged', () => {
  const canon = (id) => id.replace(/-alt$/, '');
  const matches = [
    { deckId: 'd1', oppLegendId: 'ahri', result: 'win' },
    { deckId: 'd1', oppLegendId: 'ahri-alt', result: 'loss' },
    { deckId: 'd1', oppLegendId: 'ahri', result: 'win' },
    { deckId: 'd1', oppLegendId: 'garen', result: 'loss' },
    { deckId: 'd2', oppLegendId: 'garen', result: 'win' },          // another deck
    { deckId: 'd1', oppLegendId: 'garen', result: 'win', deleted: true },
    { deckId: 'd1', oppLegendId: null, result: 'win' },             // no Legend noted
  ];
  const rows = opponentRows(deck, matches, canon);
  assert.deepEqual(rows.map(r => [r.legendId, r.games, r.rate]), [['ahri', 3, 67], ['garen', 1, 0]]);
});

test('a plan prepared in advance shows without any game; an emptied plan disappears', () => {
  let d = setPlan(deck, 'jinx', { note: 'Garder les réactions' }, 1);
  assert.deepEqual(opponentRows(d, []).map(r => [r.legendId, r.games, r.rate]), [['jinx', 0, null]]);
  assert.equal(planFor(d, 'jinx').note, 'Garder les réactions');
  assert.equal(planFor(d, 'jinx').at, 1);
  d = setPlan(d, 'jinx', { note: '  ' });
  assert.equal(hasPlan(planFor(d, 'jinx')), false);
  assert.deepEqual(d.opponents, {});
});

test('« Sortir » takes cards of the deck, « Rentrer » cards of the reserve, within the copies there', () => {
  const c = planChoices(deck);
  assert.deepEqual([...c.out], [['fury', 3], ['blade', 1]]);
  assert.deepEqual([...c.in], [['counter', 2]]);
  let out = adjust([], 'fury', 1, 3);
  out = adjust(out, 'fury', 5, 3);
  assert.deepEqual(out, [{ cardId: 'fury', quantity: 3 }]);
  assert.deepEqual(adjust(out, 'fury', -3, 3), []);
});

test('a plan that does not balance, or uses cards no longer there, says so', () => {
  const plan = { note: '', out: [{ cardId: 'fury', quantity: 2 }], in: [{ cardId: 'counter', quantity: 1 }] };
  assert.deepEqual(planIssues(deck, plan), ['2 cartes sorties, 1 rentrée']);
  const fewer = { ...deck, cards: deck.cards.filter(s => s.cardId !== 'counter') };
  assert.deepEqual(planIssues(fewer, { ...plan, out: [{ cardId: 'fury', quantity: 1 }] }), ['1 carte du plan n’est plus dans le deck en nombre suffisant']);
  assert.deepEqual(planIssues(deck, { ...plan, out: [{ cardId: 'fury', quantity: 1 }] }), []);
});
