import { tx } from './i18n.js';
/**
 * Banned / restricted cards (public/banlist.json), used by deckRules.validateDeck.
 *
 * Format (version 2): { updatedAt, sources: [{ date, url, label }], formats: {
 *   standard: { label, legalSets?, banned: [entry], restricted: {} }, 2v2: { … } } }
 * An entry is a card id, a full English name, or { name, ids?, since? } (see
 * deckRules.banStatus). legalSets: allowed sets, absent = all (Riot plans set
 * rotation in Standard from 2028; nothing uses it yet). The file is filled from
 * Riot's official pages (never guessed), updated with the catalog and sent to
 * the phone by the PC at sync time (syncClient.updateBanlist).
 */

const EMPTY = { updatedAt: null, source: null, formats: { standard: { banned: [], restricted: {} } } };
let current = EMPTY;
let override = null; // newer list received from the PC (phone)

export function getBanlist() {
  return override || current;
}

/** Test / sync hook: replace the active list (null → back to the bundled one). */
export function setBanlist(list) {
  override = list && typeof list === 'object' && list.formats ? list : null;
}

/** Loads the bundled list (call once at startup; failures keep an empty list). */
export async function loadBanlist(url = '/banlist.json') {
  try {
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      if (j?.formats) current = j;
    }
  } catch {
    /* offline / missing: no ban */
  }
  return getBanlist();
}

const entryName = (e) => (typeof e === 'string' ? e : e?.name || (e?.ids || []).join(','));

/**
 * « Standard : 7 cartes, 5 champs de bataille · 2v2 : +1 » (Réglages → Contenu, B.6.1):
 * banned cards and battlefields in Standard, and what 2v2 bans on top.
 */
export function banSummary(list) {
  const std = list?.formats?.standard?.banned || [];
  const duo = list?.formats?.['2v2']?.banned || [];
  const names = new Set(std.map(entryName));
  const battlefields = std.filter(e => e?.battlefield).length;
  const cards = std.length - battlefields;
  const extra = duo.filter(e => !names.has(entryName(e))).length;
  const s = (n) => (n > 1 ? 's' : '');
  let text = tx('Standard : {cards} carte{s}', { cards, s: s(cards) });
  if (battlefields) text += `, ${battlefields} champ${s(battlefields)} de bataille`;
  if (extra) text += ` · 2v2 : +${extra}`;
  return { cards, battlefields, extra2v2: extra, text };
}
