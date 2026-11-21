// Translation (src/lib/i18n.js): every text of the interface has its English version, and the language rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import EN from '../src/i18n/en.js';
import { collectTexts } from '../scripts/i18n-extract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('every tx / tp text has an English version, and no English text is left unused', () => {
  const { keys, dynamic } = collectTexts(root);
  const missing = [...keys.keys()].filter(k => !(k in EN));
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} texts without English (node scripts/i18n-extract.mjs)`);
  const unused = Object.keys(EN).filter(k => !keys.has(k));
  assert.deepEqual(unused.slice(0, 20), [], `${unused.length} English texts no longer used`);
  assert.deepEqual(dynamic, [], 'tx / tp take written texts (the check reads them)');
});

test('the English keeps the values and the edge spaces of the French text', () => {
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  for (const [fr, en] of Object.entries(EN)) {
    // every {value} of the English exists in the French; only the French plural endings ({v1}, {s2} = 's'…) may be dropped
    const frPh = new Set(ph(fr));
    for (const p of ph(en)) assert.ok(frPh.has(p), `{${p}} unknown in « ${fr} »`);
    for (const p of frPh) if (!/^(v|s)\d*$/.test(p)) assert.ok(ph(en).includes(p), `{${p}} missing from the English of « ${fr} »`);
    assert.equal(/^\s/.test(en), /^\s/.test(fr), `leading space of « ${fr} »`);
    assert.equal(/\s$/.test(en), /\s$/.test(fr), `trailing space of « ${fr} »`);
  }
});

test('language: English by default, French when the system is French, the choice remembered; plurals per language', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setNav = (language) => Object.defineProperty(globalThis, 'navigator', { value: { language, languages: [language] }, configurable: true });
  try {
    const { detectLang, LANG_KEY, DISPLAY_FRENCH_KEY } = await import('../src/lib/uiLang.js');
    setNav('en-US');
    assert.equal(detectLang(), 'en');
    setNav('fr-FR');
    assert.equal(detectLang(), 'fr');
    setNav('de-DE');
    assert.equal(detectLang(), 'en', 'any other language: English');
    store.set(LANG_KEY, 'fr');
    assert.equal(detectLang(), 'fr', 'the choice wins over the system');
    store.clear();
    setNav('en-GB');
    const i18n = await import(`../src/lib/i18n.js?case=${Date.now()}`);
    assert.equal(i18n.getLang(), 'en');
    assert.equal(i18n.tx('Annuler'), 'Cancel');
    assert.equal(i18n.tx('Texte sans traduction'), 'Texte sans traduction', 'missing: the French text');
    i18n.setLang('fr', { reload: false });
    assert.equal(store.get(LANG_KEY), 'fr');
    assert.equal(store.get(DISPLAY_FRENCH_KEY), '1', 'card names follow the language');
    assert.equal(i18n.tx('Annuler'), 'Annuler');
    assert.equal(i18n.tp(0, '{n} carte', '{n} cartes'), '0 carte', 'French: singular for 0');
    assert.equal(i18n.locale(), 'fr-FR');
    i18n.setLang('en', { reload: false });
    assert.equal(store.get(DISPLAY_FRENCH_KEY), '0');
    assert.equal(i18n.locale(), 'en-GB');
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
    delete globalThis.localStorage;
  }
});

test('PC app (main process): every etx text has its English, the language follows the app', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { EN: MAIN_EN, etx, setMainLang } = require('../electron/i18n.cjs');
  const { readFileSync, readdirSync } = await import('node:fs');
  const used = new Set();
  for (const f of readdirSync(new URL('../electron/', import.meta.url)).filter(n => n.endsWith('.cjs') && n !== 'i18n.cjs')) {
    const src = readFileSync(new URL(`../electron/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\betx\('((?:[^'\\]|\\.)*)'/g)) used.add(m[1]);
  }
  for (const k of ['Cartes', 'Traductions françaises', 'Cartes bannies']) used.add(k); // LABEL of content.cjs
  const missing = [...used].filter(k => !(k in MAIN_EN));
  assert.deepEqual(missing, [], 'texts of the main process without English');
  assert.equal(etx('Adresse non autorisée.'), 'Adresse non autorisée.', 'plain Node (tests): French');
  setMainLang('en');
  assert.equal(etx('Pack refusé : fichier manquant ({name}).', { name: 'x.json' }), 'Pack refused: file missing (x.json).');
  setMainLang('fr');
});
