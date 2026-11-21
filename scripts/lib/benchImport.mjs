/**
 * Puts a bench export of the app (ZIP, MODULE-BANC.md 4.3) into the bench
 * folder (model/real-photos-raw/): checks every file, writes the photos and
 * grid lists, and MERGES _collecte.json with the one already there (a plain
 * unzip would replace it).
 *
 * Refused (nothing written): a path that is not one of the export's
 * (isBenchPath: no « .. », no absolute path, generated names only), a .jpg
 * that is not a JPEG or still has a GPS position, a .txt that is not UTF-8,
 * a file over 20 MB.
 * A photo already there under another folder (corrected in the app after an
 * earlier export) is moved: the old copy is removed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readZipStore } from '../../src/lib/bench/zip.js';
import { isJpeg, jpegExifInfo } from '../../src/lib/bench/jpegClean.js';
import { COLLECTE_FILE, GRID_DIR, isBenchPath, mergeCollecte } from '../../src/lib/bench/benchFormat.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Every photo / list already in the bench folder: base name → [relative
 * paths], and the folders by lower-case name (Windows folders ignore the
 * case: « UNL-150a » and « UNL-150A » are one folder).
 */
function existingFiles(dest) {
  const byBase = new Map();
  const dirs = new Map();
  if (!fs.existsSync(dest)) return { byBase, dirs };
  for (const dir of fs.readdirSync(dest)) {
    const full = path.join(dest, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    dirs.set(dir.toLowerCase(), dir);
    for (const f of fs.readdirSync(full)) {
      if (!byBase.has(f)) byBase.set(f, []);
      byBase.get(f).push(`${dir}/${f}`);
    }
  }
  return { byBase, dirs };
}
const samePath = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * @param {Uint8Array} zipBytes
 * @param {string} dest  bench folder (model/real-photos-raw)
 * @returns {{ photos: number, lists: number, moved: string[], entries: number }}
 */
export function importBenchZip(zipBytes, dest) {
  const files = readZipStore(zipBytes);
  const problems = [];
  let collecte = null;
  for (const f of files) {
    if (!isBenchPath(f.name)) { problems.push(`${f.name} : chemin refusé`); continue; }
    if (f.data.length > MAX_FILE_BYTES) { problems.push(`${f.name} : fichier trop gros`); continue; }
    if (f.name.endsWith('.jpg')) {
      if (!isJpeg(f.data)) problems.push(`${f.name} : pas une photo JPEG`);
      else if (jpegExifInfo(f.data).gps) problems.push(`${f.name} : contient encore une position GPS`);
    } else {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(f.data); } catch { problems.push(`${f.name} : texte non UTF-8`); continue; }
      if (f.name === COLLECTE_FILE) {
        try { collecte = JSON.parse(text); } catch { problems.push(`${f.name} : JSON illisible`); }
        if (collecte && !Array.isArray(collecte)) problems.push(`${f.name} : une liste est attendue`);
      }
    }
  }
  if (problems.length) throw new Error(`Export refusé, rien n’a été écrit :\n  ${problems.join('\n  ')}`);

  fs.mkdirSync(dest, { recursive: true });
  const { byBase, dirs } = existingFiles(dest);
  const moved = [];
  const written = new Map(); // path in the ZIP → path written
  let photos = 0;
  let lists = 0;
  for (const f of files) {
    if (f.name === COLLECTE_FILE) continue;
    const [zipDir, base] = f.name.split('/');
    // An existing folder keeps its spelling (« UNL-150a » stays « UNL-150a »).
    const dir = dirs.get(zipDir.toLowerCase()) || zipDir;
    dirs.set(dir.toLowerCase(), dir);
    const target = `${dir}/${base}`;
    written.set(f.name, target);
    // Same photo elsewhere: corrected in the app since the last export.
    for (const old of byBase.get(base) || []) {
      if (samePath(old, target)) continue;
      fs.rmSync(path.join(dest, ...old.split('/')), { force: true });
      if (old.startsWith(`${GRID_DIR}/`) && base.endsWith('.jpg')) fs.rmSync(path.join(dest, GRID_DIR, base.replace(/\.jpg$/, '.txt')), { force: true });
      moved.push(`${old} → ${target}`);
    }
    fs.mkdirSync(path.join(dest, dir), { recursive: true });
    fs.writeFileSync(path.join(dest, dir, base), f.data);
    if (base.endsWith('.jpg')) photos++;
    else lists++;
  }
  let entries = 0;
  if (collecte) {
    const file = path.join(dest, COLLECTE_FILE);
    const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    const merged = mergeCollecte(old, collecte.map(e => ({ ...e, file: written.get(e.file) || e.file })));
    fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
    entries = merged.length;
  }
  return { photos, lists, moved, entries };
}
