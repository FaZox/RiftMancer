/**
 * « Ma collecte » (MODULE-BANC.md 3): the bench photos kept on this device.
 *
 *   - metadata of each photo: IndexedDB « rb-bench » (store « items »);
 *   - the photos themselves (JPEG, without GPS / device data, see jpegClean):
 *       Android app: the app's private folder (Directory.Data/bench/), not
 *       the gallery;
 *       PC / browser: IndexedDB (store « photos »).
 * Nothing is saved without a human decision on every card (assertLabeled).
 */
import { openDB } from 'idb';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { assertLabeled } from './benchFormat.js';

const DB_NAME = 'rb-bench';
const DIR = 'bench';
const native = () => Capacitor.isNativePlatform();

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('items', { keyPath: 'name' });
        d.createObjectStore('photos');
      },
    });
  }
  return dbPromise;
}

const subs = new Set();
function changed() { for (const fn of subs) fn(); }
/** Called after every change of the collection. @returns unsubscribe */
export function onBenchChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function writePhoto(name, bytes) {
  if (native()) {
    await Filesystem.writeFile({ path: `${DIR}/${name}.jpg`, data: bytesToBase64(bytes), directory: Directory.Data, recursive: true });
  } else {
    await (await db()).put('photos', bytes, name);
  }
}

/** The JPEG of a photo of the collection. */
export async function readPhoto(name) {
  if (native()) {
    const r = await Filesystem.readFile({ path: `${DIR}/${name}.jpg`, directory: Directory.Data });
    return typeof r.data === 'string' ? base64ToBytes(r.data) : new Uint8Array(await r.data.arrayBuffer());
  }
  const b = await (await db()).get('photos', name);
  if (!b) throw new Error(`Photo ${name} introuvable sur cet appareil.`);
  return b instanceof Uint8Array ? b : new Uint8Array(b);
}

async function removePhoto(name) {
  if (native()) {
    try { await Filesystem.deleteFile({ path: `${DIR}/${name}.jpg`, directory: Directory.Data }); } catch (err) {
      console.warn('[bench] photo already gone', name, err);
    }
  } else {
    await (await db()).delete('photos', name);
  }
}

/** Every photo of the collection, newest first. */
export async function listItems() {
  const all = await (await db()).getAll('items');
  return all.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.name.localeCompare(a.name));
}

/** Names already used (a new photo never takes one). */
export async function takenNames() {
  return new Set(await (await db()).getAllKeys('items'));
}

/** Saves a new photo (JPEG already cleaned) with its checked labels. */
export async function addItem(item, jpegBytes) {
  assertLabeled(item);
  if (!jpegBytes?.length) throw new Error('Photo vide.');
  const d = await db();
  if (await d.get('items', item.name)) throw new Error(`Une photo porte déjà le nom ${item.name}.`);
  await writePhoto(item.name, jpegBytes);
  await d.put('items', { ...item, bytes: jpegBytes.length, exportedAt: null });
  changed();
}

/** Labels corrected in « Ma collecte » (checked again). */
export async function updateItem(item) {
  assertLabeled(item);
  await (await db()).put('items', item);
  changed();
}

export async function deleteItem(name) {
  await removePhoto(name);
  await (await db()).delete('items', name);
  changed();
}

/** Marks photos as exported (date), after a successful export. */
export async function markExported(names, at = Date.now()) {
  const d = await db();
  for (const name of names) {
    const it = await d.get('items', name);
    if (it) await d.put('items', { ...it, exportedAt: at });
  }
  changed();
}

/** Empties the collection (proposed after an export). */
export async function clearItems() {
  for (const it of await listItems()) await deleteItem(it.name);
}
