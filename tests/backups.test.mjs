// Lot 3 (AMELIORATIONS-APPLI.md): never lose a friend's data — phone backups,
// sync reminder, conflicts in the history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const A = await import('../src/lib/autoBackup.js');
const { syncReminder, reminderText } = await import('../src/lib/syncReminder.js');
const { conflictSummary, conflictLine } = await import('../src/lib/syncConflicts.js');

const DAY = 24 * 60 * 60 * 1000;
const at = (d, h = 20) => new Date(2026, 10, d, h, 0, 0).getTime(); // 2026-11-<d> at <h> h, local time

/** In-memory phone: collections + backup folder. */
function phone(copies = 3) {
  const data = { copies: Array.from({ length: copies }, (_, i) => ({ id: `c${i}`, cardId: 'OGN-001', updatedAt: at(1) })), decks: [] };
  const files = new Map();
  let state = null;
  return {
    data, files,
    io: {
      loadCollections: async () => structuredClone(data),
      files: {
        list: async () => [...files].map(([name, text]) => ({ name, size: text.length })),
        write: async (name, text) => { files.set(name, text); },
        read: async (name) => { if (!files.has(name)) throw new Error('absent'); return files.get(name); },
        remove: async (name) => { files.delete(name); },
      },
      state: { get: async () => state, set: async (v) => { state = v; } },
    },
  };
}
const edit = (p, now) => { p.data.copies[0] = { ...p.data.copies[0], condition: 'Excellent', updatedAt: now }; };

test('daily backup: at most one a day, and none without a change', async () => {
  const p = phone();
  assert.ok(await A.makeAutoBackup(p.io, { now: at(17, 9) }), 'first backup');
  edit(p, at(17, 10));
  assert.equal(await A.makeAutoBackup(p.io, { now: at(17, 11) }), null, 'already one today');
  assert.equal(p.files.size, 1);
  assert.ok(await A.makeAutoBackup(p.io, { now: at(18, 9) }), 'next day, something changed');
  assert.equal(await A.makeAutoBackup(p.io, { now: at(19, 9) }), null, 'next day, nothing changed');
  assert.equal(await A.makeAutoBackup(p.io, { now: at(25, 9) }), null, 'a week later, still nothing changed');
  assert.equal(p.files.size, 2);
  const empty = phone(0);
  assert.equal(await A.makeAutoBackup(empty.io, { now: at(17), reason: 'manuelle' }), null, 'empty collection: nothing to keep');
});

test('rotation: the 10 most recent are kept', async () => {
  const p = phone();
  for (let d = 1; d <= 14; d++) {
    edit(p, at(d, 8));
    assert.ok(await A.makeAutoBackup(p.io, { now: at(d, 9) }));
  }
  const list = await A.listAutoBackups(p.io);
  assert.equal(list.length, 10);
  assert.equal(list[0].at, at(14, 9), 'most recent first');
  assert.equal(list.at(-1).at, at(5, 9), 'days 1 to 4 deleted');
  assert.equal(list[0].copies, 3);
  assert.equal(list[0].reason, 'quotidienne');
  assert.deepEqual(A.toRotate(['x.json', ...list.map(b => b.name)]), [], 'other files are never deleted');
});

test('migration, manual and restore backups are always made, even the same day', async () => {
  const p = phone();
  await A.makeAutoBackup(p.io, { now: at(17, 9) });
  const m = await A.makeAutoBackup(p.io, { now: at(17, 9) + 60000, reason: 'migration' });
  assert.ok(m, 'made the same day');
  assert.equal(p.files.size, 2);
  assert.ok(await A.makeAutoBackup(p.io, { now: at(17, 10), reason: 'manuelle' }));
  assert.deepEqual((await A.listAutoBackups(p.io)).map(b => b.reason), ['manuelle', 'migration', 'quotidienne']);
  // before an IndexedDB upgrade, the data read with the old version is passed in
  const old = { copies: [{ id: 'old', cardId: 'OGN-002', updatedAt: 5 }] };
  const b = await A.makeAutoBackup(p.io, { now: at(17, 11), reason: 'migration', collections: old });
  assert.deepEqual(A.parseBackupText(await p.io.files.read(b.name)).collections, old);
});

test('restoring an automatic backup: the current state is backed up first', async () => {
  const p = phone();
  const first = await A.makeAutoBackup(p.io, { now: at(16, 9) });
  edit(p, at(17, 8));
  p.data.copies.push({ id: 'new', cardId: 'OGN-003', updatedAt: at(17, 8) });
  let restored = null;
  const r = await A.restoreAutoBackup(p.io, first.name, async (b) => { restored = b; }, at(17, 9));
  assert.equal(r.copies, 3);
  assert.equal(restored.collections.copies.length, 3);
  assert.equal(restored.collections.copies[0].condition, undefined, 'the content of the 16th');
  const list = await A.listAutoBackups(p.io);
  assert.equal(list[0].reason, 'restauration');
  assert.equal(list[0].copies, 4, 'the state before restoring can be restored in turn');
  await assert.rejects(A.restoreAutoBackup(p.io, '../collection.json', async () => {}), /introuvable/);
  assert.throws(() => A.parseBackupText('{"app":"autre"}'), /pas une sauvegarde/);
});

test('backup names: date, reason, copies', () => {
  const name = A.backupName(at(18, 21), 'quotidienne', 137);
  assert.equal(name, 'auto-2026-11-18T21-00-00-quotidienne-137.json');
  assert.deepEqual(A.parseBackupName(name), { at: at(18, 21), reason: 'quotidienne', copies: 137 });
  assert.equal(A.parseBackupName('_etat.json'), null);
});

