import { tx } from './i18n.js';
import { RIFTHUNT_CARDS_URL, rifthuntCardIndex } from './rifthunt.js';
/**
 * Builds the Cardmarket price table from the public Cardmarket files, on the
 * phone (no PC needed). Same rules as electron/prices.cjs — keep both in step.
 *
 *   products_singles_22.json  Cardmarket products (Riftbound = game 22)
 *   price_guide_22.json       daily price guide
 *   api.rifthunt.com/bulk/cards  each printing's Cardmarket product and full English name
 *   api.riftcodex.com/cards   full English names ("Jinx, Loose Cannon"), when rifthunt does not answer
 */
export const CM_PRODUCTS = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json';
export const CM_PRICES = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json';
export const RIFTCODEX = 'https://api.riftcodex.com/cards';
const HISTORY_DAYS = 31;

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

function cleanName(n) {
  return n.replace(/\s*\((Alternate Art|Overnumbered|Signature)[^)]*\)\s*$/, '').replace(/ - /g, ', ').trim();
}

/** 0 base, 1 alternate art, 2 overnumbered, 3 signature, 4 other (promo, token…). */
function printKind(card) {
  const code = card.code || '';
  if (code.includes('*') || card.id.includes('-star')) return 3;
  const m = /^[A-Z]+-(\d+)([a-z]?)\/(\d+)$/.exec(code);
  if (!m) return 4;
  if (Number(m[1]) > Number(m[3])) return 2;
  return m[2] ? 1 : 0;
}

function cardmarketName(card, rcNames) {
  if (rcNames[card.id]) return cleanName(rcNames[card.id]);
  const tags = card.tags || [];
  if (card.type === 'legend' && tags[0]) return `${tags[0]}, ${card.name}`;
  return card.name;
}

