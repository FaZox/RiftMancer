/**
 * Groups the cards that share the same illustration (reprints in another set,
 * « star » / alt-art printings of the same art) — field `artGroup` of
 * public/card-hashes.json. The scanner cannot tell them apart from a photo:
 * it then asks for the set instead of picking one at random (see matchIndex.js).
 *
 *   node scripts/catalog-groups.mjs     (run by `npm run catalog:update`)
 *
 * The catalog fingerprints use different crops per layout (standard 55 %,
 * full-art 95 %), so they are recomputed here from the card images on a crop
 * common to every layout, centred on the catalog mean, and compared:
 *   same name and similarity ≥ 0.90, or any name and similarity ≥ 0.99.
 * Same name and AI signatures (build-embeddings, DINOv2) ≥ 0.95 too: the
 * colours miss reprints printed with another tint (OGN runes vs RAD / VEN:
 * colours < 0.90, AI 0.988–0.993; different artworks of one name: AI ≤ 0.873,
 * 2026-11-13). That is why this step runs after build-embeddings.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gridFeatures } from '../src/lib/fingerprint.js';
import { decodeEmbedding } from '../src/lib/engines/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'public', 'card-hashes.json');
const SAME_NAME = 0.9;
const ANY_NAME = 0.99;
const SAME_NAME_AI = 0.95;
const COMMON_BOTTOM = 0.55;

const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const cards = catalog.cards;
const grid = catalog.gridSize || 16;

console.log(`Empreintes communes de ${cards.length} cartes…`);
const feats = new Array(cards.length);
let missing = 0;
for (let i = 0; i < cards.length; i++) {
  const img = path.join(root, 'public', 'cards', `${cards[i].id}.webp`);
  if (!fs.existsSync(img)) { missing++; continue; }
  let { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Battlefields are stored landscape-rotated like the others: same treatment for all.
  feats[i] = gridFeatures(data, info.width, info.height, COMMON_BOTTOM, grid);
}
if (missing) console.warn(`⚠ ${missing} images manquantes : ces cartes restent seules dans leur groupe.`);

const dim = grid * grid * 3;
const mean = new Float32Array(dim);
let n = 0;
for (const f of feats) if (f) { n++; for (let j = 0; j < dim; j++) mean[j] += f[j]; }
for (let j = 0; j < dim; j++) mean[j] /= Math.max(1, n);
const vec = feats.map(f => {
  if (!f) return null;
  const v = new Float32Array(dim);
  let s = 0;
  for (let j = 0; j < dim; j++) { v[j] = f[j] - mean[j]; s += v[j] * v[j]; }
  s = Math.sqrt(s) || 1;
  for (let j = 0; j < dim; j++) v[j] /= s;
  return v;
});

// AI signatures of the catalog (unit vectors), when present
const ai = cards.map(c => {
  if (typeof c.e !== 'string') return null;
  const v = decodeEmbedding(c.e);
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map(x => x / s);
});
const aiSim = (a, b) => {
  if (!ai[a] || !ai[b]) return 0;
  let dot = 0;
  for (let j = 0; j < ai[a].length; j++) dot += ai[a][j] * ai[b][j];
  return dot;
};

const parent = cards.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const nameKey = (c) => String(c.name || '').trim().toLowerCase();
for (let a = 0; a < cards.length; a++) {
  if (!vec[a]) continue;
  for (let b = a + 1; b < cards.length; b++) {
    if (!vec[b]) continue;
    let dot = 0;
    for (let j = 0; j < dim; j++) dot += vec[a][j] * vec[b][j];
    const sameName = nameKey(cards[a]) === nameKey(cards[b]);
    if (dot >= ANY_NAME || (sameName && (dot >= SAME_NAME || aiSim(a, b) >= SAME_NAME_AI))) parent[find(a)] = find(b);
  }
}
const members = new Map();
cards.forEach((c, i) => {
  const r = find(i);
  if (!members.has(r)) members.set(r, []);
  members.get(r).push(c);
});
let groups = 0;
let grouped = 0;
for (const c of cards) delete c.artGroup;
for (const list of members.values()) {
  if (list.length < 2) continue;
  groups++;
  grouped += list.length;
  const gid = list.map(c => c.id).sort()[0];
  for (const c of list) c.artGroup = gid;
}
fs.writeFileSync(file, JSON.stringify(catalog));
console.log(`✓ ${groups} groupes d'illustration identique (${grouped} cartes) écrits dans card-hashes.json`);
const sample = [...members.values()].filter(l => l.length > 1).slice(0, 8);
for (const l of sample) console.log('   ', l.map(c => `${c.id} (${c.name})`).join('  =  '));
