/**
 * Recognition bench on fixed corners (no detection): replays several
 * recognition modes on the corners dumped by `eval-detector --no-identify --dump`,
 * and the same with the true artwork removed from the catalog (out-of-catalog
 * card), so that each mode's thresholds can be recalibrated
 * (scripts/recognition-report.mjs).
 *
 *   node scripts/eval-recognition.mjs --in a.json,b.json --out rec.json [--jobs 8]
 *        [--jitter 0,0.01,0.02] (each corner moved by that share of the card width, random direction)
 *        [--modes base,B] (B: 9 framings for the colours, slower) [--sim-scenes 400]
 *
 * Modes (per sample: best artwork g, its score s1, the next artwork's score s2,
 * and the path p — 'c' colours sure (Prudent gate), 'f' scored by the mode):
 *   colours  colours only (16×16 grid, all views)
 *   ai       AI only, whole catalog (3 crops 0.55 / 0.85 / 0.95, normal + 180°)
 *   cascade  the app: colours sure → colours; else AI on the colours' best card's crop, fused on their K best
 *   A        colours sure → colours; else AI on the 3 crops, fused over the whole catalog
 *   Aai      colours sure → colours; else AI alone on the 3 crops, whole catalog
 *   Aeco     like A, but the AI computes only the crops (artBottom) present among the colours' K best cards
 *            (field nb: how many crops; the embeddings are the same images, so A's are reused)
 *   Aeco12   like A, crops of the colours' 12 best cards only;  A1v  like A, only the colours' orientation (3 images)
 *   B        colours on 9 framings (±2 % shifts, ±2 % size, ±2 % height), best kept; then the cascade
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ortModule from 'onnxruntime-node';
import { tuneOrt } from './lib/benchOrt.mjs';

const ort = { ...ortModule, InferenceSession: ortModule.InferenceSession };
tuneOrt(ort);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = get('out', 'rec.json');
const JOBS = Number(get('jobs', 1));

// ─── Parallel: the same command on n shards, outputs concatenated ────────
if (JOBS > 1) {
  const cores = get("cores-each", "") ? Number(get("cores-each")) : Math.max(1, Math.floor(os.cpus().length / JOBS));
  const rest = argv.filter((a, i) => !['--jobs', '--out', '--cores-each'].includes(a) && !['--jobs', '--out', '--cores-each'].includes(argv[i - 1]));
  const outs = [];
  await Promise.all(Array.from({ length: JOBS }, (_, k) => new Promise((res, rej) => {
    const o = `${OUT}.part${k}`; outs.push(o);
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), ...rest, '--shard', `${k + 1}/${JOBS}`, '--cores', String(cores), '--out', o], { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`partie ${k + 1} : code ${c}`))));
  })));
  const parts = outs.map((o) => JSON.parse(fs.readFileSync(o, 'utf8')));
  outs.forEach((o) => fs.unlinkSync(o));
  const timings = parts.map((p) => p.pop().timing);
  const avg = (k) => timings.reduce((s, t) => s + t[k], 0) / timings.length;
  const all = parts.flat();
  all.push({ timing: { colourMs: avg('colourMs'), embedFullMs: avg('embedFullMs'), embedSingleMs: avg('embedSingleMs'), cropMs: avg('cropMs'), extraEmbeds: timings.reduce((s, t) => s + t.extraEmbeds, 0), cores } });
  fs.writeFileSync(OUT, JSON.stringify(all));
  console.log(`${all.length - 1} échantillons → ${OUT}`);
  process.exit(0);
}

const { warpQuadRGBA } = await import('../src/lib/perspectiveCrop.js');
const { queryViews } = await import('../src/lib/fingerprint.js');
const { DECISION_PRUDENT } = await import('../src/lib/matchIndex.js');

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/card-hashes.json'), 'utf8'));
globalThis.__BUILD_TIME__ = 'bench';
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify(catalog), { status: 200 });
const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
const matcher = new CardMatcher();
await matcher.initialize();
globalThis.fetch = realFetch;
await matcher.startAI(async () => ({ ort, executionProviders: ['cpu'], loadModel: async (f) => new Uint8Array(fs.readFileSync(path.join(root, 'public', 'models', f))) }));
if (matcher.aiStatus().state !== 'ready') throw new Error('IA indisponible');
const index = matcher.index; const ai = matcher.ai; const header = ai.header;
const BOTTOMS = matcher.uniqueArtBottoms; const GRID = matcher.gridSize;
const K = header.cascade?.k || 300; const ALPHA = header.alpha; // K: former cascade (before lot 1.4), replayed by the bench
const N = index.n;
const groupOfId = new Map(catalog.cards.map((c) => [c.id, c.artGroup || c.id]));
const CROP_W = 480; const CROP_H = 670;
const MODES = get('modes', 'base,B').split(',');

// ─── Samples ─────────────────────────────────────────────────────────────
const [shK, shN] = (get('shard', '1/1')).split('/').map(Number);
const jitters = get('jitter', '0').split(',').map(Number);
let samples = [];
for (const f of get('in', '').split(',').filter(Boolean)) {
  for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const kps = x.kpsF || x.kps; if (!kps || !x.file) continue;
    for (const j of jitters) samples.push({ src: path.basename(f, '.json'), kind: x.kind, truth: x.truth, list: x.list, file: x.file, rot: x.rot || 0, kps, photo: x.photo || path.basename(x.file), scene: x.scene, jitter: j });
  }
}
// --kinds real,grid: only these sets
if (get('kinds', '')) { const ks = get('kinds').split(','); samples = samples.filter((s) => ks.includes(s.kind)); }
// --sim-scenes 400: only the first 400 simulated scenes (sorted by file)
const SIM_SCENES = Number(get('sim-scenes', 0));
if (SIM_SCENES) {
  const keep = new Set([...new Set(samples.filter((s) => s.kind === 'sim').map((s) => s.file))].sort().slice(0, SIM_SCENES));
  samples = samples.filter((s) => s.kind !== 'sim' || keep.has(s.file));
}
// shards by file, so each image is loaded once per shard
const fileKey = (s) => `${s.file}|${s.rot}`;
const files = [...new Set(samples.map(fileKey))];
const mine = new Set(files.filter((_, i) => i % shN === shK - 1));
samples = samples.filter((s) => mine.has(fileKey(s)));

async function loadRGBA(file, turn = 0) {
  let img = sharp(file).rotate();
  if (turn) img = sharp(await img.toBuffer()).rotate(turn);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}
let cropMs = 0; let cropN = 0;
async function cropPx(img, q) {
  const t = performance.now();
  const c = warpQuadRGBA(img.rgba, img.w, img.h, q);
  const portrait = c.h >= c.w;
  const { data } = await sharp(Buffer.from(c.data.buffer, c.data.byteOffset, c.data.byteLength), { raw: { width: c.w, height: c.h, channels: 4 } })
    .resize(portrait ? CROP_W : CROP_H, portrait ? CROP_H : CROP_W, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  cropMs += performance.now() - t; cropN++;
  return { px: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: portrait ? CROP_W : CROP_H, h: portrait ? CROP_H : CROP_W };
}

// ─── Quad geometry (visual order TL TR BR BL) ────────────────────────────
function sortV(k) { const cx = k.reduce((s, q) => s + q[0], 0) / 4; const cy = k.reduce((s, q) => s + q[1], 0) / 4; return [...k].sort((u, v) => Math.atan2(u[1] - cy, u[0] - cx) - Math.atan2(v[1] - cy, v[0] - cx)); }
function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
function cardWidth(q) { const [tl, tr, br, bl] = q; return Math.min((Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) + Math.hypot(br[0] - bl[0], br[1] - bl[1])) / 2, (Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) + Math.hypot(br[0] - tr[0], br[1] - tr[1])) / 2); }
function jitterQuad(q, d, key) { if (!d) return q; const r = seeded(key); const W = cardWidth(q); return q.map(([x, y]) => { const a = r() * 2 * Math.PI; return [x + Math.cos(a) * d * W, y + Math.sin(a) * d * W]; }); }
// 9 framings: normal, shift ±2 % (along the card's own axes), whole size ±2 %, height only ±2 %
function framings(q, s = 0.02) {
  const [tl, tr, br, bl] = q; const W = cardWidth(q);
  const ux = [(tr[0] - tl[0] + br[0] - bl[0]) / 2, (tr[1] - tl[1] + br[1] - bl[1]) / 2]; const uy = [(bl[0] - tl[0] + br[0] - tr[0]) / 2, (bl[1] - tl[1] + br[1] - tr[1]) / 2];
  const nx = Math.hypot(...ux); const ny = Math.hypot(...uy); const ex = [ux[0] / nx, ux[1] / nx]; const ey = [uy[0] / ny, uy[1] / ny];
  const c = [(tl[0] + tr[0] + br[0] + bl[0]) / 4, (tl[1] + tr[1] + br[1] + bl[1]) / 4];
  const move = (dx, dy) => q.map(([x, y]) => [x + (ex[0] * dx + ey[0] * dy) * W, y + (ex[1] * dx + ey[1] * dy) * W]);
  const scale = (fx, fy) => q.map(([x, y]) => { const vx = x - c[0]; const vy = y - c[1]; const a = vx * ex[0] + vy * ex[1]; const b = vx * ey[0] + vy * ey[1]; return [c[0] + ex[0] * a * fx + ey[0] * b * fy, c[1] + ex[1] * a * fx + ey[1] * b * fy]; });
  return [q, move(-s, 0), move(s, 0), move(0, -s), move(0, s), scale(1 - 2 * s, 1 - 2 * s), scale(1 + 2 * s, 1 + 2 * s), scale(1, 1 - 2 * s), scale(1, 1 + 2 * s)];
}

// ─── Scoring helpers ─────────────────────────────────────────────────────
function topK(scores, k, ex) { // [{ i, s }] best first, skipping the excluded artwork
  const top = [];
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]; if (s === -Infinity || (ex && index.group[i] === ex)) continue;
    if (top.length < k || s > top[top.length - 1].s) { let p = top.length < k ? top.length : k - 1; if (top.length < k) top.push(null); while (p > 0 && top[p - 1].s < s) { top[p] = top[p - 1]; p--; } top[p] = { i, s }; }
  }
  return top;
}
function best2(scores, ex) { // best artwork and the next artwork's score (like MatchIndex.decide)
  let b = -1; let bs = -Infinity;
  for (let i = 0; i < scores.length; i++) { if (ex && index.group[i] === ex) continue; if (scores[i] > bs) { bs = scores[i]; b = i; } }
  if (b < 0 || bs === -Infinity) return { g: null, s1: 0, s2: 0 };
  const g = index.group[b]; let s2 = -Infinity;
  for (let i = 0; i < scores.length; i++) { if ((ex && index.group[i] === ex) || index.group[i] === g) continue; if (scores[i] > s2) s2 = scores[i]; }
  return { g, s1: +bs.toFixed(4), s2: +(s2 === -Infinity ? 0 : s2).toFixed(4) };
}
const sureOf = (top) => index.decide(top.slice(0, 12).map((t) => ({ index: t.i, id: index.ids[t.i], group: index.group[t.i], score: t.s })), DECISION_PRUDENT).accepted;
function singleViews(full, name, b) { const v = full.find((x) => x.name === name) || full[0]; return [{ name: v.name, byBottom: new Map([[b, v.byBottom.get(b)]]) }]; }
let embedMs = 0; let embedN = 0; let colourMs = 0; let colourN = 0; let singleMs = 0; let singleN = 0;
async function embedFull(c) { const t = performance.now(); const r = await ai.engine.embed(c.px, c.w, c.h, { region: header.region, bottoms: BOTTOMS, views: ['normal', 'rot180'] }); embedMs += performance.now() - t; embedN++; return r; }
function colourOf(c) { const t = performance.now(); const v = queryViews(c.px, c.w, c.h, BOTTOMS, GRID); const s = index.scoreAll(v); colourMs += performance.now() - t; colourN++; return { views: v, scores: s }; }

// The cascade on given colour scores / views and the AI embeddings of the crop the AI looks at.
function cascade(colour, colourViews, aiFull, ex) {
  const top = topK(colour, K, ex);
  if (!top.length) return { g: null, s1: 0, s2: 0, p: 'f' };
  if (sureOf(top)) return { ...best2(colour, ex), p: 'c' };
  const orient = index.bestViewName(colourViews, top[0].i) === 'rot180' ? 'rot180' : 'normal';
  const aiS = ai.index.scoreAll(singleViews(aiFull, orient, index.bottom[top[0].i]));
  const fused = new Float32Array(N).fill(-Infinity);
  for (const t of top) fused[t.i] = ALPHA * aiS[t.i] + (1 - ALPHA) * colour[t.i];
  return { ...best2(fused, ex), p: 'f' };
}

const out = [];
let lastKey = null; let img = null;
for (const [n, sm] of samples.entries()) {
  const key = fileKey(sm);
  if (key !== lastKey) { img = await loadRGBA(sm.file, sm.rot); lastKey = key; }
  const q = jitterQuad(sortV(sm.kps), sm.jitter, `${sm.photo}|${sm.kps.join()}|${sm.jitter}`);
  const truthG = sm.truth ? (groupOfId.get(sm.truth) || sm.truth) : null;
  const c0 = await cropPx(img, q);
  const col0 = colourOf(c0);
  const aiFull0 = await embedFull(c0);
  if (n % 25 === 0) { const t = performance.now(); await ai.engine.embed(c0.px, c0.w, c0.h, { region: header.region, bottoms: [BOTTOMS[0]], views: ['normal'] }); singleMs += performance.now() - t; singleN++; }
  const aiAll = ai.index.scoreAll(aiFull0);
  const fusedAll = new Float32Array(N); for (let i = 0; i < N; i++) fusedAll[i] = ALPHA * aiAll[i] + (1 - ALPHA) * col0.scores[i];
  const r = {};
  for (const ex of [null, truthG]) {
    if (ex === null ? false : !truthG) continue;
    const m = {};
    m.colours = { ...best2(col0.scores, ex), p: 'f' };
    m.ai = { ...best2(aiAll, ex), p: 'f' };
    m.cascade = cascade(col0.scores, col0.views, aiFull0, ex);
    const topC = topK(col0.scores, 12, ex); const sure = topC.length > 0 && sureOf(topC);
    m.A = sure ? { ...best2(col0.scores, ex), p: 'c' } : { ...best2(fusedAll, ex), p: 'f' };
    m.Aai = sure ? { ...best2(col0.scores, ex), p: 'c' } : { ...best2(aiAll, ex), p: 'f' };
    if (sure) { m.Aeco = { ...best2(col0.scores, ex), p: 'c', nb: 0 }; m.Aeco12 = m.Aeco; m.A1v = m.Aeco; for (const k of [1, 2, 3, 5, 12]) for (const d of [0, 0.02, 0.05]) m[`A${k}o${d}`] = { ...m.Aeco, img: 0 }; }
    else {
      const bs = [...new Set(topK(col0.scores, K, ex).map((t) => index.bottom[t.i]))];
      const sub = aiFull0.map((v) => ({ name: v.name, byBottom: new Map([...v.byBottom].filter(([b]) => bs.includes(b))) }));
      const aiE = ai.index.scoreAll(sub);
      const fusedE = new Float32Array(N); for (let i = 0; i < N; i++) fusedE[i] = ALPHA * aiE[i] + (1 - ALPHA) * col0.scores[i];
      m.Aeco = { ...best2(fusedE, ex), p: 'f', nb: bs.length };
      // Aeco12: the crops of the colours' 12 best cards only; A1v: the 3 crops, only the colours' orientation
      const fuse = (aiS) => { const f = new Float32Array(N); for (let i = 0; i < N; i++) f[i] = ALPHA * aiS[i] + (1 - ALPHA) * col0.scores[i]; return f; };
      const top12 = topK(col0.scores, 12, ex); const b12 = [...new Set(top12.map((t) => index.bottom[t.i]))];
      m.Aeco12 = { ...best2(fuse(ai.index.scoreAll(aiFull0.map((v) => ({ name: v.name, byBottom: new Map([...v.byBottom].filter(([b]) => b12.includes(b))) })))), ex), p: 'f', nb: b12.length };
      const orient = index.bestViewName(col0.views, top12[0].i) === 'rot180' ? 'rot180' : 'normal';
      m.A1v = { ...best2(fuse(ai.index.scoreAll(aiFull0.filter((v) => v.name === orient))), ex), p: 'f' };
      // Lighter variant A: crops of the colours' k best cards; one way up when the colours' best card
      // scores clearly better one way (normal vs 180°, difference ≥ d), else both. img = AI pictures.
      const t0 = top12[0].i;
      const sN = index.scoreAll(col0.views.filter((v) => v.name === 'normal'))[t0];
      const sR = index.scoreAll(col0.views.filter((v) => v.name === 'rot180'))[t0];
      for (const k of [1, 2, 3, 5, 12]) {
        const bk = [...new Set(top12.slice(0, k).map((t) => index.bottom[t.i]))];
        for (const d of [0, 0.02, 0.05]) {
          const one = d > 0 && Math.abs(sN - sR) >= d;
          const views = one ? [sN >= sR ? 'normal' : 'rot180'] : ['normal', 'rot180'];
          const sub = aiFull0.filter((v) => views.includes(v.name)).map((v) => ({ name: v.name, byBottom: new Map([...v.byBottom].filter(([b]) => bk.includes(b))) }));
          m[`A${k}o${d}`] = { ...best2(fuse(ai.index.scoreAll(sub)), ex), p: 'f', img: bk.length * views.length };
        }
      }
    }
    r[ex ? 'loo' : 'cat'] = m;
  }
  if (MODES.includes('B')) {
    // B: colours on 9 framings, max per card; the AI looks at the framing where the colours' best card scores highest
    const fr = framings(q);
    const cols = [col0]; const crops = [c0];
    for (const f of fr.slice(1)) { const c = await cropPx(img, f); crops.push(c); cols.push(colourOf(c)); }
    const maxS = new Float32Array(N).fill(-Infinity); for (const c of cols) for (let i = 0; i < N; i++) if (c.scores[i] > maxS[i]) maxS[i] = c.scores[i];
    const aiCache = new Map([[0, aiFull0]]);
    for (const ex of [null, truthG]) {
      if (ex === null ? false : !truthG) continue;
      const top = topK(maxS, 1, ex); if (!top.length) continue;
      let bi = 0; let bs = -Infinity; cols.forEach((c, k) => { if (c.scores[top[0].i] > bs) { bs = c.scores[top[0].i]; bi = k; } });
      // the AI is needed only when the colours are not sure
      const topB = topK(maxS, K, ex);
      if (!sureOf(topB) && !aiCache.has(bi)) aiCache.set(bi, await embedFull(crops[bi]));
      r[ex ? 'loo' : 'cat'].B = { ...cascade(maxS, cols[bi].views, aiCache.get(bi) || aiFull0, ex), fr: bi };
    }
  }
  out.push({ src: sm.src, kind: sm.kind, photo: sm.photo, scene: sm.scene, rot: sm.rot, jitter: sm.jitter, truth: truthG, list: sm.list ? sm.list.map((id) => groupOfId.get(id) || id) : undefined, ...r });
}
out.push({ timing: { colourMs: colourMs / Math.max(1, colourN), embedFullMs: embedMs / Math.max(1, embedN), embedSingleMs: singleMs / Math.max(1, singleN), cropMs: cropMs / Math.max(1, cropN), extraEmbeds: embedN - samples.length } });
fs.writeFileSync(OUT, JSON.stringify(out));
if (!argv.includes('--shard')) console.log(`${out.length - 1} échantillons → ${OUT}`);
