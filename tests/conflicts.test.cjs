/* Lot 3.3 and 3.4: extra backup folder on the PC, conflicts noted at sync. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../electron/store.cjs');
const { copyToExtra, extraStatus, listBackups, listBackupsWithCopies, validExtraDir } = require('../electron/backups.cjs');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const rec = (id, updatedAt, extra = {}) => ({ id, cardId: 'OGN-001', updatedAt, deleted: false, ...extra });

test('conflict: modified on the PC and on the phone since the last sync → noted, most recent kept', () => {
  const store = new Store(path.join(tmp('rb-conf-'), 'collection.sqlite'));
  store.putLocal('copies', [rec('a', 100), rec('b', 100), rec('c', 100)]);
  const since = store.seq; // the phone received everything up to here
  store.putLocal('copies', [rec('a', 200, { condition: 'Good' }), rec('b', 300, { condition: 'Good' }), rec('c', 200, { foil: true })]);
  const m = store.merge('copies', [
    rec('a', 250, { condition: 'Excellent' }), // both changed, phone more recent
    rec('b', 250, { condition: 'Played' }),    // both changed, PC more recent
    rec('c', 260, { foil: true }),             // same change on both sides: no conflict
    rec('d', 260),                             // new on the phone
  ], 'phone1', since);
  assert.deepEqual(m.conflicts, [
    { collection: 'copies', id: 'a', cardId: 'OGN-001', name: null, deleted: false, kept: 'phone' },
    { collection: 'copies', id: 'b', cardId: 'OGN-001', name: null, deleted: false, kept: 'pc' },
  ]);
  assert.equal(store.load('copies').find(r => r.id === 'a').condition, 'Excellent');
  assert.equal(store.load('copies').find(r => r.id === 'b').condition, 'Good');
});

test('no conflict for a record only the phone changed, nor at the first sync', () => {
  const store = new Store(path.join(tmp('rb-conf-'), 'collection.sqlite'));
  store.putLocal('decks', [{ id: 'd', name: 'Jinx', updatedAt: 100 }]);
  const since = store.seq;
  assert.deepEqual(store.merge('decks', [{ id: 'd', name: 'Jinx 2', updatedAt: 200 }], 'phone1', since).conflicts, []);
  // its own earlier push is not a change « on the PC side »
  assert.deepEqual(store.merge('decks', [{ id: 'd', name: 'Jinx 3', updatedAt: 300 }], 'phone1', since).conflicts, []);
  // a second phone's change counts as the other side
  store.merge('decks', [{ id: 'd', name: 'Autre', updatedAt: 400 }], 'phone2', 0);
  const m = store.merge('decks', [{ id: 'd', name: 'Jinx 4', updatedAt: 350 }], 'phone1', since);
  assert.deepEqual(m.conflicts, [{ collection: 'decks', id: 'd', cardId: null, name: 'Autre', deleted: false, kept: 'pc' }]);
  // first sync (since 0, e.g. after pairing): everything is sent again, not conflicts
  assert.deepEqual(store.merge('decks', [{ id: 'd', name: 'X', updatedAt: 500 }], 'phone3', 0).conflicts, []);
});

test('extra backup folder: copy and rotation; missing folder reported without failing', () => {
  const store = new Store(path.join(tmp('rb-extra-'), 'collection.sqlite'));
  store.putLocal('copies', [rec('a', 1), rec('b', 1)]);
  const backups = tmp('rb-bk-'), extra = tmp('rb-usb-');
  const file = store.backup(backups);
  assert.deepEqual(extraStatus(extra), { dir: extra, ok: true });
  assert.deepEqual(copyToExtra(file, extra), { ok: true });
  assert.deepEqual(listBackups(extra).map(b => b.name), [path.basename(file)]);
  assert.equal(listBackupsWithCopies(backups)[0].copies, 2);
  // rotation in the extra folder
  for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(extra, `collection-2020-01-0${i + 1}T00-00-00.sqlite`), 'x');
  for (const [i, n] of [[1, 1], [2, 2], [3, 3], [4, 4]]) fs.utimesSync(path.join(extra, `collection-2020-01-0${i}T00-00-00.sqlite`), n, n);
  copyToExtra(file, extra, 3);
  assert.equal(listBackups(extra).length, 3);
  // USB key removed
  const gone = path.join(extra, 'retiree');
  assert.deepEqual(extraStatus(gone), { dir: gone, ok: false });
  assert.deepEqual(copyToExtra(file, gone), { ok: false });
  assert.equal(extraStatus(null), null);
  // never the backups folder itself
  assert.equal(validExtraDir(backups, backups), false);
  assert.equal(validExtraDir(path.join(backups, 'sous'), backups), false);
  assert.equal(validExtraDir(extra, backups), true);
  assert.equal(validExtraDir('relatif', backups), false);
});
