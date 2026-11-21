/**
 * Cardmarket prices in the app (trend price, EUR, no FR/EN distinction).
 *
 *   - PC app: prices come from the main process (electron/prices.cjs), which
 *     downloads them daily.
 *   - Phone: downloads them itself from Cardmarket (refreshPrices, daily at
 *     start-up or on demand) — no PC needed. Prices received from the PC during
 *     sync are taken only when newer. Kept locally (IndexedDB meta "prices"),
 *     so they work offline.
 *
 * Price table: { updatedAt, priceDate, source,
 *                cards: { cardId: [trend, trendFoil, idProduct, avg7, avg30, low, lowFoil, avg7Foil] },
 *                promo: { cardId: [trend, trendFoil, n] },
 *                hist: { days: [...], cards / foil / avg7 / avg7Foil / low / lowFoil: { cardId: [per day] } } }   (31 days)
 * History:     [{ d: 'YYYY-MM-DD', v: value €, n: copies }]
 */
import { useEffect, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { isDesktop, getMeta, setMeta } from './collectionDB.js';
import { getMatcher } from './cardMatcher.js';
import { buildPriceTable, fetchCardIndex, CM_PRODUCTS, CM_PRICES } from './priceBuilder.js';
import { getPrefs } from './uiPrefs.js';import { tx, locale } from './i18n.js';


const REFRESH_EVERY = 20 * 60 * 60 * 1000; // ~ daily
const NAMES_EVERY = 7 * 24 * 60 * 60 * 1000;

let state = { prices: null, history: [] };
const subs = new Set();
function set(next) {
  state = { prices: next.prices || null, history: next.history || [] };
  for (const fn of subs) fn(state);
}

let started = false;
export async function initPrices() {
  if (started) return;
  started = true;
  try {
    if (isDesktop) {
      const api = window.riftboundDesktop.prices;
      set(await api.get());
      api.onChanged(async () => set(await api.get()));
    } else {
      const saved = await getMeta('prices');
      if (saved) set(saved);
      refreshPrices(); // phone: daily download, in the background
    }
  } catch (err) {
    console.warn('[prices] load failed:', err);
  }
}

/** Phone: store prices received from the PC (only if newer than ours). */
export async function savePrices(payload) {
  const cur = state.prices?.updatedAt || 0;
  if (cur && !state.prices?.demo && (payload?.prices?.updatedAt || 0) <= cur) return;
  await setMeta('prices', payload);
  set(payload);
}

// ─── Phone: download prices from Cardmarket ──────────────────────────────
// Cardmarket's files have no CORS headers, so the request goes through the
// native HTTP client (CapacitorHttp), not the WebView's fetch.
async function getJSON(url) {
  const r = await CapacitorHttp.get({ url, responseType: 'json', connectTimeout: 30000, readTimeout: 90000 });
  if (r.status !== 200) throw new Error(`${url} → HTTP ${r.status}`);
  return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
}

/** Cardmarket links and names (rifthunt, else Riftcodex), kept a week. */
async function cardIndex() {
  const cached = await getMeta('cardIndex');
  if (cached && cached.index?.source === 'riftcodex' && Date.now() - cached.fetchedAt < NAMES_EVERY) return cached.index;
  try {
    const index = await fetchCardIndex(getJSON);
    await setMeta('cardIndex', { fetchedAt: Date.now(), index });
    return index;
  } catch (err) {
    console.warn('[prices] card index unavailable:', err);
    return cached?.index || (await getMeta('riftcodexNames'))?.names || {};
  }
}

let running = null;
/**
 * Updates the prices: PC app → its main process; phone → Cardmarket directly.
 * Does nothing if they are less than a day old (unless forced). Never throws;
 * resolves to true when new prices were stored.
 */
export function refreshPrices(force = false) {
  if (isDesktop) return window.riftboundDesktop.prices.refresh().then(() => true, () => false);
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  if (running) return running;
  const cur = state.prices;
  if (!force && cur?.hist && !cur.demo && Date.now() - cur.updatedAt < REFRESH_EVERY) return Promise.resolve(false);
  running = (async () => {
    const catalog = getMatcher().cards;
    if (!catalog?.length) return false;
    const [products, guide, names] = await Promise.all([getJSON(CM_PRODUCTS), getJSON(CM_PRICES), cardIndex()]);
    const table = buildPriceTable(catalog, products, guide, names, cur?.demo ? null : cur);
    const payload = { prices: table, history: state.history };
    await setMeta('prices', payload);
    set(payload);
    console.log(`[prices] ${table.matched}/${table.total} cards priced`);
    return true;
  })()
    .catch(err => { console.warn('[prices] refresh failed:', err); return false; })
    .finally(() => { running = null; });
  return running;
}

export function getPricesState() { return state; }

export function usePrices() {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); return () => subs.delete(setS); }, []);
  return s;
}

