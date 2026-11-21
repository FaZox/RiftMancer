// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Lot 4: probabilities, opening hand, share code, match statistics. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { hypergeomPmf, atLeast, cardsSeenByTurn, probabilityByTurn, GAME } = await import('../src/lib/probability.js');
const { newHand, mulligan, drawCard, expandMainDeck } = await import('../src/lib/handSim.js');
const { encodeDeck, decodeDeck, isDeckCode } = await import('../src/lib/deckShare.js');
const { parseDeckList } = await import('../src/lib/deckList.js');
const { computeStats, matchesToCsv, record } = await import('../src/lib/matchStats.js');
const { getMatcher: getMatcherForTests } = await import('../src/lib/cardMatcher.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('hypergeometric values checked by hand', () => {
  // 40 cards, 3 copies, 4-card hand: P(0) = C(37,4)/C(40,4) = 66045/91390
  near(hypergeomPmf(0, 40, 3, 4), 66045 / 91390);
  near(atLeast(1, 40, 3, 4), 1 - 66045 / 91390); // ≈ 0.2773
  // Exactly 1 of 3 in 4: 3 * C(37,3) / C(40,4) = 3*7770/91390
  near(hypergeomPmf(1, 40, 3, 4), (3 * 7770) / 91390);
  // Sum of the distribution = 1
  let s = 0;
  for (let k = 0; k <= 3; k++) s += hypergeomPmf(k, 40, 3, 7);
  near(s, 1, 1e-12);
  assert.equal(atLeast(0, 40, 3, 4), 1);
  assert.equal(atLeast(4, 40, 3, 10), 0);
});

test('cards seen by turn (1v1: both players draw on their first turn)', () => {
  assert.equal(GAME.handSize, 4);
  assert.equal(cardsSeenByTurn(1, true), 5);
  assert.equal(cardsSeenByTurn(3, false), 7);
  // With 3 copies in 40, by turn 3 (7 cards): 1 - C(37,7)/C(40,7)
  near(probabilityByTurn({ deckSize: 40, copies: 3, turn: 3 }), 1 - 10295472 / 18643560);
});

test('opening hand, mulligan (2 cards max, to the bottom), draw', () => {
  const deck = { cards: [{ cardId: 'a', zone: 'main', quantity: 20 }, { cardId: 'b', zone: 'main', quantity: 20 }, { cardId: 'r', zone: 'rune', quantity: 12 }] };
  assert.equal(expandMainDeck(deck).length, 40);
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let s = newHand(deck, { rand });
  assert.equal(s.hand.length, 4);
  assert.equal(s.library.length, 36);
  const before = [...s.hand];
  s = mulligan(s, [0, 1, 2]); // only 2 are replaced
  assert.equal(s.hand.length, 4);
  assert.deepEqual(s.library.slice(-2), before.slice(0, 2));
  assert.equal(mulligan(s, [3]), s); // once per game
  s = drawCard(s);
  assert.equal(s.hand.length, 5);
  assert.equal(s.library.length, 35);
});

test('share code: encode → import gives the same deck', () => {
  const deck = { name: 'Jinx aggro', legendId: 'ogn-251-298', championId: 'ogn-030-298', cards: [
    { cardId: 'ogn-030-298', zone: 'main', quantity: 3 },
    { cardId: 'ogn-007-298', zone: 'rune', quantity: 6 },
    { cardId: 'ogn-202-298', zone: 'side', quantity: 2 },
  ] };
  const code = encodeDeck(deck);
  assert.ok(isDeckCode(code) && code.length < 200, code);
  const back = decodeDeck(code);
  assert.deepEqual(back.deck, deck);
  const parsed = parseDeckList(code);
  assert.equal(parsed.deck.legendId, 'ogn-251-298');
  assert.equal(parsed.deck.cards.length, 3);
  assert.equal(parsed.unknown.length, 0);
  assert.equal(decodeDeck('RB1.!!!'), null);
});

test('match statistics: win rates, matchups, first / second, events, CSV', () => {
  const M = (result, my, opp, first, extra = {}) => ({ id: Math.random().toString(36), result, myLegendId: my, oppLegendId: opp, wentFirst: first, deckId: 'd1', date: 1, ...extra });
  const list = [
    M('win', 'L1', 'O1', true, { eventName: 'Store', eventId: 'e1', round: 1 }),
    M('loss', 'L1', 'O1', false, { eventName: 'Store', eventId: 'e1', round: 2 }),
    M('win', 'L1', 'O2', true),
    M('draw', 'L2', 'O1', false),
    { ...M(null, 'L2', 'O2', true), result: undefined, format: 'bo3', games: [{ result: 'win', wentFirst: true }, { result: 'loss', wentFirst: false }, { result: 'win', wentFirst: true }] },
    M('win', 'L1', 'O1', true, { deleted: true }),
  ];
  const s = computeStats(list);
  assert.equal(s.overall.n, 5);
  assert.equal(s.overall.win, 3);
  assert.equal(record(list.slice(0, 5)).small, false);
  assert.deepEqual(s.matrix.cell('L1', 'O1'), { n: 2, win: 1, loss: 1, draw: 0, winrate: 0.5, small: true });
  // Games: first = 2 matches + 2 Bo3 games won first → 4 games, all wins
  assert.equal(s.first.n, 4);
  assert.equal(s.first.win, 4);
  assert.equal(s.second.n, 3);
  assert.equal(s.events.find(e => e.key === 'e1').matches.length, 2);
  const csv = matchesToCsv(list, { cardName: (id) => `Nom ${id}` });
  assert.equal(csv.trim().split('\r\n').length, 6);
  assert.match(csv, /Nom L1;Nom O1/);
});

