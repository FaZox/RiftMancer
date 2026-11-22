/**
 * Cardmarket prices (PC app). Downloads Cardmarket's public price files for
 * Riftbound once a day and links each product to our cards.
 *
 *   - Cardmarket "productCatalog" files (public, no account needed), game 22:
 *       products_singles_22.json  idProduct, name, idExpansion
 *       price_guide_22.json       trend / trend-foil / avg / low per idProduct
 *   - Cardmarket gives names but no collector numbers, so full English names
 *     ("Jinx, Loose Cannon") and each printing's product come from rifthunt
 *     (Riftcodex's names when it does not answer), cached for a week.
 *   - Matching: our set → the Cardmarket expansion sharing most names; then by
 *     name. When a name has several prints (base, alternate art, overnumbered,
 *     signature), they are matched in that order with Cardmarket's products in
 *     the order Cardmarket added them (checked: alt arts priced ≥ base 97/98).
 *
 * Output (userData/prices.json, sent to the phone at sync):
 *   { updatedAt, source, cards: { <cardId>: [trend, trendFoil, idProduct, avg7, avg30, low, lowFoil, avg7Foil] },
 *     hist: { days: ['YYYY-MM-DD', …], cards / foil / avg7 / avg7Foil / low / lowFoil: { <cardId>: [price|null per day] } },
 *     oldImported, rifthuntAt }
 *
 * `hist` keeps the prices of each day for the last month, then one day a
 * week, as far back as it goes (thinHistory). Built up day after day, plus
 * once the prices.json of the app's former versions on this PC
 * (OLD_DATA_DIRS), plus the days the app missed from rifthunt's copy of
 * Cardmarket's trend price (fillFromRifthunt). The app's own readings win.
 */
const fs = require('node:fs');
const path = require('node:path');

const CM_PRODUCTS = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json';
const CM_PRICES = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json';
const RIFTCODEX = 'https://api.riftcodex.com/cards';
const RIFTHUNT_CARDS = 'https://api.rifthunt.com/bulk/cards'; // first source of the Cardmarket products (src/lib/rifthunt.js)
const HEADERS = { 'User-Agent': 'RiftMancer (local collection app; https://github.com/FaZox/RiftMancer)' };
const REFRESH_EVERY = 20 * 60 * 60 * 1000; // ~ daily
// Price table format: raised when the links or the card ↔ product matching change,
// so a table built the former way is rebuilt at once instead of waiting a day.
const PRICE_FORMAT = 2; // same as src/lib/priceBuilder.js
const NAMES_EVERY = 7 * 24 * 60 * 60 * 1000;

async function getJSON(url) {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

/**
 * rifthunt's printings: { names: { id → full English name }, cardmarket: { id → idProduct },
 * paths: { idProduct → 'Expansion/Name' } } (same as rifthuntCardIndex).
 */
async function fetchRifthuntIndex() {
  const d = await getJSON(RIFTHUNT_CARDS);
  const cards = Array.isArray(d) ? d : d?.cards;
  if (!Array.isArray(cards) || cards.length < 100) throw new Error('rifthunt: unexpected file');
  const names = {}, cardmarket = {}, paths = {};
  const base = (p) => String(p.riftboundId || '').toLowerCase().replace('*', '-star');
  const count = new Map();
  for (const p of cards) count.set(base(p), (count.get(base(p)) || 0) + 1);
  const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const p of cards) {
    const m = /\/Products\/Singles\/([\w-]+\/[\w-]+)$/.exec(String(p.cardmarketUrl || ''));
    if (m && Number(p.cardmarketId) > 0 && !paths[Number(p.cardmarketId)]) paths[Number(p.cardmarketId)] = m[1];
    const label = /\(([^)]+)\)\s*$/.exec(String(p.name || ''))?.[1];
    const id = count.get(base(p)) > 1 && label ? `${base(p)}-${slug(label)}` : base(p);
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) continue;
    if (!names[id]) names[id] = String(p.name || '');
    const cm = Number(p.cardmarketId);
    if (cm > 0 && !cardmarket[id]) cardmarket[id] = cm;
  }
  return { source: 'rifthunt', names, cardmarket, paths };
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

