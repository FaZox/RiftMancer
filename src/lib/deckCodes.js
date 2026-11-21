/**
 * Community deck codes (lot 7.1): the format of Piltover Archive's
 * « @piltoverarchive/riftbound-deck-codes » (v1.5.0, Apache License 2.0,
 * Copyright 2025 PiltoverArchive — itself adapted from Riot's LoRDeckCodes),
 * re-implemented here from its published code and README; see
 * THIRD_PARTY_LICENSES.md. Pure: tests/deckCodes.test.mjs.
 *
 * Byte layout: (format 1 << 4) | version, then the main deck and the
 * sideboard grouped by copy count, then the chosen champion (V3+), then the
 * additional legends (V6). Varints are LEB128; the result is base32
 * (RFC 4648, no padding). A card is « SET-NUMBERvariant » (OGN-030a, RAD-SP1).
 */

const FORMAT = 1;
const MAX_VERSION = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const SET_MAP = { OGN: 0, OGS: 1, ARC: 2, SFD: 3, UNL: 4, VEN: 5, RAD: 6 };
const VARIANT_MAP = { '': 0, a: 1, s: 2, '*': 2, b: 3 };
const SET_OF = Object.fromEntries(Object.entries(SET_MAP).map(([k, v]) => [v, k]));
const VARIANT_OF = { 0: '', 1: 'a', 2: 's', 3: 'b' };

