/**
 * Collection storage — one record per physical card copy.
 *
 * A copy only stores the card id and what is specific to that physical card
 * (language, finish, condition…). Card metadata (name, text, set…) comes from
 * the card catalog (cardMatcher.getCardData), so it is never duplicated.
 *
 * Every record carries `updatedAt` and a `deleted` tombstone: the phone ↔ PC
 * sync merges records with "most recent change wins". Nothing is ever
 * hard-deleted by the UI.
 *
 * Two backends, same API:
 *   - PC app (Electron): SQLite in the main process, reached over IPC
 *     (window.riftboundDesktop). The PC is the sync hub.
 *   - Phone / browser: IndexedDB. Local edits are flagged `dirty` until the
 *     sync has pushed them to the PC.
 *
 * Copy shape:
 *   { id, cardId, language, foil, promo, condition (Cardmarket scale, conditions.js),
 *     conditionOld (American condition before the lot 1.3 migration, if any),
 *     boxId, deckId, loanId,            // future: storage / decks / loans
 *     binderPage, binderSlot, binderCols // page and pocket in a binder box (binder.js), optional
 *     createdAt, updatedAt, deleted }
 */

import { openDB } from 'idb';
import { toCardmarket } from './conditions.js';

const DB_NAME = 'riftbound-collection';
const DB_VERSION = 7;
const COPIES = 'copies';
const META = 'meta';
const WISHLIST = 'wishlist';
// Phase 4 — organisation:
//   boxes   { id, name, note }
//   decks   { id, name, legendId, championId, cards: [{ cardId, quantity, zone }], note }
//           zone: 'main' | 'rune' | 'battlefield' (legend/champion are fields)
//   people  { id, name, note }
//   loans   { id, personId, deckId?, startedAt, returnedAt, cardIds: [...], note }
//   trades  { id, personId, date, given: [{ cardId, quantity }], received: [...],
//             valueGiven, valueReceived, applied, note }
// (+ createdAt, updatedAt, deleted on every record)
const ORGANISATION = ['boxes', 'decks', 'people', 'loans'];
const TRADES = 'trades';
// Lot 4 — played games:
//   matches { id, date, eventId?, eventName?, round?, deckId, myLegendId, oppLegendId,
//             oppName?, wentFirst, result: 'win'|'loss'|'draw',
//             games: [{ result, wentFirst, myScore, oppScore }], format: 'bo1'|'bo3', notes }
const MATCHES = 'matches';
// Scanner examples learned from the user's corrections (learning.js):
//   learned { id, cardId, f (base64 fingerprint) }
const LEARNED = 'learned';
const LEGACY_STORAGE_KEY = 'riftbound_scanned_cards';

/** Collections synced between devices (future: boxes, decks, loans, people). */
export const SYNCED_COLLECTIONS = [COPIES, WISHLIST, ...ORGANISATION, TRADES, MATCHES, LEARNED];

const desktop = typeof window !== 'undefined' ? window.riftboundDesktop : undefined;
export const isDesktop = !!desktop;

// ─── Change notifications (sync wrote new data → UI reloads) ──────────────
const listeners = new Set();
export function onExternalChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
/** Ask every open view to reload its data (e.g. after loading demo data). */
export function reloadAllViews() {
  emitExternalChange();
}
function emitExternalChange() {
  for (const cb of listeners) {
    try { cb(); } catch (err) { console.error(err); }
  }
}
if (desktop) desktop.onDataChanged(emitExternalChange);

// ─── IndexedDB (phone / browser) ─────────────────────────────────────────
let dbPromise = null;

/**
 * Lot 3.1: before the database is upgraded to a new version, one backup of
 * its content as it was (read with the old version). Never blocks the opening.
 */
async function backupBeforeUpgrade() {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return;
  try {
    const v = (await indexedDB.databases()).find(d => d.name === DB_NAME)?.version || 0;
    if (!v || v >= DB_VERSION) return;
    const old = await openDB(DB_NAME, v);
    const collections = {};
    for (const col of SYNCED_COLLECTIONS) {
      if (old.objectStoreNames.contains(col)) collections[col] = (await old.getAll(col)).filter(r => !r.deleted).map(clean);
    }
    old.close();
    const [{ makeAutoBackup }, { backupFiles, backupState }] = await Promise.all([import('./autoBackup.js'), import('./backupFiles.js')]);
    await makeAutoBackup({ files: backupFiles, state: backupState }, { reason: 'migration', collections });
  } catch (err) {
    console.warn('[backup] before the database upgrade:', err);
  }
}

function getDB() {
  if (!dbPromise) {
    dbPromise = backupBeforeUpgrade().then(() => openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(COPIES, { keyPath: 'id' });
          store.createIndex('by_card', 'cardId');
          store.createIndex('by_updated', 'updatedAt');
        }
        if (oldVersion < 2) {
          // `dirty` is 1 for local changes not yet pushed to the PC (0 otherwise).
          tx.objectStore(COPIES).createIndex('by_dirty', 'dirty');
          db.createObjectStore(META);
        }
        if (oldVersion < 3) {
          // Wish list: { id: 'wish:<cardId>', cardId, quantity, createdAt, updatedAt, deleted }
          // The id is derived from the card so both devices update the same record.
          const w = db.createObjectStore(WISHLIST, { keyPath: 'id' });
          w.createIndex('by_dirty', 'dirty');
        }
        if (oldVersion < 4) {
          for (const name of ORGANISATION) {
            db.createObjectStore(name, { keyPath: 'id' }).createIndex('by_dirty', 'dirty');
          }
        }
        if (oldVersion < 5) {
          db.createObjectStore(TRADES, { keyPath: 'id' }).createIndex('by_dirty', 'dirty');
        }
        if (oldVersion < 6) {
          db.createObjectStore(MATCHES, { keyPath: 'id' }).createIndex('by_dirty', 'dirty');
        }
        if (oldVersion < 7) {
          db.createObjectStore(LEARNED, { keyPath: 'id' }).createIndex('by_dirty', 'dirty');
        }
      },
      // Another tab (browser version) runs a newer app and needs to upgrade
      // the database: release it instead of blocking that tab, then reload.
      blocking(_cur, _next, event) {
        event.target.close();
        dbPromise = null;
        if (typeof location !== 'undefined') location.reload();
      },
    }));
  }
  return dbPromise;
}

