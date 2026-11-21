/**
 * Detector bench (AMELIORATIONS-NATIF.md, step 1.2): the whole scan chain,
 * from the photo to the identified card, for several YOLO models / sizes.
 *
 *   npm run eval:detector -- [--models a.onnx,b.onnx,…] [--scenes 200] [--threads 1,4]
 *   npm run eval:detector -- --scenes 0      (real photos only, quick; no speed)
 *   npm run eval:detector -- --catalog model/cache/card-hashes-140.json   (AI at 140 px)
 *   … --ai-model <file> (model of that catalog), --report <file.json> (default model/eval-detector.json)
 *   … --dump <file.json>: every identification (truth, decision, score, margin, 5 best)
 *
 * Default models: the app's detector (public/models/…-dyn.onnx, dynamic
 * input) at 320 and 416 px; others with --models a.onnx[@size],…
 *
 * Photos (never mixed in one percentage):
 *   - simulated scenes (python model/make_detector_eval.py): exact corners
 *     and card of every card are known →
 *       detected  = cards found (mean corner error < 10 % of the card diagonal),
 *       false     = detections matching no card (per scene),
 *       corners   = mean corner error of the cards found, % of the diagonal,
 *       identified = cards found AND recognised (cascade colours → AI, Prudent,
 *                   accepted and right artwork), % of all cards;
 *       wrong      = cards found and accepted as ANOTHER card, % of all cards;
 *   - real photos (model/real-photos-raw/<card>/, one card per photo):
 *       found = the card is among the detections and recognised, % of photos;
 *   - real photos of grids (model/real-photos-raw/grilles/<name>.jpg, with
 *     <name>.txt: the printed code of every card of the photo, one per line,
 *     e.g. OGN-011 — a card present twice is written twice):
 *       detected   = detections / cards of the photos (capped per photo;
 *                    codes missing from the catalog count here only),
 *       identified = cards of the list recognised (each detection counts for
 *                    one card at most), % of all listed cards,
 *       extra      = detections beyond the number of cards, per photo.
 * Speed: ms per image (Node CPU, onnxruntime-node) with 1 and 4 threads, on
 * the first 20 scenes. Report: model/eval-detector.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ortModule from 'onnxruntime-node';
import { tuneOrt } from './lib/benchOrt.mjs';

// --ep dml / --threads N (lib/benchOrt.mjs); a mutable copy of the module namespace
const ort = { ...ortModule, InferenceSession: ortModule.InferenceSession };
tuneOrt(ort);
import { letterbox, rgbaToCHW, decodePose, nms, modelInputSize, unrotateDetection, fewCards, mergeOrientations } from '../src/lib/yoloCore.js';
import { warpQuadRGBA } from '../src/lib/perspectiveCrop.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const CONF = Number(get('conf', 0.6));    // yoloDetector.confidenceThreshold (--conf: to see the cards just below it)
const IOU = 0.45;    // yoloDetector.iouThreshold
const CROP_W = 480;  // crop size the matcher works on (cardMatcher CROP_W / CROP_H)
const CROP_H = 670;

// The app's detector: one model with a dynamic input, run at each scan mode's size.
// Other models: --models file.onnx[@size],… (@size for a dynamic-input model).
const APP_MODELS = ['public/models/yolo11s-pose-riftbound-dyn.onnx@320', 'public/models/yolo11s-pose-riftbound-dyn.onnx@416'];
const models = (get('models', '') ? get('models').split(',') : APP_MODELS).map(m => {
  const [file, size] = m.split('@');
  return { file: path.resolve(root, file), size: size ? Number(size) : null };
});
const threadsList = get('threads', '1,4').split(',').map(Number);

// ─── Card matcher of the app (cascade colours → AI), in Node ─────────────
// --catalog: another catalog (AI signatures made by another engine, build-embeddings --out)
const catalog = JSON.parse(fs.readFileSync(path.resolve(root, get('catalog', 'public/card-hashes.json')), 'utf8'));
globalThis.__BUILD_TIME__ = 'bench';
// (--test-features is gone: the app has one recognition chain since lot 1.4)
// --camera: the camera mode's rule (a card under 2 % of the picture is not accepted)
const CAMERA = argv.includes('--camera');
const { setScanSize, cameraAutoAccept } = await import('../src/lib/scanRules.js');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify(catalog), { status: 200 });
const { default: CardMatcher } = await import('../src/lib/cardMatcher.js');
const matcher = new CardMatcher();
matcher.benchSameThresholds = true; // every detector benched with the catalog's thresholds
await matcher.initialize();
globalThis.fetch = realFetch;
await matcher.startAI(async () => ({
  ort, executionProviders: ['cpu'],
  // --ai-model: the file of a bench catalog made with build-embeddings --model
  loadModel: async (file) => new Uint8Array(fs.readFileSync(get('ai-model', '') ? path.resolve(root, get('ai-model')) : path.join(root, 'public', 'models', file))),
}));
if (matcher.aiStatus().state !== 'ready') throw new Error(`IA indisponible : ${matcher.aiStatus().error}`);
const groupOf = new Map(catalog.cards.map(c => [c.id, c.artGroup || c.id]));
const sameArt = (a, b) => a && b && (a === b || groupOf.get(a) === groupOf.get(b));

// --shrink 0.01: the 4 corners moved towards the inside of the card, each edge
// by 1 % of the card width, before recognition (sleeves: the corners fall on
// the sleeve). --two-crops 0.01: the normal crop and the shrunk one, the
// better score kept; --dump keeps both crops' results (crops).
const SHRINK = Number(get('shrink', 0));
const TWO = Number(get('two-crops', 0));
function shrinkQuad(kps, s) {
  const P = kps.map(p => [p[0] ?? p.x, p[1] ?? p.y]);
  const side = (i, j) => Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]);
  const W = Math.min((side(0, 1) + side(2, 3)) / 2, (side(1, 2) + side(3, 0)) / 2);
  return P.map((p, i) => {
    let [x, y] = p;
    for (const j of [(i + 1) % 4, (i + 3) % 4]) { const d = side(i, j); x += (P[j][0] - p[0]) / d * s * W; y += (P[j][1] - p[1]) / d * s * W; }
    return [x, y];
  });
}
const cropSummary = r => r && { score: +r.score.toFixed(4), margin: +r.margin.toFixed(4), accepted: r.accepted, aiUsed: !!matcher.lastTiming?.aiUsed, top: r.top.slice(0, 5).map(t => [t.card.id, +t.score.toFixed(4)]) };
let lastCrops = null;
async function identify(rgba, w, h, kps) {
  lastCrops = null;
  if (NO_ID) { lastResult = null; return null; }
  if (!TWO) return identifyOne(rgba, w, h, SHRINK ? shrinkQuad(kps, SHRINK) : kps);
  await identifyOne(rgba, w, h, kps); const a = lastResult; const ca = cropSummary(a);
  await identifyOne(rgba, w, h, shrinkQuad(kps, TWO)); const b = lastResult; const cb = cropSummary(b);
  lastCrops = [ca, cb];
  lastResult = b && (!a || b.score > a.score) ? b : a;
  return lastResult?.accepted ? lastResult.card.id : null;
}
// --crop strips: the camera mode's former crop (before lot 1.4: 48
// horizontal strips, each an affine map — i.e. a bilinear map of the quad, in
// the model's corner order), turned to portrait like ensurePortrait; default:
// the true perspective warp (warpQuadRGBA) of the photo mode and the bench.
const CROP_MODE = get('crop', 'warp');
function stripCropRGBA(rgba, w, h, kps) {
  const [tl, tr, br, bl] = kps.map(p => [p[0] ?? p.x, p[1] ?? p.y]);
  const W = Math.max(1, Math.round((Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) + Math.hypot(br[0] - bl[0], br[1] - bl[1])) / 2));
  const H = Math.max(1, Math.round((Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) + Math.hypot(br[0] - tr[0], br[1] - tr[1])) / 2));
  const out = new Uint8ClampedArray(W * H * 4);
  const STRIPS = 48;
  for (let y = 0; y < H; y++) {
    // each strip uses the affine map of its top row (piecewise like the canvas version)
    const t = Math.floor((y + 0.5) / H * STRIPS) / STRIPS, t1 = t + 1 / STRIPS, f = ((y + 0.5) / H - t) / (t1 - t);
    const L0 = [tl[0] + (bl[0] - tl[0]) * t, tl[1] + (bl[1] - tl[1]) * t], R0 = [tr[0] + (br[0] - tr[0]) * t, tr[1] + (br[1] - tr[1]) * t];
    const L1 = [tl[0] + (bl[0] - tl[0]) * t1, tl[1] + (bl[1] - tl[1]) * t1];
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const sx = L0[0] + (R0[0] - L0[0]) * u + (L1[0] - L0[0]) * f, sy = L0[1] + (R0[1] - L0[1]) * u + (L1[1] - L0[1]) * f;
      const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5), fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
      for (let c = 0; c < 4; c++) {
        const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : rgba[(yy * w + xx) * 4 + c];
        out[(y * W + x) * 4 + c] = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
      }
    }
  }
  if (W <= H) return { data: out, w: W, h: H };
  const rot = new Uint8ClampedArray(W * H * 4); // ensurePortrait: 90° clockwise
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = H - 1 - y, ny = x; for (let c = 0; c < 4; c++) rot[(ny * H + nx) * 4 + c] = out[(y * W + x) * 4 + c]; }
  return { data: rot, w: H, h: W };
}
async function identifyOne(rgba, w, h, kps) {
  const crop = CROP_MODE === 'strips' || CROP_MODE === 'app' ? stripCropRGBA(rgba, w, h, kps) : warpQuadRGBA(rgba, w, h, kps);
  const portrait = crop.h >= crop.w;
  const { data, info } = await sharp(Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength), { raw: { width: crop.w, height: crop.h, channels: 4 } })
    .resize(portrait ? CROP_W : CROP_H, portrait ? CROP_H : CROP_W, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let r = await matcher.identifyPixels(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
  if (CAMERA) r = cameraAutoAccept(r, kps.map(p => [p[0] ?? p.x, p[1] ?? p.y]), w, h);
  lastResult = r;
  return r?.accepted ? r.card.id : null;
}

// --dump <file.json>: every identification (truth, decision, score, margin,
// 5 best artworks), to analyse the rejected cards (step 5, before 5.2).
const DUMP = get('dump', '');
let lastResult = null;
const dumped = [];
// --no-identify: detection only (with --dump: the corners of every card, for
// scripts/eval-recognition.mjs, which replays the recognition on them).
const NO_ID = argv.includes('--no-identify');
const k1 = kps => kps.map(p => [+(p[0] ?? p.x).toFixed(1), +(p[1] ?? p.y).toFixed(1)]);
function dump(model, kind, truth, extra = {}) {
  if (DUMP && NO_ID) { dumped.push({ model, kind, truth, ...extra }); return; }
  if (!DUMP || !lastResult) return;
  const r = lastResult;
  dumped.push({
    model, kind, truth, accepted: r.accepted, got: r.card?.id, score: +r.score.toFixed(4), margin: +r.margin.toFixed(4), engine: r.engine,
    top: r.top.slice(0, 5).map(t => [t.card.id, +t.score.toFixed(4)]), aiUsed: !!matcher.lastTiming?.aiUsed, ...(lastCrops ? { crops: lastCrops } : {}), ...extra,
  });
}

// ─── Photos ──────────────────────────────────────────────────────────────
// --rotate 90|180|270: real photos and grids turned (clockwise) after their EXIF
// orientation — cards lying sideways or upside down (detector retraining)
const ROTATE = Number(get('rotate', 0));
async function loadRGBA(file, turn = 0) {
  let img = sharp(file).rotate();
  if (turn) img = sharp(await img.toBuffer()).rotate(turn);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}

const sceneDir = path.join(root, 'model', 'detector-eval');
if (!fs.existsSync(path.join(sceneDir, 'scenes.json'))) throw new Error('Scènes absentes : python model/make_detector_eval.py');
const scenes = JSON.parse(fs.readFileSync(path.join(sceneDir, 'scenes.json'), 'utf8')).slice(0, Number(get('scenes', 200)));

const ids = new Set(catalog.cards.map(c => c.id));
// Folders named by printed code; the reprints missing from the catalog that
// share their artwork with a catalog card (see docs/RAPPORT-MODELES-IA.md;
// UNL-R02 / UNL-R05 are now manual additions, model/manual-cards/).
const ALIASES = { 'PAD-098': 'rad-098-167' };
function cardIdOf(folder) {
  if (ALIASES[folder.toUpperCase()]) return ALIASES[folder.toUpperCase()];
  const f = folder.trim().toLowerCase();
  if (ids.has(f)) return f;
  const hit = catalog.cards.filter(c => String(c.code || '').toUpperCase().split('/')[0] === folder.trim().toUpperCase());
  return hit.length === 1 ? hit[0].id : null;
}
// --real-dir model/real-photos-1115: another set of single-card photos (same layout)
const realDir = get('real-dir', '') ? path.resolve(root, get('real-dir')) : path.join(root, 'model', 'real-photos-raw');
const reals = [];
// Real out-of-catalog cards (other games, folders YGO-xx from the collect module): every
// accepted card is an error (« hors catalogue réel »).
const foreign = [];
if (fs.existsSync(realDir)) {
  for (const folder of fs.readdirSync(realDir)) {
    if (/^YGO-/i.test(folder)) {
      for (const f of fs.readdirSync(path.join(realDir, folder))) if (/\.(jpe?g|png|webp)$/i.test(f)) foreign.push({ code: folder, file: path.join(realDir, folder, f) });
      continue;
    }
    const id = cardIdOf(folder);
    if (!id) continue;
    for (const f of fs.readdirSync(path.join(realDir, folder))) if (/\.(jpe?g|png|webp)$/i.test(f)) reals.push({ id, file: path.join(realDir, folder, f) });
  }
}

// Grids: <name>.jpg + <name>.txt (printed codes, one per line)
// --grid-dir <dir>: other grid photos (same layout: <name>.jpg + <name>.txt), e.g. rotated copies
const gridDir = get('grid-dir', '') ? path.resolve(root, get('grid-dir', '')) : path.join(realDir, 'grilles');
const grids = [];
if (fs.existsSync(gridDir)) {
  for (const f of fs.readdirSync(gridDir).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const list = path.join(gridDir, f.replace(/\.[^.]+$/, '.txt'));
    if (!fs.existsSync(list)) { console.warn(`grille ${f} : ${path.basename(list)} absent, photo ignorée`); continue; }
    const codes = fs.readFileSync(list, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // A code missing from the catalog (token, new set): the card counts for
    // detection, it cannot be identified.
    const unknown = codes.filter(c => !cardIdOf(c));
    if (unknown.length) console.warn(`grille ${f} : hors catalogue ${unknown.join(', ')} (comptées pour la détection seulement)`);
    grids.push({ file: path.join(gridDir, f), ids: codes.map(cardIdOf).filter(Boolean), outside: unknown.length });
  }
}

// ─── One model ───────────────────────────────────────────────────────────
// --pad 0.1: grey margin (114, like the letterbox) of 10 % of the width / height
// on each side before detection — corners just outside the photo come back in
// the picture; detections are moved back to the photo's coordinates.
const PAD = Number(get('pad', 0));
async function detect(session, size, img) {
  if (!PAD) return detectRaw(session, size, img);
  const px = Math.round(PAD * img.w), py = Math.round(PAD * img.h);
  const { data, info } = await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.w, height: img.h, channels: 4 } })
    .extend({ top: py, bottom: py, left: px, right: px, background: { r: 114, g: 114, b: 114, alpha: 1 } })
    .raw().toBuffer({ resolveWithObject: true });
  const r = await detectRaw(session, size, { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height });
  for (const d of r.dets) {
    d.box = { ...d.box, cx: d.box.cx - px, cy: d.box.cy - py };
    d.keypoints = d.keypoints.map(([x, y]) => [x - px, y - py]);
  }
  return r;
}
async function detectRaw(session, size, img) {
  const lb = letterbox(img.w, img.h, size);
  const left = Math.floor(lb.padX);
  const top = Math.floor(lb.padY);
  const { data } = await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(lb.newW, lb.newH, { fit: 'fill' })
    .extend({ top, bottom: size - lb.newH - top, left, right: size - lb.newW - left, background: { r: 114, g: 114, b: 114, alpha: 1 } })
    .raw().toBuffer({ resolveWithObject: true });
  const t0 = performance.now();
  const out = await session.run({ images: new ort.Tensor('float32', rgbaToCHW(data, size), [1, 3, size, size]) });
  const ms = performance.now() - t0;
  const o = out.output0 || out[Object.keys(out)[0]];
  // pads as drawn (whole pixels)
  return { dets: nms(decodePose(o.data, o.dims[o.dims.length - 1], { ...lb, padX: left, padY: top }, CONF), IOU), ms };
}

// --orient retry|always (photo mode, real photos and grids): the 4
// orientations of the picture — « retry » only when the upright pass found
// few cards (yoloCore.fewCards), like the app; « always » for every photo.
const ORIENT = ['retry', 'always'].includes(get('orient', '')) ? get('orient', '') : '';
let orientRetries = 0;
// --refine 0.15: second pass — the picture cropped around each detected card
// with a 15 % margin, detected again at --refine-size (320) on that crop, the
// best detection's corners (back in the photo's coordinates) used for recognition.
const REFINE = Number(get('refine', 0));
const REFINE_SIZE = Number(get('refine-size', 320));
async function refineDets(session, img, dets) {
  const t0 = performance.now(); let ms = 0;
  const out = [];
  for (const d of dets) {
    const xs = d.keypoints.map(p => p[0]), ys = d.keypoints.map(p => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - REFINE * bw)), y0 = Math.max(0, Math.floor(Math.min(...ys) - REFINE * bh));
    const x1 = Math.min(img.w, Math.ceil(Math.max(...xs) + REFINE * bw)), y1 = Math.min(img.h, Math.ceil(Math.max(...ys) + REFINE * bh));
    if (x1 - x0 < 16 || y1 - y0 < 16) { out.push(d); continue; }
    const { data, info } = await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.w, height: img.h, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).raw().toBuffer({ resolveWithObject: true });
    const r = await detectRaw(session, REFINE_SIZE, { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height });
    ms += r.ms;
    // the detection closest to the first pass's card (a grid crop shows its neighbours too)
    const cx = xs.reduce((u, v) => u + v, 0) / 4 - x0, cy = ys.reduce((u, v) => u + v, 0) / 4 - y0;
    const dist = e => Math.hypot(e.box.cx - cx, e.box.cy - cy);
    const best = r.dets.reduce((b, e) => (!b || dist(e) < dist(b) ? e : b), null);
    out.push(best ? { ...best, box: { ...best.box, cx: best.box.cx + x0, cy: best.box.cy + y0 }, keypoints: best.keypoints.map(([x, y]) => [x + x0, y + y0]) } : d);
  }
  return { dets: out, ms, total: performance.now() - t0 };
}

async function detectOriented(session, size, img) {
  const first = await detect(session, size, img);
  // camera mode (320 px) never retries: only the photo mode (416 px)
  if (!ORIENT || size < 416 || (ORIENT === 'retry' && !fewCards(first.dets, img.w, img.h, Number(get('min-cover', 0.6))))) return { ...first, deg: 0 };
  const passes = [{ deg: 0, dets: first.dets }];
  for (const deg of [90, 180, 270]) {
    const { data, info } = await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.w, height: img.h, channels: 4 } })
      .rotate(deg).raw().toBuffer({ resolveWithObject: true });
    const r = await detect(session, size, { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height });
    passes.push({ deg, dets: r.dets.map(d => unrotateDetection(d, deg, img.w, img.h)) });
  }
  orientRetries++;
  return mergeOrientations(passes, 0.45, get('merge', 'switch'));
}

const diag = (c) => Math.hypot(c[0][0] - c[2][0], c[0][1] - c[2][1]) / 2 + Math.hypot(c[1][0] - c[3][0], c[1][1] - c[3][1]) / 2;
const cornerErr = (a, b) => a.reduce((s, p, k) => s + Math.hypot(p[0] - b[k][0], p[1] - b[k][1]), 0) / 4;

async function benchModel({ file, size: forcedSize }) {
  const session = await ort.InferenceSession.create(file, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
  const size = forcedSize || modelInputSize(session, file);
  setScanSize(size); // the catalog's thresholds per input size
  const res = { model: path.relative(root, file).replace(/\\/g, '/') + (forcedSize ? `@${forcedSize}` : ''), size, bytes: fs.statSync(file).size, sim: { byKind: {} }, real: {}, ms: {} };
  let gt = 0; let found = 0; let falseDet = 0; let err = 0; let idOk = 0; let idWrong = 0;
  const kinds = {};
  for (const sc of scenes) {
    const img = await loadRGBA(path.join(sceneDir, 'scenes', sc.file));
    let { dets } = await detectOriented(session, size, img);
    if (REFINE) dets = (await refineDets(session, img, dets)).dets;
    const used = new Set();
    const k = (kinds[sc.kind] ||= { gt: 0, found: 0, identified: 0 });
    for (const card of sc.cards) {
      gt++; k.gt++;
      let best = -1; let bestE = Infinity;
      dets.forEach((d, i) => { if (used.has(i)) return; const e = cornerErr(d.keypoints, card.corners); if (e < bestE) { bestE = e; best = i; } });
      const d0 = diag(card.corners);
      if (best < 0 || bestE > 0.1 * d0) continue;
      used.add(best);
      found++; k.found++;
      err += bestE / d0;
      const got = await identify(img.rgba, img.w, img.h, dets[best].keypoints);
      dump(res.model, 'sim', card.id, { scene: sc.kind, file: path.join(sceneDir, 'scenes', sc.file), kps: k1(dets[best].keypoints) });
      if (sameArt(got, card.id)) { idOk++; k.identified++; } else if (got) idWrong++; // accepted, wrong card
    }
    falseDet += dets.length - used.size;
  }
  // raw counts: shards of one bench (--shard k/n) are added up by eval-detector-par.mjs
  res.counts = { sim: { scenes: scenes.length, gt, found, falseDet, err, idOk, idWrong, kinds } };
  res.sim = {
    scenes: scenes.length, cards: gt, detected: found / gt, falsePerScene: falseDet / scenes.length,
    cornerErrorPct: found ? (100 * err) / found : null, identified: idOk / gt, wrong: idWrong / gt,
    byKind: Object.fromEntries(Object.entries(kinds).map(([kk, v]) => [kk, { cards: v.gt, detected: v.found / v.gt, identified: v.identified / v.gt }])),
  };
  let rOk = 0; let rDet = 0; let rWrong = 0;
  for (const r of reals) {
    const img = await loadRGBA(r.file, ROTATE);
    let { dets, ms } = await detectOriented(session, size, img);
    const r2 = REFINE ? await refineDets(session, img, dets) : null;
    if (r2) dets = r2.dets;
    if (dets.length) rDet++;
    let ok = false;
    let wrong = false;
    for (const d of dets) {
      const got = await identify(img.rgba, img.w, img.h, d.keypoints);
      dump(res.model, 'real', r.id, { file: r.file, rot: ROTATE, kpsF: k1(d.keypoints), photo: path.basename(r.file), ms1: ms != null ? +ms.toFixed(1) : undefined, ms2: r2 ? +r2.ms.toFixed(1) : undefined, msCrop: r2 ? +(r2.total - r2.ms).toFixed(1) : undefined, w: img.w, h: img.h, kps: d.keypoints.map(([x, y]) => [Math.round(x), Math.round(y)]) });
      if (sameArt(got, r.id)) ok = true;
      else if (got) wrong = true; // one card per photo: any other accepted card is an error
    }
    if (ok) rOk++;
    if (wrong) rWrong++;
  }
  res.counts.real = { photos: reals.length, rOk, rDet, rWrong };
  let fAcc = 0;
  for (const r of foreign) {
    const img = await loadRGBA(r.file, ROTATE);
    let { dets } = await detectOriented(session, size, img);
    if (REFINE) dets = (await refineDets(session, img, dets)).dets;
    let acc = false;
    for (const d of dets) {
      const got = await identify(img.rgba, img.w, img.h, d.keypoints);
      dump(res.model, 'foreign', null, { file: r.file, rot: ROTATE, kpsF: k1(d.keypoints), photo: path.basename(r.file), code: r.code });
      if (got) acc = true;
    }
    if (acc) fAcc++;
  }
  res.counts.foreign = { photos: foreign.length, accepted: fAcc };
  res.real = reals.length ? { photos: reals.length, detected: rDet / reals.length, identified: rOk / reals.length, wrong: rWrong / reals.length } : null;
  let gCards = 0; let gPresent = 0; let gDet = 0; let gOk = 0; let gExtra = 0;
  const perPhoto = [];
  for (const g of grids) {
    const img = await loadRGBA(g.file, ROTATE);
    let { dets } = await detectOriented(session, size, img);
    if (REFINE) dets = (await refineDets(session, img, dets)).dets;
    const present = g.ids.length + g.outside;
    gCards += g.ids.length;
    gDet += Math.min(dets.length, present);
    gPresent += present;
    gExtra += Math.max(0, dets.length - present);
    const left = [...g.ids];
    const notListed = [];
    for (const d of dets) {
      const got = await identify(img.rgba, img.w, img.h, d.keypoints);
      // grids: each detection, with its corners, to sort the losses (detection, corners, recognition)
      dump(res.model, 'grid', null, { file: g.file, rot: ROTATE, kpsF: k1(d.keypoints), photo: path.basename(g.file), list: g.ids, conf: d.score != null ? +d.score.toFixed(3) : undefined, kps: d.keypoints.map(p => [Math.round(p[0] ?? p.x), Math.round(p[1] ?? p.y)]) });
      const k = left.findIndex(id => sameArt(got, id));
      if (k >= 0) { left.splice(k, 1); gOk++; } else if (got) notListed.push(got);
    }
    // notListed: recognised cards that are not in the list (list to complete, or wrong card)
    perPhoto.push({ photo: path.basename(g.file), cards: g.ids.length, detections: dets.length, identified: g.ids.length - left.length, missed: left, notListed });
  }
  res.orientRetries = orientRetries; orientRetries = 0;
  res.counts.grids = { photos: grids.length, gCards, gPresent, gDet, gOk, gExtra, perPhoto };
  res.grids = grids.length ? { photos: grids.length, cards: gCards, detected: gDet / gPresent, identified: gOk / gCards, extraPerPhoto: gExtra / grids.length, perPhoto } : null;
  for (const t of scenes.length && !SHARD ? threadsList : []) {
    const s = await ort.InferenceSession.create(file, { executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: t });
    const sample = scenes.slice(0, 20);
    let ms = 0;
    await detect(s, size, await loadRGBA(path.join(sceneDir, 'scenes', sample[0].file)));
    for (const sc of sample) ms += (await detect(s, size, await loadRGBA(path.join(sceneDir, 'scenes', sc.file)))).ms;
    res.ms[t] = +(ms / sample.length).toFixed(1);
  }
  return res;
}

// --shard k/n: only the k-th of n parts of the scenes, real photos and grids
// (scripts/eval-detector-par.mjs runs the n parts side by side, then adds them up)
const SHARD = get('shard', '');
if (SHARD) {
  const [k, n] = SHARD.split('/').map(Number);
  const keep = (a) => a.filter((_, i) => i % n === k);
  for (const a of [scenes, reals, grids]) a.splice(0, a.length, ...keep(a));
}

const pct = (x) => (x == null ? '   —  ' : `${(100 * x).toFixed(1).padStart(5)} %`);
const report = { date: new Date().toISOString().slice(0, 10), confidence: CONF, models: [] };
console.log(`${scenes.length} scènes simulées, ${reals.length} photos réelles, ${grids.length} photos de grilles, ${models.length} modèles\n`);
for (const m of models) {
  const t0 = Date.now();
  const r = await benchModel(m);
  report.models.push(r);
  console.log(`${r.model} (${r.size} px) : ${Math.round((Date.now() - t0) / 1000)} s`);
}
fs.writeFileSync(path.resolve(root, get('report', 'model/eval-detector.json')), JSON.stringify(report, null, 2));
if (DUMP) fs.writeFileSync(path.resolve(root, DUMP), JSON.stringify(dumped));

if (scenes.length) {
  console.log(`\nScènes SIMULÉES (${scenes.length} scènes, ${report.models[0]?.sim.cards} cartes)`);
  console.log('modèle                                         taille  détectées  fausses/scène  coins   identifiées  FAUSSES   (grilles / gros plans / scènes)');
  for (const r of report.models) {
    const k = r.sim.byKind;
    console.log(`${r.model.slice(-46).padEnd(46)} ${String(r.size).padStart(5)}  ${pct(r.sim.detected)}  ${r.sim.falsePerScene.toFixed(2).padStart(8)}     ${r.sim.cornerErrorPct?.toFixed(2).padStart(5)} %  ${pct(r.sim.identified)}  ${pct(r.sim.wrong)}   (${pct(k.grid?.identified)} / ${pct(k.closeup?.identified)} / ${pct(k.scene?.identified)})`);
  }
}
if (reals.length) {
  console.log(`\nPhotos RÉELLES (${reals.length})`);
  console.log('modèle                                         taille  carte détectée  identifiée  FAUSSE');
  for (const r of report.models) console.log(`${r.model.slice(-46).padEnd(46)} ${String(r.size).padStart(5)}  ${pct(r.real.detected)}       ${pct(r.real.identified)}   ${pct(r.real.wrong)}`);
}
if (grids.length) {
  console.log(`\nPhotos RÉELLES de GRILLES (${grids.length} photos, ${report.models[0]?.grids.cards} cartes)`);
  console.log('modèle                                         taille  détectées  identifiées  en trop/photo');
  for (const r of report.models) console.log(`${r.model.slice(-46).padEnd(46)} ${String(r.size).padStart(5)}  ${pct(r.grids.detected)}  ${pct(r.grids.identified)}     ${r.grids.extraPerPhoto.toFixed(2)}`);
}
if (scenes.length) console.log('\nVitesse YOLO seule (Node CPU, ms par image)');
if (scenes.length) for (const r of report.models) console.log(`${r.model.slice(-46).padEnd(46)} ${String(r.size).padStart(5)}  ${threadsList.map(t => `${t} fil${t > 1 ? 's' : ''} : ${r.ms[t]} ms`).join('   ')}  ${(r.bytes / 1e6).toFixed(1)} Mo`);
console.log(`\nRapport : ${get('report', 'model/eval-detector.json')}`);