test('sync reminder: after the delay, closed for the same delay, never when unpaired or nothing waits', () => {
  const now = at(18);
  const base = { paired: true, pending: 23, pendingSince: now - 9 * DAY, now };
  assert.deepEqual(syncReminder(base), { count: 23, days: 9 });
  assert.equal(reminderText({ count: 23, days: 9 }), '23 changements non envoyés au PC depuis 9 jours.');
  assert.equal(reminderText({ count: 1, days: 1 }), '1 changement non envoyé au PC depuis 1 jour.');
  assert.equal(syncReminder({ ...base, pendingSince: now - 6 * DAY }), null, 'under 7 days');
  assert.deepEqual(syncReminder({ ...base, pendingSince: now - 4 * DAY, days: 3 }), { count: 23, days: 4 }, 'delay set to 3 days');
  assert.equal(syncReminder({ ...base, days: 0 }), null, 'reminder off');
  assert.equal(syncReminder({ ...base, paired: false }), null);
  assert.equal(syncReminder({ ...base, pending: 0 }), null);
  assert.equal(syncReminder({ ...base, dismissedAt: now - 2 * DAY }), null, 'closed 2 days ago');
  assert.deepEqual(syncReminder({ ...base, dismissedAt: now - 8 * DAY }), { count: 23, days: 9 }, 'comes back after the delay');
});

test('conflicts: one line in the history, with the cards’ names', () => {
  assert.equal(conflictSummary(2), '2 fiches modifiées des deux côtés : la plus récente a été gardée');
  assert.equal(conflictSummary(1), '1 fiche modifiée des deux côtés : la plus récente a été gardée');
  const names = { 'OGN-001': 'Jinx, Rebelle' };
  assert.equal(conflictLine({ collection: 'copies', id: 'c1', cardId: 'OGN-001', kept: 'phone' }, id => names[id]),
    'Jinx, Rebelle (carte) — version du téléphone gardée');
  assert.equal(conflictLine({ collection: 'decks', id: 'd1', name: 'Jinx aggro', kept: 'pc', deleted: true }),
    'Jinx aggro (deck, supprimé) — version du PC gardée');
});

// ─── CORRECTIONS-v3 D: weekly copy in Documents/Riftbound ─────────────────
test('weekly copy: only when the data changed, at most once a week, 3 kept, opponents notes left out', async () => {
  const A = await import('../src/lib/autoBackup.js');
  const DAY = 86400000;
  const docs = new Map();
  let state = null;
  let data = {
    copies: [{ id: 'c1', updatedAt: 1 }],
    decks: [{ id: 'd1', name: 'Jinx', updatedAt: 1, opponents: { 'ogn-247-298': { note: 'Paul joue toujours Kai’Sa', out: [], in: [] } } }],
  };
  const io = {
    loadCollections: async () => data,
    public: { list: async () => [...docs.keys(), 'autre-fichier.txt'], write: async (n, t) => { docs.set(n, t); return `Documents/Riftbound/${n}`; }, remove: async (n) => docs.delete(n) },
    publicState: { get: async () => state, set: async (v) => { state = v; } },
  };
  const t0 = Date.parse('2026-11-20T10:00:00');
  const first = await A.makePublicCopy(io, { now: t0 });
  assert.match(first.name, /^riftbound-copie-2026-11-20T10-00-00-1\.json$/);
  assert.equal(first.where, `Documents/Riftbound/${first.name}`);
  const text = docs.get(first.name);
  assert.ok(!text.includes('opponents') && !text.includes('Paul'), 'notes on opponents left out');
  assert.equal(JSON.parse(text).collections.decks[0].name, 'Jinx', 'the deck itself is kept');
  assert.equal(A.parseBackupText(text).copies, 1, 'a normal backup file, restorable');
  assert.equal(await A.makePublicCopy(io, { now: t0 + 8 * DAY }), null, 'nothing changed: no copy');
  data = { ...data, copies: [...data.copies, { id: 'c2', updatedAt: 2 }] };
  assert.equal(await A.makePublicCopy(io, { now: t0 + 3 * DAY }), null, 'changed, but less than a week');
  for (let w = 1; w <= 4; w++) {
    data = { ...data, copies: [...data.copies, { id: `w${w}`, updatedAt: 10 + w }] };
    assert.ok((await A.makePublicCopy(io, { now: t0 + w * 7 * DAY })).name);
  }
  assert.equal(docs.size, 3, 'the 3 most recent kept');
  assert.ok(!docs.has(first.name), 'the oldest removed');
});

test('weekly copy: a failed write is reported (never silent) and tried again later', async () => {
  const A = await import('../src/lib/autoBackup.js');
  let state = null;
  const io = {
    loadCollections: async () => ({ copies: [{ id: 'c1', updatedAt: 1 }] }),
    public: { list: async () => [], write: async () => { throw new Error('Impossible d’écrire le fichier sur le téléphone.'); }, remove: async () => {} },
    publicState: { get: async () => state, set: async (v) => { state = v; } },
  };
  const t0 = Date.parse('2026-11-20T10:00:00');
  const r = await A.makePublicCopy(io, { now: t0 });
  assert.deepEqual(r, { error: 'Impossible d’écrire le fichier sur le téléphone.' });
  assert.equal(state.error, 'Impossible d’écrire le fichier sur le téléphone.');
  assert.equal(A.shouldPublicCopy({ now: t0 + 3600000, last: state, stamp: '1:1' }), false, 'not again within the day');
  assert.equal(A.shouldPublicCopy({ now: t0 + 86400000, last: state, stamp: '1:1' }), true, 'tried again the next day');
});
