import { tx, getLang } from './i18n.js';
import { fold } from './globalSearch.js';

/**
 * Text search of the « Cartes » tab (ONGLET-CARTES 1.4): plain words (French or
 * English name, number) and keys in the style of OpenRift / Scryfall, with
 * French aliases — `t:unité d:esprit e<=3 own:0`. The filters of the tab write
 * and read the same line (selectionFor / setSelection), so a search is always
 * one line of text. Pure: tests/cardQuery.test.mjs.
 */

// ─── Keys ──────────────────────────────────────────────────────────────────
// kind: num (number, operators), enum (fixed values), set, text, flag
export const KEYS = {
  t: { kind: 'enum', aliases: ['t', 'type'] },
  d: { kind: 'enum', aliases: ['d', 'domaine', 'domain', 'dom'] },
  e: { kind: 'num', aliases: ['e', 'energie', 'energy', 'cost', 'cout', 'mana'] },
  p: { kind: 'num', aliases: ['p', 'puissance', 'might', 'pow'] },
  r: { kind: 'enum', aliases: ['r', 'rarete', 'rarity', 'rar'] },
  s: { kind: 'set', aliases: ['s', 'set', 'extension', 'ext'] },
  o: { kind: 'text', aliases: ['o', 'texte', 'text', 'oracle'] },
  n: { kind: 'num', aliases: ['n', 'num', 'number', 'numero', 'no'] },
  is: { kind: 'flag', aliases: ['is', 'est'] },
  own: { kind: 'num', aliases: ['own', 'possede', 'possedee', 'owned', 'qte'] },
};
const KEY_OF = new Map(Object.entries(KEYS).flatMap(([k, d]) => d.aliases.map(a => [a, k])));

// Values of the enum keys: canonical id → accepted words (folded, without spaces / hyphens).
// The first French word is the one the filters write in a French interface.
const VALUES = {
  d: {
    fury: ['fureur', 'fury', 'rouge'], calm: ['calme', 'calm', 'vert'], mind: ['esprit', 'mind', 'bleu'],
    body: ['corps', 'body', 'orange'], chaos: ['chaos', 'violet'], order: ['ordre', 'order', 'jaune'],
    colorless: ['incolore', 'colorless'],
  },
  t: {
    unit: ['unite', 'unit', 'unites', 'units'], champion: ['champion', 'champions'], legend: ['legende', 'legend', 'legendes'],
    spell: ['sort', 'spell', 'sorts', 'spells'], gear: ['equipement', 'gear', 'equipements'], rune: ['rune', 'runes'],
    battlefield: ['champ', 'battlefield', 'champdebataille', 'champsdebataille', 'bf'],
  },
  r: {
    common: ['commune', 'common', 'c'], uncommon: ['peucommune', 'uncommon', 'pc', 'u'], rare: ['rare', 'r'],
    epic: ['epique', 'epic', 'e'], showcase: ['showcase', 's'],
  },
  is: {
    foil: ['foil'], promo: ['promo', 'promos'], signature: ['signature', 'sig'], banned: ['bannie', 'banned', 'banni', 'ban'],
    champion: ['champion'], deck: ['deck', 'dansundeck', 'indeck'],
  },
};
// Word written by the filters, per language (accents kept: « t:unité »)
const WRITE_FR = {
  d: { fury: 'fureur', calm: 'calme', mind: 'esprit', body: 'corps', chaos: 'chaos', order: 'ordre', colorless: 'incolore' },
  t: { unit: 'unité', champion: 'champion', legend: 'légende', spell: 'sort', gear: 'équipement', rune: 'rune', battlefield: 'champ' },
  r: { common: 'commune', uncommon: 'peu-commune', rare: 'rare', epic: 'épique', showcase: 'showcase' },
  is: { foil: 'foil', promo: 'promo', signature: 'signature', banned: 'bannie', champion: 'champion', deck: 'deck' },
};

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'showcase'];
const RARITY_RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
/** Options of the filters (canonical ids). */
export const OPTIONS = {
  d: ['fury', 'calm', 'mind', 'body', 'chaos', 'order'],
  t: ['legend', 'champion', 'unit', 'spell', 'gear', 'rune', 'battlefield'],
  r: RARITIES,
  e: ['0', '1', '2', '3', '4', '5', '6', '7+'],
  p: ['0', '1', '2', '3', '4', '5', '6', '7+'],
  is: ['foil', 'promo', 'signature', 'banned', 'deck'],
};

