/**
 * Data folder of the PC app, named after the app (RiftMancer, 21/11/2026,
 * LICENCE-ET-PUBLICATION.md 2.2). On the first launch, the folder of the
 * former name (« Riftbound Scanner ») is copied into the new one; the old
 * folder is left untouched — it is the backup made before. Nothing is taken
 * over when the new folder already holds data. Pure Node (no Electron):
 * tests/dataFolder.test.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');

const FOLDERS = {
  daily: { now: 'riftmancer', before: 'riftbound-scanner' },
  test: { now: 'riftmancer-test', before: 'riftbound-scanner-test' },
};
// Chromium's caches and lock files: rebuilt by themselves, never copied
const SKIP = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad', 'blob_storage',
  'Shared Dictionary', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile']);
const MARKER = 'reprise-riftbound-scanner.json';

/**
 * → { dir, taken, from?, files? } — dir: the data folder to use; taken: the
 * old folder was copied into it now.
 */
function takeOverOldData(appData, variant = 'daily', now = Date.now()) {
  const names = FOLDERS[variant] || FOLDERS.daily;
  const dir = path.join(appData, names.now);
  const old = path.join(appData, names.before);
  const marker = path.join(dir, MARKER);
  if (!fs.existsSync(old) || fs.existsSync(marker)) return { dir, taken: false };
  const hasData = fs.existsSync(dir) && fs.readdirSync(dir).some(n => !SKIP.has(n));
  fs.mkdirSync(dir, { recursive: true });
  if (hasData) {
    fs.writeFileSync(marker, JSON.stringify({ from: old, at: now, taken: false, why: 'le nouveau dossier contenait déjà des données' }, null, 1));
    return { dir, taken: false };
  }
  let files = 0;
  fs.cpSync(old, dir, {
    recursive: true,
    filter: (src) => {
      const top = path.relative(old, src).split(path.sep)[0];
      if (SKIP.has(top)) return false;
      if (fs.statSync(src).isFile()) files++;
      return true;
    },
  });
  fs.writeFileSync(marker, JSON.stringify({ from: old, at: now, taken: true, files, note: 'L’ancien dossier est laissé tel quel (sauvegarde).' }, null, 1));
  return { dir, taken: true, from: old, files };
}

module.exports = { takeOverOldData, FOLDERS, MARKER };
