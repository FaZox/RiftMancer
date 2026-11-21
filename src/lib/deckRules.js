/**
 * Riftbound constructed deck rules (checked in the deck editor).
 *
 *   - 1 Legend (Champion Legend). Its domains (2) are the deck's identity.
 *   - 1 Chosen Champion: a unit named after the Legend's champion
 *     (e.g. Legend "Jinx - Loose Cannon" → unit "Jinx"). It counts in the
 *     main deck.
 *   - Main deck: at least 40 cards (exactly 40 in tournaments), at most 3
 *     copies of a card with the same full name ("Jinx - Demolitionist";
 *     alternate arts count together, the Chosen Champion counts too).
 *   - Sideboard (best-of-three tournaments): optional, 8 cards.
 *   - Rune deck: exactly 12 runes.
 *   - Battlefields: exactly 3, all with different names.
 *   - Every card (main deck and runes) must only use the Legend's domains
 *     (colorless cards are always allowed).
 *   - Signature cards: at most 3 in total (all names together), and each one
 *     must carry the champion tag of the Legend (Core Rules 103.2.d).
 *   - Banned / restricted cards: public/banlist.json (banlist.js).
 *
 * Checked against the Core Rules and tournament rules (riftbound.gg).
 * The numbers live in RULES so they can be adjusted if the rules change.
 */
import { getMatcher } from './cardMatcher.js';
import { getLocalizedName, displayLanguage } from './cardLocale.js';
import { getBanlist } from './banlist.js';import { tx } from './i18n.js';


export const RULES = {
  mainMin: 40,
  maxCopies: 3,
  runes: 12,
  battlefields: 3,
  sideboard: 8,
  signatureMax: 3,
};

/** Signature card (catalog `signature`, from the official gallery « superType »). */
export function isSignature(cardData) {
  return !!cardData?.signature;
}

/**
 * Identity of a card for the copy limit and for "same card, other print":
 * the full English name ("Jinx - Demolitionist" ≠ "Jinx - Rebel").
 */
export function cardKey(cardData) {
  return cardData?.nameEn || cardData?.name;
}

export const ZONES = [
  { id: 'main', label: tx('Deck principal') },
  { id: 'rune', label: tx('Runes') },
  { id: 'battlefield', label: tx('Champs de bataille') },
  { id: 'side', label: tx('Réserve (sideboard)') },
];

/** Zone a card goes to when added to a deck. */
export function zoneForCard(cardData) {
  if (cardData.type === 'rune') return 'rune';
  if (cardData.type === 'battlefield') return 'battlefield';
  return 'main';
}

export function cardDomains(cardData) {
  const list = cardData?.domains?.length ? cardData.domains : (cardData?.domain ? [cardData.domain] : []);
  return list.filter(d => d && d !== 'colorless');
}

/** Champion name of a Legend (from its tags, e.g. ["Jinx"]). */
export function legendChampion(legend) {
  return legend?.tags?.[0] || null;
}

/** Units that can be the Chosen Champion of this Legend. */
export function isChampionFor(cardData, legend) {
  const champ = legendChampion(legend);
  return !!champ && cardData.type === 'unit' && cardData.name === champ;
}

/** Can this card go in a deck led by `legend` (domain identity)? */
export function fitsLegend(cardData, legend) {
  if (!legend) return true;
  if (cardData.type === 'legend') return true;
  const allowed = new Set(cardDomains(legend));
  return cardDomains(cardData).every(d => allowed.has(d));
}

/**
 * Check a deck. Returns { counts, errors, warnings, ok }.
 * Messages are in French, ready for display.
 */
