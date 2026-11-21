import { priceInfo, priceChange, priceAlerts, priceRef, pct, euro } from './prices.js';import { tx } from './i18n.js';


/**
 * Price alerts (lot 9): the cards you own that rose or fell by more than X %
 * over 7 days, plus the wish list alerts, and the summary shown after each
 * price update. A change is counted only from the card's own price history
 * (priceChange, lot 1.2 a): no history over the 7 days, no alert.
 *
 * Settings (uiPrefs): priceAlertPct (X %, 0 = off), priceAlertMin (only the
 * cards worth more than this, in €).
 */
export const ALERT_PCTS = [10, 20, 30, 50];
export const ALERT_MINS = [0.5, 1, 2, 5, 10];

/** The owned cards (one entry per card and finish, promos left out) that moved past the threshold. */
export function ownedMoves(prices, scannedCards, { pct: limit = 20, min = 2 } = {}, ref = priceRef(), today = Date.now()) {
  if (!prices || !(limit > 0)) return { up: [], down: [] };
  const seen = new Map();
  for (const s of scannedCards) {
    if (s.promo) continue; // a promo has no price history of its own
    const key = `${s.cardData.id}|${s.foil ? 1 : 0}`;
    const cur = seen.get(key);
    if (cur) { cur.n += s.quantity; continue; }
    const info = priceInfo(prices, s.cardData.id, !!s.foil, ref);
    if (info.value == null || info.estimated || info.value < min) continue;
    const ch = priceChange(prices, s.cardData.id, 7, ref, !!s.foil, today);
    if (ch == null || Math.abs(ch) < limit) continue;
    seen.set(key, { key, cardData: s.cardData, foil: !!s.foil, unit: info.value, ch, n: s.quantity });
  }
  const all = [...seen.values()];
  return {
    up: all.filter(m => m.ch > 0).sort((a, b) => b.ch - a.ch),
    down: all.filter(m => m.ch < 0).sort((a, b) => a.ch - b.ch),
  };
}

/** Everything the « Mouvements » panel shows. */
export function movements(prices, scannedCards, wishItems, prefs, ref = priceRef(), today = Date.now()) {
  const { up, down } = ownedMoves(prices, scannedCards, { pct: prefs.priceAlertPct, min: prefs.priceAlertMin }, ref, today);
  return { up, down, wish: priceAlerts(prices, wishItems) };
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** « 3 cartes en forte hausse, 1 en forte baisse, 1 alerte de souhait » — null when there is nothing. */
export function summaryText({ up, down, wish }) {
  const parts = [];
  if (up.length) parts.push(plural(up.length, 'carte en forte hausse', 'cartes en forte hausse'));
  if (down.length) parts.push(up.length ? `${down.length} en forte baisse` : plural(down.length, 'carte en forte baisse', 'cartes en forte baisse'));
  if (wish.length) parts.push(plural(wish.length, 'alerte de souhait', 'alertes de souhait'));
  return parts.length ? parts.join(', ') : null;
}

/** One line of the panel: « Jinx, Démolisseuse +34 % en 7 jours · 12,40 € ». */
export function moveLine(m, name) {
  return `${name} ${pct(m.ch)} en 7 jours · ${euro(m.unit)}`;
}

/** « Souhait : Ahri est passée sous 8 € ». */
export function wishLine(item, name) {
  return tx('Souhait : {name} est passée sous {replace}', { name, replace: euro(item.maxPrice).replace(/,00(?=\s€)/, '') });
}

// The summary is shown once per price update (not at every start)
const SEEN_KEY = 'rb.prices.summarized';
export function takeNewUpdate(updatedAt, storage = globalThis.localStorage) {
  if (!updatedAt) return false;
  let last = null;
  try { last = storage?.getItem(SEEN_KEY); } catch { /* private mode */ }
  if (String(updatedAt) === last) return false;
  try { storage?.setItem(SEEN_KEY, String(updatedAt)); } catch { /* ignore */ }
  return true;
}

/** Réglages → Prix status: « Tendance · alertes à 20 % ». */
export function alertStatus(prefs) {
  return prefs.priceAlertPct > 0 ? tx('alertes à {priceAlertPct} %', { priceAlertPct: prefs.priceAlertPct }) : tx('alertes coupées');
}
