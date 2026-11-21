/**
 * Deck lists as text, to share a deck or copy one from a deck-building site.
 *
 * Export (the usual layout of Riftbound deck sites):
 *
 *   Legend:
 *   1 Jinx - Loose Cannon
 *   Champion:
 *   1 Jinx - Demolitionist
 *   MainDeck:
 *   3 Get Excited!
 *   ...
 *   Battlefields:
 *   1 The Grand Plaza
 *   Runes:
 *   6 Fury Rune
 *   Sideboard:
 *   ...
 *
 * Import is lenient: English or French names, "Name - Title" or "Name, Title",
 * "3 Name", "3x Name", "Name x3", card codes ("OGN-030", "OGN-030/298"),
 * section titles in English or French (or none: the zone then comes from the
 * card type).
 */
import { getMatcher } from './cardMatcher.js';
import { isDeckCode, decodeDeck } from './deckShare.js';
import { isCommunityCode, communityCodeToDeck, formatCode } from './deckCodes.js';
import { getLocalizedName } from './cardLocale.js';
import { isBaseCard, setRank } from './catalog.js';
import { zoneForCard } from './deckRules.js';

const SECTIONS = [
  { zone: 'legend', re: /^(legend|légende|legende)s?$/ },
  { zone: 'champion', re: /^(chosen )?champions?( choisi)?$/ },
  { zone: 'main', re: /^(main ?deck|main|deck|deck principal|principal|cartes?)$/ },
  { zone: 'battlefield', re: /^(battlefields?|champs? de bataille|cdb)$/ },
  { zone: 'rune', re: /^(runes?|rune deck|deck de runes?)$/ },
  { zone: 'side', re: /^(sideboard|side|réserve|reserve)$/ },
];

/** Name used to compare cards: lowercase, no accents/punctuation. */
export function normName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/\s+-\s+|,\s*/g, ' ')
    .replace(/[^a-z0-9&+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Preferred print for a name: base card of the earliest set.
function better(a, b) {
  const ba = isBaseCard(a) ? 0 : 1;
  const bb = isBaseCard(b) ? 0 : 1;
  return ba - bb || setRank(a.set) - setRank(b.set) || (a.number || 0) - (b.number || 0);
}

let index = null;
function getIndex() {
  const m = getMatcher();
  if (index && index.cards === m.cards) return index;
  const byName = new Map(); // normalized name → [cards]
  const byCode = new Map(); // "ogn-030" / "ogn-030a" → card
  const push = (key, c) => {
    if (!key) return;
    const list = byName.get(key) || [];
    if (!list.includes(c)) list.push(c);
    byName.set(key, list);
  };
  for (const raw of m.cards) {
    const c = { ...m.getCardData(raw.id), number: raw.number, nameFr: raw.nameFr };
    if (!c.id) continue;
    push(normName(c.nameEn), c);
    push(normName(c.name), c);
    push(normName(c.nameFr), c);
    if (c.type === 'legend' && c.tags?.[0]) push(normName(`${c.tags[0]} ${c.name}`), c);
    const code = (c.code || '').split('/')[0].toLowerCase();
    if (code) byCode.set(code.replace('*', '-star'), c);
  }
  for (const list of byName.values()) list.sort(better);
  index = { cards: m.cards, byName, byCode };
  return index;
}

function findCard(text, zone) {
  const { byName, byCode } = getIndex();
  // Card code, alone or in brackets: "OGN-030", "(OGN-030a/298)", "[OGN-030]"
  const codeM = /\b([a-z]{2,4})-(\d{1,3})([a-z]|\*)?(?:\/\d+)?\b/i.exec(text);
  if (codeM) {
    const key = `${codeM[1]}-${codeM[2].padStart(3, '0')}${codeM[3] === '*' ? '-star' : (codeM[3] || '')}`.toLowerCase();
    const c = byCode.get(key);
    if (c) return c;
  }
  const name = text.replace(/[([][^)\]]*[)\]]/g, ' ');
  let list = byName.get(normName(name)) || [];
  if (zone === 'legend') list = list.filter(c => c.type === 'legend').concat(list.filter(c => c.type !== 'legend'));
  else if (zone === 'champion') list = list.filter(c => c.type === 'unit').concat(list.filter(c => c.type !== 'unit'));
  else list = list.filter(c => c.type !== 'legend').concat(list.filter(c => c.type === 'legend'));
  return list[0] || null;
}

/** Find a card from free text (name in English/French, or card code). */
export function findCardByText(text) {
  return findCard(text, null);
}

/**
 * Parse a deck list. Returns { deck: { legendId, championId, cards }, unknown: [lines], count }.
 */
