import { tx } from './i18n.js';
/**
 * Automatic backups of the phone (lot 3.1 of AMELIORATIONS-APPLI.md).
 *   - at most one a day, and only when something changed since the last one;
 *   - always before a database migration and before a restore;
 *   - the 10 most recent are kept.
 * Pure logic over an `io` object, so it is tested in Node (tests/backups.test.mjs):
 *   io.loadCollections() → { copies: [...], wishlist: [...], … }
 *   io.files.list() → [{ name, size }] · write(name, text) · read(name) → text · remove(name)
 *   io.state.get() → { at, stamp } | null · set(value)
 * The phone's io is in localBackup.js (files in the app's own folder).
 */

export const BACKUP_APP = 'riftbound-scanner-backup';
export const AUTO_KEEP = 10;
const DAY = 24 * 60 * 60 * 1000;

/** Why a backup was made: shown in the list. */
export const REASON_LABEL = {
  quotidienne: tx('Automatique'),
  manuelle: tx('Manuelle'),
  migration: tx('Avant une mise à jour des données'),
  restauration: tx('Avant une restauration'),
};

/** « What the data looks like »: number of records and most recent change, every collection. */
export function dataStamp(collections) {
  let n = 0, last = 0;
  for (const recs of Object.values(collections || {})) {
    for (const r of recs || []) {
      n++;
      if (r?.updatedAt > last) last = r.updatedAt;
    }
  }
  return `${n}:${last}`;
}

const localDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Daily backup: something changed since the last backup, and none made today yet. */
export function shouldAutoBackup({ now, last, stamp }) {
  if (!stamp || stamp.startsWith('0:')) return false; // empty collection: nothing to keep
  if (!last) return true;
  if (last.stamp === stamp) return false;
  return localDay(last.at) !== localDay(now);
}

/** « auto-2026-11-18T10-15-00-quotidienne-137.json » (date, reason, copies). */
export function backupName(at, reason, copies) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `auto-${stamp}-${reason}-${copies}.json`;
}

const NAME = /^auto-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-([a-z]+)-(\d+)\.json$/;

/** { at, reason, copies } from a backup file name, or null for any other file. */
export function parseBackupName(name) {
  const m = NAME.exec(String(name));
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  return { at: new Date(y, mo - 1, d, h, mi, s).getTime(), reason: m[7], copies: Number(m[8]) };
}

/** Backups to delete so that only the `keep` most recent remain. */
export function toRotate(names, keep = AUTO_KEEP) {
  const sorted = names.filter(n => parseBackupName(n)).sort().reverse();
  return sorted.slice(keep);
}

/** The backup file's text (same format as « Enregistrer une sauvegarde »). */
export function backupText(collections, at, reason) {
  return JSON.stringify({ app: BACKUP_APP, v: 1, at, reason, collections });
}

/**
 * Makes a backup. `reason`: 'quotidienne' (only when needed, see
 * shouldAutoBackup), 'manuelle', 'migration', 'restauration' (always, unless
 * there is no data at all). Returns { name, copies } or null when none was made.
 */
export async function makeAutoBackup(io, { reason = 'quotidienne', now = Date.now(), collections } = {}) {
  const data = collections || await io.loadCollections();
  const stamp = dataStamp(data);
  if (stamp.startsWith('0:')) return null;
  if (reason === 'quotidienne' && !shouldAutoBackup({ now, last: await io.state.get(), stamp })) return null;
  const copies = (data.copies || []).filter(c => c && !c.deleted).length;
  let name = backupName(now, reason, copies);
  const existing = new Set((await io.files.list()).map(f => f.name));
  for (let i = 1; existing.has(name); i++) name = backupName(now + i * 1000, reason, copies);
  await io.files.write(name, backupText(data, now, reason));
  for (const old of toRotate([...existing, name])) await io.files.remove(old);
  await io.state.set({ at: now, stamp });
  return { name, copies };
}

/** Backups, most recent first: [{ name, at, reason, copies, size }]. */
export async function listAutoBackups(io) {
  return (await io.files.list())
    .map(f => ({ ...f, ...parseBackupName(f.name) }))
    .filter(f => f.at)
    .sort((a, b) => b.at - a.at);
}

