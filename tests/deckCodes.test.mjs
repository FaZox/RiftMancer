// Lot 7.1 / 7.2: community deck codes (Piltover Archive format) and « Copier pour l'inscription ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeckFromCode, getCodeFromDeck, isCommunityCode, deckToCommunityCode, communityCodeToDeck,
  formatCode, registrationText,
} from '../src/lib/deckCodes.js';

// The examples of the library's README (v1.0.0 and v1.5.0): a Kai'Sa deck, with and without sideboard.
const CODE_A = 'CIAAAAAAAAAQCAAAA4AACAIAABMQAAILAAAAICIMDMOVOX3AM5UHIAIDAAACO6XYAEAQKAAABX3QDGACUABKIAQAAEBQAAAWDBOQCAQAABMHE';
const CODE_B = 'CIAAAAAAAAAQCAAAA4AACAIAABMQAAILAAAAICIMDMOVOX3AM5UHIAIDAAACO6XYAEAQKAAABX3QDGACUABKIAQAAAAA';
const MAIN = [
  ['OGN-007', 7], ['OGN-089', 5],
  ...['004', '009', '012', '027', '029', '087', '095', '096', '103', '104', '116'].map(n => [`OGN-${n}`, 3]),
  ...['039', '122', '248'].map(n => [`OGN-${n}`, 2]),
  ...['013', '247', '280', '288', '292'].map(n => [`OGN-${n}`, 1]),
];
const SIDE = [['OGN-022', 2], ['OGN-024', 2], ['OGN-093', 2], ['OGN-088', 1], ['OGN-114', 1]];
const asPairs = (l) => l.map(c => [c.cardCode, c.count]);

test('the README codes decode to the README lists', () => {
  const a = getDeckFromCode(CODE_A);
  assert.deepEqual(asPairs(a.mainDeck), MAIN);
  assert.deepEqual(asPairs(a.sideboard), SIDE);
  const b = getDeckFromCode(CODE_B);
  assert.deepEqual(asPairs(b.mainDeck), MAIN);
  assert.deepEqual(b.sideboard, []);
  assert.equal(isCommunityCode(CODE_A), true);
  assert.equal(isCommunityCode('RB1.abc'), false);
});

test('encoding then decoding gives the same deck (V3 champion, V5 SP and many copies, V4 runes)', () => {
  const main = MAIN.map(([cardCode, count]) => ({ cardCode, count }));
  const side = SIDE.map(([cardCode, count]) => ({ cardCode, count }));
  const c = getCodeFromDeck(main, side, 'OGN-103');
  assert.equal(c[0] + c[1], 'CM'); // format 1, version 3
  const d = getDeckFromCode(c);
  assert.deepEqual(asPairs(d.mainDeck), MAIN);
  assert.deepEqual(asPairs(d.sideboard), SIDE);
  assert.equal(d.chosenChampion, 'OGN-103');
  const v5 = getDeckFromCode(getCodeFromDeck([{ cardCode: 'OGN-030a', count: 14 }, { cardCode: 'RAD-SP1', count: 1 }], [{ cardCode: 'SFD-R01', count: 3 }], 'RAD-SP1'));
  assert.deepEqual(asPairs(v5.mainDeck), [['OGN-030a', 14], ['RAD-SP1', 1]]);
  assert.deepEqual(asPairs(v5.sideboard), [['SFD-R01', 3]]);
  assert.equal(v5.chosenChampion, 'RAD-SP1');
  const v4 = getDeckFromCode(getCodeFromDeck([{ cardCode: 'OGN-R02', count: 6 }, { cardCode: 'OGN-001', count: 3 }]));
  assert.deepEqual(asPairs(v4.mainDeck), [['OGN-R02', 6], ['OGN-001', 3]]);
  assert.throws(() => getDeckFromCode('CI!'), /caractère/);
  assert.throws(() => getDeckFromCode('AAAA'), /format/);
});

test('the app’s deck ⇄ the format: Legend, runes and battlefields in the main deck, reserve in the sideboard', () => {
  const cards = [
    { id: 'ogn-247-298', code: 'OGN-247/298', type: 'legend', name: 'Kai’Sa' },
    { id: 'ogn-103-298', code: 'OGN-103/298', type: 'unit', name: 'Champion' },
    { id: 'ogn-030a-298', code: 'OGN-030a/298', type: 'unit', name: 'Alt art' },
    { id: 'ogn-007-298', code: 'OGN-007/298', type: 'rune', name: 'Rune' },
    { id: 'ogn-280-298', code: 'OGN-280/298', type: 'battlefield', name: 'Field' },
    { id: 'ogn-022-298', code: 'OGN-022/298', type: 'spell', name: 'Side' },
  ];
  const byId = new Map(cards.map(c => [c.id, c]));
  const byCode = new Map(cards.map(c => [formatCode(c), c]));
  const deck = {
    legendId: 'ogn-247-298', championId: 'ogn-103-298',
    cards: [
      { cardId: 'ogn-103-298', zone: 'main', quantity: 3 }, { cardId: 'ogn-030a-298', zone: 'main', quantity: 2 },
      { cardId: 'ogn-007-298', zone: 'rune', quantity: 12 }, { cardId: 'ogn-280-298', zone: 'battlefield', quantity: 1 },
      { cardId: 'ogn-022-298', zone: 'side', quantity: 2 },
    ],
  };
  const code = deckToCommunityCode(deck, (id) => byId.get(id));
  assert.deepEqual(asPairs(getDeckFromCode(code).mainDeck), [['OGN-007', 12], ['OGN-103', 3], ['OGN-030a', 2], ['OGN-247', 1], ['OGN-280', 1]]);
  const back = communityCodeToDeck(code, byCode);
  assert.deepEqual(back.unknown, []);
  assert.equal(back.deck.legendId, 'ogn-247-298');
  assert.equal(back.deck.championId, 'ogn-103-298');
  const sort = (l) => [...l].sort((x, y) => x.cardId.localeCompare(y.cardId));
  assert.deepEqual(sort(back.deck.cards), sort(deck.cards));
  // a card of the code missing from the catalog is reported, not invented
  assert.deepEqual(communityCodeToDeck(CODE_B, byCode).unknown.includes('OGN-004'), true);
  // a card the format cannot hold: said by name
  assert.throws(() => deckToCommunityCode({ cards: [{ cardId: 'x', zone: 'main', quantity: 1 }] }, () => ({ name: 'Carte maison' })), /Carte maison/);
});

test('« Copier pour l’inscription » is refused while the deck has a problem, naming it', () => {
  assert.deepEqual(registrationText({ errors: [] }, 'Legend:\n1 X'), { ok: true, text: 'Legend:\n1 X' });
  const r = registrationText({ errors: ['Called Shot est bannie en Standard.', 'Deck principal : 38 / 40 cartes minimum.'] }, '');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Called Shot est bannie en Standard. (et 1 autre problème)');
});
