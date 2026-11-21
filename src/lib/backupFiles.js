/**
 * Where the phone keeps its automatic backups (autoBackup.js): the app's own
 * folder (`sauvegardes/`, removed with the app, never readable by other apps);
 * in a browser, a separate IndexedDB database. Kept apart from collectionDB.js,
 * which uses it before a database migration.
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { openDB } from 'idb';import { tx } from './i18n.js';


const DIR = 'sauvegardes';
const STATE = '_etat.json';
const native = () => Capacitor.isNativePlatform();

let idb = null;
const browserDB = () => (idb ||= openDB('riftbound-backups', 1, { upgrade(db) { db.createObjectStore('files'); } }));

async function nativeList() {
  try {
    const r = await Filesystem.readdir({ path: DIR, directory: Directory.Data });
    return r.files.filter(f => f.type !== 'directory').map(f => ({ name: f.name, size: f.size || 0 }));
  } catch {
    return []; // no folder yet
  }
}

export const backupFiles = {
  async list() {
    if (native()) return (await nativeList()).filter(f => f.name !== STATE);
    const db = await browserDB();
    const names = (await db.getAllKeys('files')).filter(n => n !== STATE);
    return Promise.all(names.map(async name => ({ name, size: (await db.get('files', name))?.length || 0 })));
  },
  async write(name, text) {
    if (native()) {
      await Filesystem.writeFile({ path: `${DIR}/${name}`, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
    } else {
      await (await browserDB()).put('files', text, name);
    }
  },
  async read(name) {
    if (native()) return (await Filesystem.readFile({ path: `${DIR}/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 })).data;
    const text = await (await browserDB()).get('files', name);
    if (text == null) throw new Error(tx('Sauvegarde introuvable.'));
    return text;
  },
  async remove(name) {
    if (native()) await Filesystem.deleteFile({ path: `${DIR}/${name}`, directory: Directory.Data }).catch(() => {});
    else await (await browserDB()).delete('files', name);
  },
};

export const backupState = {
  async get() {
    try { return JSON.parse(await backupFiles.read(STATE)); } catch { return null; }
  },
  async set(value) { await backupFiles.write(STATE, JSON.stringify(value)); },
};

/**
 * Copy of a backup where the user can reach it: Documents/Riftbound/ on the
 * phone (or the app's external folder), a download in a browser.
 */
export async function saveToDocuments(name, text) {
  if (native()) {
    for (const directory of [Directory.Documents, Directory.External]) {
      try {
        const r = await Filesystem.writeFile({ path: `Riftbound/${name}`, data: text, directory, encoding: Encoding.UTF8, recursive: true });
        return directory === Directory.Documents ? `Documents/Riftbound/${name}` : r.uri;
      } catch (err) {
        console.warn('[backup] cannot write in', directory, err);
      }
    }
    throw new Error(tx('Impossible d’écrire le fichier sur le téléphone.'));
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

/** Phone app (not a browser): the weekly copy is only made there. */
export const isNativePhone = native;

/**
 * Documents/Riftbound/ (or the app's external folder when Documents is refused):
 * the weekly copy of the backups (CORRECTIONS-v3 D), which stays when the app
 * is uninstalled.
 */
export const documentsFiles = {
  async list() {
    const names = [];
    for (const directory of [Directory.Documents, Directory.External]) {
      try { names.push(...(await Filesystem.readdir({ path: 'Riftbound', directory })).files.map(f => f.name)); } catch { /* no folder */ }
    }
    return names;
  },
  write: (name, text) => saveToDocuments(name, text),
  async remove(name) {
    for (const directory of [Directory.Documents, Directory.External]) {
      try { await Filesystem.deleteFile({ path: `Riftbound/${name}`, directory }); return; } catch { /* not there */ }
    }
  },
};

const COPY_STATE = '_copie.json';
/** State of the weekly copy: { at, okAt, stamp, where, error } (kept with the private backups). */
export const publicCopyState = {
  async get() {
    try { return JSON.parse(await backupFiles.read(COPY_STATE)); } catch { return null; }
  },
  async set(value) { await backupFiles.write(COPY_STATE, JSON.stringify(value)); },
};
