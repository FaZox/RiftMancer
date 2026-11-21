/**
 * Backups of the phone (and of the browser version):
 *   - « Enregistrer une sauvegarde » : the whole collection (cards, wish list,
 *     boxes, decks, people, loans, trades…) in one JSON file the user keeps;
 *   - automatic backups (lot 3.1, autoBackup.js): at most one a day when
 *     something changed, before a data migration and before a restore; the
 *     10 most recent are kept in the app's own folder, and can be restored or
 *     copied to Documents.
 *
 * Restoring replaces the current data by the backup's content: every record is
 * written again with a new date (and records missing from the backup are
 * deleted), so a later sync spreads the restored state to the other device.
 */
import { SYNCED_COLLECTIONS, isDesktop, loadRecords, putRecords, reloadAllViews } from './collectionDB.js';
import { backupText, listAutoBackups, makeAutoBackup, makePublicCopy, parseBackupText, restoreAutoBackup } from './autoBackup.js';
import { backupFiles, backupState, saveToDocuments, documentsFiles, publicCopyState, isNativePhone } from './backupFiles.js';
import { getPrefs } from './uiPrefs.js';

async function loadCollections() {
  const collections = {};
  for (const col of SYNCED_COLLECTIONS) collections[col] = await loadRecords(col);
  return collections;
}

/** What autoBackup.js works on. */
export const backupIO = { loadCollections, files: backupFiles, state: backupState, public: documentsFiles, publicState: publicCopyState };

// Weekly copy in Documents/Riftbound (CORRECTIONS-v3 D): phone only, on by default (Réglages → Sauvegardes)
const listeners = new Set();
export function onPublicCopy(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const publicCopyInfo = () => publicCopyState.get();
export const weeklyCopyAvailable = () => isNativePhone();
/** The weekly copy if it is due (or now, `force`). Returns the result of makePublicCopy. */
export async function weeklyCopy({ force = false } = {}) {
  if (!isNativePhone() || (!force && getPrefs().weeklyDocCopy === false)) return null;
  const r = await makePublicCopy(backupIO, { force });
  if (r) for (const fn of listeners) fn(r);
  return r;
}

export async function exportBackup() {
  const collections = await loadCollections();
  const name = `riftbound-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const where = await saveToDocuments(name, backupText(collections, Date.now(), 'manuelle'));
  return { copies: collections.copies.length, where };
}

/** Read a backup file's text and check it. Returns { at, copies, collections }. */
export const parseBackup = parseBackupText;

async function replaceData(backup) {
  const now = Date.now();
  for (const col of SYNCED_COLLECTIONS) {
    const want = new Map((backup.collections[col] || []).filter(r => r && r.id).map(r => [r.id, r]));
    const current = await loadRecords(col);
    const out = [...want.values()].map(r => ({ ...r, deleted: false, updatedAt: now }));
    for (const r of current) if (!want.has(r.id)) out.push({ ...r, deleted: true, updatedAt: now });
    if (out.length) await putRecords(col, out);
  }
  reloadAllViews();
}

/** Restores a backup file (the current state is backed up first). */
export async function restoreBackup(backup) {
  await makeAutoBackup(backupIO, { reason: 'restauration' }).catch(err => console.warn('[backup]', err));
  await replaceData(backup);
}

// ─── Automatic backups ───────────────────────────────────────────────────

export const listBackups = () => listAutoBackups(backupIO);
export const backupNow = () => makeAutoBackup(backupIO, { reason: 'manuelle' });

/** Restores automatic backup `name` (the current state is backed up first). */
export const restoreAuto = (name) => restoreAutoBackup(backupIO, name, replaceData);

/** Copy of automatic backup `name` in Documents/Riftbound/. Returns where it went. */
export async function exportAuto(name) {
  return saveToDocuments(name.replace(/^auto-/, 'riftbound-sauvegarde-'), await backupFiles.read(name));
}

/** Before changing the data on load (e.g. the condition scale): one backup of the data as it was. */
export async function backupBeforeMigration() {
  if (isDesktop) return; // the PC app backs its database up at every start
  try {
    await makeAutoBackup(backupIO, { reason: 'migration' });
  } catch (err) {
    console.warn('[backup] before migration:', err);
  }
}

async function daily() {
  try {
    const made = await makeAutoBackup(backupIO, { reason: 'quotidienne' });
    if (made) console.log(`[backup] ${made.name}`);
  } catch (err) {
    console.warn('[backup] automatic backup failed:', err);
  }
  try {
    const copy = await weeklyCopy();
    if (copy?.name) console.log(`[backup] copie hebdomadaire : ${copy.where}`);
    if (copy?.error) console.warn('[backup] weekly copy failed:', copy.error);
  } catch (err) {
    console.warn('[backup] weekly copy failed:', err);
  }
}

let started = false;
/** Phone: daily backup at start and each time the app goes to the background. */
export function initAutoBackup() {
  if (started || isDesktop) return;
  started = true;
  daily();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') daily(); });
}
