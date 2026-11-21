/**
 * Display and Cardmarket preferences (both interfaces), kept on this device.
 *
 *   cardAnimations  false → no rising card, sparks or shards in the card zoom
 *                   (legend effects and the floating cards of decks stay)
 *   cm.country      seller country for Cardmarket links ('' = everywhere)
 *   cm.languages    card languages for Cardmarket links
 *   cm.minCondition minimum condition for Cardmarket links ('' = any)
 *   priceRef        reference price: 'trend' (Cardmarket trend, default),
 *                   'avg7' (7-day average sale) or 'low' (lowest offer)
 *   recognition     scanner engine: 'ai' (DINOv2 + colours, default) or
 *                   'grid16' (colour fingerprint alone, lighter)
 *   devMode         developer mode (bench collection, components/bench/)
 *   benchKeepHesitant  developer mode: keep doubtful scans for the bench
 */
import { useEffect, useState } from 'react';
import { CONDITIONS } from './conditions.js';import { tx } from './i18n.js';


const KEY = 'rb.prefs';
const DEFAULTS = {
  cardAnimations: true,
  priceRef: 'trend',
  learnFromCorrections: true, // the scanner learns from the cards the user picks (learning.js)
  // Developer mode (7 taps on the version, Réglages → À propos): bench collection (MODULE-BANC.md)
  devMode: false,
  // Developer mode: offer to keep the doubtful scans for the bench (« laquelle est-ce ? »)
  benchKeepHesitant: false,
  // 'ai': AI model + colours (recommended) · 'grid16': colour fingerprint alone
  recognition: 'ai',
  // Rappel de synchro (lot 3.2): days before « N changements non envoyés au PC » (0 = never)
  syncReminderDays: 7,
  syncReminderDismissedAt: null,
  // « Nouveautés » shown once after an update (lot 4.6)
  lastSeenVersion: null,
  // Réglages → Affichage / Jeu (B.4)
  textSize: 'normal',
  gameFormat: 'standard',
  // Scan sounds (lot 8.2): off by default, volume 0–1
  scanSounds: false,
  scanVolume: 0.5,
  // Scanner « Grille » into a box: note the binder page and pocket of each card
  gridBinder: true,
  // Weekly copy of the backups in Documents/Riftbound (CORRECTIONS-v3 D): on by default
  weeklyDocCopy: true,
  // Price alerts on the cards you own (lot 9): ±X % over 7 days (0 = off), cards worth more than this (€)
  priceAlertPct: 20,
  priceAlertMin: 2,
  // First launch done (lot 6 g); null on a new install
  onboardingDone: null,
  // Version of the stored preferences (see migratePrefs)
  prefsVersion: 5,
  cm: { country: '12', languages: ['1', '2'], minCondition: '4' },
};

// Cardmarket's own ids (website filters)
export const CM_COUNTRIES = [
  ['', tx('Tous les pays')], ['12', tx('France')], ['2', tx('Belgique')], ['4', tx('Suisse')], ['20', tx('Luxembourg')],
  ['7', tx('Allemagne')], ['10', tx('Espagne')], ['17', tx('Italie')], ['23', tx('Pays-Bas')], ['1', tx('Autriche')], ['26', tx('Portugal')],
];
export const CM_LANGUAGES = [['1', tx('Anglais')], ['2', tx('Français')], ['3', tx('Allemand')], ['4', tx('Espagnol')], ['5', tx('Italien')]];
// Minimum condition of the Cardmarket links: the collection's own scale (Poor would filter nothing)
export const CM_CONDITIONS = [['', tx('Tous')], ...CONDITIONS.filter(c => c.value !== 'Poor').map(c => [c.cm, c.label])];

let prefs = load();
const subs = new Set();

/**
 * Stored preferences → current ones. setPrefs() stores the whole object
 * (defaults included), so a new default would never reach people who changed
 * any setting before. v2: « Prudent » becomes the default scan mode; v3: the
 * AI recognition engine — each applied once, the user's choice is respected
 * afterwards. v4: the « Normal / Rapide » choice of the detection model is
 * gone (one model, shipped with the app): its old keys are removed
 * (removeLegacyModelKeys) and, on Android, the models downloaded from the PC
 * (nativeAssets.removeDownloadedModels). v5: the « Rapide » scan mode is
 * gone (it took about 10 % of the cards absent from the catalog): everyone
 * is in Prudent, and the scanMode key is removed.
 * @returns {{ prefs: object, migrated: boolean }}
 */
export function migratePrefs(stored) {
  const p = { ...(stored || {}) };
  let migrated = false;
  if (!(p.prefsVersion >= 2)) {
    p.prefsVersion = 2;
    migrated = Object.keys(stored || {}).length > 0;
  }
  // v3: the AI recognition becomes the default engine.
  if (!(p.prefsVersion >= 3)) {
    p.recognition = 'ai';
    p.prefsVersion = 3;
    migrated = Object.keys(stored || {}).length > 0;
  }
  // v4: nothing to change in these preferences (see removeLegacyModelKeys)
  if (!(p.prefsVersion >= 4)) {
    p.prefsVersion = 4;
    migrated = Object.keys(stored || {}).length > 0;
  }
  // v5: one scan mode (Prudent)
  if (!(p.prefsVersion >= 5)) {
    delete p.scanMode;
    p.prefsVersion = 5;
    migrated = Object.keys(stored || {}).length > 0;
  }
  return { prefs: { ...DEFAULTS, ...p, cm: { ...DEFAULTS.cm, ...(p.cm || {}) } }, migrated };
}

/** Keys of the old « Normal / Rapide » detection model choice (before v4). */
export const LEGACY_MODEL_KEYS = ['riftbound_model_preference', 'rb-model-default-v2'];

/** Removes them (idempotent). @returns {boolean} whether one was there */
export function removeLegacyModelKeys(storage) {
  let found = false;
  for (const k of LEGACY_MODEL_KEYS) {
    if (storage.getItem(k) !== null) {
      storage.removeItem(k);
      found = true;
    }
  }
  return found;
}

function load() {
  try {
    removeLegacyModelKeys(localStorage);
    const { prefs: p, migrated } = migratePrefs(JSON.parse(localStorage.getItem(KEY) || '{}'));
    if (migrated) localStorage.setItem(KEY, JSON.stringify(p));
    return p;
  } catch { return DEFAULTS; }
}

export function getPrefs() { return prefs; }

export function setPrefs(patch) {
  prefs = { ...prefs, ...patch, cm: { ...prefs.cm, ...(patch.cm || {}) } };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  applyPrefs();
  for (const fn of subs) fn(prefs);
}

/** Card animations are switched off with a class on <html> (see index.css). */
export function applyPrefs() {
  document.documentElement.classList.toggle('rf-calm', !prefs.cardAnimations);
  import('./textSize.js').then(m => m.applyTextSize(prefs.textSize)).catch(() => {});
}

export function usePrefs() {
  const [p, setP] = useState(prefs);
  useEffect(() => { subs.add(setP); setP(prefs); return () => subs.delete(setP); }, []);
  return [p, setPrefs];
}

/** Query string of the Cardmarket filters, e.g. "sellerCountry=12&language=1,2&minCondition=4". */
export function cardmarketFilters() {
  const { country, languages, minCondition } = prefs.cm;
  const q = [];
  if (country) q.push(`sellerCountry=${country}`);
  if (languages?.length) q.push(`language=${languages.join(',')}`);
  if (minCondition) q.push(`minCondition=${minCondition}`);
  return q.join('&');
}
