// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
// « Cartes » tab (ONGLET-CARTES 1.3, 1.5, 1.7): the real catalog filtered, grouped, sorted, counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { allCards } = await import('../src/lib/catalog.js');
const { parseQuery } = await import('../src/lib/cardQuery.js');
const { browseCards, ownedMap, groupKey, gridRows, deckWithCards, deckCardIds, viewCsv, setProgress } = await import('../src/lib/cardsBrowser.js');

const cards = allCards();
const pick = (f) => cards.find(f);
const unitMind = cards.filter(c => c.type === 'unit' && (c.domains || [c.domain]).includes('mind') && c.energy <= 3);
const ownedCard = unitMind[0];
const stacks = [
  { cardData: ownedCard, quantity: 2, language: 'French', foil: false },
  { cardData: ownedCard, quantity: 1, language: 'English', foil: true },
];
const owned = ownedMap(stacks);
const browse = (q, o = {}) => browseCards(cards, { parsed: parseQuery(q), owned, grouped: false, ...o });

test('owned copies per card, computed once', () => {
  assert.deepEqual(owned.get(ownedCard.id), { total: 3, fr: 2, en: 1, foil: 1 });
});

test('acceptance: d:esprit t:unité e<=3 own:0 = the Mind units of 3 energy or less not owned', () => {
  const ids = browse('d:esprit t:unité e<=3 own:0').items.map(g => g.card.id).sort();
  assert.deepEqual(ids, unitMind.filter(c => c !== ownedCard).map(c => c.id).sort());
});

test('might 4 and 5 = p>=4 p<=5, only cards with a might', () => {
  const a = browse('p:4,5').items.map(g => g.card.id);
  assert.deepEqual(a, browse('p>=4 p<=5').items.map(g => g.card.id));
  assert.ok(a.length > 0);
  assert.ok(browse('p:4,5').items.every(g => g.card.might === 4 || g.card.might === 5));
});

test('printings grouped by default; ownership counts; set titles', () => {
  const all = browseCards(cards, { parsed: parseQuery(''), owned });
  assert.ok(all.items.length < cards.length, 'alternate arts and stars join their card');
  const alt = pick(c => /a\//.test(c.code || ''));
  assert.equal(groupKey(alt), groupKey(pick(c => c.set === alt.set && c.code === alt.code.replace('a/', '/'))));
  assert.equal(all.counts.owned, 1);
  assert.equal(all.counts.all, all.counts.owned + all.counts.missing);
  const missing = browseCards(cards, { parsed: parseQuery(''), owned, ownership: 'missing' });
  assert.equal(missing.items.length, all.counts.missing);
  const rows = gridRows(all.items, 6, true);
  assert.equal(rows[0].type, 'set');
  assert.equal(rows.filter(r => r.type === 'set').length, new Set(all.items.map(g => g.card.set)).size);
  assert.equal(rows.filter(r => r.type === 'cards').reduce((n, r) => n + r.items.length, 0), all.items.length);
  const prog = setProgress(cards, owned);
  assert.equal(prog.get(ownedCard.set).own, 1);
});

test('sorts: energy, name, quantity', () => {
  const e = browse('t:sort', { sort: 'energy' }).items.map(g => g.card.energy ?? 99);
  assert.deepEqual(e, [...e].sort((a, b) => a - b));
  const q = browse('', { sort: 'quantity' }).items;
  assert.equal(q[0].card.id, ownedCard.id);
});

test('add to a deck, cards of the decks, CSV of the view', () => {
  const legend = pick(c => c.type === 'legend');
  const rune = pick(c => c.type === 'rune');
  const d = deckWithCards({ id: 'x', cards: [{ cardId: ownedCard.id, zone: 'main', quantity: 1 }] }, [ownedCard, legend, rune]);
  assert.equal(d.legendId, legend.id);
  assert.deepEqual(d.cards.find(s => s.cardId === ownedCard.id), { cardId: ownedCard.id, zone: 'main', quantity: 2 });
  assert.equal(d.cards.find(s => s.cardId === rune.id).zone, 'rune');
  assert.ok(deckCardIds([d]).has(legend.id));
  const csv = viewCsv(browse('own>0').items, { nameOf: c => c.name, priceOf: () => 1.5 });
  assert.match(csv, /^Set,Number,Name/);
  assert.match(csv, /,3,1\.50\n$/);
});

test('performance: filtering the whole catalog stays far under 50 ms', () => {
  browse('jinx'); // warm the search cache
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) browseCards(cards, { parsed: parseQuery('d:esprit t:unité e<=3 o:pioche'), owned, sort: 'name', nameOf: c => c.name });
  const ms = (performance.now() - t0) / 10;
  console.log(`  ${cards.length} cards filtered + sorted in ${ms.toFixed(1)} ms`);
  assert.ok(ms < 50, `${ms} ms`);
});
