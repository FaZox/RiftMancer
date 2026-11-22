// Printing remembered per artwork (src/lib/printingChoice.js).
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__BUILD_TIME__ = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { rememberedPrinting, rememberPrinting, printingsOf, groupKey, resetPrintingChoice } = await import('../src/lib/printingChoice.js');

const runes = [{ id: 'ogn-042-298' }, { id: 'rad-r02' }, { id: 'ven-r02' }];

test('nothing remembered at first; a choice is kept per artwork, on the device', () => {
  resetPrintingChoice();
  assert.equal(rememberedPrinting(runes), null);
  rememberPrinting(runes, 'rad-r02');
  assert.equal(rememberedPrinting(runes).id, 'rad-r02');
  // same artwork, printings listed in another order: same memory
  assert.equal(rememberedPrinting([...runes].reverse()).id, 'rad-r02');
  assert.match(store.get('rb.printingChoice'), /rad-r02/);
  assert.equal(groupKey(runes), 'ogn-042-298|rad-r02|ven-r02');
});

test('a card of another artwork, or a single printing, is never remembered', () => {
  resetPrintingChoice();
  rememberPrinting(runes, 'ogn-001-298');
  assert.equal(rememberedPrinting(runes), null);
  rememberPrinting([{ id: 'ogn-001-298' }], 'ogn-001-298');
  assert.equal(rememberedPrinting([{ id: 'ogn-001-298' }]), null);
});

test('printings of a card: the catalog cards sharing its artwork', () => {
  const cards = [{ id: 'ogn-042-298', artGroup: 'g' }, { id: 'rad-r02', artGroup: 'g' }, { id: 'ogn-001-298' }];
  const matcher = { cards, getCard: (id) => cards.find(c => c.id === id), getCardData: (id) => ({ id, set: id.slice(0, 3).toUpperCase() }) };
  assert.deepEqual(printingsOf('rad-r02', matcher).map(c => c.id), ['ogn-042-298', 'rad-r02']);
  assert.deepEqual(printingsOf('ogn-001-298', matcher), []);
});
