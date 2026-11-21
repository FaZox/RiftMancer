/**
 * rifthunt.com (api.rifthunt.com): the first source of the cards, the banned
 * cards and the Cardmarket links (asked on 21/11/2026). Free, no key, any use
 * allowed (rifthunt.com/terms); its data comes from Riot's. When it does not
 * answer, the former sources take over: Riot's gallery (galleryCards.js), the
 * tournament rules page (banUpdate.js), Riftcodex (priceBuilder.js).
 * Pure functions (tests/rifthunt.test.mjs); the files are downloaded by the
 * PC app's main process (electron/contentFetch.cjs, allowed addresses).
 */
import { PageReadError } from './banUpdate.js';
import { artBottomOf, catalogChanges, extractGalleryCards, galleryChanges } from './galleryCards.js';
import { tx } from './i18n.js';

export const RIFTHUNT_SITE = 'https://rifthunt.com/';
export const RIFTHUNT_CARDS_URL = 'https://api.rifthunt.com/bulk/cards';
const SEARCH = 'https://api.rifthunt.com/cards/search?q=banned%3A';
export const RIFTHUNT_BAN_URLS = { standard: `${SEARCH}standard`, '2v2': `${SEARCH}2v2`, upcoming: `${SEARCH}upcoming` };
// Promo and special sets (« Impressions et promos »): their printings are « promo » when rifthunt gives no kind
export const PROMO_SETS = new Set(['PR', 'OPP', 'JDG', 'RWB', 'SGN', 'KDA']);
const UNREADABLE = tx('Les données de rifthunt n’ont pas pu être lues.');
const ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
const RIOT_IMAGE = /^https:\/\/cmsassets\.rgpub\.io\/[\w./%-]+\.(png|jpe?g|webp)(\?[\w=&%-]*)?$/i;
/** Kinds of printing (card field `variant`); « promo »: printings of the promo sets. */
export const VARIANTS = ['base', 'alternate', 'overnumbered', 'signature', 'showcase', 'promo'];

/** Our id of a printing: « ogn-303*-298 » → « ogn-303-star-298 » (the catalog's form). */
export const catalogId = (riftboundId) => String(riftboundId || '').toLowerCase().replace('*', '-star');

/** The printings of /bulk/cards (throws when it is not that file). */
export function parseRifthuntCards(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new PageReadError(UNREADABLE); }
  const cards = Array.isArray(data) ? data : data?.cards;
  if (!Array.isArray(cards) || cards.length < 100 || !cards[0]?.riftboundId) throw new PageReadError(UNREADABLE);
  return cards;
}

const lower = (s) => (s == null || s === '' ? null : String(s).toLowerCase());
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** « Ahri, Nine-Tailed Fox (Metal) » → ['Ahri, Nine-Tailed Fox', 'Metal'] */
const splitLabel = (name) => {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(String(name || ''));
  return m ? [m[1], m[2]] : [String(name || ''), null];
};
// Labels already said by the kind of printing (or by the card itself): not kept as the printing's label
const PLAIN_LABEL = /^(alternate art|signature|overnumbered|showcase)$/i;

/**
 * Our id of every printing: the catalog's form, and a suffix for the printings
 * sharing a riftboundId (« opp-255-298 » and « opp-255-298-metal »; « … -champion »,
 * « … -top-8 »). Map printing → id.
 */
export function printingIds(printings) {
  const groups = new Map();
  for (const p of printings) {
    const id = catalogId(p?.riftboundId);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(p);
  }
  const out = new Map();
  for (const [id, list] of groups) {
    for (const p of list) {
      const label = splitLabel(p.name)[1];
      out.set(p, list.length > 1 && label ? `${id}-${slug(label)}` : id);
    }
  }
  return out;
}

/** Picture of a printing on rifthunt's image server (744 × 1039 WebP), for the ones Riot has not. */
export function rifthuntImage(p) {
  const m = /^[a-z]+-([0-9a-z*]+)/i.exec(String(p?.riftboundId || ''));
  if (!m || !p.imgHash || !p.set) return null;
  return `https://images.rifthunt.com/cards/large/front/${String(p.set).toLowerCase()}/${m[1].toLowerCase().replace('*', 's')}/${slug(p.name)}.webp?v=${p.imgHash}`;
}

/**
 * A printing in the catalog's shape (without fingerprint, AI signature and
 * French data), plus `imageUrl` (Riot's server, else rifthunt's). `id`: from
 * printingIds. null when it cannot be used.
 */
export function normalizeRifthuntCard(p, id = catalogId(p?.riftboundId)) {
  if (!ID.test(id)) return null;
  const set = String(p.set || '').toUpperCase();
  const [full, label] = splitLabel(p.name);
  const [base, sub] = full.split(/, (.+)/);
  const type = lower(p.type);
  const m = /^([a-z]+)-([0-9a-z*]+)(?:-(\d+))?$/i.exec(String(p.riftboundId));
  const code = m ? `${m[1].toUpperCase()}-${m[2].replace(/^[a-z]+/i, x => x.toUpperCase())}${m[3] ? `/${m[3]}` : ''}` : '';
  const card = {
    nameEn: sub ? `${base} - ${sub}` : null,
    id,
    name: type === 'legend' && sub ? sub : base, // the catalog names a Legend by its title (« Loose Cannon »)
    number: p.num ?? null,
    code,
    set,
    setName: p.setName || null,
    domain: lower(p.domains?.[0]),
    domains: (p.domains || []).map(lower).filter(Boolean),
    rarity: lower(p.rarity),
    type,
    superTypes: [lower(p.supertype)].filter(Boolean),
    energy: p.energy ?? null,
    might: p.might ?? null,
    power: p.power > 0 ? p.power : null, // recycle cost: runes of the card's domain
    tags: p.tags || [],
    illustrator: p.artist || null,
    text: p.rich || null,
    orientation: p.orientation || 'portrait',
    artBottom: artBottomOf(type, id),
    // Prints of one card (« Impressions et variantes »): rifthunt's oracle id, the kind of printing, its label
    oracle: p.oracle_id ? String(p.oracle_id).replace(/-/g, '').slice(0, 16) : null,
    variant: VARIANTS.includes(p.variant) ? p.variant : PROMO_SETS.has(set) ? 'promo' : 'base',
    printLabel: label && !PLAIN_LABEL.test(label) ? label : null,
  };
  for (const k of Object.keys(card)) if (card[k] === null || card[k] === '' || (Array.isArray(card[k]) && !card[k].length)) delete card[k];
  return { card, imageUrl: RIOT_IMAGE.test(p.imgUrl || '') ? p.imgUrl : rifthuntImage(p) };
}

