// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Recognition engines: common interface, generic index (any vector size). */
import { test } from 'node:test';
import { sameDetector } from '../src/lib/scanRules.js';
import assert from 'node:assert/strict';
import { NO_LFS } from './helpers.mjs';

const { MatchIndex } = await import('../src/lib/matchIndex.js');
const { grid16 } = await import('../src/lib/engines/grid16.js');
const { resizeToCHW, regionRect, createOnnxEngine, ENGINE_CONFIGS } = await import('../src/lib/engines/onnxEngine.js');
const { queryViews } = await import('../src/lib/fingerprint.js');

const { DETECTOR } = await import('../src/lib/scanRules.js');

test('generic index: vectors of any size are centred, normalised and compared', () => {
  const rnd = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const r = rnd(7);
  const cards = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, f: Float32Array.from({ length: 384 }, () => r() - 0.5), artBottom: 1 }));
  const idx = new MatchIndex(cards, { generic: true });
  assert.equal(idx.grid, null);
  assert.equal(idx.dim, 384);
  const q = [{ name: 'normal', byBottom: new Map([[1, cards[17].f]]) }];
  const top = idx.rank(q);
  assert.equal(top[0].id, 'c17');
  assert.ok(Math.abs(top[0].score - 1) < 1e-5);
  const all = idx.scoreAll(q);
  assert.equal(all.length, 50);
  assert.ok(Math.abs(all[17] - top[0].score) < 1e-6);
  // a 768-value fingerprint is still treated as a 16 × 16 grid
  const g = new MatchIndex([{ id: 'a', f: new Float32Array(768).fill(0.5), artBottom: 0.55 }]);
  assert.equal(g.grid, 16);
});

test('grid16 engine = the fingerprint, unchanged', async () => {
  const w = 40; const h = 56;
  const rgba = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256);
  const a = await grid16.embed(rgba, w, h, { bottoms: [0.55, 0.95] });
  const b = queryViews(rgba, w, h, [0.55, 0.95], 16);
  assert.deepEqual(a.map(v => v.name), b.map(v => v.name));
  assert.deepEqual([...a[0].byBottom.get(0.55)], [...b[0].byBottom.get(0.55)]);
});

test('model pre-processing: whole crop resized (no centre crop), planar RGB 0–1', () => {
  const w = 4; const h = 4;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = 255; rgba[i * 4 + 3] = 255; } // pure red
  const chw = resizeToCHW(rgba, w, h, regionRect(w, h, 'full'), 2, 3);
  assert.equal(chw.length, 3 * 2 * 3);
  assert.ok(chw.slice(0, 6).every(v => Math.abs(v - 1) < 1e-6)); // R plane
  assert.ok(chw.slice(6).every(v => v === 0)); // G and B planes
  assert.deepEqual(regionRect(100, 140, 'art', 0.55), { x0: 5, y0: 7, x1: 95, y1: 77 });
  assert.ok(ENGINE_CONFIGS.dinov2s && ENGINE_CONFIGS.mnv4s && ENGINE_CONFIGS.siglip2b);
  assert.throws(() => createOnnxEngine('inconnu'));
});

// ─── Step 4: the AI engine in the app ────────────────────────────────────
const { encodeEmbedding, decodeEmbedding } = await import('../src/lib/engines/index.js');
const { readCatalogEmbeddings, sha256Hex, aiKey } = await import('../src/lib/aiRecognizer.js');
const { readFileSync } = await import('node:fs');
const sharpMod = (await import('sharp')).default;
const appCatalog = JSON.parse(readFileSync(new URL('../public/card-hashes.json', import.meta.url), 'utf8'));
const modelPath = new URL('../public/models/dinov2s-ft-fp16.onnx', import.meta.url);

test('AI vectors: int8 + scale keeps the direction (cosine ≥ 0.9999)', () => {
  const v = Float32Array.from({ length: 384 }, (_, i) => Math.sin(i * 1.7) * (1 + (i % 7)));
  const d = decodeEmbedding(encodeEmbedding(v));
  let dot = 0; let a = 0; let b = 0;
  for (let i = 0; i < v.length; i++) { dot += v[i] * d[i]; a += v[i] * v[i]; b += d[i] * d[i]; }
  assert.equal(d.length, 384);
  assert.ok(dot / Math.sqrt(a * b) >= 0.9999);
});

test('catalog: AI signatures for every card, made by the model shipped with the app', { skip: NO_LFS }, async () => {
  const h = appCatalog.embeddings;
  assert.ok(h, 'en-tête embeddings');
  // DINOv2 fine-tuned on the cards, fp16; thresholds calibrated on 4 224 simulated photos (model/MODELS.md)
  assert.equal(h.engine, 'dinov2s-ft-fp16-mean-168');
  assert.equal(h.model, 'dinov2s-ft-fp16.onnx');
  assert.equal(await sha256Hex(new Uint8Array(readFileSync(modelPath))), h.modelSha256);
  // Variant A thresholds per detector input size, for the shipped detector (lot 1.4)
  assert.deepEqual(h.decision, { 320: { abs: 0.457, margin: 0.15 }, 416: { abs: 0.467, margin: 0.115 } });
  assert.equal(h.cascade, undefined, 'one chain: no cascade over K cards any more');
  assert.equal(h.detector, 'yolo11s-pose-riftbound-dyn.onnx');
  assert.ok(sameDetector(h.detectorSha256), 'thresholds made for the shipped detector (same weights)');
  assert.equal(await sha256Hex(new Uint8Array(readFileSync(new URL('../public/models/yolo11s-pose-riftbound-dyn.onnx', import.meta.url)))), DETECTOR.sha256);
  assert.ok(h.alpha > 0 && h.alpha < 1);
  const vecs = readCatalogEmbeddings(h, appCatalog.cards);
  assert.equal(vecs.length, appCatalog.cards.length);
  // A card without signature → refused (no half AI)
  assert.throws(() => readCatalogEmbeddings(h, [{ id: 'x' }]), /incomplètes/);
  assert.throws(() => readCatalogEmbeddings(null, []), /pas de signatures/);
});

