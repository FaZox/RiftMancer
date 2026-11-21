/**
 * Gathers what the diagnostic report says (lot 5.3) and saves it as a file
 * (Documents/Riftbound on the phone, a download on the PC). No network.
 * The report itself: diagnostic.js (buildReport), checked once more for the
 * names and secrets known on this device before it is written.
 */
import { SYNCED_COLLECTIONS, loadRecords, getMeta, isDesktop } from './collectionDB.js';
import { getMatcher } from './cardMatcher.js';
import { getDetector } from './yoloDetector.js';
import { getBanlist } from './banlist.js';
import { getPrefs } from './uiPrefs.js';
import { getSyncState } from './syncClient.js';
import { getScanStats } from './scanStats.js';
import { getErrors, lastSpeed } from './errorLog.js';
import { APP_VERSION, BUILD_TIME } from './appVersion.js';
import { buildReport, leaks, reportName } from './diagnostic.js';
import { saveToDocuments } from './backupFiles.js';
import { isNative } from './nativeAssets.js';

export async function createReport() {
  const records = {};
  for (const col of SYNCED_COLLECTIONS) {
    try { records[col] = await loadRecords(col); } catch { records[col] = []; }
  }
  // Names and secrets of this device: never in the report.
  const names = [
    ...(records.people || []).map(p => p.name), ...(records.decks || []).map(d => d.name), ...(records.boxes || []).map(b => b.name),
  ];
  const secrets = [];
  let otherVersion = null;
  const s = getSyncState();
  if (isDesktop) {
    try {
      const info = await window.riftboundDesktop.sync.info();
      names.push(info.name, ...(info.devices || []).map(d => d.name));
      secrets.push(info.token, info.pcId, ...(info.ips || []));
      otherVersion = (info.devices || []).map(d => d.appVersion).filter(Boolean).join(', ') || null;
    } catch { /* no PC info */ }
  } else {
    const pairing = await getMeta('pairing').catch(() => null);
    if (pairing) {
      names.push(pairing.name);
      secrets.push(pairing.deviceKey, pairing.pcSecret, pairing.deviceId, pairing.pcId, pairing.lastHost, ...(pairing.hosts || []));
    }
    otherVersion = s.pcVersion?.version || null;
  }
  const m = getMatcher();
  const d = getDetector();
  const prefs = getPrefs();
  const report = buildReport({
    app: { version: APP_VERSION, build: BUILD_TIME ? new Date(BUILD_TIME).toISOString() : null, variant: window.riftboundDesktop?.variant || null },
    kind: isDesktop ? 'pc' : isNative ? 'android' : 'navigateur',
    ua: navigator.userAgent,
    cores: navigator.hardwareConcurrency || null,
    recognition: { pref: prefs.recognition, aiState: m.ai?.state, aiError: m.ai?.error, engine: m.ai?.header?.engine || null, detectorState: d.state, detectorError: d.error },
    content: {
      generatedAt: m.contentInfo?.generatedAt, cards: m.cards?.length, source: m.catalogInfo?.source,
      ignored: m.catalogInfo?.ignored, layers: m.contentInfo?.content || {}, banlistUpdatedAt: getBanlist()?.updatedAt,
    },
    sync: { paired: isDesktop ? null : s.paired, lastSync: s.lastSync, pending: isDesktop ? null : s.pending, otherVersion },
    records,
    scans: getScanStats(),
    speed: lastSpeed(),
    startup: (() => { try { return JSON.parse(localStorage.getItem('rb.startupMs') || 'null'); } catch { return null; } })(),
    errors: getErrors(),
    redact: names.filter(Boolean),
  });
  let text = JSON.stringify(report, null, 2);
  for (const found of leaks(text, [...names, ...secrets].filter(x => x && String(x).length >= 3))) text = text.split(found).join('<masqué>');
  const where = await saveToDocuments(reportName(), text);
  return { where, report };
}
