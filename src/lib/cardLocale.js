/**
 * Card language helpers.
 *
 * French names/texts live in card-hashes.json (`nameFr` / `textFr`, see
 * cards_scraper.py). They are looked up by card id from the matcher rather
 * than copied into every cardData object, so cards saved before the French
 * data existed still get translated.
 */

import { MASK_ICON, domainIcon, symbolsReady } from './symbols.js';
import { useEffect, useState } from 'react';
import { getMatcher } from './cardMatcher.js';
import { sanitizeHtml } from './sanitizeHtml.js';
import { detectLang, DISPLAY_FRENCH_KEY } from './uiLang.js';

export const DEFAULT_LANGUAGE = 'English';

// ─── Display preference ─────────────────────────────────────────────────
// "Tout afficher en français": names and texts of every card are shown in
// French (from the app's catalog), whatever the language of the physical
// copy. The copy keeps its real language (badge, filters, exports).
// Not chosen yet: the language of the app (i18n.js; changing it sets this too)
const PREF_KEY = DISPLAY_FRENCH_KEY;
let displayFrench = detectLang() === 'fr';
try { const v = localStorage.getItem(PREF_KEY); if (v !== null) displayFrench = v !== '0'; } catch { /* storage unavailable */ }
const prefSubs = new Set();

export function setDisplayFrench(value) {
  displayFrench = !!value;
  try { localStorage.setItem(PREF_KEY, displayFrench ? '1' : '0'); } catch { /* ignore */ }
  for (const fn of prefSubs) fn(displayFrench);
}

/** [displayFrench, setDisplayFrench] — re-renders when the preference changes. */
export function useDisplayFrench() {
  const [v, setV] = useState(displayFrench);
  useEffect(() => { prefSubs.add(setV); setV(displayFrench); return () => { prefSubs.delete(setV); }; }, []);
  return [v, setDisplayFrench];
}

/** Language to display a copy in (French when the preference is on). */
export function displayLanguage(language) {
  return displayFrench ? 'French' : (language || DEFAULT_LANGUAGE);
}

function frenchEntry(cardData) {
  if (!cardData?.id) return null;
  const m = getMatcher();
  const direct = m.getCard(cardData.id);
  if (direct?.nameFr) return direct;
  // Another printing of the same card (same oracle): reuse its French entry.
  const oracle = cardData.oracle || direct?.oracle;
  if (oracle) return m.cards.find(c => c.oracle === oracle && c.nameFr) || direct;
  return direct;
}

/** French entry carrying a rules text, by id then by oracle (variants share it). */
function frenchTextEntry(cardData) {
  const fr = frenchEntry(cardData);
  if (fr?.textFr) return fr;
  const oracle = cardData?.oracle || fr?.oracle;
  if (oracle) return getMatcher().cards.find(c => c.oracle === oracle && c.textFr) || null;
  return null;
}

/**
 * Unofficial French card texts (public/card-texts-fr.json): for cards the
 * official French files (riftboundfr.fr) do not cover yet. Keyed by oracle
 * (variants share the text), falling back to the card id. Loaded once at
 * startup like the banlist; shown with a « non officielle » mark, and the
 * card sheet's FR/EN switch still shows the English text.
 */
let cardTextsFr = null;

export function setCardTextsFr(data) {
  if (!data || typeof data.texts !== 'object') return false;
  cardTextsFr = data.texts;
  return true;
}

export async function loadCardTextsFr(url = '/card-texts-fr.json', fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return false;
    return setCardTextsFr(await res.json());
  } catch { return false; }
}

/** The unofficial French text of a card, or null. */
export function unofficialTextFr(cardData) {
  if (!cardTextsFr || !cardData) return null;
  const oracle = cardData.oracle || getMatcher().getCard(cardData.id)?.oracle;
  return (oracle && cardTextsFr[oracle]) || cardTextsFr[cardData.id] || null;
}

/**
 * Display name of a card in the given language (falls back to English).
 */
export function getLocalizedName(cardData, language) {
  if (language === 'French') {
    const fr = frenchEntry(cardData);
    if (fr?.nameFr) return fr.nameFr;
  }
  // Full English name ("Jinx - Demolitionist") when known.
  return cardData?.nameEn || frenchEntry(cardData)?.nameEn || cardData?.name || cardData?.id || '';
}

/**
 * Rules text of a card in the given language.
 *
 * @returns {{ text: string, isHtml: boolean, translated: boolean, unofficial?: boolean } | null}
 *   English text from Riot is HTML; French text is plain text.
 *   `translated` is false when French was asked but is unavailable.
 *   `unofficial` marks a community French text (card-texts-fr.json) used when
 *   the official French text does not exist.
 */
export function getLocalizedText(cardData, language) {
  if (language === 'French') {
    const fr = frenchTextEntry(cardData);
    if (fr?.textFr) return { text: fr.textFr, isHtml: false, translated: true };
    const unofficial = unofficialTextFr(cardData);
    if (unofficial) return { text: unofficial, isHtml: false, translated: true, unofficial: true };
    if (cardData?.text) return { text: cardData.text, isHtml: true, translated: false };
    return null;
  }
  return cardData?.text ? { text: cardData.text, isHtml: true, translated: true } : null;
}

/**
 * Two collection/pending entries are the same stack only when they share the
 * card, the language, the finish and the promo flag — a French and an English
 * copy of the same card stay on separate rows.
 */
export function isSameStack(a, b) {
  return a.cardData.id === b.cardData.id
    && (a.language || DEFAULT_LANGUAGE) === (b.language || DEFAULT_LANGUAGE)
    && !!a.foil === !!b.foil
    && !!a.promo === !!b.promo;
}

