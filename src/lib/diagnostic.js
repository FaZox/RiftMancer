/**
 * « Créer un rapport » (lot 5.3 of AMELIORATIONS-APPLI.md): a file, made
 * without any network, that the user gives to whoever helps them.
 * In it: versions, platform, recognition engine and why it fell back,
 * content versions, last sync, NUMBER of records, the 200 last errors, scan
 * statistics, the last « Tester la vitesse ».
 * NEVER: secrets (pairing keys, tokens), IP addresses, the PC's name, the
 * collection's content (no card list), people's names, photos.
 * buildReport is pure (tests/diagnostic.test.mjs, on the demo database).
 */
import { scrub } from './errorLog.js';import { tx } from './i18n.js';


/** Operating system in a few words, from the user agent (never the device's name). */
export function platformOf(ua = '') {
  const android = /Android (\d+)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  if (/Windows NT 10/.test(ua)) return tx('Windows 10/11');
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'inconnue';
}

/**
 * `input`: { app, kind ('pc' | 'android' | 'navigateur'), ua, cores,
 *   recognition: { pref, aiState, aiError, engine, detectorState, detectorError },
 *   content: { generatedAt, cards, source, ignored, layers, banlistUpdatedAt },
 *   sync: { paired, lastSync, pending, otherVersion },
 *   records: { copies: [...], decks: [...], … } (only their NUMBER is kept),
 *   scans, speed, errors, redact: [names] }
 * Returns the report object (JSON-ready).
 */
export function buildReport(input, now = new Date()) {
  const redact = input.redact || [];
  const clean = (v) => (v == null ? null : scrub(v, redact));
  const counts = Object.fromEntries(Object.entries(input.records || {}).map(([k, v]) => [k, Array.isArray(v) ? v.filter(r => !r?.deleted).length : Number(v) || 0]));
  const layers = Object.fromEntries(Object.entries(input.content?.layers || {}).filter(([, l]) => l).map(([k, l]) => [k, {
    createdAt: l.createdAt || null, count: l.count ?? null, source: l.source?.label ? clean(l.source.label) : null,
  }]));
  const speed = input.speed ? Object.fromEntries(Object.entries(input.speed).filter(([, v]) => typeof v !== 'object' || v === null).map(([k, v]) => [k, typeof v === 'string' ? clean(v) : v])) : null;
  return {
    rapport: tx('RiftMancer — rapport de diagnostic'),
    createdAt: now.toISOString(),
    contenu: tx('Aucune carte, aucun nom, aucun mot de passe, aucune adresse.'),
    app: { version: input.app?.version || null, build: input.app?.build || null, variant: input.app?.variant || null },
    platform: { kind: input.kind || null, os: platformOf(input.ua), cores: input.cores ?? null },
    recognition: {
      pref: input.recognition?.pref || null,
      ai: input.recognition?.aiState || null,
      aiError: clean(input.recognition?.aiError),
      engine: input.recognition?.engine || null,
      detector: input.recognition?.detectorState || null,
      detectorError: clean(input.recognition?.detectorError),
    },
    content: {
      catalog: input.content?.generatedAt || null,
      cards: input.content?.cards ?? null,
      source: input.content?.source || null,
      ignored: clean(input.content?.ignored),
      layers,
      banlist: input.content?.banlistUpdatedAt || null,
    },
    sync: {
      paired: !!input.sync?.paired,
      lastSync: input.sync?.lastSync ? new Date(input.sync.lastSync).toISOString() : null,
      pending: input.sync?.pending ?? null,
      otherVersion: input.sync?.otherVersion || null,
    },
    records: counts,
    scans: input.scans || null,
    startup: input.startup ? { ms: input.startup.ms ?? null, at: input.startup.at ? new Date(input.startup.at).toISOString() : null } : null,
    speed,
    errors: (input.errors || []).slice(0, 200).map(e => ({
      at: e.at ? new Date(e.at).toISOString() : null, where: clean(e.where), type: clean(e.type), message: clean(e.message), stack: clean(e.stack),
    })),
  };
}

/**
 * Last check before writing: nothing of `forbidden` (names, secrets, IP…) in
 * the text. Returns the strings found (empty = clean).
 */
export function leaks(text, forbidden) {
  return forbidden.filter(f => f && String(f).length >= 2 && text.includes(String(f)));
}

export const reportName = (now = new Date()) => `rapport-riftbound-${now.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
