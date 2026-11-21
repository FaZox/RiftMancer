/**
 * Catalog enrichment (run after the scraper). Adds the full English card names ("Jinx - Demolitionist") to the catalog
 * (public/card-hashes.json, field `nameEn`), from the public Riftcodex API.
 *
 * Our catalog only has the short name ("Jinx"); deck lists from other sites
 * use the full name, so the deck import needs it.
 *
 *   npm run catalog:enrich
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../public/card-hashes.json', import.meta.url);
const API = 'https://api.riftcodex.com/cards';
const HEADERS = { 'User-Agent': 'RiftboundScanner/1.0 (local collection app)' };

async function fetchNames() {
  const out = {};
  for (let page = 1; page < 100; page++) {
    const r = await fetch(`${API}?size=100&page=${page}`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`Riftcodex HTTP ${r.status}`);
    const d = await r.json();
    for (const i of d.items || []) {
      const id = String(i.riftbound_id || '').replace('*', '-star');
      if (id && !out[id]) out[id] = i.name;
    }
    if (page >= (d.pages || 1)) break;
  }
  return out;
}

const clean = (n) => n.replace(/\s*\((Alternate Art|Overnumbered|Signature)[^)]*\)\s*$/, '').trim();

const catalog = JSON.parse(await readFile(FILE, 'utf8'));
const names = await fetchNames();
// Prints of the same card (alt art, signature…) share set + number: a print
// missing from Riftcodex takes the name of another print.
const bySetNumber = new Map();
for (const c of catalog.cards) {
  const full = names[c.id] ? clean(names[c.id]) : null;
  if (full) bySetNumber.set(`${c.set}-${c.number}-${c.name}`, full);
}
let added = 0;
for (const c of catalog.cards) {
  let full = names[c.id] ? clean(names[c.id]) : bySetNumber.get(`${c.set}-${c.number}-${c.name}`);
  // Legends: "Champion - Title" (e.g. "Jinx - Loose Cannon").
  if (!full && c.type === 'legend' && c.tags?.[0]) full = `${c.tags[0]} - ${c.name}`;
  if (full && full !== c.name) { c.nameEn = full; added++; } else delete c.nameEn;
}
// French names: drop the print suffix the source sometimes leaves
// ("Lee Sin - Concentré (Alternate Art)"), and give prints without French
// data (or with an English fallback name) the French name/text of another
// print of the same card.
const PRINT = /\s*\((Alternate Art|Overnumbered|Signature)[^)]*\)\s*$/;
const looksEnglish = (c) => !c.nameFr || PRINT.test(c.nameFr)
  || (c.nameEn && c.nameFr.replace(/, /g, ' - ') === c.nameEn) || c.nameFr === c.name;
const frByCard = new Map();
for (const c of catalog.cards) {
  if (c.nameFr) c.nameFr = c.nameFr.replace(PRINT, '');
  if (!looksEnglish(c)) {
    const key = `${c.type}|${c.nameEn || c.name}`;
    if (!frByCard.has(key) || (!frByCard.get(key).textFr && c.textFr)) frByCard.set(key, c);
  }
}
let fixed = 0;
for (const c of catalog.cards) {
  if (!looksEnglish(c)) continue;
  const src = frByCard.get(`${c.type}|${c.nameEn || c.name}`);
  if (!src) continue;
  c.nameFr = src.nameFr;
  if (!c.textFr && src.textFr) c.textFr = src.textFr;
  fixed++;
}

await writeFile(FILE, JSON.stringify(catalog));
console.log(`[catalog] ${added} full English names, ${fixed} French names completed from other prints (${catalog.cards.length} cards)`);