/** Strip local-only fields before handing a record to the UI or the sync. */
function clean(rec) {
  const { dirty, ...rest } = rec;
  return rest;
}

/** RFC 4122 v4 id. crypto.randomUUID is missing on insecure origins (LAN IP over http). */
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Build a new copy record. */
export function makeCopy({ cardId, language, foil, promo, condition, boxId, deckId, loanId, paid, paidAt, binderPage, binderSlot, binderCols }, now = Date.now()) {
  return {
    id: newId(),
    cardId,
    language: language || 'English',
    foil: !!foil,
    promo: !!promo,
    condition: toCardmarket(condition),
    boxId: boxId || null,
    deckId: deckId || null,
    loanId: loanId || null,
    paid: paid > 0 ? paid : null, // purchase price of this copy (€), optional
    paidAt: /^\d{4}-\d{2}-\d{2}$/.test(paidAt || '') ? paidAt : null, // purchase date (YYYY-MM-DD), optional
    // page and pocket in a binder (binder.js), only in a box
    ...(boxId && binderPage > 0 ? { binderPage, binderSlot: binderSlot > 0 ? binderSlot : null, binderCols: binderCols > 0 ? binderCols : null } : {}),
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
}

/** All live (not deleted) records of a synced collection. */
export async function loadRecords(collection) {
  if (desktop) return desktop.db.load(collection);
  const db = await getDB();
  const all = await db.getAll(collection);
  return all.filter(c => !c.deleted).map(clean);
}

/** Insert or replace records changed by the user (only those records are written). */
export async function putRecords(collection, records) {
  if (records.length === 0) return;
  if (desktop) return desktop.db.put(collection, records);
  const db = await getDB();
  const tx = db.transaction(collection, 'readwrite');
  for (const c of records) tx.store.put({ ...c, dirty: 1 });
  await tx.done;
  notifyLocalChange();
}

export const loadCopies = () => loadRecords(COPIES);
export const putCopies = (copies) => putRecords(COPIES, copies);
export const loadWishlist = () => loadRecords(WISHLIST);
export const putWishlist = (items) => putRecords(WISHLIST, items);

// ─── Sync helpers (phone / browser side) ─────────────────────────────────
let localChangeHandler = null;
/** The sync client registers here to sync soon after a local edit. */
export function setLocalChangeHandler(fn) { localChangeHandler = fn; }
function notifyLocalChange() { if (localChangeHandler) localChangeHandler(); }

export async function getMeta(key) {
  const db = await getDB();
  return db.get(META, key);
}

export async function setMeta(key, value) {
  const db = await getDB();
  return db.put(META, value, key);
}

/** Local changes not yet pushed, per collection. */
export async function getDirty(collection) {
  const db = await getDB();
  const recs = await db.getAllFromIndex(collection, 'by_dirty', 1);
  return recs.map(clean);
}

/** Clear the dirty flag of pushed records, unless they were edited again meanwhile. */
export async function markClean(collection, pushed) {
  if (pushed.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(collection, 'readwrite');
  for (const p of pushed) {
    const cur = await tx.store.get(p.id);
    if (cur && cur.dirty && cur.updatedAt === p.updatedAt) tx.store.put({ ...cur, dirty: 0 });
  }
  await tx.done;
}

/** Flag every record as dirty (e.g. after pairing with a new PC, push everything). */
export async function markAllDirty(collection) {
  const db = await getDB();
  const tx = db.transaction(collection, 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (!cursor.value.dirty) cursor.update({ ...cursor.value, dirty: 1 });
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Merge records received from the PC: the most recent `updatedAt` wins.
 * A local record with unpushed changes that is newer (or equal) is kept: it
 * will be pushed on the next sync. Returns the number of records changed.
 */
export async function applyRemote(collection, records, clockSkew = 0) {
  if (records.length === 0) return 0;
  const db = await getDB();
  const tx = db.transaction(collection, 'readwrite');
  let changed = 0;
  for (const r of records) {
    const cur = await tx.store.get(r.id);
    // PC dates → this phone's clock (clockSkew = PC time − phone time).
    if (!cur || r.updatedAt - clockSkew > cur.updatedAt) {
      tx.store.put({ ...r, dirty: 0 });
      changed++;
    }
  }
  await tx.done;
  if (changed > 0) emitExternalChange();
  return changed;
}

/**
 * One-time import of the old localStorage collection (stacks with a quantity)
 * into per-copy records. Removes the old key once imported.
 */
export async function migrateLegacyCollection() {
  let stacks;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return 0;
    stacks = JSON.parse(raw);
  } catch {
    return 0;
  }
  const now = Date.now();
  const copies = [];
  for (const s of Array.isArray(stacks) ? stacks : []) {
    const cardId = s?.cardData?.id;
    if (!cardId) continue;
    const qty = Math.max(1, s.quantity | 0);
    const createdAt = s.scanTimestamp || now;
    for (let i = 0; i < qty; i++) {
      copies.push({ ...makeCopy({ ...s, cardId }, now), createdAt });
    }
  }
  await putCopies(copies);
  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
  return copies.length;
}
