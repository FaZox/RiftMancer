/**
 * Groups of cards with the same illustration (reprints, star / alt-art
 * prints): field `artGroup` of the catalog — the scanner asks for the set
 * instead of picking one. Same rules as scripts/catalog-groups.mjs, shared
 * with the PC app (« Rechercher de nouvelles cartes », lot 4.2):
 *   colour fingerprint on a crop common to every layout (bottom 55 %),
 *   centred on the catalog mean: any name ≥ 0.99, same name ≥ 0.90;
 *   same name and AI signatures ≥ 0.95 (reprints printed with another tint).
 * Pure: tested in tests/galleryCards.test.mjs.
 */
import { decodeEmbedding } from './engines/index.js';

export const COMMON_BOTTOM = 0.55;
const SAME_NAME = 0.9, ANY_NAME = 0.99, SAME_NAME_AI = 0.95;

const unit = (v) => {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return Float32Array.from(v, x => x / s);
};

/**
 * `cards`: catalog cards; `common[i]`: fingerprint of card i on the common
 * crop (Float32Array, null when its image is missing). Returns Map(id → group
 * id) for the cards in a group of 2 or more (group id = smallest card id).
 */
export function computeGroups(cards, common) {
  const dim = common.find(Boolean)?.length || 0;
  const mean = new Float32Array(dim);
  let n = 0;
  for (const f of common) if (f) { n++; for (let j = 0; j < dim; j++) mean[j] += f[j]; }
  for (let j = 0; j < dim; j++) mean[j] /= Math.max(1, n);
  const vec = common.map(f => (f ? unit(f.map((x, j) => x - mean[j])) : null));
  const ai = cards.map(c => (typeof c.e === 'string' ? unit(decodeEmbedding(c.e)) : null));
  const dot = (a, b) => { let d = 0; for (let j = 0; j < a.length; j++) d += a[j] * b[j]; return d; };
  const parent = cards.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const nameKey = (c) => String(c.name || '').trim().toLowerCase();
  for (let a = 0; a < cards.length; a++) {
    if (!vec[a]) continue;
    for (let b = a + 1; b < cards.length; b++) {
      if (!vec[b]) continue;
      const d = dot(vec[a], vec[b]);
      const sameName = nameKey(cards[a]) === nameKey(cards[b]);
      if (d >= ANY_NAME || (sameName && (d >= SAME_NAME || (ai[a] && ai[b] && dot(ai[a], ai[b]) >= SAME_NAME_AI)))) parent[find(a)] = find(b);
    }
  }
  const members = new Map();
  cards.forEach((c, i) => { const r = find(i); if (!members.has(r)) members.set(r, []); members.get(r).push(c.id); });
  const out = new Map();
  for (const ids of members.values()) {
    if (ids.length < 2) continue;
    const gid = [...ids].sort()[0];
    for (const id of ids) out.set(id, gid);
  }
  return out;
}

/** Cards whose group changes: [{ id, artGroup }] (artGroup null = no group any more). */
export function groupPatches(cards, groups) {
  const out = [];
  for (const c of cards) {
    const g = groups.get(c.id) || null;
    if ((c.artGroup || null) !== g) out.push({ id: c.id, artGroup: g });
  }
  return out;
}
