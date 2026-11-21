import { tx } from './i18n.js';
/**
 * « Mettre à jour les cartes bannies » (lot 4.4 of AMELIORATIONS-APPLI.md).
 * Pure functions (tested in tests/banUpdate.test.mjs), the page itself is
 * downloaded by the PC app's main process (electron/contentFetch.cjs).
 *
 *   - parseRulesPage: Riot's tournament rules page (« Constructed Format
 *     Legality » and « 2v2 Constructed Legality »: Cards / Battlefields /
 *     Legends lists, « Last updated » date);
 *   - parseBanAnnouncement: a ban announcement on playriftbound.com
 *     (« Effective: <date> », the cards « being added »). The rules page is
 *     updated later than the announcements: what it does not list yet but a
 *     more recent announcement added is kept;
 *   - buildBanList: the new list, names checked against the catalog;
 *   - diffBans + guards: never applied without the user's « Installer », an
 *     empty or much shorter list is a reading error, not lifted bans.
 */

export const RULES_URL = 'https://playriftbound.com/en-us/news/organizedplay/riftbound-tournament-rules/';
export const ANNOUNCEMENT_URL = /^https:\/\/playriftbound\.com\/[a-z]{2}-[a-z]{2}\/news\/[a-z0-9-]+\/[a-z0-9-]+\/?$/;

export class PageReadError extends Error {}
const UNREADABLE = tx('La page a changé et n’a pas pu être lue. Rien n’a été modifié.');

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
/** « September 18, 2026 » → « 2026-09-18 » (null if not a date). */
export function isoDate(text) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(String(text || ''));
  const mo = m && MONTHS[m[1].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;|’/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** The pages' text: the rich text of their __NEXT_DATA__ (Next.js), else the page itself. */
function richText(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html || ''));
  if (!m) return String(html || '');
  let data;
  try { data = JSON.parse(m[1]); } catch { throw new PageReadError(UNREADABLE); }
  const parts = [];
  (function walk(o) {
    if (typeof o === 'string') { if (o.includes('<')) parts.push(o); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k]);
  })(data);
  return parts.join('\n');
}

/** Headings and list items in order: [{ tag: 'h3'|'h4'|'li'|'p', text }]. */
function blocks(html) {
  const out = [];
  const re = /<(h[1-6]|li|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ tag: m[1].toLowerCase(), text: decode(m[2]) });
  return out;
}

const KIND = { cards: 'cards', battlefields: 'battlefields', legends: 'legends' };
const FORMAT_HEADING = [[/^2v2 constructed legality$/i, '2v2'], [/^constructed format legality$/i, 'standard']];

/** { updatedAt, formats: { standard: { cards, battlefields, legends }, 2v2: {…} } } */
export function parseRulesPage(html) {
  const bl = blocks(richText(html));
  const formats = {};
  let updatedAt = null, format = null, kind = null;
  for (const b of bl) {
    const t = b.text;
    if (b.tag === 'h3' || b.tag === 'h4' || b.tag === 'h2') {
      const f = FORMAT_HEADING.find(([re]) => re.test(t));
      if (f) { format = f[1]; formats[format] = { cards: [], battlefields: [], legends: [] }; kind = null; continue; }
      if (format && KIND[t.toLowerCase()]) { kind = KIND[t.toLowerCase()]; continue; }
      if (format) { format = null; kind = null; } // next section of the page
      continue;
    }
    if (format && b.tag === 'p' && /last updated/i.test(t)) {
      const d = isoDate(t);
      if (d && (!updatedAt || d > updatedAt)) updatedAt = d;
      continue;
    }
    if (format && kind && b.tag === 'li' && t) formats[format][kind].push(t);
  }
  if (!formats.standard || !updatedAt) throw new PageReadError(UNREADABLE);
  return { updatedAt, formats };
}

/** { effective, formats: ['standard', '2v2'], cards, battlefields, legends } */
export function parseBanAnnouncement(html) {
  const bl = blocks(richText(html));
  let effective = null, kind = null, formats = null;
  const out = { cards: [], battlefields: [], legends: [] };
  for (const b of bl) {
    const t = b.text;
    if (!effective && /effective/i.test(t)) effective = isoDate(t);
    if (b.tag === 'p' && /being added to/i.test(t)) {
      formats = [];
      if (/standard/i.test(t)) formats.push('standard');
      if (/2v2/i.test(t)) formats.push('2v2');
      kind = null;
      continue;
    }
    if (!formats) continue;
    if (/^h[1-6]$/.test(b.tag)) {
      const k = KIND[t.toLowerCase()];
      if (k) { kind = k; continue; }
      if (Object.values(out).some(a => a.length)) break; // end of the lists
      continue;
    }
    if (b.tag === 'p' && Object.values(out).some(a => a.length)) break;
    if (kind && b.tag === 'li' && t) out[kind].push(t);
  }
  if (!effective || !formats?.length || !Object.values(out).some(a => a.length)) throw new PageReadError(UNREADABLE);
  return { effective, formats, ...out };
}

// ─── Names → catalog ─────────────────────────────────────────────────────

/** Same normalisation as deckRules.banStatus (letters and digits only). */
export const normName = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');
const withoutThe = (s) => normName(s).replace(/^the/, '');

/** Prints of the catalog named `name` (« Ekko, Recurrent » ↔ « Ekko - Recurrent », « Dreaming Tree » ↔ « The Dreaming Tree »). */
export function catalogMatches(name, cards) {
  const n = normName(name), w = withoutThe(name);
  return cards.filter(c => {
    const k = c.nameEn || c.name;
    return normName(k) === n || withoutThe(k) === w;
  });
}