test('prices: reference price (trend / 7-day average / low) and unstable trend', async () => {
  const { unitPrice, priceVolatile } = await import('../src/lib/prices.js');
  const prices = { cards: {
    a: [10, 20, 1, 9, 8, 6, 15, 18],
    b: [10, null, 2, 5, 5],          // old table: no low price
  } };
  assert.equal(unitPrice(prices, 'a', false, 'trend'), 10);
  assert.equal(unitPrice(prices, 'a', false, 'avg7'), 9);
  assert.equal(unitPrice(prices, 'a', false, 'low'), 6);
  assert.equal(unitPrice(prices, 'a', true, 'low'), 15);
  assert.equal(unitPrice(prices, 'b', false, 'low'), 10); // falls back to the trend
  assert.equal(priceVolatile(prices, 'a'), false);
  assert.equal(priceVolatile(prices, 'b'), true); // 10 vs 5
});

test('collection sort by price: unit price both ways, stack value, unpriced last', async () => {
  const { priceComparator } = await import('../src/lib/catalog.js');
  const stacks = [
    { cardData: { id: 'a', name: 'A' }, quantity: 20 },
    { cardData: { id: 'b', name: 'B' }, quantity: 1 },
    { cardData: { id: 'c', name: 'C' }, quantity: 2 }, // no price
  ];
  const unit = (s) => ({ a: 1, b: 10 })[s.cardData.id] ?? null;
  const nameOf = (s) => s.cardData.name;
  const order = (sort) => [...stacks].sort(priceComparator(sort, unit, nameOf)).map(s => s.cardData.id).join('');
  assert.equal(order('price'), 'bac');
  assert.equal(order('priceAsc'), 'abc');
  assert.equal(order('value'), 'abc'); // 20 × 1 € > 1 × 10 €
  assert.equal(priceComparator('name', unit, nameOf), null);
});

test('preferences v5: « Rapide » is gone — everyone in Prudent, scanMode removed, other choices kept', async () => {
  const { migratePrefs } = await import('../src/lib/uiPrefs.js');
  for (const stored of [{ scanMode: 'fast', priceRef: 'low' }, { scanMode: 'fast', prefsVersion: 4, priceRef: 'low' }]) {
    const m = migratePrefs(stored);
    assert.equal('scanMode' in m.prefs, false);
    assert.equal(m.prefs.prefsVersion, 5);
    assert.equal(m.prefs.priceRef, 'low');
    assert.equal(m.migrated, true);
  }
  const done = migratePrefs({ prefsVersion: 5, priceRef: 'low' });
  assert.equal(done.migrated, false);
  assert.equal('scanMode' in migratePrefs({}).prefs, false);
});

test('preferences v3: the AI engine becomes the default once, then the choice is kept', async () => {
  const { migratePrefs } = await import('../src/lib/uiPrefs.js');
  const v2 = migratePrefs({ prefsVersion: 2, recognition: 'grid16', priceRef: 'avg7' });
  assert.equal(v2.prefs.recognition, 'ai');
  assert.equal(v2.prefs.priceRef, 'avg7', 'v2 choices are kept');
  assert.equal(v2.migrated, true);
  const chosen = migratePrefs({ prefsVersion: 5, recognition: 'grid16' });
  assert.equal(chosen.prefs.recognition, 'grid16');
  assert.equal(chosen.migrated, false);
  assert.equal(migratePrefs({}).prefs.recognition, 'ai');
});

test('preferences v4: the « Normal / Rapide » detection model choice is removed, other choices kept', async () => {
  const { migratePrefs, removeLegacyModelKeys } = await import('../src/lib/uiPrefs.js');
  const v3 = migratePrefs({ prefsVersion: 3, recognition: 'grid16' });
  assert.equal(v3.prefs.prefsVersion, 5);
  assert.equal(v3.prefs.recognition, 'grid16');
  assert.equal(v3.migrated, true);
  const store = new Map([['riftbound_model_preference', '"quantized"'], ['rb-model-default-v2', '1'], ['other', 'x']]);
  const storage = { getItem: k => (store.has(k) ? store.get(k) : null), removeItem: k => store.delete(k) };
  assert.equal(removeLegacyModelKeys(storage), true);
  assert.deepEqual([...store.keys()], ['other']);
  assert.equal(removeLegacyModelKeys(storage), false, 'idempotent');
});