const norm = (s) => fold(s).replace(/[\s\-_'’.]/g, '');

/** Canonical id of an enum value (exact word, else the only word it starts), or null. */
export function canonValue(key, word) {
  const table = VALUES[key];
  const w = norm(word);
  if (!table || !w) return null;
  for (const [id, words] of Object.entries(table)) if (id === w || words.includes(w)) return id;
  const hits = Object.entries(table).filter(([, words]) => words.some(x => x.startsWith(w)));
  return hits.length === 1 ? hits[0][0] : null;
}

// ─── Parsing ───────────────────────────────────────────────────────────────
const TOKEN = /(?:"[^"]*"?|[^\s"])+/g;
const TERM = /^(-?)([a-zA-ZÀ-ɏ]+)(<=|>=|!=|:|=|<|>)([\s\S]*)$/;

const unquote = (s) => s.replace(/"/g, '');
/** Split a value on the commas outside quotes. */
function splitList(v) {
  const out = []; let cur = ''; let q = false;
  for (const ch of v) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

/**
 * → { tokens: [{ raw, type: 'term', key, op, values, neg } | { raw, type: 'text', value, neg }] }.
 * An unknown key is plain text; a key without a value (« t: » while typing) filters nothing.
 */
export function parseQuery(text) {
  const tokens = [];
  for (const raw of String(text || '').match(TOKEN) || []) {
    const m = TERM.exec(raw);
    const key = m && KEY_OF.get(fold(m[2]));
    if (key) {
      const kind = KEYS[key].kind;
      const values = kind === 'text' ? [unquote(m[4])].filter(Boolean) : splitList(m[4]);
      tokens.push({ raw, type: 'term', key, op: m[3] === '=' ? ':' : m[3], values, neg: m[1] === '-' });
      continue;
    }
    const neg = raw.length > 1 && raw[0] === '-';
    const value = unquote(neg ? raw.slice(1) : raw);
    if (value.trim()) tokens.push({ raw, type: 'text', value, neg });
  }
  return { tokens };
}

/** The line contains at least one key (shown in a monospace font). */
export const hasKeys = (text) => parseQuery(text).tokens.some(t => t.type === 'term');

// ─── Matching ──────────────────────────────────────────────────────────────
const NUM_OPS = {
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};

/** Number term against a card value (null = the card has none: never matches). */
function numMatch(term, v) {
  if (v == null || !Number.isFinite(v)) return false;
  if (NUM_OPS[term.op]) {
    const b = parseFloat(term.values[0]);
    return Number.isFinite(b) && NUM_OPS[term.op](v, b);
  }
  const eq = term.values.some(x => (/^\d+\+$/.test(x) ? v >= parseInt(x, 10) : parseFloat(x) === v));
  return term.op === '!=' ? !eq : eq;
}

/** Enum term against the card's canonical values (an array). */
function enumMatch(term, key, vals) {
  if (key === 'r' && NUM_OPS[term.op]) {
    const b = RARITY_RANK[canonValue('r', term.values[0])];
    const a = RARITY_RANK[vals[0]];
    return a != null && b != null && NUM_OPS[term.op](a, b);
  }
  const eq = term.values.some(x => { const id = canonValue(key, x); return id != null && vals.includes(id); });
  return term.op === '!=' ? !eq : eq;
}

const info = new WeakMap();
/** Folded search texts of a card (cached). `extra(card)` → { nameFr, textFr }. */
function searchInfo(card, extra) {
  let i = info.get(card);
  if (!i) {
    const x = extra?.(card) || {};
    const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ');
    const digits = /^(\d+)/.exec(card.collectorNumber || '');
    i = {
      names: `${fold(card.nameEn || card.name)} | ${fold(card.name)} | ${fold(x.nameFr)}`,
      code: fold(card.code),
      num: digits ? parseInt(digits[1], 10) : null,
      text: `${fold(strip(card.text))} | ${fold(x.textFr)}`,
      set: fold(card.set),
      setName: fold(card.setName),
    };
    info.set(card, i);
  }
  return i;
}

/** Canonical values of a card for an enum key. */
export function cardValues(card, key) {
  if (key === 'd') return card.domains?.length ? card.domains : card.domain ? [card.domain] : [];
  if (key === 't') {
    const champ = (card.superTypes || []).includes('champion');
    return card.type ? (champ ? [card.type, 'champion'] : [card.type]) : [];
  }
  if (key === 'r') return card.rarity ? [card.rarity] : [];
  return [];
}

export const isPromo = (card) => card.variant === 'promo' || /-(R|SP)\d/i.test(card.code || '');

function flagMatch(flag, card, ctx) {
  switch (flag) {
    case 'foil': return !!ctx.foil?.(card);
    case 'promo': return isPromo(card);
    case 'signature': return !!card.signature || (card.superTypes || []).includes('signature');
    case 'banned': return !!ctx.banned?.(card);
    case 'champion': return (card.superTypes || []).includes('champion');
    case 'deck': return !!ctx.inDeck?.(card);
    default: return false;
  }
}

function termMatch(t, card, ctx) {
  if (!t.values.length) return true;
  const i = searchInfo(card, ctx.extra);
  switch (t.key) {
    case 'e': return numMatch(t, card.energy);
    case 'p': return numMatch(t, card.might);
    case 'n': return numMatch(t, i.num);
    case 'own': return numMatch(t, ctx.owned?.(card) || 0);
    case 'd': case 't': case 'r': return enumMatch(t, t.key, cardValues(card, t.key));
    case 's': {
      const eq = t.values.some(v => { const f = fold(v); return f === i.set || (f.length > 2 && i.setName.startsWith(f)); });
      return t.op === '!=' ? !eq : eq;
    }
    case 'o': return t.values.every(v => i.text.includes(fold(v)));
    case 'is': {
      const eq = t.values.some(v => flagMatch(canonValue('is', v), card, ctx));
      return t.op === '!=' ? !eq : eq;
    }
    default: return true;
  }
}

function textMatch(t, card, ctx) {
  const i = searchInfo(card, ctx.extra);
  const w = fold(t.value);
  if (/^\d+$/.test(w)) return i.num === parseInt(w, 10) || i.names.includes(w);
  return i.names.includes(w) || i.code.startsWith(w);
}

/**
 * Predicate of a parsed query. `ctx`: { extra(card) → { nameFr, textFr },
 * owned(card) → copies, banned(card), inDeck(card), foil(card) }.
 * `skip`: keys left out (the counts of a filter computed without it).
 */
export function compileQuery(parsed, ctx = {}, { skip = [] } = {}) {
  const tokens = parsed.tokens.filter(t => !(t.type === 'term' && skip.includes(t.key)));
  if (!tokens.length) return () => true;
  return (card) => tokens.every(t => {
    const ok = t.type === 'term' ? termMatch(t, card, ctx) : textMatch(t, card, ctx);
    return t.neg ? !ok : ok;
  });
}

// ─── Filters ↔ line of text ────────────────────────────────────────────────
const positive = (parsed, key) => parsed.tokens.filter(t => t.type === 'term' && t.key === key && !t.neg && t.values.length);

/**
 * Options of a filter lit by the line: those that satisfy every (positive)
 * term of the key — « e<=3 » lights 0, 1, 2 and 3; « r>=rare » lights rare,
 * epic and showcase. Empty when the key is absent.
 */
export function selectionFor(parsed, key, options = OPTIONS[key] || []) {
  const terms = positive(parsed, key);
  if (!terms.length) return new Set();
  const kind = KEYS[key].kind;
  return new Set(options.filter(opt => terms.every(t => {
    if (kind === 'num') return numMatch(t, parseInt(opt, 10));
    if (kind === 'set') return t.op === '!=' ? !t.values.some(v => fold(v) === fold(opt)) : t.values.some(v => fold(v) === fold(opt));
    if (kind === 'flag') return t.values.some(v => canonValue('is', v) === opt);
    return enumMatch(t, key, [opt]);
  })));
}

/** Word the filters write for a value (French words in a French interface). */
export function valueWord(key, id, lang = getLang()) {
  if (KEYS[key]?.kind === 'set') return String(id).toLowerCase();
  if (lang === 'fr' && WRITE_FR[key]?.[id]) return WRITE_FR[key][id];
  return String(id);
}

const join = (tokens) => tokens.map(t => t.raw).join(' ');

/**
 * New line where the filter `key` selects exactly `values` (canonical ids):
 * its positive terms are replaced by one « key:a,b » term at the end.
 */
export function setSelection(text, key, values, lang = getLang()) {
  const parsed = parseQuery(text);
  const keep = parsed.tokens.filter(t => !(t.type === 'term' && t.key === key && !t.neg));
  const order = OPTIONS[key];
  const list = order ? order.filter(v => (values instanceof Set ? values.has(v) : values.includes(v))) : [...values];
  const raw = list.length ? `${key}:${list.map(v => valueWord(key, v, lang)).join(',')}` : null;
  return [join(keep), raw].filter(Boolean).join(' ');
}

/** Turn one option of a filter on or off (`options`: every option of the filter, e.g. the set codes). */
export function toggleOption(text, key, value, options = OPTIONS[key], lang = getLang()) {
  const sel = selectionFor(parseQuery(text), key, options || [value]);
  if (sel.has(value)) sel.delete(value); else sel.add(value);
  return setSelection(text, key, options ? options.filter(o => sel.has(o)) : [...sel], lang);
}

/** « is:x » flags are separate terms (they add up): on / off. */
export function toggleFlag(text, flag, lang = getLang()) {
  const parsed = parseQuery(text);
  const has = (t) => t.type === 'term' && t.key === 'is' && !t.neg && t.values.length === 1 && canonValue('is', t.values[0]) === flag;
  if (parsed.tokens.some(has)) return join(parsed.tokens.filter(t => !has(t)));
  return [text.trim(), `is:${valueWord('is', flag, lang)}`].filter(Boolean).join(' ');
}
export const flagOn = (parsed, flag) => parsed.tokens.some(t => t.type === 'term' && t.key === 'is' && !t.neg && t.values.some(v => canonValue('is', v) === flag));

/** The line without its token n° `index` (chips of the active filters). */
export function removeToken(text, index) {
  return join(parseQuery(text).tokens.filter((_, i) => i !== index));
}

// ─── Chips of the active filters ───────────────────────────────────────────
const KEY_LABEL = {
  t: tx('Type'), d: tx('Domaine'), e: tx('Énergie'), p: tx('Puissance'), r: tx('Rareté'), s: tx('Set'),
  o: tx('Texte'), n: tx('Numéro'), is: tx('Autres'), own: tx('Possédées'),
};
const OP_LABEL = { ':': ' : ', '!=': ' ≠ ', '<': ' < ', '<=': ' ≤ ', '>': ' > ', '>=': ' ≥ ' };
export const VALUE_LABEL = {
  d: { fury: tx('Fureur'), calm: tx('Calme'), mind: tx('Esprit'), body: tx('Corps'), chaos: tx('Chaos'), order: tx('Ordre'), colorless: tx('Incolore') },
  t: { unit: tx('Unité'), champion: tx('Champion'), legend: tx('Légende'), spell: tx('Sort'), gear: tx('Équipement'), rune: tx('Rune'), battlefield: tx('Champ de bataille') },
  r: { common: tx('Commune'), uncommon: tx('Peu commune'), rare: tx('Rare'), epic: tx('Épique'), showcase: tx('Showcase') },
  is: { foil: tx('Foil'), promo: tx('Promo'), signature: tx('Signature'), banned: tx('Bannie'), champion: tx('Champion'), deck: tx('Dans un deck') },
};

/** Label of a token for its chip: « Type : Unité », « Énergie ≤ 3 », « “jinx” ». */
export function tokenLabel(t) {
  if (t.type === 'text') return `${t.neg ? tx('sans') + ' ' : ''}« ${t.value} »`;
  const shown = t.values.map(v => {
    const id = VALUES[t.key] ? canonValue(t.key, v) : null;
    return (id && VALUE_LABEL[t.key]?.[id]) || (t.key === 's' ? v.toUpperCase() : v);
  }).join(', ');
  if (t.key === 'is') return `${t.neg ? tx('Pas') + ' ' : ''}${shown}`;
  return `${t.neg ? tx('Pas') + ' ' : ''}${KEY_LABEL[t.key]}${OP_LABEL[t.op] || ' : '}${shown}`;
}

/** The syntax help (« ? » of the search bar). */
export const SYNTAX_HELP = [
  ['t:', tx('type'), 't:unité, t:légende, -t:sort'],
  ['d:', tx('domaine'), 'd:esprit, d:fury,calm'],
  ['e:', tx('énergie'), 'e<=3, e:0, e>=7'],
  ['p:', tx('puissance'), 'p>=4, p:4,5'],
  ['r:', tx('rareté (ordonnée)'), 'r>=rare, r:commune'],
  ['s:', tx('set'), 's:ogn, s:sfd'],
  ['o:', tx('mot du texte de la carte'), 'o:pioche, o:"au début"'],
  ['n:', tx('numéro'), 'n:118, n>=300'],
  ['is:', tx('foil, promo, signature, bannie, champion, deck'), 'is:promo, -is:bannie'],
  ['own:', tx('exemplaires possédés'), 'own:0, own>=3'],
];