async function cardPixels(id) {
  const { data, info } = await sharpMod(new URL(`../public/cards/${id}.webp`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: data, w: info.width, h: info.height };
}

async function newMatcher() {
  globalThis.__BUILD_TIME__ = 'test';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(appCatalog), { status: 200 });
  try {
    const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
    const m = new CardMatcher();
    await m.initialize();
    return m;
  } finally {
    globalThis.fetch = realFetch;
  }
}

const nodeIO = (bytes) => async () => ({
  ort: await import('onnxruntime-node'),
  executionProviders: ['cpu'],
  loadModel: async () => bytes,
});

test('CardMatcher with the AI: fused score, thresholds of the header, AI vector learned', { skip: NO_LFS }, async () => {
  const m = await newMatcher();
  const states = [];
  m.onAIChange(s => states.push(s.state));
  await m.startAI(nodeIO(new Uint8Array(readFileSync(modelPath))));
  assert.equal(m.aiStatus().state, 'ready');
  assert.ok(states.includes('loading') && states.at(-1) === 'ready');
  const { rgba, w, h } = await cardPixels('ogn-001-298');
  const r = await m.identifyPixels(rgba, w, h);
  assert.equal(r.engine, 'ai');
  assert.equal(r.card.id, 'ogn-001-298');
  assert.equal(r.accepted, true);
  // Clean image: the colours are sure, the AI is not even run (cascade)
  assert.equal(m.lastTiming.aiUsed, false);
  const f = await m.identifyPixels(rgba, w, h, { forceAI: true });
  assert.equal(m.lastTiming.aiUsed, true);
  assert.ok(m.lastTiming.aiMs > 0);
  assert.equal(f.card.id, 'ogn-001-298');
  assert.equal(f.accepted, true);
  const e = f.learnSampleAI('ogn-001-298');
  const key = aiKey(appCatalog.embeddings);
  assert.equal(typeof e[key], 'string');
  // A learned example keeps both engines aligned
  m.setLearned([{ id: 'l1', cardId: 'ogn-001-298', f: r.learnSample('ogn-042-298') || appCatalog.cards[0].f, e }]);
  assert.equal(m.ai.index.n, m.index.n);
  // Back to the colours alone
  m.stopAI();
  const g = await m.identifyPixels(rgba, w, h);
  assert.equal(g.engine, 'grid16');
});

test('catalog made for another model (int8 signatures) with the shipped model → refused, banner shown', { skip: NO_LFS }, async () => {
  const { shouldShowAIBanner } = await import('../src/components/scan/aiBanner.js');
  globalThis.__BUILD_TIME__ = 'test';
  const old = { ...appCatalog, embeddings: { ...appCatalog.embeddings, engine: 'dinov2s-int8-mean-168', model: 'dinov2s-int8.onnx', modelSha256: 'dfce54a839b491f395c516350ebb4a78f947e9170a6beac0f2bc5638e0f09d61' } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(old), { status: 200 });
  const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
  const m = new CardMatcher();
  try { await m.initialize(); } finally { globalThis.fetch = realFetch; }
  await m.startAI(nodeIO(new Uint8Array(readFileSync(modelPath))));
  assert.equal(m.aiStatus().state, 'error');
  assert.match(m.aiStatus().error, /ne correspond pas/);
  assert.equal(shouldShowAIBanner({ recognition: 'ai' }, m.aiStatus()), true);
  assert.equal(shouldShowAIBanner({ recognition: 'grid16' }, m.aiStatus()), false, 'colours chosen: no banner');
  assert.equal(shouldShowAIBanner({ recognition: 'ai' }, { state: 'ready' }), false);
  const { rgba, w, h } = await cardPixels('ogn-001-298');
  assert.equal((await m.identifyPixels(rgba, w, h)).engine, 'grid16');
});

test('AI model different from the catalog signatures → refused, colours used (state error)', { skip: NO_LFS }, async () => {
  const m = await newMatcher();
  const bytes = new Uint8Array(readFileSync(modelPath));
  bytes[bytes.length - 1] ^= 1;
  await m.startAI(nodeIO(bytes));
  assert.equal(m.aiStatus().state, 'error');
  assert.match(m.aiStatus().error, /ne correspond pas/);
  const { rgba, w, h } = await cardPixels('ogn-001-298');
  const r = await m.identifyPixels(rgba, w, h);
  assert.equal(r.engine, 'grid16');
});
