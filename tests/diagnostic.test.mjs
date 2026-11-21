// Lot 5: rescue screen, start-up errors, diagnostic report (on the demo database).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers.mjs';

// localStorage for the error log (Node)
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { scrub, logError, getErrors, clearErrors, MAX_ERRORS, rememberSpeed, lastSpeed } = await import('../src/lib/errorLog.js');
const { buildReport, leaks, platformOf, reportName } = await import('../src/lib/diagnostic.js');
const { demoRecords } = await import('../src/lib/demoData.js');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('scrub: no IP, user folder, secret, key or query string; names masked', () => {
  const s = scrub('fetch http://192.168.1.20:47321/api/sync?token=abc failed for C:\\Users\\Camille\\AppData token=s3cr3t key: 9f8e7d6c5b4a39281706f5e4d3c2b1a0 Alex', ['Alex']); // gitleaks:allow (invented key: the test checks it is masked)
  assert.doesNotMatch(s, /192\.168|47321|Camille|s3cr3t|9f8e7d6c|Alex|abc/);
  assert.match(s, /<ip>/);
  assert.match(s, /C:\\Users\\…/);
  assert.match(s, /token=<masqué>/);
  assert.match(s, /<nom>/);
  assert.equal(scrub('/home/marie/app.js and /Users/jean/x'), '/home/…/app.js and /Users/…/x');
  assert.equal(scrub('ab '.repeat(300)).length, 500, 'long texts cut');
  assert.equal(scrub('x'.repeat(900)), '<…>', 'a long key-like string is masked');
});

test('error log: the 200 last, cleaned', () => {
  clearErrors();
  for (let i = 0; i < MAX_ERRORS + 15; i++) logError(new TypeError(`boom ${i} at 10.0.0.${i % 250}`), 'DeckEditor');
  const list = getErrors();
  assert.equal(list.length, MAX_ERRORS);
  assert.equal(list[0].message, `boom ${MAX_ERRORS + 14} at <ip>`);
  assert.equal(list[0].type, 'TypeError');
  assert.equal(list[0].where, 'DeckEditor');
  rememberSpeed({ totalMs: 120, yoloModel: 'yolo11s' }, 'camera');
  assert.equal(lastSpeed().totalMs, 120);
});

test('report on the demo database: counts only — no card, name, secret, IP or PC name', () => {
  const demo = demoRecords(Date.UTC(2026, 10, 18));
  const records = { copies: demo.copies, decks: [demo.deck], boxes: [demo.box], people: [demo.person], loans: [demo.loan], wishlist: [demo.wish], trades: [demo.trade], matches: [] };
  clearErrors();
  logError(new Error(`Deck « ${demo.deck.name} » de ${demo.person.name} introuvable sur PC-SALON (192.168.1.20)`), 'DeckEditor');
  const secret = 'f'.repeat(64);
  const report = buildReport({
    app: { version: '2.1.0', build: '2026-11-18T10:00:00.000Z', variant: 'daily' },
    kind: 'android', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A) Chrome/120', cores: 8,
    recognition: { pref: 'ai', aiState: 'error', aiError: `model at C:\\Users\\Camille\\x key=${secret}`, engine: 'dinov2', detectorState: 'ready' },
    content: { generatedAt: '2026-11-17T19:15:48Z', cards: 1415, source: 'downloaded', layers: { cartes: { createdAt: '2026-11-18', count: 12, source: { label: 'galerie officielle Riot' } } }, banlistUpdatedAt: '2026-11-23' },
    sync: { paired: true, lastSync: Date.UTC(2026, 10, 17), pending: 3, otherVersion: '2.1.0' },
    records, scans: { total: { scans: 40, success: 35 } }, speed: { totalMs: 120, detection: 'camera' },
    errors: getErrors(),
    redact: [demo.person.name, demo.deck.name, demo.box.name, 'PC-SALON'],
  }, new Date('2026-11-18T10:00:00Z'));
  const text = JSON.stringify(report);
  assert.deepEqual(report.records, { copies: 24, decks: 1, boxes: 1, people: 1, loans: 1, wishlist: 1, trades: 1, matches: 0 });
  assert.equal(report.platform.os, 'Android 14', 'never the phone model');
  for (const forbidden of [demo.person.name, demo.deck.name, demo.box.name, 'PC-SALON', '192.168', 'Pixel 7', 'Camille', secret, ...new Set(demo.copies.map(c => c.cardId))]) {
    assert.ok(!text.includes(forbidden), `« ${forbidden} » must not be in the report`);
  }
  assert.deepEqual(leaks(text, [demo.person.name, 'PC-SALON', secret]), []);
  assert.match(report.errors[0].message, /<nom>.*<nom>.*<ip>/);
  assert.equal(report.content.layers.cartes.count, 12);
  assert.equal(report.contenu, 'Aucune carte, aucun nom, aucun mot de passe, aucune adresse.');
  assert.match(reportName(new Date('2026-11-18T10:05:00Z')), /^rapport-riftbound-2026-11-18-10-05\.json$/);
  assert.equal(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows 10/11');
});

test('error barriers at the root of both interfaces and around each page; start-up step named', () => {
  assert.match(read('src/main.jsx'), /<ErrorBoundary where="appli">/);
  assert.match(read('src/App.jsx'), /<ErrorBoundary key=\{activeTab\} where=\{activeTab\} page>/);
  assert.match(read('src/desktop/DesktopApp.jsx'), /<ErrorBoundary key=\{page\} where=\{page\} page>/);
  const ctrl = read('src/hooks/app/useStartup.js'); // the start-up, split out of useAppController.js (lot 11.5)
  assert.match(read('src/hooks/useAppController.js'), /useStartup\(\{ initDetector, loadCollection \}\)/);
  assert.match(ctrl, /setStartupError\(\{ stage, error \}\)/);
  assert.match(ctrl, /stage = 'catalog'/);
  assert.match(ctrl, /stage = 'db'/);
  assert.match(read('src/components/common/StartupError.jsx'), /Le contenu des cartes n’a pas pu être chargé\./);
});