export function parseDeckList(text) {
  // Share code (« RB1.… », see deckShare.js)
  if (isDeckCode(text)) {
    const m = getMatcher();
    const r = decodeDeck(text, (id) => !!m.getCard(id));
    if (r) return { deck: r.deck, unknown: r.unknown, count: r.deck.cards.reduce((n, s) => n + s.quantity, 0) + (r.deck.legendId ? 1 : 0) };
  }
  // Community deck code (Piltover Archive format, lot 7.1)
  if (isCommunityCode(text)) {
    try {
      const m = getMatcher();
      const byCode = new Map();
      for (const c of m.cards || []) { const k = formatCode(c); if (k && !byCode.has(k)) byCode.set(k, c); }
      const r = communityCodeToDeck(text, byCode);
      return { deck: r.deck, unknown: r.unknown, count: r.deck.cards.reduce((n, s) => n + s.quantity, 0) + (r.deck.legendId ? 1 : 0) };
    } catch { /* not a valid code: read as a list below */ }
  }
  let section = null;
  const cards = new Map(); // zone|cardId → qty
  const unknown = [];
  let legendId = null;
  let championId = null;
  let count = 0;

  for (let line of String(text || '').split(/\r?\n/)) {
    line = line.replace(/\s*(\/\/|#).*$/, '').trim();
    if (!line) continue;
    // Section title: "MainDeck:", "Runes (12):", "Légende", or inline "Legend: Jinx - Loose Cannon"
    if (line.includes(':') || !/^\d/.test(line)) {
      const [head, ...tail] = line.split(':');
      const sec = SECTIONS.find(s => s.re.test(normName(head.replace(/\(\d+\)/g, ''))));
      if (sec) {
        section = sec.zone;
        line = tail.join(':').trim();
        if (!line) continue;
      }
    }

    let qty = 1;
    let rest = line;
    let mm;
    if ((mm = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(line))) { qty = Number(mm[1]); rest = mm[2]; }
    else if ((mm = /^(.+?)\s+[x×]\s*(\d+)$/i.exec(line))) { qty = Number(mm[2]); rest = mm[1]; }
    if (!qty) continue;

    const card = findCard(rest, section);
    if (!card) { unknown.push(line); continue; }
    count += qty;

    if (card.type === 'legend') { legendId = card.id; continue; }
    let zone = section === 'side' ? 'side' : zoneForCard(card);
    if (section === 'champion') { championId = card.id; zone = 'main'; }
    const key = `${zone}|${card.id}`;
    cards.set(key, (cards.get(key) || 0) + qty);
  }

  return {
    deck: {
      legendId,
      championId,
      cards: [...cards].map(([k, quantity]) => {
        const [zone, cardId] = k.split('|');
        return { cardId, zone, quantity };
      }),
    },
    unknown,
    count,
  };
}

/** Deck → text. language: 'English' (for deck sites) or 'French'. */
export function formatDeckList(deck, language = 'English') {
  const m = getMatcher();
  const nameOf = (id) => {
    const c = m.getCardData(id);
    if (!c) return id;
    if (language === 'French') return getLocalizedName(c, 'French');
    return c.nameEn || (c.type === 'legend' && c.tags?.[0] ? `${c.tags[0]} - ${c.name}` : c.name);
  };
  const fr = language === 'French';
  const out = [];
  const block = (title, items) => {
    if (!items.length) return;
    out.push(`${title}:`);
    for (const [id, q] of items) out.push(`${q} ${nameOf(id)}`);
    out.push('');
  };
  const slots = deck.cards || [];
  const zone = (z) => slots.filter(s => s.zone === z && s.quantity > 0)
    .sort((a, b) => nameOf(a.cardId).localeCompare(nameOf(b.cardId), 'fr'))
    .map(s => [s.cardId, s.quantity]);

  block(fr ? 'Légende' : 'Legend', deck.legendId ? [[deck.legendId, 1]] : []);
  let main = zone('main');
  if (deck.championId && main.some(([id]) => id === deck.championId)) {
    block(fr ? 'Champion' : 'Champion', [[deck.championId, 1]]);
    main = main.map(([id, q]) => [id, id === deck.championId ? q - 1 : q]).filter(([, q]) => q > 0);
  }
  block(fr ? 'Deck principal' : 'MainDeck', main);
  block(fr ? 'Champs de bataille' : 'Battlefields', zone('battlefield'));
  block(fr ? 'Runes' : 'Runes', zone('rune'));
  block(fr ? 'Réserve' : 'Sideboard', zone('side'));
  return out.join('\n').trim();
}