const DAILY_DAYS = 31; // price history: one column per day for the last month, then one per week
const SERIES = ['cards', 'foil', 'avg7', 'avg7Foil', 'low', 'lowFoil'];
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const dayNumber = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000);

/**
 * Days of a history worth keeping: every day of the last month (31 days),
 * then the latest day of each week before. Same as thinHistory in
 * src/lib/priceBuilder.js.
 */
function thinHistory(h) {
  const days = h?.days || [];
  const last = days.length ? dayNumber(days[days.length - 1]) : 0;
  const daily = [];
  const lastOfWeek = new Map();
  days.forEach((d, i) => {
    const n = dayNumber(d);
    if (last - n < DAILY_DAYS) daily.push(i);
    else lastOfWeek.set(Math.floor(n / 7), i);
  });
  const idx = [...lastOfWeek.values(), ...daily].sort((a, b) => a - b);
  const out = { days: idx.map(i => days[i]) };
  for (const key of SERIES) {
    const rows = {};
    for (const [id, row] of Object.entries(h?.[key] || {})) {
      const kept = idx.map(i => row[i] ?? null);
      if (kept.some(v => v != null)) rows[id] = kept;
    }
    out[key] = rows;
  }
  return out;
}

/**
 * Two price histories in one, without doubles: one column per day, `a`'s
 * value when both have one (the app's own readings win). `only`: the cards
 * taken from `b` (a Set of card ids; all when null). Then thinned. Same as
 * mergeHistory in src/lib/priceBuilder.js.
 */
function mergeHistory(a, b, only = null) {
  const days = [...new Set([...(a?.days || []), ...(b?.days || [])])].sort();
  const pos = new Map(days.map((d, i) => [d, i]));
  const out = { days };
  for (const key of SERIES) {
    const rows = {};
    for (const [h, own] of [[b, false], [a, true]]) { // a written last: it wins
      for (const [id, row] of Object.entries(h?.[key] || {})) {
        if (!own && only && !only.has(id)) continue;
        const r = rows[id] || (rows[id] = new Array(days.length).fill(null));
        (h.days || []).forEach((d, i) => { if (row[i] != null) r[pos.get(d)] = row[i]; });
      }
    }
    out[key] = rows;
  }
  return thinHistory(out);
}

const PICK = {
  cards: p => p[0] ?? p[1], foil: p => p[1] ?? null,
  avg7: p => p[3] ?? null, avg7Foil: p => p[7] ?? null,
  low: p => p[5] ?? null, lowFoil: p => p[6] ?? null,
};

/**
 * Add today's prices to the per-card history (one column per day for the
 * last month, then one per week), for each reference price and finish:
 * `cards` / `foil` = trend, `avg7` / `avg7Foil` = 7-day average, `low` /
 * `lowFoil` = lowest offer (Réglages → Prix de référence).
 */
function updateHistory(prev, day, cards) {
  const today = { days: [day] };
  for (const key of SERIES) {
    today[key] = {};
    for (const [id, p] of Object.entries(cards)) {
      const v = r2(PICK[key](p));
      if (v != null) today[key][id] = [v];
    }
  }
  return mergeHistory(today, prev);
}