const entryName = (e) => (typeof e === 'string' ? e : e?.name || '');
const cleanName = (s) => String(s).replace(/’/g, "'").trim();

/**
 * The new list, from the rules page (+ an announcement, optional). Returns
 * { list, unknown: [names not in the catalog], date }.
 *   - entries already in the current list keep their date (`since`) and ids;
 *   - current entries more recent than the rules page (a later announcement)
 *     and not on it are kept;
 *   - names of cards not in the catalog are kept by name and reported.
 */
export function buildBanList(current, rules, announcement, cards) {
  const unknown = new Set();
  const formats = {};
  const date = [rules.updatedAt, announcement?.effective].filter(Boolean).sort().at(-1);
  for (const fmt of Object.keys({ ...current?.formats, ...rules.formats })) {
    const cur = current?.formats?.[fmt] || {};
    const page = rules.formats[fmt];
    const byName = new Map((cur.banned || []).map(e => [withoutThe(entryName(e)), e]));
    const out = new Map();
    const add = (name, kind, since) => {
      const key = withoutThe(name);
      if (out.has(key)) return;
      const prev = byName.get(key);
      if (prev && typeof prev === 'object') { out.set(key, prev); return; }
      const hits = catalogMatches(name, cards);
      if (!hits.length) unknown.add(cleanName(name));
      const entry = { name: cleanName(name) };
      // deckRules.banStatus compares names with the catalog's `name` (« Riven » for « Riven, Broken Blade »): list the prints then
      if (hits.length && hits.some(c => normName(c.name) !== normName(name))) entry.ids = hits.map(c => c.id);
      if (kind === 'battlefields') entry.battlefield = true;
      if (kind === 'legends') entry.legend = true;
      entry.since = since;
      out.set(key, entry);
    };
    // an entry is a name (rules page) or { name, since } (rifthunt: each ban with its own date)
    if (page) for (const kind of ['legends', 'cards', 'battlefields']) for (const n of page[kind]) add(entryName(n), kind, n?.since || rules.updatedAt);
    // Bans announced after the rules page was updated, already in the list: kept.
    for (const e of cur.banned || []) {
      if (typeof e === 'object' && e.since && e.since > rules.updatedAt) out.set(withoutThe(e.name), e);
    }
    if (announcement?.formats.includes(fmt)) {
      for (const kind of ['legends', 'cards', 'battlefields']) for (const n of announcement[kind]) add(n, kind, announcement.effective);
    }
    if (!page && !announcement?.formats.includes(fmt)) { formats[fmt] = cur; continue; }
    formats[fmt] = { ...cur, label: cur.label || (fmt === 'standard' ? 'Standard' : fmt), banned: [...out.values()], restricted: cur.restricted || {} };
  }
  const sources = [...(current?.sources || [])];
  const addSource = (s) => { if (!sources.some(x => x.url === s.url && x.date === s.date)) sources.push(s); };
  addSource({ date: rules.updatedAt, url: rules.source?.url || RULES_URL, label: rules.source?.label || tx('Règlement officiel des tournois (Constructed Format Legality)') });
  if (announcement) addSource({ date: announcement.effective, url: announcement.url, label: announcement.title || tx('Annonce de bannissements') });
  const list = { ...current, version: 2, updatedAt: [current?.updatedAt, date].filter(Boolean).sort().at(-1), sources, formats };
  return { list, unknown: [...unknown], date };
}

/** Per format: { added: [names], removed: [names] }; `changed` false when nothing differs. */
export function diffBans(current, next) {
  const out = {};
  let changed = false;
  for (const fmt of Object.keys({ ...current?.formats, ...next?.formats })) {
    const a = new Map((current?.formats?.[fmt]?.banned || []).map(e => [withoutThe(entryName(e)), entryName(e)]));
    const b = new Map((next?.formats?.[fmt]?.banned || []).map(e => [withoutThe(entryName(e)), entryName(e)]));
    const added = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
    const removed = [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
    if (added.length || removed.length) changed = true;
    out[fmt] = { added, removed };
  }
  return { changed, formats: out };
}

/** A reading that empties the list or halves it is an error, not lifted bans. */
export function banListProblem(current, next) {
  const n = (l) => l?.formats?.standard?.banned?.length || 0;
  if (!n(next)) return tx('La liste lue est vide : erreur de lecture probable, rien n’est modifié.');
  if (n(current) && n(next) < n(current) / 2) return tx('La liste lue ({n} cartes) est moins de la moitié de l’actuelle ({n2}) : erreur de lecture probable, rien n’est modifié.', { n: n(next), n2: n(current) });
  return null;
}

/** The content layer (electron/content.cjs, kind « bannies ») for a list. */
export function banLayer(list, source, now = new Date()) {
  const count = Object.values(list.formats || {}).reduce((s, f) => s + (f.banned?.length || 0), 0);
  return { createdAt: now.toISOString(), source, count, data: list };
}

/** Manual edit (fallback): add or remove a card in a format, with the date typed by the user. */
export function editBanList(current, { format = 'standard', add = [], remove = [], date }) {
  const f = current?.formats?.[format] || { label: format, banned: [], restricted: {} };
  const rm = new Set(remove.map(normName));
  const banned = (f.banned || []).filter(e => !rm.has(normName(entryName(e))));
  const have = new Set(banned.map(e => normName(entryName(e))));
  for (const c of add) {
    if (have.has(normName(c.name))) continue;
    banned.push({ name: c.name, ids: c.ids, ...(c.battlefield ? { battlefield: true } : {}), ...(c.legend ? { legend: true } : {}), since: date });
  }
  return { ...current, updatedAt: [current?.updatedAt, date].filter(Boolean).sort().at(-1), formats: { ...current?.formats, [format]: { ...f, banned } } };
}
