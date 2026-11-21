import { priceInfo, priceRef, stacksValue, priceChange } from './prices.js';

/**
 * Value of the collection from the Cardmarket prices — shared by the phone
 * (ValueView) and the PC (desktop/pages/ValuePage), through useValueData.
 *
 * total   { value, priced, unpriced, estimated }
 * week    { diff (€), pct } change over 7 days of the cards owned (own price history only)
 * up/down biggest 7-day moves (cards worth ≥ 0.50 €), 8 each
 * all     one entry per card and finish { key, cardData, foil, promo, v (€ total), n (copies),
 *         unit, estimated (key of ESTIMATE_LABEL or null), ch (% 7 d or null) }, most valuable first
 * sets    value per set
 * paid / paidValue / paidCopies: purchase prices entered, for the copies that have a price;
 * paidUnpriced: copies with a purchase price but no Cardmarket price (left out of the comparison)
 */
export function valueData(prices, scannedCards, ref = priceRef()) {
  const total = stacksValue(prices, scannedCards, ref);
  const byKey = new Map();
  const bySet = new Map();
  let before = 0; let now = 0;
  let paid = 0; let paidValue = 0; let paidCopies = 0; let paidUnpriced = 0;
  for (const s of scannedCards) {
    const info = priceInfo(prices, s.cardData.id, s.foil, ref, s.promo);
    if (s.paid) {
      if (info.value == null) paidUnpriced += s.quantity;
      else { paid += s.paid * s.quantity; paidValue += info.value * s.quantity; paidCopies += s.quantity; }
    }
    if (info.value == null) continue;
    const v = info.value * s.quantity;
    const key = `${s.cardData.id}|${s.foil ? 1 : 0}|${s.promo ? 1 : 0}`;
    const ch = s.promo ? null : priceChange(prices, s.cardData.id, 7, ref, !!s.foil);
    const cur = byKey.get(key) || { key, cardData: s.cardData, foil: !!s.foil, promo: !!s.promo, v: 0, n: 0, unit: info.value, estimated: info.estimated, ch };
    cur.v += v; cur.n += s.quantity;
    byKey.set(key, cur);
    const st = bySet.get(s.cardData.set) || { set: s.cardData.set, name: s.cardData.setName, v: 0, n: 0 };
    st.v += v; st.n += s.quantity;
    bySet.set(s.cardData.set, st);
    if (ch != null) { now += v; before += v / (1 + ch / 100); }
  }
  const all = [...byKey.values()].sort((a, b) => b.v - a.v);
  const moves = all.filter(c => c.ch != null && (c.unit || 0) >= 0.5);
  return {
    total,
    week: before > 0 ? { diff: now - before, pct: ((now - before) / before) * 100 } : null,
    up: moves.filter(c => c.ch > 0).sort((a, b) => b.ch - a.ch).slice(0, 8),
    down: moves.filter(c => c.ch < 0).sort((a, b) => a.ch - b.ch).slice(0, 8),
    paid, paidValue, paidCopies, paidUnpriced,
    all,
    sets: [...bySet.values()].sort((a, b) => b.v - a.v),
  };
}
