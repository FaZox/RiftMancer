// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
// Lot 1.3 (AMELIORATIONS-APPLI.md): Cardmarket condition scale — migration of
// a demo collection, and CSV round trips without loss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers.mjs';

await loadCatalog();
const { CONDITIONS, LEGACY_TO_CM, migrateCopies, toCardmarket, usCondition, parseCondition, conditionShort } = await import('../src/lib/conditions.js');
const { parseCollectionCsv } = await import('../src/lib/csvImport.js');
const { default: cardnexus } = await import('../src/lib/exporters/cardnexus.js');
const { makeCopy } = await import('../src/lib/collectionDB.js');
const { CM_CONDITIONS } = await import('../src/lib/uiPrefs.js');
const { getMatcher } = await import('../src/lib/cardMatcher.js');

const T0 = 1_700_000_000_000;
const NOW = T0 + 1000;

// A demo collection as saved before lot 1.3: every old condition, plus edge cases.
const demo = [
  { id: 'a', cardId: 'ogn-030-298', condition: 'Near Mint', updatedAt: T0 },
  { id: 'b', cardId: 'ogn-030-298', condition: 'Lightly Played', updatedAt: T0, paid: 2 },
  { id: 'c', cardId: 'ogn-007-298', condition: 'Moderately Played', updatedAt: T0 },
  { id: 'd', cardId: 'ogn-007-298', condition: 'Heavily Played', updatedAt: T0 },
  { id: 'e', cardId: 'ogn-007-298', condition: 'Damaged', updatedAt: T0 },
  { id: 'f', cardId: 'ogn-007-298', condition: undefined, updatedAt: T0 },
  { id: 'g', cardId: 'ogn-007-298', condition: 'Excellent', updatedAt: T0 }, // already migrated (synced)
  { id: 'h', cardId: 'ogn-007-298', condition: 'Damaged', updatedAt: T0, deleted: true },
];

test('migration of a demo collection: the user\'s table, old value kept, synced as an edit', () => {
  const changed = migrateCopies(demo, NOW);
  const byId = Object.fromEntries(changed.map(c => [c.id, c]));
  assert.deepEqual(Object.keys(byId).sort(), ['b', 'c', 'd', 'e', 'f']); // NM, Excellent and deleted untouched
  assert.deepEqual(['b', 'c', 'd', 'e', 'f'].map(id => byId[id].condition), ['Excellent', 'Good', 'Played', 'Poor', 'Near Mint']);
  assert.deepEqual(['b', 'c', 'd', 'e', 'f'].map(id => byId[id].conditionOld), ['Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged', null]);
  assert.ok(changed.every(c => c.updatedAt === NOW)); // newer → the sync carries it
  assert.equal(byId.b.paid, 2); // nothing else changes
  // Applying it twice changes nothing more
  const after = demo.map(c => byId[c.id] || c);
  assert.deepEqual(migrateCopies(after, NOW + 1), []);
});

test('the table validated by the user', () => {
  assert.deepEqual(LEGACY_TO_CM, { 'Lightly Played': 'Excellent', 'Moderately Played': 'Good', 'Heavily Played': 'Played', Damaged: 'Poor' });
  assert.equal(toCardmarket('Near Mint'), 'Near Mint');
  assert.equal(makeCopy({ cardId: 'x', condition: 'Heavily Played' }).condition, 'Played');
  assert.equal(conditionShort('Moderately Played'), 'GD');
  assert.deepEqual(CONDITIONS.map(c => c.short), ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO']);
});

test('CardNexus CSV keeps its American scale, and a migrated copy goes back to exactly its old condition', () => {
  for (const [us, cm] of Object.entries(LEGACY_TO_CM)) assert.equal(usCondition(cm), us);
  assert.equal(usCondition('Near Mint'), 'Near Mint');
  assert.equal(usCondition('Mint'), 'Near Mint');
});

test('CSV round trip without loss (CardNexus export → import)', () => {
  const m = getMatcher();
  const conds = ['Near Mint', 'Excellent', 'Good', 'Played', 'Poor'];
  const stacks = conds.map((condition, i) => ({ cardData: m.getCardData(['ogn-030-298', 'ogn-007-298', 'ogn-001-298', 'ogn-013-298', 'ogn-024-298'][i]), quantity: i + 1, language: 'French', foil: false, promo: false, condition }));
  const csv = cardnexus.generate(stacks);
  assert.match(csv, /Lightly Played/); // CardNexus's own scale in the file
  const { entries, unknown } = parseCollectionCsv(csv);
  assert.deepEqual(unknown, []);
  assert.deepEqual(entries.map(e => [e.cardId, e.quantity, e.condition]), stacks.map(s => [s.cardData.id, s.quantity, s.condition]));
});

test('imported files: both scales, French labels, abbreviations', () => {
  assert.equal(parseCondition('Lightly Played'), 'Excellent');
  assert.equal(parseCondition('Moderately Played'), 'Good');
  assert.equal(parseCondition('MP'), 'Good');
  assert.equal(parseCondition('LP'), 'Light Played'); // Cardmarket's abbreviation
  assert.equal(parseCondition('Light Played'), 'Light Played');
  assert.equal(parseCondition('Quasi neuve (NM)'), 'Near Mint');
  assert.equal(parseCondition('ex'), 'Excellent');
  assert.equal(parseCondition('Poor'), 'Poor');
  assert.equal(parseCondition(''), null);
  assert.equal(parseCondition('???'), null);
});

test('« minimum condition » of the Cardmarket links uses the same scale and labels', () => {
  assert.deepEqual(CM_CONDITIONS.map(([id]) => id), ['', '1', '2', '3', '4', '5', '6']);
  assert.equal(CM_CONDITIONS[4][1], 'Bonne (GD)');
});
