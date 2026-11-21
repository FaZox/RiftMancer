// Lot 6 e and i: global search, keyboard shortcuts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const G = await import('../src/lib/globalSearch.js');
const { keyToAction, isTyping, SHORTCUTS } = await import('../src/lib/shortcuts.js');
const N = await import('../src/lib/navRequest.js');

const cards = [
  { id: 'ogn-030-298', name: 'Jinx', nameEn: 'Jinx - Demolitionist', nameFr: 'Jinx - Démolisseuse', code: 'OGN-030/298' },
  { id: 'ogn-030a-298', name: 'Jinx', nameEn: 'Jinx - Demolitionist', nameFr: 'Jinx - Démolisseuse', code: 'OGN-030a/298' },
  { id: 'ogn-202-298', name: 'Jinx', nameEn: 'Jinx - Rebel', nameFr: 'Jinx - Rebelle', code: 'OGN-202/298' },
  { id: 'ogn-171-298', name: 'Mystic Poro', nameFr: 'Poro mystique', code: 'OGN-171/298' },
];
const data = {
  cards, owned: new Map([['ogn-030-298', 2], ['ogn-030a-298', 1]]),
  decks: [{ id: 'd1', name: 'Jinx Aggro', cards: [{ quantity: 3 }, { quantity: 37 }] }, { id: 'd2', name: 'Old', deleted: true }],
  boxes: [{ id: 'b1', name: 'Boîte des doubles' }], people: [{ id: 'p1', name: 'Élodie' }],
  settings: [{ id: 'sync', label: 'Synchronisation', keywords: G.SETTINGS_KEYWORDS.sync }],
};

test('owned cards by default, prints grouped, « ×3 possédées »; decks, boxes, people too', () => {
  const r = G.searchAll('jinx', data);
  assert.deepEqual(r.map(g => g.label), ['Cartes', 'Decks']);
  assert.deepEqual(r[0].items, [{ type: 'card', id: 'ogn-030-298', cardId: 'ogn-030-298', label: 'Jinx - Démolisseuse', detail: '×3 possédées' }]);
  assert.equal(r[1].items[0].detail, '40 cartes');
  const all = G.searchAll('jinx', data, { allCards: true })[0].items;
  assert.deepEqual(all.map(i => [i.label, i.detail]), [['Jinx - Démolisseuse', '×3 possédées'], ['Jinx - Rebelle', 'non possédée']], 'owned first');
});

test('accents and case ignored; codes; settings by keyword; nothing → empty', () => {
  assert.equal(G.searchAll('elodie', data)[0].items[0].label, 'Élodie');
  assert.equal(G.searchAll('DOUBLES', data)[0].items[0].type, 'box');
  assert.equal(G.searchAll('ogn-171', data, { allCards: true })[0].items[0].label, 'Poro mystique');
  assert.deepEqual(G.searchAll('qr code', data).map(g => g.group), ['settings']);
  assert.deepEqual(G.searchAll('zzz', data), []);
  assert.deepEqual(G.searchAll('   ', data), []);
  assert.equal(G.searchAll('old', data).length, 0, 'deleted deck not found');
});

test('last five searches, most recent first, no double', () => {
  const store = new Map();
  const st = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  for (const q of ['jinx', 'poro', 'Jinx', 'a', 'ahri', 'yasuo', 'teemo', 'lux']) G.rememberSearch(q, st);
  assert.deepEqual(G.recentSearches(st), ['lux', 'teemo', 'yasuo', 'ahri', 'Jinx']);
});

test('PC shortcuts: Ctrl+K, Ctrl+N, Ctrl+1…8, Ctrl+, and « ? » (not while typing)', () => {
  const k = (key, o = {}) => keyToAction({ key, ctrlKey: false, metaKey: false, altKey: false, ...o });
  assert.deepEqual(k('k', { ctrlKey: true }), { search: true });
  assert.deepEqual(k('n', { ctrlKey: true }), { add: true });
  assert.deepEqual(k('1', { ctrlKey: true }), { page: 'collection' });
  assert.deepEqual(k('5', { ctrlKey: true }), { page: 'scan' });
  assert.deepEqual(k(',', { ctrlKey: true }), { page: 'settings' });
  assert.deepEqual(k('?'), { help: true });
  assert.equal(keyToAction({ key: '?' }, true), null, 'a « ? » typed in a field stays a character');
  assert.equal(k('k'), null);
  assert.equal(isTyping({ tagName: 'INPUT' }), true);
  assert.ok(SHORTCUTS.length >= 12);
});

test('« open this deck »: taken once by the page that shows it', () => {
  const seen = [];
  const off = N.onRequest((r) => seen.push(r.kind));
  N.requestOpen({ kind: 'deck', id: 'd1' });
  assert.equal(N.peekRequest().id, 'd1');
  assert.equal(N.takeRequest('box'), null);
  assert.equal(N.takeRequest('deck').id, 'd1');
  assert.equal(N.takeRequest('deck'), null);
  assert.deepEqual(seen, ['deck']);
  off();
});