// ─── Days the app missed: Cardmarket's trend price kept by rifthunt ───────
// rifthunt keeps the trend price of Cardmarket's price guide (the same file,
// the same figure) for each printing since 10/11/2026 — free, no key, any use
// allowed (rifthunt.com/terms), « bursts under 10 requests a second ».
const RIFTHUNT_HISTORY_FROM = '2026-11-10';
const RIFTHUNT_EVERY = 7 * 24 * 60 * 60 * 1000;
const RIFTHUNT_WAIT = 500; // ms between two cards: 2 a second (4 a second got « 429 Too Many Requests »)
const rifthuntHistoryUrl = (rid, range) => `https://api.rifthunt.com/prices/${encodeURIComponent(rid)}/history?range=${range}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** One card's rifthunt history; on « 429 Too Many Requests », waits (Retry-After, else 10 s) and tries again, 5 times at most. Null when it has none. */
async function getRifthuntHistory(url, wait = sleep) {
  for (let tries = 0; tries < 6; tries++) {
    let r;
    try { r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) }); } catch { return null; }
    if (r.status === 429) { await wait(Math.min(60, Number(r.headers.get('retry-after')) || 10) * 1000); continue; }
    if (!r.ok) return null;
    try { return await r.json(); } catch { return null; }
  }
  return null;
}

/** rifthunt's id of one of our cards ('ogn-303-star-298' → 'ogn-303*-298'); null for our own ids of printings sharing a number. */
function rifthuntId(cardId) {
  const m = /^([a-z0-9]+)-([a-z0-9]+?)(-star)?-(\d+)$/.exec(cardId);
  return m ? `${m[1]}-${m[2]}${m[3] ? '*' : ''}-${m[4]}` : null;
}

/**
 * One card's history from rifthunt (/prices/:id/history) as a history
 * ({ days, cards, foil }), kept only when it agrees with our own prices on
 * the days both have (at least one, all within a cent): a printing rifthunt
 * links to another Cardmarket product is left out. Null otherwise.
 */
function fromRifthunt(cardId, data, own) {
  const cm = data?.series?.cardmarket;
  const dates = data?.dates;
  if (!cm || !Array.isArray(dates) || !dates.length) return null;
  const n = cm.normal || []; const f = cm.foil || [];
  const rows = { cards: dates.map((d, i) => r2(n[i] ?? f[i] ?? null)), foil: dates.map((d, i) => r2(f[i] ?? null)) };
  const pos = new Map((own?.days || []).map((d, i) => [d, i]));
  let same = 0; let differ = 0;
  for (const key of ['cards', 'foil']) {
    const mine = own?.[key]?.[cardId];
    if (!mine) continue;
    dates.forEach((d, i) => {
      const j = pos.get(d);
      if (j == null || mine[j] == null || rows[key][i] == null) return;
      if (Math.abs(mine[j] - rows[key][i]) > 0.011) differ++; else same++;
    });
  }
  if (!same || differ) return null;
  return { days: dates, cards: { [cardId]: rows.cards }, foil: { [cardId]: rows.foil } };
}

/** Days of the last month (from rifthunt's first day) missing in a history. */
function missingDays(hist, today) {
  const have = new Set(hist?.days || []);
  const out = [];
  for (let n = dayNumber(today) - DAILY_DAYS + 1; n <= dayNumber(today); n++) {
    const d = new Date(n * 86400000).toISOString().slice(0, 10);
    if (d >= RIFTHUNT_HISTORY_FROM && !have.has(d)) out.push(d);
  }
  return out;
}

/** Former names of the app's data folders (prices.json of older versions on this PC). */
const OLD_DATA_DIRS = ['riftbound-scanner', 'riftbound-scanner-test', 'riftmancer', 'riftmancer-test'];

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
function mainExpansions(mapping, byId) {
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
function buildPromoPrices(mapping, products, guideById) {
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
function cardmarketSlug(s) {
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
 * null when Cardmarket has none. Same as buildLinks in src/lib/priceBuilder.js.
 */
function buildLinks(catalog, mapping, products, paths) {
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
function withoutPromos(catalog, mapping) {
  const promoSets = new Set(catalog.filter(c => c.variant === 'promo').map(c => c.set));
  const promo = new Set(catalog.filter(c => c.variant === 'promo' || promoSets.has(c.set)).map(c => c.id));
  return Object.fromEntries(Object.entries(mapping).filter(([id]) => !promo.has(id)));
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
    // rifthunt's (with the Cardmarket addresses) only: a Riftcodex cache may lack the new sets, rifthunt is tried again
    if (cached && cached.index?.source === 'rifthunt' && cached.index.paths && Date.now() - cached.fetchedAt < NAMES_EVERY) return cached.index;
    // rifthunt first (each printing's product), Riftcodex's names when it does not answer (very slow: ~50 s a page)
    let index = null;
    try { index = await fetchRifthuntIndex(); } catch (err) { console.warn('[prices] rifthunt unavailable, Riftcodex used:', err.message); }
    if (!index) {
      try { index = { source: 'riftcodex', names: await fetchRiftcodexNames(), cardmarket: {} }; } catch (err) { console.warn('[prices] Riftcodex unavailable too:', err.message); }
    }
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
    const prev = current;
    current = {
      format: PRICE_FORMAT,
      oldImported: prev?.oldImported,
      rifthuntAt: prev?.rifthuntAt,
      updatedAt: Date.now(),
      priceDate: guide.createdAt || null,
      source: 'Cardmarket (prix tendance)',
      matched: Object.keys(cards).length,
      total: catalog.length,
      cards,
      promo: buildPromoPrices(withoutPromos(catalog, mapping), products.products || [], guideById),
      links: buildLinks(catalog, mapping, products.products || [], rcNames?.paths),
      hist: updateHistory(prev?.hist, day, cards),
    };
    importOldFiles();
    fs.writeFileSync(file, JSON.stringify(current));
    console.log(`[prices] ${current.matched}/${current.total} cards priced`);
    onUpdated?.(current);
    fillFromRifthunt().catch(err => console.warn('[prices] rifthunt history failed:', err.message));
    return current;
  }

  /** Once: the history of the prices.json left by the app's former versions on this PC (their cards still in ours). */
  function importOldFiles() {
    if (!current?.cards || current.oldImported) return;
    const only = new Set(Object.keys(current.cards));
    let hist = current.hist;
    for (const name of OLD_DATA_DIRS) {
      const other = path.join(path.dirname(userData), name, 'prices.json');
      if (path.resolve(other) === path.resolve(file)) continue;
      try {
        const h = JSON.parse(fs.readFileSync(other, 'utf8')).hist;
        if (Array.isArray(h?.days)) hist = mergeHistory(hist, h, only);
      } catch { /* not on this PC */ }
    }
    current = { ...current, hist, oldImported: true };
  }

  /**
   * The days of the last month the app missed, from rifthunt (Cardmarket's
   * trend price, normal and foil): all its history the first time, then the
   * last month at most once a week, and only when days are missing.
   * In the background, one card after another.
   */
  let filling = null;
  function fillFromRifthunt(force = false) {
    if (filling) return filling;
    const today = current?.hist?.days?.at(-1);
    if (!today || !current.cards) return Promise.resolve(false);
    const first = !current.rifthuntAt;
    if (!force && !first && (!missingDays(current.hist, today).length || Date.now() - current.rifthuntAt < RIFTHUNT_EVERY)) return Promise.resolve(false);
    filling = (async () => {
      const range = first ? 'all' : '1m';
      const own = current.hist;
      let add = null; let n = 0;
      for (const cardId of Object.keys(current.cards)) {
        const rid = rifthuntId(cardId);
        if (!rid) continue;
        const h = fromRifthunt(cardId, await getRifthuntHistory(rifthuntHistoryUrl(rid, range)), own);
        if (h) { add = mergeHistory(add, h); n++; }
        await sleep(RIFTHUNT_WAIT);
      }
      current = { ...current, hist: add ? mergeHistory(current.hist, add) : current.hist, rifthuntAt: Date.now() };
      fs.writeFileSync(file, JSON.stringify(current));
      console.log(`[prices] rifthunt history: ${n} cards`);
      onUpdated?.(current);
      return true;
    })().finally(() => { filling = null; });
    return filling;
  }

  /** Refresh if older than a day (or forced). Never throws. */
  function refresh(force = false) {
    if (running) return running;
    if (!force && current?.hist && current.format === PRICE_FORMAT && Date.now() - current.updatedAt < REFRESH_EVERY) {
      // the history of older versions and of rifthunt, when the prices of the day are already there
      if (!current.oldImported) { importOldFiles(); fs.writeFileSync(file, JSON.stringify(current)); onUpdated?.(current); }
      fillFromRifthunt().catch(err => console.warn('[prices] rifthunt history failed:', err.message));
      return Promise.resolve(current);
    }
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

module.exports = { createPrices, copiesValue, buildMapping, updateHistory, thinHistory, mergeHistory, fromRifthunt, rifthuntId, missingDays, buildPromoPrices, buildLinks, withoutPromos, cardmarketSlug };