// Price table row: [trend, trendFoil, idProduct, avg7, avg30, low, lowFoil, avg7Foil]
// (older tables stop at avg30: the trend is used then).
// Promo table: prices.promo = { cardId: [trend, trendFoil, n] }, n = number of
// Cardmarket promo products of that card (1: its own price; more: median, estimated).
const REF_INDEX = { trend: [0, 1], avg7: [3, 7], low: [5, 6] };
export const PRICE_REF_LABEL = { trend: tx('prix tendance'), avg7: tx('moyenne 7 jours'), low: tx('prix le plus bas') };

/** Reference price chosen in the settings (« Prix de référence »). */
export function priceRef() {
  return REF_INDEX[getPrefs().priceRef] ? getPrefs().priceRef : 'trend';
}

/** Help line of an estimated price (« ≈ »), by reason. */
export const ESTIMATE_LABEL = {
  'from-normal': tx('Estimé d’après la version non foil'),
  'from-foil': tx('Estimé d’après la version foil'),
  'promo-several': tx('Estimé : plusieurs promos de cette carte sur Cardmarket'),
  'promo-none': tx('Estimé d’après la carte normale (pas de promo sur Cardmarket)'),
};

/**
 * Price of one copy, with how sure it is: { value, estimated } where
 * estimated is null (Cardmarket price of this very finish) or a key of
 * ESTIMATE_LABEL. Order: own finish in the chosen reference, own finish
 * trend, then the other finish (estimated). Promo copies use the price of the
 * card's promo on Cardmarket (trend) when there is one.
 */
export function priceInfo(prices, cardId, foil = false, ref = priceRef(), promo = false) {
  if (promo) {
    const q = prices?.promo?.[cardId];
    if (q && (q[0] || q[1])) {
      const own = foil ? q[1] : q[0];
      const several = q[2] > 1 ? 'promo-several' : null;
      if (own) return { value: own, estimated: several };
      return { value: foil ? q[0] : q[1], estimated: several || (foil ? 'from-normal' : 'from-foil') };
    }
    const base = priceInfo(prices, cardId, foil, ref, false);
    return base.value == null ? base : { value: base.value, estimated: 'promo-none' };
  }
  const p = prices?.cards?.[cardId];
  if (!p) return { value: null, estimated: null };
  const [n, f] = REF_INDEX[ref] || REF_INDEX.trend;
  const own = foil ? (p[f] || p[1]) : (p[n] || p[0]);
  if (own) return { value: own, estimated: null };
  const other = foil ? (p[n] || p[0]) : (p[f] || p[1]);
  if (other) return { value: other, estimated: foil ? 'from-normal' : 'from-foil' };
  return { value: null, estimated: null };
}

/** Price of one copy (see priceInfo), or null. */
export function unitPrice(prices, cardId, foil = false, ref = priceRef(), promo = false) {
  return priceInfo(prices, cardId, foil, ref, promo).value;
}

/** True when the card has its own Cardmarket price in this finish (foil or not). */
export function hasFinishPrice(prices, cardId, foil) {
  const p = prices?.cards?.[cardId];
  return !!p && !!(foil ? p[1] : p[0]);
}

/**
 * The trend of a little-traded card can be far from what it really sells
 * for: true when the trend differs from the 7-day average by more than 30 %.
 */
