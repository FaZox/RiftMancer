/**
 * Links to Cardmarket (no account link: Cardmarket's API is for professional
 * sellers only). Card pages open with the filters chosen in Réglages; wants
 * are copied to the clipboard as « quantity name » lines and the Cardmarket
 * Wants page is opened so they can be pasted.
 */
import { getPricesState } from './prices.js';
import { cardmarketFilters } from './uiPrefs.js';

const BASE = 'https://www.cardmarket.com/fr/Riftbound';
export const WANTS_URL = `${BASE}/Wants`;

/** Name as Cardmarket writes it: « Jinx, Demolitionist » (full English name). */
export function cardmarketName(cardData) {
  if (cardData.nameEn) return cardData.nameEn.replace(/ - /g, ', ');
  if (cardData.type === 'legend' && cardData.tags?.[0]) return `${cardData.tags[0]}, ${cardData.name}`;
  return cardData.name;
}

/** Card page (by Cardmarket product id when known, else a search), with the filters. */
export function cardmarketUrl(cardData) {
  const q = cardmarketFilters();
  const id = getPricesState().prices?.cards?.[cardData.id]?.[2];
  if (id) return `${BASE}/Products?idProduct=${id}${q ? `&${q}` : ''}`;
  return `${BASE}/Products/Search?searchString=${encodeURIComponent(cardmarketName(cardData))}${q ? `&${q}` : ''}`;
}

/** Opens a web page outside the app (PC: default browser, phone: browser app). */
export function openExternal(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback below */ }
  const t = document.createElement('textarea');
  t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

/**
 * items: [{ cardData, quantity }]. Same card names are merged. Copies the list
 * (one « 2 Jinx, Demolitionist » per line) and opens the Cardmarket wants.
 * Returns { lines, copied }.
 */
export async function sendToCardmarketWants(items) {
  const byName = new Map();
  for (const { cardData, quantity } of items) {
    if (!cardData || quantity <= 0) continue;
    const n = cardmarketName(cardData);
    byName.set(n, (byName.get(n) || 0) + quantity);
  }
  const text = [...byName].map(([n, q]) => `${q} ${n}`).join('\n');
  const copied = text ? await copy(text) : false;
  if (text) openExternal(WANTS_URL);
  return { lines: byName.size, copied, text };
}
