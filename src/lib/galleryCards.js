/**
 * « Rechercher de nouvelles cartes » (lot 4.2 of AMELIORATIONS-APPLI.md),
 * part 1: read Riot's official card gallery — the same source and the same
 * fields as the former Python scraper (model/cards_scraper.py), in JavaScript.
 * Pure functions (tested in tests/galleryCards.test.mjs); the page is
 * downloaded by the PC app's main process (electron/contentFetch.cjs).
 */
import { PageReadError } from './banUpdate.js';import { tx } from './i18n.js';


export const GALLERY_URL = 'https://playriftbound.com/en-us/card-gallery/';
const UNREADABLE = tx('La galerie officielle a changé et n’a pas pu être lue. Rien n’a été modifié.');

/** The gallery's cards (raw), wherever the page keeps them (__NEXT_DATA__). */
export function extractGalleryCards(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html || ''));
  if (!m) throw new PageReadError(UNREADABLE);
  let data;
  try { data = JSON.parse(m[1]); } catch { throw new PageReadError(UNREADABLE); }
  let found = null;
  (function walk(o, depth) {
    if (found || depth > 12 || !o || typeof o !== 'object') return;
    if (Array.isArray(o) && o.length > 5 && o[0] && typeof o[0] === 'object' && 'cardImage' in o[0]) { found = o; return; }
    for (const k of Object.keys(o)) walk(o[k], depth + 1);
  })(data, 0);
  if (!found) throw new PageReadError(UNREADABLE);
  return found;
}

const list = (o, key) => (Array.isArray(o) ? o : Array.isArray(o?.[key]) ? o[key] : []);
const nested = (o, key) => (o && typeof o === 'object' ? (o.value && typeof o.value === 'object' ? o.value[key] : o[key]) : o) ?? '';
const stat = (o) => (o && typeof o === 'object' ? o.value?.id ?? null : o ?? null);
const ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
const FULLART_ID = /-\d+a-|-star-/;

/** Bottom of the artwork crop of the colour fingerprint (same as _resolve_art_region). */
export function artBottomOf(type, id) {
  if (FULLART_ID.test(id) || type === 'battlefield') return 0.95;
  if (type === 'legend') return 0.85;
  return 0.55;
}

/**
 * Full English name of a champion (« Riven, Broken Blade ») from the image's
 * accessibility text (« Riftbound Unit: Riven, Broken Blade. … »), only when it
 * starts with the card's name and a comma (never « B.F » for « B.F. Sword »).
 */
function fullName(raw) {
  const name = String(raw?.name || '');
  const m = /^Riftbound [^:]{1,30}:\s*(.+?)\.(?:\s|$)/.exec(raw?.cardImage?.accessibilityText || '');
  const full = m ? m[1].trim() : '';
  return name && full.startsWith(`${name}, `) && full.length < 120 ? full : null;
}

/**
 * A gallery card in the catalog's shape (without fingerprint, AI signature
 * and French data), plus `imageUrl`. null when it cannot be used.
 */
export function normalizeGalleryCard(raw) {
  const id = String(raw?.id || '');
  if (!ID.test(id)) return null;
  const domains = list(raw.domain, 'values').map(d => (d && typeof d === 'object' ? d.id : d)).filter(Boolean);
  const types = list(raw.cardType, 'type');
  const type = types[0] && typeof types[0] === 'object' ? types[0].id || '' : '';
  const superTypes = (raw.cardType?.superType || []).map(t => t?.id).filter(Boolean);
  const tags = list(raw.tags, 'tags').map(t => (t && typeof t === 'object' ? t.label || t.id : t)).filter(Boolean);
  const illus = list(raw.illustrator, 'values');
  const text = raw.text && typeof raw.text === 'object' ? (typeof raw.text.richText === 'object' ? raw.text.richText?.body : raw.text.richText) || '' : raw.text || '';
  const imageUrl = raw.cardImage && typeof raw.cardImage === 'object' ? raw.cardImage.url || '' : '';
  const card = {
    nameEn: fullName(raw),
    id,
    name: String(raw.name || ''),
    number: raw.collectorNumber ?? 0,
    code: raw.publicCode || '',
    set: String(nested(raw.set, 'id')).toUpperCase(),
    setName: nested(raw.set, 'label'),
    domain: domains[0] || null,
    domains,
    rarity: nested(raw.rarity, 'id'),
    type,
    superTypes,
    signature: superTypes.includes('signature') ? true : null,
    energy: stat(raw.energy),
    might: stat(raw.might),
    tags,
    illustrator: illus[0] ? (typeof illus[0] === 'object' ? illus[0].label || '' : illus[0]) : '',
    text,
    orientation: raw.orientation || 'portrait',
    artBottom: artBottomOf(type, id),
  };
  // Same compaction as the catalog file: no empty field.
  for (const k of Object.keys(card)) if (card[k] === null || card[k] === '' || (Array.isArray(card[k]) && !card[k].length)) delete card[k];
  return { card, imageUrl };
}