export function priceVolatile(prices, cardId, foil = false) {
  const p = prices?.cards?.[cardId];
  if (!p) return false;
  const trend = foil ? p[1] : p[0];
  const avg7 = foil ? p[7] : p[3];
  return !!trend && !!avg7 && Math.abs(trend - avg7) / avg7 > 0.3;
}

/** Re-renders the price views (after « Prix de référence » changed). */
export function notifyPricesChanged() {
  set({ ...state });
}

/**
 * Total value of stacks ({ cardData, quantity, foil, promo }).
 * Returns { value, priced, unpriced, estimated } (estimated: copies whose price is « ≈ »).
 */
export function stacksValue(prices, stacks, ref = priceRef()) {
  let value = 0; let priced = 0; let unpriced = 0; let estimated = 0;
  for (const s of stacks) {
    const u = priceInfo(prices, s.cardData.id, s.foil, ref, s.promo);
    if (u.value == null) unpriced += s.quantity;
    else {
      value += u.value * s.quantity; priced += s.quantity;
      if (u.estimated) estimated += s.quantity;
    }
  }
  return { value, priced, unpriced, estimated };
}

const HIST_KEY = { trend: ['cards', 'foil'], avg7: ['avg7', 'avg7Foil'], low: ['low', 'lowFoil'] };

/**
 * Price history of a card over the last month, in the chosen reference price
 * and finish: [{ d: 'YYYY-MM-DD', v }]. (Foil histories and those of the
 * 7-day average and of the low price fill up day after day.)
 */
export function cardHistory(prices, cardId, ref = priceRef(), foil = false) {
  const h = prices?.hist;
  const row = h?.[(HIST_KEY[ref] || HIST_KEY.trend)[foil ? 1 : 0]]?.[cardId];
  if (!row) return [];
  return h.days.map((d, i) => ({ d, v: row[i] })).filter(p => p.v != null);
}

/** Collection value history in the chosen reference price: [{ d, v, n }]. */
export function valueHistory(history, ref = priceRef()) {
  const key = ref === 'avg7' ? 'v7' : ref === 'low' ? 'vl' : 'v';
  return (history || []).filter(h => h[key] != null).map(h => ({ ...h, v: h[key] }));
}

/**
 * Price movement of a card over `days` days, in % — only from the app's own
 * history of that finish, and only when it goes back far enough (one day of
 * tolerance). Otherwise null: the screens show « — » (the history fills up
 * day after day). Never a comparison with an average presented as a change.
 */
export function priceChange(prices, cardId, days = 7, ref = priceRef(), foil = false, today = Date.now()) {
  const p = prices?.cards?.[cardId];
  if (!p) return null;
  const [n, f] = REF_INDEX[ref] || REF_INDEX.trend;
  const now = foil ? p[f] : (ref === 'trend' ? (p[0] ?? p[1]) : p[n]);
  if (!now) return null;
  const hist = cardHistory(prices, cardId, ref, foil);
  if (!hist.length) return null;
  const limit = new Date(today - (days - 1) * 86400000).toISOString().slice(0, 10);
  let base = null;
  for (const x of hist) if (x.d <= limit) base = x; // latest point at least days − 1 days old
  if (!base?.v) return null;
  return ((now - base.v) / base.v) * 100;
}

/** The one percentage format of the app: « +12 % », « −3,4 % » (one decimal under 10 %). */
export function pct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const s = a < 10 ? a.toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(a));
  const sign = s === '0' ? '' : v > 0 ? '+' : '−';
  return `${sign}${s} %`;
}

/** Wish list items whose price is at or below the alert price. */
export function priceAlerts(prices, wishItems) {
  if (!prices) return [];
  return wishItems.filter(i => i.maxPrice > 0 && (unitPrice(prices, i.cardId) ?? Infinity) <= i.maxPrice);
}

const fmt = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' });
export function euro(v) {
  return v == null ? '—' : fmt.format(v);
}

/** Cardmarket search page for a card (English name, as Cardmarket lists it). */
// Card page on Cardmarket, with the filters chosen in Réglages (see cardmarket.js)
export { cardmarketUrl } from './cardmarket.js';
