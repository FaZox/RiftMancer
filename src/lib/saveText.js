/**
 * Saves a text file (CSV, deck list…):
 *   - Android app: Documents/Riftbound/<name> (or the app folder if refused);
 *   - PC app / browser: a normal download.
 * @returns {Promise<string>} where it was saved (for the message shown to the user)
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';import { tx } from './i18n.js';


export async function saveTextFile(name, text, mime = 'text/plain') {
  if (Capacitor.isNativePlatform()) {
    for (const directory of [Directory.Documents, Directory.External]) {
      try {
        const r = await Filesystem.writeFile({ path: `Riftbound/${name}`, data: text, directory, encoding: Encoding.UTF8, recursive: true });
        return directory === Directory.Documents ? `Documents/Riftbound/${name}` : r.uri;
      } catch {
        /* try the next folder */
      }
    }
    throw new Error(tx('Enregistrement impossible'));
  }
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
