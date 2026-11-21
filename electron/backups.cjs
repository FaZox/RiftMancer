/**
 * Backup files of the PC app (collection-<date>.sqlite in the backups folder).
 * Kept apart from main.cjs so it can be tested without Electron.
 */
const fs = require('node:fs');
const path = require('node:path');

const KEEP = 30; // backups kept in each folder

const BACKUP_NAME = /^collection-[\w.-]+\.sqlite$/;

/** Backups in `dir`, most recent first: [{ name, date, size }]. */
function listBackups(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return []; // no backup folder yet
  }
  return names
    .filter(name => BACKUP_NAME.test(name))
    .map(name => {
      try {
        const st = fs.statSync(path.join(dir, name));
        return st.isFile() ? { name, date: st.mtimeMs, size: st.size } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);
}

/** Full path of backup `name` inside `dir`, or null if the name is invalid or the file is missing. */
function resolveBackup(dir, name) {
  if (typeof name !== 'string' || !BACKUP_NAME.test(name)) return null;
  const root = path.resolve(dir);
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return null;
  return listBackups(root).some(b => b.name === name) ? file : null;
}

/** Live copies in a backup file (null if it cannot be read). */
function backupCopies(file) {
  let db;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(file, { readOnly: true });
    return db.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = 'copies' AND deleted = 0").get().n;
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

/** Backups of `dir` with their number of copies (Réglages → Sauvegardes). */
function listBackupsWithCopies(dir) {
  return listBackups(dir).map(b => ({ ...b, copies: backupCopies(path.join(dir, b.name)) }));
}

/** Can the extra backup folder be written to now? (A USB key may have been removed.) */
function extraStatus(dir) {
  if (!dir) return null;
  try {
    if (!fs.statSync(dir).isDirectory()) return { dir, ok: false };
    fs.accessSync(dir, fs.constants.W_OK);
    return { dir, ok: true };
  } catch {
    return { dir, ok: false };
  }
}

/**
 * Lot 3.3: copies backup `file` into the extra folder `dir` too, keeping the
 * KEEP most recent there. A missing folder is reported ({ ok: false }), never
 * an error: the backups go on on this PC.
 */
function copyToExtra(file, dir, keep = KEEP) {
  const status = extraStatus(dir);
  if (!status?.ok) return { ok: false };
  try {
    fs.copyFileSync(file, path.join(dir, path.basename(file)));
    const old = listBackups(dir).slice(keep);
    for (const b of old) fs.rmSync(path.join(dir, b.name), { force: true });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** The extra folder cannot be the backups folder itself (nor inside it). */
function validExtraDir(dir, backupsDir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return false;
  const a = path.resolve(dir).toLowerCase(), b = path.resolve(backupsDir).toLowerCase();
  return a !== b && !a.startsWith(b + path.sep);
}

module.exports = { listBackups, listBackupsWithCopies, resolveBackup, backupCopies, extraStatus, copyToExtra, validExtraDir, BACKUP_NAME, KEEP };