/** Link our cards to Cardmarket products. Returns { cardId: idProduct }. */
export function buildMapping(cards, products, index) {
  // index: { names, cardmarket } (rifthunt: each printing's Cardmarket product), or Riftcodex's names alone
  const rcNames = index?.names || index || {};
  const direct = index?.cardmarket || {};
  const mapping = {};
  const productIds = new Set(products.map(p => p.idProduct));
  const used = new Set();
  for (const c of cards) {
    const idp = direct[c.id];
    if (idp && productIds.has(idp) && !used.has(idp)) { mapping[c.id] = idp; used.add(idp); }
  }
  // The others (rifthunt not reached, or a card it does not link): by name, as before
  products = products.filter(p => !used.has(p.idProduct));
  cards = cards.filter(c => !mapping[c.id] && c.variant !== 'promo'); // a promo printing: rifthunt's product only
  const namesByExp = new Map();
  const byExpName = new Map();
  for (const p of [...products].sort((a, b) => a.idProduct - b.idProduct)) {
    if (!namesByExp.has(p.idExpansion)) namesByExp.set(p.idExpansion, new Set());
    namesByExp.get(p.idExpansion).add(p.name);
    const k = `${p.idExpansion}|${p.name}`;
    if (!byExpName.has(k)) byExpName.set(k, []);
    byExpName.get(k).push(p);
  }
  const bySet = new Map();
  for (const c of cards) {
    if (!bySet.has(c.set)) bySet.set(c.set, []);
    bySet.get(c.set).push(c);
  }
  const expOfSet = new Map();
  for (const [set, list] of bySet) {
    const names = new Set(list.map(c => cardmarketName(c, rcNames)));
    let best = null; let bestN = -1;
    for (const [exp, set2] of namesByExp) {
      let n = 0;
      for (const nm of names) if (set2.has(nm)) n++;
      if (n > bestN) { bestN = n; best = exp; }
    }
    expOfSet.set(set, best);
  }
  const groups = new Map();
  for (const c of cards) {
    const k = `${expOfSet.get(c.set)}|${cardmarketName(c, rcNames)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  for (const [k, list] of groups) {
    list.sort((a, b) => printKind(a) - printKind(b) || a.id.localeCompare(b.id));
    const prods = byExpName.get(k) || [];
    if (prods.length === 0) continue;
    if (prods.length === list.length) list.forEach((c, i) => { mapping[c.id] = prods[i].idProduct; });
    else mapping[list[0].id] = prods[0].idProduct; // only the base print is certain
  }
  return mapping;
}

/**
 * Add today's prices to the per-card history (one column per day, last 31
 * days), for each reference price and finish: `cards` / `foil` = trend,
 * `avg7` / `avg7Foil` = 7-day average, `low` / `lowFoil` = lowest offer
 * (Réglages → Prix de référence).
 */
export function updateHistory(prev, day, cards) {
  const days = [...(prev?.days || [])];
  let idx = days.indexOf(day);
  if (idx === -1) { days.push(day); idx = days.length - 1; }
  const drop = Math.max(0, days.length - HISTORY_DAYS);
  const series = (old, pick) => {
    const out = {};
    for (const id of new Set([...Object.keys(old || {}), ...Object.keys(cards)])) {
      const row = ((old || {})[id] || []).slice(0, days.length);
      while (row.length < days.length) row.push(null);
      const p = cards[id];
      if (p) row[idx] = r2(pick(p));
      const kept = row.slice(drop);
      if (kept.some(v => v != null)) out[id] = kept;
    }
    return out;
  };
  return {
    days: days.slice(drop),
    cards: series(prev?.cards, p => p[0] ?? p[1]),
    foil: series(prev?.foil, p => p[1] ?? null),
    avg7: series(prev?.avg7, p => p[3] ?? null),
    avg7Foil: series(prev?.avg7Foil, p => p[7] ?? null),
    low: series(prev?.low, p => p[5] ?? null),
    lowFoil: series(prev?.lowFoil, p => p[6] ?? null),
  };
}

const median = (xs) => {
  const v = xs.filter(x => x).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/**
 * Cardmarket expansions of our sets: for each set (card id prefix), the one
 * most of its cards are in (rifthunt puts a few in the set's promos).
 */
export function mainExpansions(mapping, byId) {
  const count = new Map();
  for (const [cardId, id] of Object.entries(mapping)) {
    const e = byId.get(id)?.idExpansion;
    if (e == null) continue;
    const k = `${cardId.split('-')[0]}|${e}`;
    count.set(k, (count.get(k) || 0) + 1);
  }
  const best = new Map();
  for (const [k, n] of count) {
    const [s, e] = k.split('|');
    if (!best.has(s) || n > best.get(s)[1]) best.set(s, [Number(e), n]);
  }
  return new Set([...best.values()].map(([e]) => e));
}

/**
 * Prices of the promo versions: Cardmarket products of the same card (same
 * idMetacard) in expansions that hold none of our sets. { cardId: [trend,
 * trendFoil, n] }: n = 1 → that promo's own price; n > 1 → median of the
 * promos (the app shows it as estimated, it cannot know which promo it is).
 */
export function buildPromoPrices(mapping, products, guideById) {
  const byId = new Map(products.map(p => [p.idProduct, p]));
  const setExpansions = mainExpansions(mapping, byId);
  const byMeta = new Map();
  for (const p of products) {
    if (p.idMetacard == null || setExpansions.has(p.idExpansion)) continue;
    const g = guideById.get(p.idProduct);
    if (!g) continue;
    const t = g.trend || g.avg || null;
    const tf = g['trend-foil'] || g['avg-foil'] || null;
    if (!t && !tf) continue;
    if (!byMeta.has(p.idMetacard)) byMeta.set(p.idMetacard, []);
    byMeta.get(p.idMetacard).push({ t, tf });
  }
  const out = {};
  for (const [cardId, id] of Object.entries(mapping)) {
    const list = byMeta.get(byId.get(id)?.idMetacard);
    if (list) out[cardId] = [r2(median(list.map(x => x.t))), r2(median(list.map(x => x.tf))), list.length];
  }
  return out;
}

/** Cardmarket's way of writing a name in its addresses: « Kai'Sa, Survivor » → « KaiSa-Survivor », « B.F. Sword » → « BF-Sword ». */
export function cardmarketSlug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’.]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** 'Expansion/Name' of a product; rifthunt's name part when it is this very product there (it adds « -V2-Showcase »…). */
function productPath(exp, p, paths) {
  const name = cardmarketSlug(p.name);
  const [e, n] = String(paths?.[p.idProduct] || '').split('/');
  return `${exp}/${e === exp && n && (n === name || n.startsWith(`${name}-V`)) ? n : name}`;
}

/**
 * Card pages on Cardmarket: { cardId: [normal, promo] }, each 'Expansion/Name'
 * (« Unleashed/Mutated-Mouser », « Unleashed-Promos/Mutated-Mouser »), promo
 * null when Cardmarket has none. The expansion is our set's name (« -Promos »
 * added for the promos), the name Cardmarket's product name.
 */
export function buildLinks(catalog, mapping, products, paths) {
  const byId = new Map(products.map(p => [p.idProduct, p]));
  // our sets' expansions, their names, and the set of each card (by Cardmarket's idMetacard)
  const setExpansions = mainExpansions(withoutPromos(catalog, mapping), byId);
  const setNames = new Set();
  const setOfMeta = new Map();
  for (const c of catalog) {
    const p = byId.get(mapping[c.id]);
    if (!p || !setExpansions.has(p.idExpansion)) continue;
    const exp = cardmarketSlug(c.setName || c.set);
    setNames.add(exp);
    if (!setOfMeta.has(p.idMetacard)) setOfMeta.set(p.idMetacard, exp);
  }
  // the other expansions (promos…): rifthunt's name when it is not one of our sets
  // (« Origins-Promos », « Secret-Garden-Bundle »), else « <set of most of its cards>-Promos »
  const votes = new Map();
  const vote = (e, name, n) => {
    if (!votes.has(e)) votes.set(e, new Map());
    votes.get(e).set(name, (votes.get(e).get(name) || 0) + n);
  };
  const promos = new Map();
  for (const p of [...products].sort((a, b) => a.idProduct - b.idProduct)) {
    if (p.idMetacard == null || setExpansions.has(p.idExpansion)) continue;
    const e = String(paths?.[p.idProduct] || '').split('/')[0];
    if (e && !setNames.has(e)) vote(p.idExpansion, e, 1000);
    else if (setOfMeta.has(p.idMetacard)) vote(p.idExpansion, `${setOfMeta.get(p.idMetacard)}-Promos`, 1);
    if (!promos.has(p.idMetacard)) promos.set(p.idMetacard, []);
    promos.get(p.idMetacard).push(p);
  }
  const expName = (e) => [...(votes.get(e) || [])].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const out = {};
  for (const c of catalog) {
    const p = byId.get(mapping[c.id]);
    if (!p) continue;
    const exp = cardmarketSlug(c.setName || c.set);
    if (!setExpansions.has(p.idExpansion)) {
      // a promo printing of the catalog (« opp-036-219 »), or a card Cardmarket sells among the promos
      const path = productPath(expName(p.idExpansion) || exp, p, paths);
      out[c.id] = [path, path];
      continue;
    }
    const list = promos.get(p.idMetacard) || [];
    const promo = list.find(q => expName(q.idExpansion) === `${exp}-Promos`) || list[0];
    out[c.id] = [productPath(exp, p, paths), promo ? productPath(expName(promo.idExpansion) || `${exp}-Promos`, promo, paths) : null];
  }
  return out;
}

/**
 * The mapping without the catalog's promo printings and promo sets (« OPP »,
 * « PR »…: they have their own price; the promo table is for the others).
 */
export function withoutPromos(catalog, mapping) {
  const promoSets = new Set(catalog.filter(c => c.variant === 'promo').map(c => c.set));
  const promo = new Set(catalog.filter(c => c.variant === 'promo' || promoSets.has(c.set)).map(c => c.id));
  return Object.fromEntries(Object.entries(mapping).filter(([id]) => !promo.has(id)));
}

/**
 * Cardmarket products and names for the prices: rifthunt first ({ source,
 * names, cardmarket, paths }: each printing's product, right for 1,408 of
 * 1,408 cards), Riftcodex's names when rifthunt does not answer (then by name
 * only). The links are built from the names (buildLinks), not from rifthunt's
 * addresses.
 */
export async function fetchCardIndex(getJSON) {
  try {
    const d = await getJSON(RIFTHUNT_CARDS_URL);
    const cards = Array.isArray(d) ? d : d?.cards;
    if (!Array.isArray(cards) || cards.length < 100) throw new Error('rifthunt: unexpected file');
    return { source: 'rifthunt', ...rifthuntCardIndex(cards) };
  } catch (err) {
    console.warn('[prices] rifthunt unavailable, Riftcodex used:', err?.message || err);
    return { source: 'riftcodex', names: await fetchRiftcodexNames(getJSON), cardmarket: {} };
  }
}

/** Riftcodex: { riftbound_id → full English name }. */
export async function fetchRiftcodexNames(getJSON) {
  // The API is slow (~10 s a page): page 1 gives the page count, the others
  // are fetched 5 at a time, then read in page order.
  const url = (page) => `${RIFTCODEX}?size=100&page=${page}`;
  const first = await getJSON(url(1));
  const pages = [first];
  const rest = Array.from({ length: Math.min(99, first.pages || 1) - 1 }, (_, i) => i + 2);
  for (let i = 0; i < rest.length; i += 5) {
    pages.push(...await Promise.all(rest.slice(i, i + 5).map(p => getJSON(url(p)))));
  }
  const out = {};
  for (const d of pages) {
    for (const i of d.items || []) {
      const id = String(i.riftbound_id || '').replace('*', '-star');
      if (id && !out[id]) out[id] = i.name;
    }
  }
  return out;
}

/** Full price table (same shape as the PC's). */
export function buildPriceTable(catalog, products, guide, rcNames, prev) {
  // Manual additions (model/manual-cards/): no price
  const mapping = buildMapping(catalog.filter(c => !c.manual), products.products || [], rcNames);
  const guideById = new Map((guide.priceGuides || []).map(g => [g.idProduct, g]));
  const cards = {};
  for (const [cardId, idProduct] of Object.entries(mapping)) {
    const g = guideById.get(idProduct);
    if (!g) continue;
    const trend = g.trend || g.avg || null;
    const trendFoil = g['trend-foil'] || g['avg-foil'] || null;
    if (trend == null && trendFoil == null) continue;
    cards[cardId] = [r2(trend), r2(trendFoil), idProduct, r2(g.avg7), r2(g.avg30), r2(g.low), r2(g['low-foil']), r2(g['avg7-foil'])];
  }
  const day = String(guide.createdAt || new Date().toISOString()).slice(0, 10);
  return {
    updatedAt: Date.now(),
    priceDate: guide.createdAt || null,
    source: tx('Cardmarket (prix tendance)'),
    matched: Object.keys(cards).length,
    total: catalog.length,
    cards,
    promo: buildPromoPrices(withoutPromos(catalog, mapping), products.products || [], guideById),
    links: buildLinks(catalog, mapping, products.products || [], rcNames?.paths),
    hist: updateHistory(prev?.hist, day, cards),
  };
}