// Written without being listed as changes: prints of one card, recycle cost (absent from Riot's gallery)
const LINKS = ['oracle', 'variant', 'printLabel', 'power'];

/**
 * rifthunt against the catalog in use: same result as galleryChanges, plus
 * `links` ([{ id, oracle, variant, printLabel }]: the prints of one card,
 * written without being listed as changes). A field is compared only when
 * rifthunt has it (nothing is erased because it lacks it); a new card needs a picture.
 */
export function rifthuntChanges(printings, catalog) {
  const ids = printingIds(printings);
  const seen = new Set();
  const normalized = [];
  for (const p of printings) {
    const n = normalizeRifthuntCard(p, ids.get(p));
    if (!n || seen.has(n.card.id)) continue;
    seen.add(n.card.id);
    normalized.push(n);
  }
  // A card to add needs a picture; without one, a manual addition of the catalog stays as it is
  const official = new Set(catalog.filter(c => !c.manual).map(c => c.id));
  const usable = normalized.filter(n => n.imageUrl || official.has(n.card.id));
  const out = catalogChanges(usable, catalog, { onlyFilled: true });
  const byId = new Map(catalog.map(c => [c.id, c]));
  out.links = [];
  for (const { card } of usable) {
    const cur = byId.get(card.id);
    if (!cur || cur.manual) continue; // new cards carry them
    const diff = LINKS.filter(k => card[k] !== undefined && card[k] !== cur[k]);
    if (diff.length) out.links.push(Object.fromEntries([['id', card.id], ...diff.map(k => [k, card[k]])]));
  }
  return out;
}

/** New cards from a downloaded text: rifthunt's file (JSON) or Riot's gallery page (HTML). */
export function cardSourceChanges(text, catalog) {
  if (String(text || '').trimStart().startsWith('{')) return { ...rifthuntChanges(parseRifthuntCards(text), catalog), source: 'rifthunt' };
  return { ...galleryChanges(extractGalleryCards(text), catalog), links: [], source: 'gallery' };
}

/** Cards and Cardmarket links for the prices: { names: { id: full English name }, cardmarket: { id: idProduct } }. */
export function rifthuntCardIndex(printings) {
  const ids = printingIds(printings);
  const names = {}, cardmarket = {};
  for (const p of printings) {
    const id = ids.get(p);
    if (!ID.test(id)) continue;
    if (!names[id]) names[id] = String(p.name || '');
    const cm = Number(p.cardmarketId);
    if (cm > 0 && !cardmarket[id]) cardmarket[id] = cm;
  }
  return { names, cardmarket };
}

const KIND = { legend: 'legends', battlefield: 'battlefields' };

/**
 * The three rifthunt searches (banned:standard, banned:2v2, banned:upcoming) in
 * the shape of parseRulesPage (banUpdate.js), each card with the date its ban
 * applies from: { updatedAt, formats: { standard: { cards, battlefields, legends }, 2v2 }, source }.
 */
export function rifthuntBanRules(texts) {
  const formats = { standard: { cards: [], battlefields: [], legends: [] }, '2v2': { cards: [], battlefields: [], legends: [] } };
  const today = new Date().toISOString().slice(0, 10);
  let updatedAt = null;
  const seen = { standard: new Set(), '2v2': new Set() };
  for (const key of ['standard', '2v2', 'upcoming']) {
    let data;
    try { data = JSON.parse(texts[key]); } catch { throw new PageReadError(UNREADABLE); }
    // no match: rifthunt answers 404 with an error object, read as an empty list
    const list = data?.object === 'list' ? data.data || [] : data?.object === 'error' ? [] : null;
    if (!list) throw new PageReadError(UNREADABLE);
    for (const c of list) {
      for (const fmt of ['standard', '2v2']) {
        const l = c.legalities?.[fmt];
        const banned = l?.status === 'banned' || (key === 'upcoming' && l?.banned_from);
        if (!banned || seen[fmt].has(c.name)) continue;
        seen[fmt].add(c.name);
        const since = l.banned_from || null; // no date: the list's date (buildBanList)
        if (since && since <= today && (!updatedAt || since > updatedAt)) updatedAt = since;
        formats[fmt][KIND[lower(c.type)] || 'cards'].push({ name: String(c.name), ...(since ? { since } : {}) });
      }
    }
  }
  if (!formats.standard.cards.length && !formats.standard.battlefields.length) throw new PageReadError(UNREADABLE);
  return { updatedAt: updatedAt || today, formats, source: { url: RIFTHUNT_SITE, label: tx('rifthunt.com (listes officielles de Riot)') } };
}
