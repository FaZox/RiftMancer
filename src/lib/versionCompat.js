import { tx } from './i18n.js';
/**
 * PC ↔ phone versions (lot 4.6, B.6.10): say WHAT to update when the two apps
 * do not go together, and show the other device's version (À propos).
 *   - protocol different (sync impossible): the side with the lower protocol
 *     is the older one — known from the public « hello » without giving the
 *     app's version to anyone on the network;
 *   - app versions different (seen at the last authenticated sync): sync still
 *     works, but the content may not go together: a warning.
 * Pure: tests/versionCompat.test.mjs.
 */

/** « 2.1.0 », « 2.1.0-test » → [2, 1, 0]; null otherwise. */
export function parseAppVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  return m ? m.slice(1).map(Number) : null;
}

export function compareAppVersions(a, b) {
  const x = parseAppVersion(a), y = parseAppVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

const PC = { older: tx('L’appli du PC est plus ancienne'), update: tx('Mettez-la à jour') };

/**
 * Message for the phone. `pcProto` / `myProto`: when the PC answered with
 * another protocol; `pcVersion` / `myVersion`: versions seen at the last sync.
 * Returns { tone: 'bad' | 'warn', text, update: 'pc' | 'phone' } or null.
 */
export function phoneCompat({ myProto, pcProto, myVersion, pcVersion }) {
  if (pcProto != null && myProto != null && pcProto !== myProto) {
    return pcProto < myProto
      ? { tone: 'bad', update: 'pc', text: `${PC.older}${pcVersion ? ` (${pcVersion})` : ''}. ${PC.update} pour synchroniser.` }
      : { tone: 'bad', update: 'phone', text: tx('L’appli de ce téléphone est plus ancienne que celle du PC. Mettez-la à jour pour synchroniser.') };
  }
  const cmp = compareAppVersions(myVersion, pcVersion);
  if (!pcVersion || !cmp) return null;
  return cmp > 0
    ? { tone: 'warn', update: 'pc', text: tx('{older} ({pcVersion}). {update} : les deux appareils doivent avoir la même version.', { older: PC.older, pcVersion, update: PC.update }) }
    : { tone: 'warn', update: 'phone', text: tx('L’appli de ce téléphone est plus ancienne ({myVersion}) que celle du PC ({pcVersion}). Mettez-la à jour.', { myVersion, pcVersion }) };
}

/** Message for the PC about one phone seen at its last sync. */
export function pcCompat({ myVersion, phoneVersion, phoneName = tx('Téléphone') }) {
  const cmp = compareAppVersions(myVersion, phoneVersion);
  if (!phoneVersion || !cmp) return null;
  return cmp > 0
    ? { tone: 'warn', update: 'phone', text: tx('L’appli de « {phoneName} » est plus ancienne ({phoneVersion}). Mettez-la à jour.', { phoneName, phoneVersion }) }
    : { tone: 'warn', update: 'pc', text: tx('L’appli de ce PC est plus ancienne ({myVersion}) que celle de « {phoneName} » ({phoneVersion}). Mettez-la à jour.', { myVersion, phoneName, phoneVersion }) };
}

/** « Nouveautés » of a version from docs/NOUVEAUTES.md: { version, title, items: [{ title, text }] } or null. */
export function whatsNew(md, version) {
  const lines = String(md || '').split(/\r?\n/);
  const v = String(version || '').replace(/-.*$/, '');
  const start = lines.findIndex(l => new RegExp(`^##\\s+v?${v.replace(/\./g, '\\.')}(\\s|$)`).test(l));
  if (start < 0) return null;
  const items = [];
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    const m = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const b = /^\*\*(.+?)\*\*\s*[:—-]?\s*(.*)$/.exec(m[1]);
    items.push(b ? { title: b[1], text: b[2] } : { title: null, text: m[1] });
  }
  if (!items.length) return null;
  return { version: v, title: lines[start].replace(/^##\s+v?/, '').trim(), items };
}

/**
 * Show « Nouveautés » now? Only after an UPDATE (a version seen before, older
 * than this one); a first install just records the version (the welcome
 * screens of lot 6 are for that).
 */
export function shouldShowWhatsNew(lastSeen, current) {
  return !!lastSeen && compareAppVersions(current, lastSeen) > 0;
}
