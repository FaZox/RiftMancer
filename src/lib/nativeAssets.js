/**
 * Card images and catalog on the phone (Android app).
 *
 * The Android app ships the thumbnails, the full-size images and the card
 * catalog that existed when it was built. Newer sets come from the PC during
 * sync and are stored in the app's private storage:
 *   <Data>/cards/<id>.webp          full-size images of cards newer than the app
 *   <Data>/thumbs/<id>.webp         thumbnails of cards newer than the app
 *   <Data>/catalog/card-hashes.json newer card catalog
 * Files are shown through Capacitor's local server (convertFileSrc).
 *
 * On the PC app and in the browser, everything is served from the web app
 * itself and these helpers simply return the normal URLs.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const isNative = Capacitor.isNativePlatform();

let dataUri = null; // file:// URI of the app's Data directory (native only)

/** Must be awaited once at startup before using the *Src helpers on native. */
export async function initNativeAssets() {
  if (!isNative || dataUri) return;
  try {
    const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: '' });
    dataUri = uri.replace(/\/$/, '');
  } catch (err) {
    console.warn('[assets] Data directory unavailable:', err);
  }
}

function localSrc(rel) {
  return Capacitor.convertFileSrc(`${dataUri}/${rel}`);
}

/**
 * Detection models downloaded from the PC by older versions (<Data>/models/,
 * « Normal » model): the app now ships its only model — the folder is
 * removed (preferences v4, see uiPrefs.migratePrefs). Safe to call again.
 */
export async function removeDownloadedModels() {
  if (!isNative) return false;
  try {
    await Filesystem.rmdir({ directory: Directory.Data, path: 'models', recursive: true });
    return true;
  } catch {
    return false; // nothing downloaded
  }
}

/**
 * Full-size card image (zoom / detail views). PC and browser: served with the
 * app. Phone: the APK has no full-size images any more (lot 4.6): the copy
 * received from the PC at sync.
 */
export function fullImageSrc(cardId) {
  if (isNative) return downloadedImageSrc(cardId) || `/cards/thumbs/${cardId}.webp`;
  return `/cards/${cardId}.webp`;
}

/** Full-size image downloaded from the PC (cards newer than the app), or null. */
export function downloadedImageSrc(cardId) {
  return isNative && dataUri ? localSrc(`cards/${cardId}.webp`) : null;
}

/** Thumbnail bundled with the app (lists). */
export function thumbSrc(cardId) {
  return `/cards/thumbs/${cardId}.webp`;
}

/**
 * Sources to try in order when an image fails to load: bundled thumbnail →
 * downloaded thumbnail (cards newer than the app) → full image.
 */
export function imageFallbacks(cardId) {
  const list = [thumbSrc(cardId)];
  if (isNative && dataUri) list.push(localSrc(`thumbs/${cardId}.webp`));
  list.push(fullImageSrc(cardId));
  const downloaded = downloadedImageSrc(cardId);
  if (downloaded) list.push(downloaded);
  return list;
}

/** onError handler for <img>: walk the fallback list once. */
export function handleImageError(e, cardId) {
  const img = e.currentTarget;
  const list = imageFallbacks(cardId);
  const i = Number(img.dataset.fallback || 0) + 1;
  if (i < list.length) {
    img.dataset.fallback = String(i);
    img.src = list[i];
  }
}

// ─── Catalog ──────────────────────────────────────────────────────────────
const CATALOG_PATH = 'catalog/card-hashes.json';

async function exists(path) {
  try {
    await Filesystem.stat({ directory: Directory.Data, path });
    return true;
  } catch {
    return false;
  }
}

/** URL of the card catalog to load: the one downloaded from the PC if any. */
export async function catalogUrl() {
  if (isNative && dataUri && await exists(CATALOG_PATH)) return localSrc(CATALOG_PATH);
  return null; // → bundled /card-hashes.json
}

export async function saveCatalog(text) {
  await Filesystem.writeFile({
    directory: Directory.Data, path: CATALOG_PATH, data: text, encoding: Encoding.UTF8, recursive: true,
  });
}

// ─── Image download from the PC ───────────────────────────────────────────
async function listDir(path) {
  try {
    const { files } = await Filesystem.readdir({ directory: Directory.Data, path });
    return new Set(files.map(f => (typeof f === 'string' ? f : f.name)));
  } catch {
    return new Set();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Downloads the images this phone is missing from the PC.
 *
 * @param {string} baseUrl       PC address, e.g. "http://192.168.1.20:47321"
 * @param {string[]} cardIds     every card of the current catalog
 * @param {Set<string>} bundled  card ids whose thumbnail ships with the app
 * @param {object} opts          { full: download full-size images, onProgress, shouldStop }
 */
export async function downloadMissingImages(baseUrl, cardIds, bundled, { full = true, onProgress, shouldStop } = {}) {
  if (!isNative) return { done: 0, failed: 0 };
  const haveFull = await listDir('cards');
  const haveThumb = await listDir('thumbs');
  const jobs = [];
  for (const id of cardIds) {
    const name = `${id}.webp`;
    if (!bundled.has(id) && !haveThumb.has(name)) jobs.push({ url: `${baseUrl}/cards/thumbs/${name}`, path: `thumbs/${name}` });
    // Full-size images: none in the APK (lot 4.6), all of them come from the PC
    if (full && !haveFull.has(name)) jobs.push({ url: `${baseUrl}/cards/${name}`, path: `cards/${name}` });
  }
  let done = 0;
  let failed = 0;
  const total = jobs.length;
  onProgress?.({ done, total, failed });
  if (total === 0) return { done, failed };

  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      if (shouldStop?.()) return;
      const job = jobs[next++];
      try {
        const resp = await fetch(job.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await blobToBase64(await resp.blob());
        await Filesystem.writeFile({ directory: Directory.Data, path: job.path, data, recursive: true });
        done++;
      } catch {
        failed++;
      }
      onProgress?.({ done, total, failed });
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { done, failed };
}
