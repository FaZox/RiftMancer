/**
 * Cardmarket prices (PC app). Downloads Cardmarket's public price files for
 * Riftbound once a day and links each product to our cards.
 *
 *   - Cardmarket "productCatalog" files (public, no account needed), game 22:
 *       products_singles_22.json  idProduct, name, idExpansion
 *       price_guide_22.json       trend / trend-foil / avg / low per idProduct
 *   - Cardmarket gives names but no collector numbers, so full English names
 *     ("Jinx, Loose Cannon") come from the Riftcodex API (riftbound_id → name),
 *     cached for a week.
 *   - Matching: our set → the Cardmarket expansion sharing most names; then by
 *     name. When a name has several prints (base, alternate art, overnumbered,
 *     signature), they are matched in that order with Cardmarket's products in
 *     the order Cardmarket added them (checked: alt arts priced ≥ base 97/98).
 *
 * Output (userData/prices.json, sent to the phone at sync):
 *   { updatedAt, source, cards: { <cardId>: [trend, trendFoil, idProduct, avg7, avg30, low, lowFoil, avg7Foil] },
 *     hist: { days: ['YYYY-MM-DD', …], cards: { <cardId>: [trend|null per day] } } }
 *
 * `hist` keeps one trend price per card and per day for the last 31 days
 * (built up day after day). avg7 / avg30 (Cardmarket's 7- and 30-day average
 * sale prices) give a price movement even before the history fills up.
 */
const fs = require('node:fs');
const path = require('node:path');

const CM_PRODUCTS = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json';
const CM_PRICES = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json';
const RIFTCODEX = 'https://api.riftcodex.com/cards';
const HEADERS = { 'User-Agent': 'RiftMancer (local collection app; https://github.com/FaZox/RiftMancer)' };
const REFRESH_EVERY = 20 * 60 * 60 * 1000; // ~ daily
const NAMES_EVERY = 7 * 24 * 60 * 60 * 1000;

async function getJSON(url) {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

/** All Riftcodex cards: { riftbound_id → full English name, flags }. */
async function fetchRiftcodexNames() {
  const out = {};
  for (let page = 1; page < 100; page++) {
    const d = await getJSON(`${RIFTCODEX}?size=100&page=${page}`);
    for (const i of d.items || []) {
      const id = String(i.riftbound_id || '').replace('*', '-star');
      if (id && !out[id]) out[id] = i.name;
    }
    if (page >= (d.pages || 1)) break;
  }
  return out;
}

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
function buildMapping(cards, products, index) {
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
  cards = cards.filter(c => !mapping[c.id]);
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

const HISTORY_DAYS = 31;
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/**
 * Add today's prices to the per-card history (one column per day, last 31
 * days), for each reference price and finish: `cards` / `foil` = trend,
 * `avg7` / `avg7Foil` = 7-day average, `low` / `lowFoil` = lowest offer
 * (Réglages → Prix de référence).
 */
function updateHistory(prev, day, cards) {
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
function buildPromoPrices(mapping, products, guideById) {
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

function createPrices({ userData, distDir, onUpdated, catalogFile = null }) {
  const file = path.join(userData, 'prices.json');
  const indexFile = path.join(userData, 'card-index.json'); // rifthunt (or Riftcodex) links and names, a week
  const namesFile = path.join(userData, 'riftcodex-names.json'); // former cache, read when nothing else
  let current = null;
  let running = null;

  try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }

  async function loadNames() {
    let cached = null;
    try { cached = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { /* none yet */ }
    // a cache made from rifthunt's ids is not used any more
    if (cached && cached.index?.source === 'riftcodex' && Date.now() - cached.fetchedAt < NAMES_EVERY) return cached.index;
    // Riftcodex's names, products found by name (rifthunt's Cardmarket ids gave links that did not work)
    let index = null;
    try { index = { source: 'riftcodex', names: await fetchRiftcodexNames(), cardmarket: {} }; } catch (err) { console.warn('[prices] Riftcodex unavailable:', err.message); }
    if (index) {
      fs.writeFileSync(indexFile, JSON.stringify({ fetchedAt: Date.now(), index }));
      return index;
    }
    if (cached) return cached.index;
    try { return JSON.parse(fs.readFileSync(namesFile, 'utf8')).names; } catch { return {}; }
  }

  async function doRefresh() {
    // The catalog in use: with the new cards of Réglages → Contenu (lot 4.2) when there are some
    const catalog = JSON.parse(fs.readFileSync(catalogFile?.() || path.join(distDir, 'card-hashes.json'), 'utf8')).cards;
    const [products, guide, rcNames] = await Promise.all([getJSON(CM_PRODUCTS), getJSON(CM_PRICES), loadNames()]);
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
    current = {
      updatedAt: Date.now(),
      priceDate: guide.createdAt || null,
      source: 'Cardmarket (prix tendance)',
      matched: Object.keys(cards).length,
      total: catalog.length,
      cards,
      promo: buildPromoPrices(mapping, products.products || [], guideById),
      hist: updateHistory(current?.hist, day, cards),
    };
    fs.writeFileSync(file, JSON.stringify(current));
    console.log(`[prices] ${current.matched}/${current.total} cards priced`);
    onUpdated?.(current);
    return current;
  }

  /** Refresh if older than a day (or forced). Never throws. */
  function refresh(force = false) {
    if (running) return running;
    if (!force && current?.hist && Date.now() - current.updatedAt < REFRESH_EVERY) return Promise.resolve(current);
    running = doRefresh()
      .catch(err => { console.warn('[prices] refresh failed:', err.message); return current; })
      .finally(() => { running = null; });
    return running;
  }

  return { get: () => current, refresh };
}

/**
 * Value of the copies for a reference price: 'trend' (default), 'avg7' or
 * 'low' — same rule as the app's priceInfo (src/lib/prices.js): own finish in
 * the reference, own finish trend, then the other finish; promo copies take
 * the promo's price (trend) when Cardmarket has one.
 */
const REF_INDEX = { trend: [0, 1], avg7: [3, 7], low: [5, 6] };
function copyPrice(prices, c, ref) {
  if (c.promo) {
    const q = prices?.promo?.[c.cardId];
    if (q && (q[0] || q[1])) return (c.foil ? (q[1] || q[0]) : (q[0] || q[1])) || 0;
  }
  const p = prices?.cards?.[c.cardId];
  if (!p) return 0;
  const [n, f] = REF_INDEX[ref] || REF_INDEX.trend;
  return (c.foil ? (p[f] || p[1] || p[n] || p[0]) : (p[n] || p[0] || p[f] || p[1])) || 0;
}
function copiesValue(copies, prices, ref = 'trend') {
  let v = 0;
  for (const c of copies) v += copyPrice(prices, c, ref);
  return Math.round(v * 100) / 100;
}

module.exports = { createPrices, copiesValue, buildMapping, updateHistory, buildPromoPrices };