const COMPARED = ['name', 'number', 'code', 'set', 'setName', 'domains', 'rarity', 'type', 'superTypes', 'energy', 'might', 'tags', 'illustrator', 'text', 'orientation'];
// Same value: tags in any order, names whatever the capitals (« Ride The Wind » = « Ride the Wind »)
const comparable = (k, v) => (k === 'tags' && Array.isArray(v) ? [...v].sort() : k === 'name' && typeof v === 'string' ? v.toLowerCase() : v);
const same = (k, a, b) => JSON.stringify(comparable(k, a) ?? null) === JSON.stringify(comparable(k, b) ?? null);
const letters = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Gallery against the catalog in use. Returns { added: [{card, imageUrl}],
 * changed: [{card, imageUrl, fields}], manualOfficial: [ids], total }.
 * A manual addition (catalog `manual: true`) whose printed code the gallery
 * now publishes is to be removed (the official card replaces it).
 */
export function galleryChanges(rawCards, catalog) {
  return catalogChanges(rawCards.map(normalizeGalleryCard), catalog);
}

/**
 * Cards of a source ([{ card, imageUrl }], null skipped) against the catalog:
 * the gallery's, or rifthunt's (rifthunt.js). `onlyFilled`: a field the source
 * does not have is not a change.
 */
export function catalogChanges(normalized, catalog, { onlyFilled = false } = {}) {
  const byId = new Map(catalog.map(c => [c.id, c]));
  const added = [], changed = [];
  const codes = new Set();
  let total = 0;
  for (const n of normalized) {
    if (!n) continue;
    total++;
    codes.add(String(n.card.code).toUpperCase().split('/')[0]);
    const cur = byId.get(n.card.id);
    if (!cur || cur.manual) { added.push(n); continue; }
    const fields = COMPARED.filter(k => (!onlyFilled || n.card[k] !== undefined) && !same(k, n.card[k], cur[k]));
    // Full English name: filled when the catalog lacks it (« Ekko - Recurrent » = « Ekko, Recurrent »)
    if (n.card.nameEn && letters(n.card.nameEn) !== letters(cur.nameEn)) fields.push('nameEn');
    if (fields.length) changed.push({ ...n, fields });
  }
  if (total < catalog.filter(c => !c.manual).length / 2) throw new PageReadError(UNREADABLE); // half the cards missing: a reading problem
  const manualOfficial = catalog.filter(c => c.manual && (codes.has(String(c.code || '').toUpperCase().split('/')[0]) || added.some(a => a.card.id === c.id))).map(c => c.id);
  return { added, changed, manualOfficial, total };
}

/** « 12 nouvelles cartes (Vendetta), 2 cartes modifiées » */
export function galleryText({ added, changed }) {
  if (!added.length && !changed.length) return tx('Aucune nouvelle carte : le catalogue est à jour.');
  const sets = [...new Set(added.map(a => a.card.setName).filter(Boolean))];
  const parts = [];
  if (added.length) parts.push(`${added.length} nouvelle${added.length > 1 ? 's' : ''} carte${added.length > 1 ? 's' : ''}${sets.length ? ` (${sets.join(', ')})` : ''}`);
  if (changed.length) parts.push(tx('{length} carte{v1} modifiée{v2}', { length: changed.length, v1: changed.length > 1 ? 's' : '', v2: changed.length > 1 ? 's' : '' }));
  return `${parts.join(', ')}.`;
}