test('Chosen Champion starts in the Champion Zone: 39-card library, one copy less', async () => {
  const { expandLibrary, newHand } = await import('../src/lib/handSim.js');
  const deck = { championId: 'champ', cards: [
    { cardId: 'champ', zone: 'main', quantity: 3 },
    { cardId: 'x', zone: 'main', quantity: 37 },
  ] };
  const lib = expandLibrary(deck);
  assert.equal(lib.length, 39);
  assert.equal(lib.filter(id => id === 'champ').length, 2);
  for (let i = 0; i < 50; i++) {
    const s = newHand(deck);
    assert.ok([...s.hand, ...s.library].filter(id => id === 'champ').length === 2);
  }
  // 2 copies left in 39 cards, 5 cards seen: 1 − C(37,5)/C(39,5)
  near(probabilityByTurn({ deckSize: 39, copies: 2, turn: 1 }), 1 - 435897 / 575757);
  assert.equal(expandLibrary({ cards: deck.cards }).length, 40); // no champion chosen
});

test('matchups: an alternate-art Legend is counted with its Legend', async () => {
  const { legendKey, legendReferences, canonicalLegendId } = await import('../src/lib/legends.js');
  const m = getMatcherForTests();
  const jinx = m.cards.filter(c => c.type === 'legend' && (c.tags || [])[0] === 'Jinx');
  assert.ok(jinx.length >= 2, 'Jinx has alternate arts');
  const refs = legendReferences(m.cards.filter(c => c.type === 'legend'));
  assert.equal(refs.size, 58);
  const canon = (id) => canonicalLegendId(id, (x) => m.getCard(x), refs);
  assert.equal(canon(jinx[0].id), canon(jinx[1].id));
  assert.equal(legendKey(jinx[0]), legendKey(jinx[1]));
  const s = computeStats([
    { id: '1', result: 'win', myLegendId: jinx[0].id, oppLegendId: 'x' },
    { id: '2', result: 'loss', myLegendId: jinx[1].id, oppLegendId: 'x' },
  ], { legendOf: canon });
  assert.equal(s.byLegend.length, 1);
  assert.equal(s.byLegend[0].n, 2);
  assert.equal(s.matrix.rows.length, 1);
});

test('incremental SHA-256 (model download) = node:crypto, whatever the pieces', async () => {
  const { Sha256 } = await import('../src/lib/sha256.js');
  const { createHash, randomBytes } = await import('node:crypto');
  for (const size of [0, 1, 55, 56, 63, 64, 65, 1000, 200000]) {
    const data = randomBytes(size);
    const h = new Sha256();
    for (let i = 0; i < size;) { const n = 1 + Math.floor(Math.random() * 5000); h.update(data.subarray(i, i + n)); i += n; }
    assert.equal(h.hex(), createHash('sha256').update(data).digest('hex'), `size ${size}`);
  }
});

test('prices: history and 7-day change follow the chosen reference price', async () => {
  const { updateHistory } = await import('../src/lib/priceBuilder.js');
  const { priceChange, cardHistory, valueHistory } = await import('../src/lib/prices.js');
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  let hist = updateHistory(null, day(7), { a: [10, null, 1, 20, 18, 5] });
  hist = updateHistory(hist, day(0), { a: [11, null, 1, 30, 18, 6] });
  assert.deepEqual(hist.avg7.a, [20, 30]);
  assert.deepEqual(hist.low.a, [5, 6]);
  const prices = { cards: { a: [11, null, 1, 30, 18, 6] }, hist };
  assert.deepEqual(cardHistory(prices, 'a', 'avg7').map(p => p.v), [20, 30]);
  assert.equal(Math.round(priceChange(prices, 'a', 7, 'trend')), 10);  // 10 → 11
  assert.equal(Math.round(priceChange(prices, 'a', 7, 'avg7')), 50);   // 20 → 30, not the trend
  assert.equal(Math.round(priceChange(prices, 'a', 7, 'low')), 20);    // 5 → 6
  // No history yet for the low price → no change shown (not the trend's)
  assert.equal(priceChange({ cards: prices.cards, hist: { days: hist.days, cards: hist.cards } }, 'a', 7, 'low'), null);
  // Collection value curve in the chosen reference
  const h = [{ d: day(1), v: 100, v7: 90, vl: 70 }, { d: day(0), v: 110 }];
  assert.deepEqual(valueHistory(h, 'avg7').map(x => x.v), [90]);
  assert.deepEqual(valueHistory(h, 'trend').map(x => x.v), [100, 110]);
});