function base32Encode(bytes) {
  let out = '', buffer = 0, bits = 0;
  for (const b of bytes) {
    buffer = ((buffer << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += ALPHABET[(buffer >> bits) & 0x1f]; }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 0x1f];
  return out;
}

function base32Decode(str) {
  const bytes = [];
  let buffer = 0, bits = 0;
  for (const ch of str) {
    const v = ALPHABET.indexOf(ch.toUpperCase());
    if (v < 0) throw new Error(`caractère inattendu « ${ch} »`);
    buffer = ((buffer << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 0xff); }
  }
  return bytes;
}

const varint = (n) => {
  const out = [];
  do {
    let b = n & 0x7f;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
};

/** Reads the bytes in order. */
function reader(bytes) {
  let i = 0;
  return {
    byte() { if (i >= bytes.length) throw new Error('code tronqué'); return bytes[i++]; },
    varint() {
      let r = 0, shift = 0;
      for (;;) {
        const b = this.byte();
        r += (b & 0x7f) * 2 ** shift;
        if (!(b & 0x80)) return r;
        shift += 7;
        if (shift > 35) throw new Error('nombre invalide');
      }
    },
  };
}

/** « OGN-030a » → { set, number: '030', prefix: '', variant: 'a' } */
export function parseCardCode(code) {
  const m = /^([A-Z]{3})-((R|SP)?(\d+))([a-z*]?)$/.exec(String(code).trim());
  if (!m || !(m[1] in SET_MAP)) return null;
  return { set: m[1], prefix: m[3] || '', num: Number(m[4]), variant: m[5] === '*' ? 's' : m[5] };
}

const FLAG = { '': 0, R: 1, SP: 2 };
const numberText = (flag, num) => (flag === 1 ? `R${String(num).padStart(2, '0')}` : flag === 2 ? `SP${num}` : String(num).padStart(3, '0'));

function groups(cards) {
  const m = new Map();
  for (const c of cards) {
    const p = parseCardCode(c.cardCode);
    if (!p) throw new Error(`carte inconnue du format (${c.cardCode})`);
    const k = `${SET_MAP[p.set]}|${VARIANT_MAP[p.variant]}`;
    if (!m.has(k)) m.set(k, { set: SET_MAP[p.set], variant: VARIANT_MAP[p.variant], cards: [] });
    m.get(k).cards.push(p);
  }
  const key = (p) => `${p.prefix}${String(p.num).padStart(6, '0')}`;
  return [...m.values()]
    .sort((a, b) => a.set - b.set || a.variant - b.variant)
    .map(g => ({ ...g, cards: g.cards.sort((a, b) => key(a).localeCompare(key(b))) }));
}

const cardBytes = (p, flagged) => [...(flagged ? [FLAG[p.prefix]] : []), ...varint(p.num)];

function encodeSection(deck, maxCount, flagged) {
  const bytes = [];
  for (let count = maxCount; count >= 1; count--) {
    const gs = groups(deck.filter(c => c.count === count));
    bytes.push(...varint(gs.length));
    for (const g of gs) {
      bytes.push(...varint(g.cards.length), g.set, g.variant);
      for (const p of g.cards) bytes.push(...cardBytes(p, flagged));
    }
  }
  return bytes;
}

function encodeSparse(deck, flagged) {
  const counts = [...new Set(deck.map(c => c.count))].sort((a, b) => b - a);
  const bytes = [...varint(counts.length)];
  for (const count of counts) {
    const gs = groups(deck.filter(c => c.count === count));
    bytes.push(...varint(count), ...varint(gs.length));
    for (const g of gs) {
      bytes.push(...varint(g.cards.length), g.set, g.variant);
      for (const p of g.cards) bytes.push(...cardBytes(p, flagged));
    }
  }
  return bytes;
}

function cardRef(code, flagged) {
  const p = parseCardCode(code);
  if (!p) throw new Error(`carte inconnue du format (${code})`);
  return [SET_MAP[p.set], VARIANT_MAP[p.variant], ...cardBytes(p, flagged)];
}

/**
 * mainDeck / sideboard: [{ cardCode, count }]; the version is chosen like
 * the reference encoder (V3, V4 with rune numbers, V5 for SP numbers or many
 * copies, V6 with additional legends).
 */
export function getCodeFromDeck(mainDeck, sideboard = [], chosenChampion = null, additionalLegends = []) {
  const all = [...mainDeck, ...sideboard].map(c => c.cardCode).concat(chosenChampion ? [chosenChampion] : [], additionalLegends);
  for (const c of [...mainDeck, ...sideboard]) if (!Number.isSafeInteger(c.count) || c.count < 1) throw new Error(`nombre d’exemplaires invalide (${c.cardCode})`);
  const parsed = all.map(c => parseCardCode(c));
  if (parsed.some(p => !p)) throw new Error(`carte inconnue du format (${all[parsed.findIndex(p => !p)]})`);
  const anyRune = parsed.some(p => p.prefix === 'R');
  const anySP = parsed.some(p => p.prefix === 'SP');
  const many = mainDeck.some(c => c.count > 12) || sideboard.some(c => c.count > 3);
  const version = additionalLegends.length ? 6 : many || anySP ? 5 : anyRune ? 4 : 3;
  const flagged = anyRune || anySP || version === 4;
  const bytes = [(FORMAT << 4) | version];
  if (version >= 5) {
    bytes.push(flagged ? 1 : 0, ...encodeSparse(mainDeck, flagged), ...encodeSparse(sideboard, flagged));
  } else {
    bytes.push(...encodeSection(mainDeck, 12, flagged), ...encodeSection(sideboard, 3, flagged));
  }
  bytes.push(...(chosenChampion ? [1, ...cardRef(chosenChampion, flagged)] : [0]));
  if (version >= 6) {
    bytes.push(...varint(additionalLegends.length));
    for (const l of additionalLegends) bytes.push(...cardRef(l, flagged));
  }
  return base32Encode(bytes);
}

function readCard(r, set, variant, flagged) {
  const flag = flagged ? r.byte() : 0;
  if (flag > 2) throw new Error('carte invalide');
  return `${set}-${numberText(flag, r.varint())}${variant}`;
}
function readGroup(r, count, flagged, out) {
  const n = r.varint();
  const set = SET_OF[r.byte()];
  const variant = VARIANT_OF[r.byte()];
  if (set === undefined) throw new Error('extension inconnue');
  if (variant === undefined) throw new Error('variante inconnue');
  for (let j = 0; j < n; j++) out.push({ cardCode: readCard(r, set, variant, flagged), count });
}
function readRef(r, flagged) {
  const set = SET_OF[r.byte()];
  const variant = VARIANT_OF[r.byte()];
  if (set === undefined || variant === undefined) throw new Error('carte invalide');
  return readCard(r, set, variant, flagged);
}

/** → { mainDeck, sideboard, chosenChampion, additionalLegends }; throws on a bad code. */
export function getDeckFromCode(code) {
  const r = reader(base32Decode(String(code).trim()));
  const head = r.byte();
  if (head >> 4 !== FORMAT) throw new Error('format inconnu');
  const version = head & 0x0f;
  if (version < 1 || version > MAX_VERSION) throw new Error(`version ${version} non prise en charge`);
  let flagged = version === 4;
  if (version >= 5) {
    const f = r.byte();
    if (f > 1) throw new Error('code invalide');
    flagged = f === 1;
  }
  const section = (maxCount) => {
    const out = [];
    if (version >= 5) {
      const counts = r.varint();
      for (let i = 0; i < counts; i++) {
        const count = r.varint();
        const ng = r.varint();
        for (let k = 0; k < ng; k++) readGroup(r, count, flagged, out);
      }
    } else {
      for (let count = maxCount; count >= 1; count--) {
        const ng = r.varint();
        for (let k = 0; k < ng; k++) readGroup(r, count, flagged, out);
      }
    }
    return out;
  };
  const mainDeck = section(12);
  const sideboard = version >= 2 ? section(3) : [];
  let chosenChampion = null;
  if (version >= 3 && r.byte() === 1) chosenChampion = readRef(r, flagged);
  const additionalLegends = [];
  if (version >= 6) for (let i = r.varint(); i > 0; i--) additionalLegends.push(readRef(r, flagged));
  return { mainDeck, sideboard, chosenChampion, additionalLegends };
}

/** Looks like a community deck code (base32, starts with the format byte 0x1_ → « C »). */
export const isCommunityCode = (text) => /^\s*C[A-Z2-7]{15,}\s*$/.test(String(text || ''));

// ── The app's decks ⇄ the format ───────────────────────────────────────────

/** Catalog id « ogn-030a-298 » ⇄ format code « OGN-030a » (from the catalog's printed code). */
export const formatCode = (card) => (card?.code ? card.code.split('/')[0].replace(/\*$/, 's') : null);

/**
 * The app's deck → a community code. The Legend, runes and battlefields go
 * in the main deck, as in Piltover Archive; the reserve in the sideboard.
 * `cardOf(id)` → the catalog card. Throws with the card the format cannot hold.
 */
export function deckToCommunityCode(deck, cardOf) {
  const code = (id) => {
    const c = formatCode(cardOf(id));
    if (!c || !parseCardCode(c)) throw new Error(`${cardOf(id)?.name || id} n’existe pas dans le format commun`);
    return c;
  };
  const add = (map, id, n) => { const k = code(id); map.set(k, (map.get(k) || 0) + n); };
  const main = new Map(), side = new Map();
  if (deck.legendId) add(main, deck.legendId, 1);
  for (const s of deck.cards || []) if (s.quantity > 0) add(s.zone === 'side' ? side : main, s.cardId, s.quantity);
  const list = (m) => [...m].map(([cardCode, count]) => ({ cardCode, count }));
  return getCodeFromDeck(list(main), list(side), deck.championId ? code(deck.championId) : null);
}

/**
 * A community code → the app's deck: { deck: { legendId, championId, cards }, unknown }.
 * `byCode` maps « OGN-030a » to the catalog card; its type puts each card in
 * its zone (legend, rune, battlefield, the rest in the deck).
 */
export function communityCodeToDeck(code, byCode) {
  const d = getDeckFromCode(code);
  const deck = { legendId: null, championId: null, cards: [] };
  const unknown = [];
  const find = (c) => byCode.get(c) || byCode.get(c.replace(/s$/, '*'));
  for (const [list, side] of [[d.mainDeck, false], [d.sideboard, true]]) {
    for (const { cardCode, count } of list) {
      const card = find(cardCode);
      if (!card) { unknown.push(cardCode); continue; }
      if (!side && card.type === 'legend' && !deck.legendId) { deck.legendId = card.id; if (count > 1) deck.cards.push({ cardId: card.id, zone: 'main', quantity: count - 1 }); continue; }
      const zone = side ? 'side' : card.type === 'rune' ? 'rune' : card.type === 'battlefield' ? 'battlefield' : 'main';
      deck.cards.push({ cardId: card.id, zone, quantity: count });
    }
  }
  if (d.chosenChampion) {
    const card = find(d.chosenChampion);
    if (card) deck.championId = card.id; else unknown.push(d.chosenChampion);
  }
  return { deck, unknown };
}

/**
 * « Copier pour l'inscription » (lot 7.2): the English list with its sections,
 * refused while the deck breaks a rule or holds a banned card — the reason
 * names the first problem. `check`: deckRules.validateDeck(deck).
 */
export function registrationText(check, englishList) {
  if (check.errors.length) {
    const more = check.errors.length - 1;
    return { ok: false, reason: `${check.errors[0]}${more ? ` (et ${more} autre${more > 1 ? 's' : ''} problème${more > 1 ? 's' : ''})` : ''}` };
  }
  return { ok: true, text: englishList };
}
