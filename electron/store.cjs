/**
 * PC data store (SQLite, built into Electron's Node — no native module).
 *
 * Generic table for every synced collection ("copies" today; boxes, decks,
 * loans later). Each write gets a new, increasing `seq`, so a phone can ask
 * "what changed since seq N" (incremental sync). `origin` remembers which
 * device wrote the row, so a phone isn't sent back its own changes.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const MAX_BACKUPS = 30;

class Store {
  constructor(file) {
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        seq INTEGER NOT NULL,
        origin TEXT,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS records_seq ON records (seq);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    this.q = {
      load: this.db.prepare('SELECT data FROM records WHERE collection = ? AND deleted = 0'),
      get: this.db.prepare('SELECT updatedAt, seq, origin, data FROM records WHERE collection = ? AND id = ?'),
      upsert: this.db.prepare(`
        INSERT INTO records (collection, id, data, updatedAt, deleted, seq, origin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (collection, id) DO UPDATE SET
          data = excluded.data, updatedAt = excluded.updatedAt, deleted = excluded.deleted,
          seq = excluded.seq, origin = excluded.origin`),
      maxSeq: this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM records'),
      since: this.db.prepare(`
        SELECT data FROM records
        WHERE collection = ? AND seq > ? AND NOT (origin = ? AND seq > ?)`),
      count: this.db.prepare('SELECT COUNT(*) AS n FROM records WHERE collection = ? AND deleted = 0'),
      getMeta: this.db.prepare('SELECT value FROM meta WHERE key = ?'),
      setMeta: this.db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`),
    };
    this.seq = this.q.maxSeq.get().s;
  }

  getMeta(key, fallback = null) {
    const row = this.q.getMeta.get(key);
    return row ? JSON.parse(row.value) : fallback;
  }

  setMeta(key, value) {
    this.q.setMeta.run(key, JSON.stringify(value));
  }

  /** Stable identity of this PC + the secret phones must present. */
  identity() {
    let id = this.getMeta('pcId');
    if (!id) { id = crypto.randomUUID(); this.setMeta('pcId', id); }
    let token = this.getMeta('token');
    if (!token) { token = crypto.randomBytes(16).toString('hex'); this.setMeta('token', token); }
    return { pcId: id, token };
  }

  regenerateToken() {
    const token = crypto.randomBytes(16).toString('hex');
    this.setMeta('token', token);
    return token;
  }

  load(collection) {
    return this.q.load.all(collection).map(r => JSON.parse(r.data));
  }

  count(collection) {
    return this.q.count.get(collection).n;
  }

  _write(collection, rec, origin) {
    this.seq += 1;
    this.q.upsert.run(collection, rec.id, JSON.stringify(rec), rec.updatedAt, rec.deleted ? 1 : 0, this.seq, origin);
  }

  _tx(fn) {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Edits made in the PC app itself: always written. */
  putLocal(collection, records) {
    this._tx(() => { for (const r of records) if (isValid(r)) this._write(collection, r, 'pc'); });
  }

  /**
   * Records pushed by a phone: "most recent change wins" (updatedAt).
   * Returns { changed, seqBefore, conflicts } — seqBefore lets the caller
   * exclude these rows from what it sends back to the same phone.
   * `since`: the last PC position this phone received. A pushed record whose
   * PC version was changed after it, by the PC or another phone, and differs,
   * was modified on both sides: it is noted in `conflicts` (lot 3.4), with the
   * side whose version was kept ('phone' or 'pc').
   */
  merge(collection, records, origin, since = 0) {
    const seqBefore = this.seq;
    let changed = 0;
    const conflicts = [];
    this._tx(() => {
      for (const r of records) {
        if (!isValid(r)) continue;
        const cur = this.q.get.get(collection, r.id);
        if (cur && since > 0 && cur.seq > since && cur.origin !== origin) {
          const pc = JSON.parse(cur.data);
          if (!sameContent(pc, r)) {
            const kept = r.updatedAt > cur.updatedAt ? 'phone' : 'pc';
            const rec = kept === 'phone' ? r : pc;
            conflicts.push({ collection, id: r.id, cardId: rec.cardId || null, name: rec.name || null, deleted: !!rec.deleted, kept });
          }
        }
        if (!cur || r.updatedAt > cur.updatedAt) {
          this._write(collection, r, origin);
          changed++;
        }
      }
    });
    return { changed, seqBefore, conflicts };
  }

  /** Rows changed after `since`, except the ones this device just pushed. */
  changesSince(collection, since, origin, pushedAfterSeq) {
    return this.q.since.all(collection, since, origin, pushedAfterSeq).map(r => JSON.parse(r.data));
  }

  /** Copy of the database file in `dir` (keeps the most recent MAX_BACKUPS). */
  backup(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.join(dir, `collection-${stamp}.sqlite`);
    this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(dir).filter(f => f.startsWith('collection-') && f.endsWith('.sqlite')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      fs.rmSync(path.join(dir, f), { force: true });
    }
    return target;
  }
}

/**
 * Restore the records of a backup file. Instead of swapping the database
 * file, every record of the backup is written again with a new `updatedAt`
 * (and records missing from the backup are deleted), so the phone receives
 * the restored state at its next sync like any other change.
 * Returns the number of live records restored.
 */
Store.prototype.restoreFrom = function restoreFrom(file) {
  const src = new DatabaseSync(file, { readOnly: true });
  let rows;
  try {
    rows = src.prepare('SELECT collection, data, deleted FROM records').all();
  } finally {
    src.close();
  }
  const keep = new Map();
  for (const r of rows) {
    if (r.deleted) continue;
    const rec = JSON.parse(r.data);
    if (!keep.has(r.collection)) keep.set(r.collection, new Map());
    keep.get(r.collection).set(rec.id, rec);
  }
  const cols = new Set([...keep.keys(), ...this.db.prepare('SELECT DISTINCT collection FROM records').all().map(r => r.collection)]);
  const now = Date.now();
  let restored = 0;
  for (const col of cols) {
    const want = keep.get(col) || new Map();
    const out = [];
    for (const rec of want.values()) out.push({ ...rec, deleted: false, updatedAt: now });
    for (const cur of this.load(col)) if (!want.has(cur.id)) out.push({ ...cur, deleted: true, updatedAt: now });
    this.putLocal(col, out);
    restored += want.size;
  }
  return restored;
};

/** Same record apart from its dates (a change made identically on both sides is no conflict). */
function sameContent(a, b) {
  const strip = (r) => JSON.stringify(Object.keys(r || {}).filter(k => k !== 'updatedAt' && k !== 'dirty').sort().map(k => [k, r[k]]));
  return strip(a) === strip(b);
}

function isValid(r) {
  return r && typeof r.id === 'string' && r.id.length > 0 && r.id.length < 100
    && Number.isFinite(r.updatedAt);
}

module.exports = { Store };
