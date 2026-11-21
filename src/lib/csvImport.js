/**
 * Collection import from a CSV file.
 *
 * Recognised layouts:
 *   - CardNexus / PowerTools (the app's own export):
 *       Quantity, Card Name, Collector Number, Expansion, Condition, Language, Finish, …
 *   - Riftmana:  Card ID ("OGN-030a"), Normal, Foil
 *   - Any CSV with similar column names, in English or French
 *     (quantité, nom, numéro, extension, état, langue, foil…).
 *
 * Cards are found by set + collector number first, then by name.
 */
import { getMatcher } from './cardMatcher.js';
import { findCardByText, normName } from './deckList.js';
import { LANGUAGES } from '../data/sampleCards.js';
import { parseCondition } from './conditions.js';

/** Minimal RFC-4180 CSV parser (quotes, "" escapes, , or ; separator). */
export function parseCsv(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

const COLS = {
  qty: ['quantity', 'qty', 'quantite', 'count', 'nombre', 'qte'],
  name: ['card name', 'name', 'nom', 'carte', 'card'],
  number: ['collector number', 'number', 'numero', 'no', 'collector', 'num'],
  set: ['expansion', 'set', 'extension', 'set code'],
  condition: ['condition', 'etat'],
  language: ['language', 'langue', 'lang'],
  finish: ['finish', 'foil', 'finition'],
  cardId: ['card id', 'id', 'code'],
  normal: ['normal', 'standard', 'non foil'],
  foilQty: ['foil'],
};

function langOf(v) {
  const s = normName(v);
  if (!s) return null;
  const l = LANGUAGES.find(x => normName(x.value) === s || normName(x.label) === s || normName(x.short) === s);
  if (l) return l.value;
  if (s.startsWith('fr')) return 'French';
  if (s.startsWith('en')) return 'English';
  return null;
}

// Either scale (Cardmarket, or the American one of CardNexus files) → Cardmarket
const conditionOf = parseCondition;

// "OGN", "030a" → "ogn-30a" (leading zeros and "*" ignored for the loose key).
const exactKey = (set, num) => `${set}-${num}`.toLowerCase();
const looseKey = (set, num) => {
  const m = /^0*(\d+)(.*)$/.exec(String(num).replace('*', ''));
  return `${set}-${m ? m[1] + m[2] : num}`.toLowerCase();
};

let codeIndex = null;
function byCode(set, number) {
  const m = getMatcher();
  if (!codeIndex || codeIndex.cards !== m.cards) {
    const exact = new Map();
    const loose = new Map();
    for (const c of m.cards) {
      const d = m.getCardData(c.id);
      if (!d) continue;
      exact.set(exactKey(d.set, d.collectorNumber), d);
      const k = looseKey(d.set, d.collectorNumber);
      // A star (signature) print never takes the loose key from the plain print.
      if (!loose.has(k) || !String(d.collectorNumber).includes('*')) loose.set(k, d);
    }
    codeIndex = { cards: m.cards, exact, loose };
  }
  return codeIndex.exact.get(exactKey(set, number)) || codeIndex.loose.get(looseKey(set, number)) || null;
}

/**
 * Parse a collection CSV.
 * Returns { entries: [{ cardId, quantity, language, foil, promo, condition }], unknown: [lines], copies }.
 */
export function parseCollectionCsv(text, defaults = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], unknown: [], copies: 0 };
  const head = rows[0].map(h => normName(h));
  const col = (key) => head.findIndex(h => COLS[key].includes(h));
  const ix = Object.fromEntries(Object.keys(COLS).map(k => [k, col(k)]));
  const riftmana = ix.cardId !== -1 && (ix.normal !== -1 || ix.foilQty !== -1) && ix.qty === -1;

  const entries = [];
  const unknown = [];
  const get = (r, k) => (ix[k] === -1 ? '' : String(r[ix[k]] ?? '').trim());

  for (const r of rows.slice(1)) {
    let card = null;
    const code = get(r, 'cardId');
    if (code) {
      const m = /^([a-z]+)-(.+)$/i.exec(code);
      if (m) card = byCode(m[1], m[2]);
    }
    if (!card && get(r, 'set') && get(r, 'number')) card = byCode(get(r, 'set'), get(r, 'number'));
    if (!card && get(r, 'name')) card = findCardByText(get(r, 'name'));
    if (!card && code) card = findCardByText(code);
    if (!card) { unknown.push(r.join(', ')); continue; }

    const promo = /x$/i.test(get(r, 'set') || code.split('-')[0] || '');
    const base = {
      cardId: card.id,
      language: langOf(get(r, 'language')) || defaults.language || 'English',
      condition: conditionOf(get(r, 'condition')) || defaults.condition || 'Near Mint',
      promo,
    };
    if (riftmana) {
      const n = Number.parseInt(get(r, 'normal'), 10) || 0;
      const f = Number.parseInt(get(r, 'foilQty'), 10) || 0;
      if (n > 0) entries.push({ ...base, quantity: n, foil: false });
      if (f > 0) entries.push({ ...base, quantity: f, foil: true });
      continue;
    }
    const qty = ix.qty === -1 ? 1 : Number.parseInt(get(r, 'qty'), 10) || 0;
    if (qty <= 0) continue;
    const fin = normName(get(r, 'finish'));
    const foil = !!fin && !['standard', 'normal', 'non foil', 'nonfoil', 'no', 'non', '0', 'false'].includes(fin);
    entries.push({ ...base, quantity: qty, foil });
  }
  return { entries, unknown, copies: entries.reduce((n, e) => n + e.quantity, 0) };
}
