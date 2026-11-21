// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { parseCollectionCsv, parseCsv } = await import('../src/lib/csvImport.js');
const { default: cardnexus } = await import('../src/lib/exporters/cardnexus.js');
const { default: riftmana } = await import('../src/lib/exporters/riftmana.js');
const { getMatcher } = await import('../src/lib/cardMatcher.js');
const { priceChange, priceAlerts, cardHistory } = await import('../src/lib/prices.js');

const m = getMatcher();
const stacks = [
  { cardData: m.getCardData('ogn-030-298'), quantity: 2, language: 'French', foil: false, promo: false, condition: 'Near Mint' },
  { cardData: m.getCardData('ogn-030a-298'), quantity: 1, language: 'English', foil: true, promo: false, condition: 'Excellent' },
  { cardData: m.getCardData('ogn-007-298'), quantity: 6, language: 'English', foil: false, promo: false, condition: 'Near Mint' },
];
const norm = (list) => list.map(e => `${e.cardId}|${e.quantity}|${e.foil}`).sort();

test('CSV parser handles quotes, commas and semicolons', () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n'), [['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('CardNexus export → import keeps cards, quantities, language, condition, foil', () => {
  const { entries, unknown } = parseCollectionCsv(cardnexus.generate(stacks));
  assert.deepEqual(unknown, []);
  assert.deepEqual(norm(entries), norm(stacks.map(s => ({ cardId: s.cardData.id, quantity: s.quantity, foil: s.foil }))));
  const fr = entries.find(e => e.cardId === 'ogn-030-298');
  assert.equal(fr.language, 'French');
  assert.equal(entries.find(e => e.cardId === 'ogn-030a-298').condition, 'Excellent'); // via « Lightly Played » in the file
});

test('Riftmana export → import', () => {
  const { entries, unknown } = parseCollectionCsv(riftmana.generate(stacks), { language: 'French' });
  assert.deepEqual(unknown, []);
  assert.deepEqual(norm(entries), norm(stacks.map(s => ({ cardId: s.cardData.id, quantity: s.quantity, foil: s.foil }))));
  assert.ok(entries.every(e => e.language === 'French'));
});

test('generic French spreadsheet', () => {
  const csv = 'Quantité;Nom;Langue;Foil\n2;Jinx - Démolisseuse;FR;non\n1;Fendoir;EN;oui\n1;Inconnue;FR;non';
  const { entries, unknown } = parseCollectionCsv(csv);
  assert.equal(unknown.length, 1);
  assert.deepEqual(entries.map(e => [e.cardId, e.quantity, e.language, e.foil]),
    [['ogn-030-298', 2, 'French', false], ['ogn-004-298', 1, 'English', true]]);
});

test('price change, history and alerts', () => {
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const prices = {
    cards: { a: [12, null, 1, 10, 8], b: [5, null, 2, null, null] },
    hist: { days: [daysAgo(7), daysAgo(3), today], cards: { a: [6, 9, 12] } },
  };
  assert.equal(cardHistory(prices, 'a').length, 3);
  assert.equal(Math.round(priceChange(prices, 'a', 7)), 100); // from the app's own history
  assert.equal(priceChange(prices, 'a', 30), null); // history too short: no change shown (lot 1.2 a)
  assert.equal(priceChange(prices, 'b', 7), null);
  const wish = [{ cardId: 'a', maxPrice: 15 }, { cardId: 'b', maxPrice: 4 }, { cardId: 'a' }];
  assert.deepEqual(priceAlerts(prices, wish).map(w => w.cardId), ['a']);
});
