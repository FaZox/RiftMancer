/* PC database (SQLite): sync merge, incremental pull, backup restore, price history. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../electron/store.cjs');
const { updateHistory } = require('../electron/prices.cjs');

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-test-'));
  return { dir, store: new Store(path.join(dir, 'collection.sqlite')) };
}
const rec = (id, updatedAt, extra = {}) => ({ id, cardId: 'ogn-001-298', updatedAt, deleted: false, ...extra });

test('most recent change wins, and a phone does not get its own changes back', () => {
  const { store } = tmpStore();
  store.putLocal('copies', [rec('a', 100), rec('b', 100)]);
  const m = store.merge('copies', [rec('a', 50, { language: 'old' }), rec('b', 200, { language: 'new' }), rec('c', 200)], 'phone');
  assert.equal(m.changed, 2); // b (newer) and c (new); a is older than the PC's
  const byId = Object.fromEntries(store.load('copies').map(r => [r.id, r]));
  assert.equal(byId.a.language, undefined);
  assert.equal(byId.b.language, 'new');
  const pull = store.changesSince('copies', 0, 'phone', m.seqBefore);
  assert.deepEqual(pull.map(r => r.id).sort(), ['a']); // b, c came from this phone
});

test('deletions travel as tombstones', () => {
  const { store } = tmpStore();
  store.putLocal('copies', [rec('a', 100)]);
  const seq = store.seq;
  store.merge('copies', [rec('a', 300, { deleted: true })], 'phone');
  assert.equal(store.count('copies'), 0);
  const pull = store.changesSince('copies', seq, 'other-phone', store.seq);
  assert.equal(pull[0].deleted, true);
});

test('restoring a backup brings back its records and deletes newer ones, with fresh dates', () => {
  const { dir, store } = tmpStore();
  store.putLocal('copies', [rec('a', 100), rec('b', 100)]);
  store.putLocal('decks', [{ id: 'd1', name: 'Deck', updatedAt: 100 }]);
  const file = store.backup(path.join(dir, 'backups'));
  store.putLocal('copies', [rec('a', 500, { deleted: true }), rec('z', 500)]);
  store.putLocal('decks', [{ id: 'd1', name: 'Renamed', updatedAt: 500 }]);
  const before = Date.now();
  const n = store.restoreFrom(file);
  assert.equal(n, 3);
  assert.deepEqual(store.load('copies').map(r => r.id).sort(), ['a', 'b']);
  assert.equal(store.load('decks')[0].name, 'Deck');
  assert.ok(store.load('copies').every(r => r.updatedAt >= before)); // the phone will take them
});

test('price history keeps one column per day for 31 days, then one a week', () => {
  let h = null;
  for (let d = 1; d <= 40; d++) {
    const day = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);
    h = updateHistory(h, day, d === 20 ? { x: [1, null, 1] } : { x: [d, null, 1], y: [2, 3, 2] });
  }
  const last31 = h.days.slice(-31);
  assert.equal(last31[0], '2026-01-10'); // the last month, every day
  assert.deepEqual(h.days.slice(0, -31), ['2026-01-07', '2026-01-09']); // before: the latest day of each week (weeks from Thursday)
  assert.equal(h.cards.x.length, h.days.length);
  assert.equal(h.cards.y.length, h.days.length);
  assert.equal(h.cards.x.at(-1), 40);
  assert.equal(h.cards.x[0], 7);
  // same day twice → the column is replaced, not added
  const again = updateHistory(h, h.days.at(-1), { x: [99, null, 1] });
  assert.equal(again.days.length, h.days.length);
  assert.equal(again.cards.x.at(-1), 99);
});