export function validateDeck(deck, { date } = {}) {
  const m = getMatcher();
  const legend = deck.legendId ? m.getCardData(deck.legendId) : null;
  const champion = deck.championId ? m.getCardData(deck.championId) : null;
  const errors = [];
  const warnings = [];
  const counts = { main: 0, rune: 0, battlefield: 0, side: 0 };
  const byName = new Map();
  const bfNames = new Map();
  const offDomain = [];
  const signatures = { n: 0, wrongTag: new Set() };
  const ban = getBanlist();
  const format = deckFormat(deck, ban);
  const day = date || todayIso();
  const upcoming = banListInfo(format, ban, day).upcoming;
  const banned = new Set();
  const bannedIds = new Set();
  const soon = new Map(); // name → date: banned on a later date (announced)
  const restricted = new Map(); // key → { n, max, label }
  const champTag = legend ? legendChampion(legend) : null;

  for (const slot of deck.cards || []) {
    const c = m.getCardData(slot.cardId);
    if (!c) continue;
    counts[slot.zone] = (counts[slot.zone] || 0) + slot.quantity;
    if (slot.zone === 'main') {
      const cur = byName.get(cardKey(c)) || { n: 0, label: getLocalizedName(c, displayLanguage()) };
      cur.n += slot.quantity;
      byName.set(cardKey(c), cur);
    }
    if (slot.zone === 'battlefield') {
      const label = getLocalizedName(c, displayLanguage());
      bfNames.set(label, (bfNames.get(label) || 0) + slot.quantity);
    }
    if (legend && !fitsLegend(c, legend)) offDomain.push(getLocalizedName(c, displayLanguage()));
    if (slot.zone === 'main' && isSignature(c)) {
      signatures.n += slot.quantity;
      if (champTag && !(c.tags || []).includes(champTag)) signatures.wrongTag.add(getLocalizedName(c, displayLanguage()));
    }
    const status = banStatus(c, ban, format, day);
    if (status?.banned) { banned.add(getLocalizedName(c, displayLanguage())); bannedIds.add(c.id); }
    for (const u of status?.banned ? [] : upcoming) {
      if (banStatus(c, ban, format, u.since)?.banned) { soon.set(getLocalizedName(c, displayLanguage()), u.since); break; }
    }
    if (status?.max != null) {
      const k = cardKey(c);
      const cur = restricted.get(k) || { n: 0, max: status.max, label: getLocalizedName(c, displayLanguage()) };
      cur.n += slot.quantity;
      restricted.set(k, cur);
    }
  }
  if (legend) {
    const st = banStatus(legend, ban, format, day);
    if (st?.banned) { banned.add(getLocalizedName(legend, displayLanguage())); bannedIds.add(legend.id); }
  }

  if (!legend) errors.push(tx('Choisissez une Légende.'));
  if (legend && !champion) errors.push(tx('Choisissez le champion ({v0}).', { v0: legendChampion(legend) || 'unité champion' }));
  if (champion && legend && !isChampionFor(champion, legend)) {
    errors.push(tx('Le champion doit être « {legendChampion} ».', { legendChampion: legendChampion(legend) }));
  }
  if (champion && !(deck.cards || []).some(s => s.cardId === deck.championId && s.zone === 'main')) {
    warnings.push(tx('Le champion choisi doit aussi être dans le deck principal.'));
  }
  if (counts.main < RULES.mainMin) errors.push(tx('Deck principal : {main} / {mainMin} cartes minimum.', { main: counts.main, mainMin: RULES.mainMin }));
  if (counts.main > RULES.mainMin) warnings.push(tx('En tournoi, le deck principal fait exactement {mainMin} cartes (ici {main}).', { mainMin: RULES.mainMin, main: counts.main }));
  if (counts.side > RULES.sideboard) warnings.push(tx('Réserve : {side} cartes ({sideboard} en tournoi).', { side: counts.side, sideboard: RULES.sideboard }));
  for (const { n, label } of byName.values()) {
    if (n > RULES.maxCopies) errors.push(tx('« {label} » : {n} exemplaires (maximum {maxCopies}).', { label, n, maxCopies: RULES.maxCopies }));
  }
  if (counts.rune !== RULES.runes) errors.push(tx('Runes : {rune} / {runes}.', { rune: counts.rune, runes: RULES.runes }));
  if (counts.battlefield !== RULES.battlefields) errors.push(tx('Champs de bataille : {battlefield} / {battlefields}.', { battlefield: counts.battlefield, battlefields: RULES.battlefields }));
  for (const [name, n] of bfNames) {
    if (n > 1) errors.push(tx('Champ de bataille « {name} » en {n} exemplaires (tous doivent être différents).', { name, n }));
  }
  if (signatures.n > RULES.signatureMax) {
    errors.push(tx('Cartes Signature : {n} (maximum {signatureMax} au total).', { n: signatures.n, signatureMax: RULES.signatureMax }));
  }
  if (signatures.wrongTag.size) {
    errors.push(tx('Cartes Signature d’un autre champion que « {champTag} » : {join}.', { champTag, join: [...signatures.wrongTag].slice(0, 4).join(', ') }));
  }
  if (banned.size) errors.push(tx('Carte{v0} bannie{v1} : {join}.', { v0: banned.size > 1 ? 's' : '', v1: banned.size > 1 ? 's' : '', join: [...banned].slice(0, 5).join(', ') }));
  for (const [name, since] of soon) warnings.push(tx('« {name} » sera bannie à partir du {frenchDate}.', { name, frenchDate: frenchDate(since) }));
  for (const { n, max, label } of restricted.values()) {
    if (n > max) errors.push(tx('« {label} » est limitée à {max} exemplaire{v2} (ici {n}).', { label, max, v2: max > 1 ? 's' : '', n }));
  }
  if (offDomain.length) {
    errors.push(tx('Hors des domaines de la Légende : {join}{v1}.', { join: [...new Set(offDomain)].slice(0, 5).join(', '), v1: offDomain.length > 5 ? '…' : '' }));
  }
  return { counts, errors, warnings, ok: errors.length === 0, legend, champion, signatures: signatures.n, format, bannedIds, banDate: banListInfo(format, ban, day).date };
}

