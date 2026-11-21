/**
 * « Exporter la collecte » (MODULE-BANC.md 4.1, 4.3): one ZIP with the tree
 * of the bench (exportPlan), written piece by piece.
 *   - Android app: Documents/Riftbound/ (or the app's folder if refused);
 *   - PC / browser: a normal download.
 * On the PC: npm run bench:import -- <the zip>   (merges _collecte.json).
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ZipWriter } from './zip.js';
import { exportPlan, COLLECTE_FILE } from './benchFormat.js';
import { readPhoto, markExported, bytesToBase64 } from './benchStore.js';
import { isJpeg, jpegExifInfo } from './jpegClean.js';

const pad = (n) => String(n).padStart(2, '0');

export function zipName(d = new Date()) {
  return `banc-collecte-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`;
}

/** Android: a file written chunk after chunk (base64, binary). */
async function nativeSink(name) {
  for (const directory of [Directory.Documents, Directory.External]) {
    const path = `Riftbound/${name}`;
    try {
      await Filesystem.writeFile({ path, data: '', directory, recursive: true });
      return {
        write: (bytes) => Filesystem.appendFile({ path, data: bytesToBase64(bytes), directory }),
        close: async () => (directory === Directory.Documents ? `Documents/Riftbound/${name}` : (await Filesystem.getUri({ path, directory })).uri),
        abort: () => Filesystem.deleteFile({ path, directory }).catch(() => {}),
      };
    } catch (err) {
      console.warn('[bench] cannot write in', directory, err);
    }
  }
  throw new Error('Impossible d’écrire le fichier sur le téléphone.');
}

/** PC / browser: pieces kept, then downloaded. */
function downloadSink(name) {
  const parts = [];
  return {
    write: async (bytes) => { parts.push(bytes); },
    close: async () => {
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return name;
    },
    abort: async () => { parts.length = 0; },
  };
}

/**
 * Exports `items` (photos of « Ma collecte »). `onProgress(done, total)`.
 * @returns {Promise<{ where: string, photos: number, cards: number }>}
 */
export async function exportCollecte(items, { onProgress } = {}) {
  if (!items.length) throw new Error('La collecte est vide.');
  const { files, entries } = exportPlan(items); // checks every label first
  const name = zipName();
  const sink = Capacitor.isNativePlatform() ? await nativeSink(name) : downloadSink(name);
  const z = new ZipWriter();
  try {
    let done = 0;
    for (const f of files) {
      let data;
      if (f.kind === 'photo') {
        data = await readPhoto(f.item.name);
        // Last check: never a photo with a position in an export.
        if (!isJpeg(data) || jpegExifInfo(data).gps) throw new Error(`Photo ${f.item.name} : format ou métadonnées inattendus, export arrêté.`);
      } else {
        data = f.text;
      }
      for (const part of z.add(f.path, data)) await sink.write(part);
      if (f.kind === 'photo') onProgress?.(++done, items.length);
    }
    for (const part of z.add(COLLECTE_FILE, JSON.stringify(entries, null, 2) + '\n')) await sink.write(part);
    await sink.write(z.finish());
  } catch (err) {
    await sink.abort();
    throw err;
  }
  const where = await sink.close();
  await markExported(items.map(i => i.name));
  return { where, photos: items.length, cards: entries.reduce((n, e) => n + e.cards.length, 0) };
}
