// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { parseDeckList, formatDeckList } = await import('../src/lib/deckList.js');
const { validateDeck, cardKey } = await import('../src/lib/deckRules.js');
const { getMatcher } = await import('../src/lib/cardMatcher.js');

const LIST = `Legend:
1 Jinx, Loose Cannon
Champion:
1 Jinx - Demolitionist
MainDeck (40):
2 Jinx - Demolitionist
3x Cleave
Désintégration x3
3 Enthousiasme !
3 OGN-165
2 Ember Monk (OGN-167)
1 Carte qui n'existe pas
Battlefields:
1 Altar to Unity
1 Aspirant's Climb
1 Taverne de la ruelle
Runes:
6 Fury Rune
6 Chaos Rune
Sideboard:
2 Mystic Poro`;

test('deck list import: English, French, codes, sections', () => {
  const { deck, unknown, count } = parseDeckList(LIST);
  assert.equal(deck.legendId, 'ogn-251-298');
  assert.equal(deck.championId, 'ogn-030-298');
  assert.deepEqual(unknown, ["1 Carte qui n'existe pas"]);
  assert.equal(count, 35);
  const qty = (id, zone) => deck.cards.find(s => s.cardId === id && s.zone === zone)?.quantity;
  assert.equal(qty('ogn-030-298', 'main'), 3); // champion line + 2
  assert.equal(qty('ogn-165-298', 'main'), 3); // by code
  assert.equal(qty('ogn-171-298', 'side'), 2);
  assert.equal(deck.cards.filter(s => s.zone === 'rune').reduce((n, s) => n + s.quantity, 0), 12);
  assert.equal(deck.cards.filter(s => s.zone === 'battlefield').length, 3);
});

test('deck list export → import gives the same deck', () => {
  const { deck } = parseDeckList(LIST);
  for (const lang of ['English', 'French']) {
    const again = parseDeckList(formatDeckList(deck, lang)).deck;
    const norm = (d) => d.cards.map(s => `${s.zone}|${s.cardId}|${s.quantity}`).sort();
    assert.equal(again.legendId, deck.legendId, lang);
    assert.equal(again.championId, deck.championId, lang);
    assert.deepEqual(norm(again), norm(deck), lang);
  }
});

test('copy limit counts the full name: two different Jinx units are different cards', () => {
  const m = getMatcher();
  assert.notEqual(cardKey(m.getCardData('ogn-030-298')), cardKey(m.getCardData('ogn-202-298')));
  assert.equal(cardKey(m.getCardData('ogn-030-298')), cardKey(m.getCardData('ogn-030a-298')));
  const deck = { legendId: 'ogn-251-298', championId: 'ogn-030-298', cards: [
    { cardId: 'ogn-030-298', zone: 'main', quantity: 3 },
    { cardId: 'ogn-030a-298', zone: 'main', quantity: 1 },
    { cardId: 'ogn-202-298', zone: 'main', quantity: 3 },
  ] };
  const errors = validateDeck(deck).errors.join('\n');
  assert.match(errors, /Démolisseuse.*4 exemplaires/);
  assert.doesNotMatch(errors, /Rebelle.*exemplaires/);
});

test('Signature cards: 3 at most in total, with the Legend champion tag', async () => {
  const base = { legendId: 'ogn-251-298', championId: 'ogn-030-298' }; // Jinx
  const ok = validateDeck({ ...base, cards: [{ cardId: 'ogn-252-298', zone: 'main', quantity: 3 }] });
  assert.equal(ok.signatures, 3);
  assert.doesNotMatch(ok.errors.join('\n'), /Signature/);
  const four = validateDeck({ ...base, cards: [
    { cardId: 'ogn-252-298', zone: 'main', quantity: 3 },
    { cardId: 'ogn-254-298', zone: 'main', quantity: 1 }, // Darius signature
  ] }).errors.join('\n');
  assert.match(four, /Cartes Signature : 4 \(maximum 3/);
  assert.match(four, /autre champion que « Jinx »/);
});

test('banlist: a banned card is an error, a restricted one is limited', async () => {
  const { setBanlist } = await import('../src/lib/banlist.js');
  const deck = { legendId: 'ogn-251-298', championId: 'ogn-030-298', cards: [
    { cardId: 'ogn-202-298', zone: 'main', quantity: 1 },
    { cardId: 'ogn-030-298', zone: 'main', quantity: 2 },
  ] };
  assert.doesNotMatch(validateDeck(deck).errors.join('\n'), /bannie/);
  const m = getMatcher();
  setBanlist({ formats: { standard: { banned: ['ogn-202-298'], restricted: { [cardKey(m.getCardData('ogn-030-298'))]: 1 } } } });
  try {
    const errors = validateDeck(deck).errors.join('\n');
    assert.match(errors, /bannie/);
    assert.match(errors, /limitée à 1 exemplaire \(ici 2\)/);
  } finally {
    setBanlist(null);
  }
});
