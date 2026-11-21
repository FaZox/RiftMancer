import { tx } from './i18n.js';
/**
 * Builds the Cardmarket price table from the public Cardmarket files, on the
 * phone (no PC needed). Same rules as electron/prices.cjs — keep both in step.
 *
 *   products_singles_22.json  Cardmarket products (Riftbound = game 22)
 *   price_guide_22.json       daily price guide
 *   api.riftcodex.com/cards   full English names ("Jinx, Loose Cannon")
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
export function buildMapping(cards, products, rcNames) {
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
  const mapping = {};
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
 * Prices of the promo versions: Cardmarket products of the same card (same
 * idMetacard) in expansions that hold none of our sets. { cardId: [trend,
 * trendFoil, n] }: n = 1 → that promo's own price; n > 1 → median of the
 * promos (the app shows it as estimated, it cannot know which promo it is).
 */
export function buildPromoPrices(mapping, products, guideById) {
  const byId = new Map(products.map(p => [p.idProduct, p]));
  const setExpansions = new Set(Object.values(mapping).map(id => byId.get(id)?.idExpansion));
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
    promo: buildPromoPrices(mapping, products.products || [], guideById),
    hist: updateHistory(prev?.hist, day, cards),
  };
}