/** Today as « YYYY-MM-DD » (local time): a ban counts from its effective date. */
export function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Formats of the ban list ([{ id, label }]), Standard first. */
export function deckFormats(ban = getBanlist()) {
  const ids = Object.keys(ban?.formats || { standard: {} });
  return ids.map(id => ({ id, label: ban?.formats?.[id]?.label || (id === 'standard' ? 'Standard' : id) }));
}

/** A deck's format: its own choice when the list knows it, else Standard. */
export function deckFormat(deck, ban = getBanlist()) {
  const f = deck?.format;
  return f && ban?.formats?.[f] ? f : 'standard';
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Is this card banned / restricted in the format, on that date? Entries of
 * banlist.json: a card id (« ogn-001-298 »), a full English name (all prints),
 * or { name, ids?, since? } — `ids` lists every print when the catalog's name is
 * not enough (champions: « Ekko, Recurrent » is « Ekko » in the catalog), and
 * `since` is the date the ban takes effect (not banned before).
 * @returns {{ banned?: boolean, since?: string, name?: string, max?: number } | null}
 */
export function banStatus(cardData, ban = getBanlist(), format = 'standard', date = todayIso()) {
  const f = ban?.formats?.[format];
  if (!f || !cardData) return null;
  const keys = [cardData.id, cardKey(cardData), cardData.name].filter(Boolean).map(k => String(k).toLowerCase());
  for (const e of f.banned || []) {
    if (typeof e === 'string') {
      if (keys.includes(e.toLowerCase()) || norm(e) === norm(cardData.name)) return { banned: true, name: e };
      continue;
    }
    if (e.since && e.since > date) continue;
    const hit = e.ids?.length ? e.ids.includes(cardData.id) : norm(e.name) === norm(cardData.name);
    if (hit) return { banned: true, since: e.since, name: e.name };
  }
  for (const [k, max] of Object.entries(f.restricted || {})) {
    if (keys.includes(k.toLowerCase())) return { max: Number(max) };
  }
  return null;
}

/**
 * Ownership of a deck's cards. For each slot: copies already in this deck,
 * free copies (no deck, not lent) you could add, and how many are missing.
 * Copies of the same card name (other prints/languages) are accepted.
 *
 * @param deck    deck record
 * @param copies  all live copies of the collection
 */
export function deckOwnership(deck, copies) {
  const m = getMatcher();
  const nameOf = (id) => cardKey(m.getCardData(id));
  const needByName = new Map();
  const add = (cardId, n) => {
    const name = nameOf(cardId);
    if (name) needByName.set(name, (needByName.get(name) || 0) + n);
  };
  for (const s of deck.cards || []) add(s.cardId, s.quantity);
  if (deck.legendId) add(deck.legendId, 1);

  const inDeck = new Map();
  const free = new Map();
  for (const c of copies) {
    const name = nameOf(c.cardId);
    if (!name || !needByName.has(name)) continue;
    if (c.deckId === deck.id) inDeck.set(name, (inDeck.get(name) || 0) + 1);
    else if (!c.deckId && !c.loanId) free.set(name, (free.get(name) || 0) + 1);
  }
  const byName = new Map();
  let missing = 0;
  for (const [name, need] of needByName) {
    const have = inDeck.get(name) || 0;
    const avail = free.get(name) || 0;
    const miss = Math.max(0, need - have - avail);
    missing += miss;
    byName.set(name, { need, inDeck: have, free: avail, missing: miss });
  }
  return { byName, missing };
}

/**
 * Free copies to move into the deck so it holds what its list needs
 * (prefers the exact print, then other prints of the same name).
 */
export function copiesToAssign(deck, copies) {
  const m = getMatcher();
  const nameOf = (id) => cardKey(m.getCardData(id));
  const need = new Map(); // name → remaining needed
  const prefer = new Map(); // name → Set(cardId) of the exact prints in the list
  const want = (cardId, n) => {
    const name = nameOf(cardId);
    if (!name) return;
    need.set(name, (need.get(name) || 0) + n);
    if (!prefer.has(name)) prefer.set(name, new Set());
    prefer.get(name).add(cardId);
  };
  for (const s of deck.cards || []) want(s.cardId, s.quantity);
  if (deck.legendId) want(deck.legendId, 1);
  for (const c of copies) {
    if (c.deckId !== deck.id) continue;
    const name = nameOf(c.cardId);
    if (need.has(name)) need.set(name, need.get(name) - 1);
  }
  const freeCopies = copies
    .filter(c => !c.deckId && !c.loanId)
    .sort((a, b) => {
      const pa = prefer.get(nameOf(a.cardId))?.has(a.cardId) ? 0 : 1;
      const pb = prefer.get(nameOf(b.cardId))?.has(b.cardId) ? 0 : 1;
      return pa - pb;
    });
  const ids = [];
  for (const c of freeCopies) {
    const name = nameOf(c.cardId);
    if ((need.get(name) || 0) > 0) {
      ids.push(c.id);
      need.set(name, need.get(name) - 1);
    }
  }
  return ids;
}

/**
 * The ban list of a format on a date: { date: latest effective date reached,
 * count, upcoming: [{ since, names }] (bans announced, not in force yet), sources }.
 */
export function banListInfo(format = 'standard', ban = getBanlist(), date = todayIso()) {
  const list = ban?.formats?.[format]?.banned || [];
  let last = null;
  let count = 0;
  const upcoming = new Map();
  for (const e of list) {
    const since = typeof e === 'string' ? null : e.since;
    if (since && since > date) {
      if (!upcoming.has(since)) upcoming.set(since, []);
      upcoming.get(since).push(e.name);
      continue;
    }
    count++;
    if (since && (!last || since > last)) last = since;
  }
  return {
    date: last || ban?.updatedAt || null,
    count,
    upcoming: [...upcoming].sort().map(([since, names]) => ({ since, names })),
    sources: ban?.sources || (ban?.source ? [{ url: ban.source }] : []),
  };
}

const MONTHS = ['janv.', tx('févr.'), 'mars', 'avr.', 'mai', 'juin', 'juil.', tx('août'), 'sept.', 'oct.', 'nov.', tx('déc.')];
/** « 2026-09-18 » → « 18 sept. 2026 » (B.1). */
export function frenchDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

const bannedCache = new WeakMap(); // ban list → Map(key → boolean)
/** Banned now in this format? (card tiles: catalog, collection), cached per list. */
export function isBanned(cardData, format = 'standard', date = todayIso(), ban = getBanlist()) {
  if (!cardData || !ban) return false;
  let m = bannedCache.get(ban);
  if (!m) { m = new Map(); bannedCache.set(ban, m); }
  const k = `${cardData.id}|${format}|${date}`;
  if (!m.has(k)) m.set(k, !!banStatus(cardData, ban, format, date)?.banned);
  return m.get(k);
}

