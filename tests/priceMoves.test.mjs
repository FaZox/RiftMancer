// Lot 9: alerts on the cards you own (X % over 7 days, minimum value), only
// from a real price history, and the summary after each price update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const { ownedMoves, movements, summaryText, moveLine, wishLine, takeNewUpdate, alertStatus } = await import('../src/lib/priceMoves.js');
const { getPrefs } = await import('../src/lib/uiPrefs.js');

const DAY = 86400000;
const NOW = Date.parse('2026-11-17T12:00:00Z');
const ago = (n) => new Date(NOW - n * DAY).toISOString().slice(0, 10);
const card = (id) => ({ id, set: 'OGN', setName: 'Origins' });
const stack = (id, extra = {}) => ({ cardData: card(id), quantity: 1, ...extra });

// a: 10 → 13,40 (+34 %) · b: 10 → 6 (−40 %) · c: 1 → 2 (+100 %, but worth 2 € only)
// d: 10 → 11 (+10 %) · e: +50 % but only 3 days of history · f: no price of its own (≈)
const prices = {
  cards: { a: [13.4], b: [6], c: [1.5], d: [11], e: [15], f: [null, 9] },
  hist: {
    days: [ago(7), ago(3), ago(0)],
    cards: { a: [10, 12, 13.4], b: [10, 8, 6], c: [0.75, 1, 1.5], d: [10, 10, 11], e: [null, 10, 15] },
  },
};

test('owned cards past ±X % over 7 days, worth more than the minimum', () => {
  const owned = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => stack(id));
  const m = ownedMoves(prices, owned, { pct: 20, min: 2 }, 'trend', NOW);
  assert.deepEqual(m.up.map(x => x.cardData.id), ['a']);
  assert.deepEqual(m.down.map(x => x.cardData.id), ['b']);
  assert.equal(Math.round(m.up[0].ch), 34);
  // a lower minimum lets the 1,50 € card in; a higher threshold keeps only the biggest move
  assert.deepEqual(ownedMoves(prices, owned, { pct: 20, min: 1 }, 'trend', NOW).up.map(x => x.cardData.id), ['c', 'a']);
  assert.deepEqual(ownedMoves(prices, owned, { pct: 35, min: 2 }, 'trend', NOW).down.map(x => x.cardData.id), ['b']);
  assert.deepEqual(ownedMoves(prices, owned, { pct: 35, min: 2 }, 'trend', NOW).up, []);
});

test('no alert without a real 7-day history, nor for promos, nor when off', () => {
  // e: +50 % but its history starts 3 days ago (lot 1.2 a)
  assert.deepEqual(ownedMoves(prices, [stack('e')], { pct: 20, min: 2 }, 'trend', NOW).up, []);
  assert.deepEqual(ownedMoves(prices, [stack('a', { promo: true })], { pct: 20, min: 2 }, 'trend', NOW).up, []);
  assert.deepEqual(ownedMoves(prices, [stack('a')], { pct: 0, min: 2 }, 'trend', NOW).up, []);
  assert.deepEqual(ownedMoves(null, [stack('a')], { pct: 20, min: 2 }).up, []);
  // copies of the same card add up in one line
  const two = ownedMoves(prices, [stack('a'), stack('a', { quantity: 2 })], { pct: 20, min: 2 }, 'trend', NOW);
  assert.equal(two.up.length, 1);
  assert.equal(two.up[0].n, 3);
});

test('defaults: alerts at 20 %, cards over 2 €', () => {
  assert.equal(getPrefs().priceAlertPct, 20);
  assert.equal(getPrefs().priceAlertMin, 2);
  assert.equal(alertStatus(getPrefs()), 'alertes à 20 %');
  assert.equal(alertStatus({ priceAlertPct: 0 }), 'alertes coupées');
});

test('the summary and the panel lines', () => {
  const wishItems = [{ cardId: 'b', maxPrice: 8 }, { cardId: 'a', maxPrice: 5 }];
  const mv = movements(prices, ['a', 'b', 'c'].map(id => stack(id)), wishItems, { priceAlertPct: 20, priceAlertMin: 2 }, 'trend', NOW);
  assert.equal(mv.wish.length, 1);
  assert.equal(summaryText(mv), '1 carte en forte hausse, 1 en forte baisse, 1 alerte de souhait');
  assert.equal(summaryText({ up: [1, 2, 3], down: [], wish: [1] }), '3 cartes en forte hausse, 1 alerte de souhait');
  assert.equal(summaryText({ up: [], down: [1, 2], wish: [] }), '2 cartes en forte baisse');
  assert.equal(summaryText({ up: [], down: [], wish: [] }), null);
  assert.equal(moveLine(mv.up[0], 'Jinx, Démolisseuse'), 'Jinx, Démolisseuse +34 % en 7 jours · 13,40 €');
  assert.equal(wishLine({ maxPrice: 8 }, 'Ahri'), 'Souhait : Ahri est passée sous 8 €');
  assert.equal(wishLine({ maxPrice: 7.5 }, 'Ahri'), 'Souhait : Ahri est passée sous 7,50 €');
});

test('the summary is shown once per price update, not at every start', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(takeNewUpdate(1000, storage), true);
  assert.equal(takeNewUpdate(1000, storage), false);
  assert.equal(takeNewUpdate(2000, storage), true);
  assert.equal(takeNewUpdate(null, storage), false);
});