// ─── Rules text icons ────────────────────────────────────────────────────
const RUNE_COLORS = {
  fury: '#ef4444', calm: '#22c55e', mind: '#3b82f6', body: '#f97316', chaos: '#a855f7', order: '#eab308',
};
const RUNE_FR = { fury: 'Fureur', calm: 'Calme', mind: 'Esprit', body: 'Corps', chaos: 'Chaos', order: 'Ordre', rainbow: 'n’importe quelle rune' };

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Rules text as HTML with the game icons (:rb_energy_2:, :rb_rune_fury:,
 * :rb_exhaust:, :rb_might:) drawn as small badges instead of raw tokens.
 * French text is plain text (escaped here); English text from Riot is HTML.
 */
// Keyword tags ([Accelerate], [Assault 2]…) in the colours printed on the
// cards — measured on the card images (scratch script kwcolors.cjs):
//   teal  = timing / play (Accelerate, Action, Reaction, Hidden, Legion…)
//   pink  = combat (Assault, Shield, Tank, Disarm)
//   lime  = Deathknell, Deflect, Ganking, Hunt, Level, Temporary
//   grey  = Equip, Vision, Weaponmaster, Burn, Empower…
const TEAL = '#286c5b';
const PINK = '#c9366c';
const LIME = '#8fae26';
const GREY = '#7d828c';
const KEYWORD_COLORS = {
  accelerate: TEAL, action: TEAL, reaction: TEAL, hidden: TEAL, legion: TEAL,
  repeat: TEAL, ambush: TEAL, deploy: TEAL, 'quick-draw': TEAL,
  flow: '#037463', 'show off': '#037463',
  assault: PINK, shield: PINK, tank: PINK, disarm: PINK,
  deathknell: LIME, deflect: LIME, ganking: LIME, hunt: LIME, level: LIME, niveau: LIME, temporary: LIME,
  equip: GREY, vision: GREY, weaponmaster: GREY, burn: GREY, empower: GREY, empowered: GREY,
  stun: GREY, mighty: GREY, buff: GREY, predict: GREY, add: GREY, unique: GREY, backline: GREY,
};

function keywordTag(label) {
  const key = label.replace(/\s*\d+$/, '').trim().toLowerCase();
  const color = KEYWORD_COLORS[key] || GREY;
  return `<span style="display:inline-block;padding:0 .4em;margin:0 .05em;border-radius:3px;background:${color};color:#fff;font-weight:700;font-style:italic;font-size:.8em;letter-spacing:.02em;text-transform:uppercase;line-height:1.5;transform:skewX(-8deg)">${label}</span>`;
}

export function rulesTextHtml({ text, isHtml }) {
  // Source text is sanitized FIRST; the badges below are generated by the app.
  const html = isHtml ? sanitizeHtml(text) : escapeHtml(text || '').replace(/\n/g, '<br>');
  return symbolsHtml(html);
}

/** Symbols (:rb_energy_2:, :rb_rune_fury:…) and [Keywords] of ALREADY SANITIZED HTML as the app's badges (card texts, rulings). */
export function symbolsHtml(html) {
  const badge = (content, style, title) =>
    `<span title="${title}" style="display:inline-flex;align-items:center;justify-content:center;min-width:1.25em;height:1.25em;padding:0 .2em;border-radius:999px;font-size:.75em;font-weight:700;vertical-align:-.15em;${style}">${content}</span>`;
  return html.replace(/:rb_([a-z0-9_]+):/g, (m, key) => {
    let x;
    if ((x = /^energy_(\d+)$/.exec(key))) return badge(x[1], 'background:#e2e8f0;color:#0f172a', `${x[1]} énergie`);
    // The game's icons (public/sym) when the app has them, else the former signs
    const icon = (src, title) => `<img src="${src}" alt="" title="${title}" style="display:inline-block;width:1.15em;height:1.15em;vertical-align:-.2em;margin:0 .05em">`;
    const mask = (src, title) => `<span title="${title}" style="display:inline-block;width:1.05em;height:1.05em;vertical-align:-.15em;margin:0 .1em;background-color:currentColor;-webkit-mask:url(${src}) center / contain no-repeat;mask:url(${src}) center / contain no-repeat"></span>`;
    if ((x = /^rune_([a-z]+)$/.exec(key)) && domainIcon(x[1])) return icon(domainIcon(x[1]), `Rune ${RUNE_FR[x[1]] || x[1]}`);
    if (key === 'exhaust' && symbolsReady()) return mask(MASK_ICON.exhaust, 'Épuiser');
    if (key === 'might' && symbolsReady()) return mask(MASK_ICON.might, 'Puissance');
    if ((x = /^rune_([a-z]+)$/.exec(key))) {
      const color = RUNE_COLORS[x[1]];
      const style = color ? `background:${color};color:#fff` : 'background:linear-gradient(135deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7);color:#fff';
      return badge('◆', style, `Rune ${RUNE_FR[x[1]] || x[1]}`);
    }
    if (key === 'exhaust') return badge('↷', 'background:#475569;color:#fff', 'Épuiser');
    if (key === 'might') return badge('⚔', 'background:#7f1d1d;color:#fecaca', 'Puissance');
    return m;
  }).replace(/\[([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ -]*?(?: \d+)?)\]/g, (m, label) => keywordTag(label))
    // « [>] » after a keyword (« [Empowered][>] »): the small arrow printed on the card
    .replace(/\[&gt;\]/g, '<span aria-hidden="true" style="margin:0 .2em;color:#e8c973">▸</span>');
}