/** Checked content of a backup file. */
export function parseBackupText(text) {
  const j = JSON.parse(text);
  if (j?.app !== BACKUP_APP || !j.collections) throw new Error(tx('Ce fichier n’est pas une sauvegarde RiftMancer.'));
  return { at: j.at, copies: (j.collections.copies || []).filter(c => c && !c.deleted).length, collections: j.collections };
}

/**
 * Restores backup `name`: the current state is backed up first (it can be
 * restored in turn), then `restore(parsed)` replaces the data.
 */
export async function restoreAutoBackup(io, name, restore, now = Date.now()) {
  if (!parseBackupName(name)) throw new Error(tx('Sauvegarde introuvable.'));
  const parsed = parseBackupText(await io.files.read(name));
  await makeAutoBackup(io, { reason: 'restauration', now });
  await restore(parsed);
  return parsed;
}

export const DAY_MS = DAY;

// ─── Weekly copy in Documents/Riftbound (CORRECTIONS-v3 D) ─────────────────
// The automatic backups live in the app's private folder: uninstalling the
// app, resetting or losing the phone erases them all. Once a week (only when
// the data changed), a copy goes to Documents/Riftbound/, which stays when the
// app is uninstalled; the 3 most recent copies are kept there. Other apps can
// read that folder: the notes on opponents (data about other people) are left
// out — they stay in the private backups and in the sync with the PC.

export const PUBLIC_KEEP = 3;
export const WEEK_MS = 7 * DAY;
const PUBLIC_NAME = /^riftbound-copie-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+\.json$/;

/** The collections for the public copy: without the notes on opponents (deck.opponents). */
export function publicCollections(collections) {
  const out = { ...collections };
  if (Array.isArray(out.decks)) out.decks = out.decks.map(d => { if (!d || !d.opponents) return d; const { opponents: _omit, ...rest } = d; return rest; });
  return out;
}

/** Copy now? Data changed since the last copy, and the last copy (or attempt) is a week old. */
export function shouldPublicCopy({ now, last, stamp }) {
  if (!stamp || stamp.startsWith('0:')) return false;
  if (!last?.at) return true;
  if (last.error) return now - last.at >= DAY; // a failed copy is tried again the next day
  if (last.stamp === stamp) return false;
  return now - last.at >= WEEK_MS;
}

/** « riftbound-copie-2026-11-20T10-15-00-137.json » */
export const publicName = (at, copies) => backupName(at, 'x', copies).replace(/^auto-/, 'riftbound-copie-').replace(/-x-/, '-');

/**
 * The weekly copy. `io.public`: { list() → names in Documents/Riftbound,
 * write(name, text) → where, remove(name) }; `io.publicState`: { get, set }.
 * Returns { name, where } when a copy was made, { error } when writing failed
 * (shown in Réglages → Sauvegardes, never silent), null when none was needed.
 */
export async function makePublicCopy(io, { now = Date.now(), collections, force = false } = {}) {
  const data = collections || await io.loadCollections();
  const stamp = dataStamp(data);
  const last = await io.publicState.get();
  if (!force && !shouldPublicCopy({ now, last, stamp })) return null;
  if (stamp.startsWith('0:')) return null;
  const copies = (data.copies || []).filter(c => c && !c.deleted).length;
  const name = publicName(now, copies);
  try {
    const where = await io.public.write(name, backupText(publicCollections(data), now, 'copie'));
    const ours = (await io.public.list()).filter(n => PUBLIC_NAME.test(n));
    for (const old of [...new Set([...ours, name])].sort().reverse().slice(PUBLIC_KEEP)) {
      try { await io.public.remove(old); } catch { /* an old copy left: not an error */ }
    }
    await io.publicState.set({ at: now, okAt: now, stamp, where, error: null });
    return { name, where };
  } catch (err) {
    const error = err?.message || tx('écriture impossible');
    // `okAt` / `where`: the last copy that worked, still shown
    await io.publicState.set({ at: now, okAt: last?.okAt ?? null, stamp: last?.stamp ?? null, where: last?.where ?? null, error });
    return { error };
  }
}
