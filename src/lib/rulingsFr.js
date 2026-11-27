/**
 * French rendering of the rulings (Riftbound FAQ is English only): the card
 * names in their official French form (the catalog's `nameFr`, from
 * riftboundfr.fr) and the game's mechanics vocabulary, a glossary verified
 * against the official French card texts (`textFr` vs `text`). Deterministic
 * and offline — no generic machine translation: what the glossary does not
 * know stays in English. Pure functions, tests/rulingsFr.test.mjs.
 *
 * The glossary is built from the served catalog, so it follows the content
 * updates; results are memoized per catalog / per FAQ entry.
 */

/**
 * Terminology EN → FR, verified against the official French card texts
 * (riftboundfr.fr). Terminology only — never verbs, auxiliaries or pronouns:
 * replacing an English verb inside an English sentence produces unreadable
 * franglais. What is not terminology stays in English (the curated French
 * translations of rulings-fr.json give whole sentences in French).
 * Keyword abilities ([Shield], [Hidden], buff, …) are kept in English by the
 * official French texts too, so they are deliberately absent here.
 */
export const MECHANICS_FR = [
  // phrases (aligned word order)
  ["owner's hand", 'main du propriétaire'],
  ['this turn', 'pendant ce tour'],
  ['enemy unit', 'unité ennemie'],
  ['friendly unit', 'unité alliée'],
  ['unit token', 'unité créée'],
  // nouns and adjectives (singular/plural, longest first)
  ['battlefields', 'champs de bataille'],
  ['battlefield', 'champ de bataille'],
  ['abilities', 'compétences'],
  ['ability', 'compétence'],
  ['spells', 'sorts'],
  ['spell', 'sort'],
  ['units', 'unités'],
  ['unit', 'unité'],
  ['tokens', 'unités créées'],
  ['enemies', 'ennemis'],
  ['enemy', 'ennemi'],
  ['costs', 'coûts'],
  ['cost', 'coût'],
  ['damage', 'dégâts'],
  ['additional', 'supplémentaire'],
  ['friendly', 'allié'],
  ['hand', 'main'],
  ['base', 'base'],
  ['might', 'puissance'],
  ['turn', 'tour'],
  ['combat', 'combat'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** All the English spellings a card may be called by (FAQ: « Lux, Crownguard »). */
function nameVariantsOf(c) {
  const out = [c.nameEn, c.name];
  if (c.nameEn) out.push(c.nameEn.replace(/\s+-\s+/, ', '));
  if (c.type === 'legend' && c.tags?.[0]) out.push(`${c.tags[0]} ${c.name}`);
  return out.filter(Boolean);
}

const glossaryCache = new WeakMap(); // catalog array → compiled glossary
const entryCache = new WeakMap();    // FAQ entry object → { version, fr }

/**
 * Curated French translations (public/rulings-fr.json): whole questions and
 * answers in French, keyed by FAQ card name then ruling id. Loaded once at
 * startup (fire and forget, like the banlist); rulings without a curated
 * translation fall back to the glossary view, then to English.
 */
let frData = null;   // { cards: { [cardName]: { [rulingId]: { q, a } } } }
let frVersion = 0;   // bumped on each load: the entry cache follows

export function setRulingsFr(data) {
  if (!data || typeof data !== 'object' || typeof data.cards !== 'object') return false;
  frData = data;
  frVersion++;
  return true;
}

export async function loadRulingsFr(url = '/rulings-fr.json', fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return false;
    return setRulingsFr(await res.json());
  } catch { return false; }
}

/** The curated French translation of one ruling, or null. */
export function curatedRuling(cardName, rulingId) {
  const c = frData?.cards?.[cardName]?.[rulingId];
  return c && typeof c.q === 'string' && typeof c.a === 'string' ? c : null;
}

/**
 * The rulings of a FAQ layer (data.cards) that have no curated French
 * translation yet: [{ card, id, question }]. Used on the PC to notify when
 * new English rulings arrive and still need a French translation.
 */
export function missingCuratedRulings(rulingsData, fr) {
  const out = [];
  for (const e of rulingsData?.cards || []) {
    for (const r of e.rulings || []) {
      if (!fr?.cards?.[e.name]?.[r.id]) out.push({ card: e.name, id: r.id, question: r.question });
    }
  }
  return out;
}

/**
 * The compiled glossary of a catalog: one case-insensitive regex over every
 * known English term (card names first, then the mechanics), mapped to its
 * official French form. Terms are matched on letter/digit boundaries only,
 * so « Kai'Sa » matches whole and « unitary » does not match « unit ».
 */
export function buildGlossary(catalog) {
  if (catalog && glossaryCache.has(catalog)) return glossaryCache.get(catalog);
  const map = new Map(); // lowercased EN term → FR
  if (Array.isArray(catalog)) {
    for (const c of catalog) {
      if (!c?.nameFr) continue;
      for (const v of nameVariantsOf(c)) {
        const k = v.toLowerCase();
        if (!map.has(k)) map.set(k, c.nameFr);
      }
    }
  }
  for (const [en, fr] of MECHANICS_FR) if (!map.has(en)) map.set(en, fr);
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const re = keys.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
    : null;
  const g = { re, map };
  if (catalog) glossaryCache.set(catalog, g);
  return g;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain text: every known English term becomes its official French form. */
export function translateRulingText(text, g) {
  if (typeof text !== 'string' || !text || !g?.re) return text || '';
  return text.replace(g.re, (m) => {
    const fr = g.map.get(m.toLowerCase()) || m;
    return /^[\p{Lu}]/u.test(m) ? cap(fr) : fr;
  });
}

/**
 * A ruling's answer HTML: only the text between the tags is translated —
 * tags and their attributes (href, …) are passed through untouched, so the
 * sanitization done upstream (sanitizeRulingHtml) is preserved.
 */
export function translateRulingHtml(html, g) {
  if (typeof html !== 'string' || !html || !g?.re) return html || '';
  return html.split(/(<[^>]*>)/g).map(part =>
    part.startsWith('<') ? part : translateRulingText(part, g)
  ).join('');
}

/**
 * The French view of a FAQ entry (rulingsFor): same shape, each ruling with
 * `questionFr` / `htmlFr` added — the curated translation (rulings-fr.json)
 * when there is one, else the glossary view — and `curated: true` when the
 * curated translation was used. Memoized per entry object and per version of
 * the curated data.
 */
export function rulingsEntryFr(entry, catalog) {
  if (!entry || !Array.isArray(entry.rulings)) return null;
  const cached = entryCache.get(entry);
  if (cached && cached.version === frVersion) return cached.fr;
  const g = buildGlossary(catalog);
  const fr = {
    ...entry,
    rulings: entry.rulings.map(r => {
      const c = curatedRuling(entry.name, r.id);
      return c
        ? { ...r, questionFr: c.q, htmlFr: c.a, curated: true }
        : {
            ...r,
            questionFr: translateRulingText(r.question, g),
            htmlFr: translateRulingHtml(r.html, g),
            curated: false,
          };
    }),
  };
  entryCache.set(entry, { version: frVersion, fr });
  return fr;
}
