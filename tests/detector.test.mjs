// @needs-card-content (scripts/run-tests.mjs: set aside without the card pictures and catalog)
/* Detector: one model, explicit error state, never a fake « simulation ». */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_LFS } from './helpers.mjs';

const fakeSession = { inputNames: ['images'], outputNames: ['out'], run: async () => ({}) };
const fakeOrt = { InferenceSession: {}, Tensor: class { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } } };
const { default: YOLODetector } = await import('../src/lib/yoloDetector.js');
const make = () => { const d = new YOLODetector(); d._loadOrt = async () => fakeOrt; return d; };

test('model that cannot load → ERROR state, no detection at all', async () => {
  const d = make();
  d._createSession = async () => { throw new Error('modèle corrompu'); };
  await assert.rejects(d.initialize());
  assert.equal(d.state, 'error');
  assert.match(d.error, /corrompu/);
  assert.deepEqual(await d.detect({ width: 10, height: 10 }), []);
});

test('one model (dynamic input) for both scan modes: camera 320 px, photo 416 px, warmed up at each size', async () => {
  const d = make();
  const loaded = [];
  const runs = [];
  d._createSession = async (url) => {
    loaded.push(url);
    return { ...fakeSession, run: async (feeds) => { runs.push(feeds.images.dims[2]); return {}; } };
  };
  await d.initialize();
  assert.equal(d.state, 'ready');
  assert.deepEqual(loaded, ['/models/yolo11s-pose-riftbound-dyn.onnx']);
  assert.equal(d.models.camera.inputSize, 320);
  assert.equal(d.models.photo.inputSize, 416);
  assert.equal(d.models.camera.session, d.models.photo.session);
  assert.deepEqual(runs.sort(), [320, 416]);
});

test('engine: no WebGPU build without a graphics card (plain WASM)', async () => {
  const asked = [];
  const d = make();
  d._loadOrt = async (gpu) => { asked.push(gpu); return fakeOrt; };
  d._createSession = async () => fakeSession;
  await d.initialize();
  assert.deepEqual(asked, [false]);
});

// ─── Any input size (AMELIORATIONS-NATIF.md 1.1): yoloCore ───────────────
const core = await import('../src/lib/yoloCore.js');

test('input size: read from the model, else from the file name, else 768', () => {
  assert.equal(core.modelInputSize({ inputMetadata: [{ shape: [1, 3, 416, 416] }] }, '/models/x.onnx'), 416);
  assert.equal(core.modelInputSize({}, '/models/yolo11s-pose-rb416-320-q8.onnx'), 320);
  assert.equal(core.modelInputSize(null, '/models/yolo11s-pose-riftbound.onnx'), 768);
});

test('letterbox + decoding map corners back to the photo at 320 / 416 / 768', () => {
  for (const size of [320, 416, 768]) {
    const W = 1280; const H = 720;
    const lb = core.letterbox(W, H, size);
    assert.equal(lb.newW, size);
    assert.ok(Math.abs(lb.padY - (size - Math.round(H * size / W)) / 2) < 1e-9);
    // one detection: a card whose corners are known in the photo
    const corners = [[400, 100], [700, 120], [690, 600], [390, 580]];
    const toModel = ([x, y]) => [x * lb.scale + lb.padX, y * lb.scale + lb.padY];
    const n = 3;
    const data = new Float32Array(13 * n);
    const put = (ch, v) => { data[ch * n + 1] = v; };
    const [cx, cy] = toModel([545, 350]);
    put(0, cx); put(1, cy); put(2, 310 * lb.scale); put(3, 500 * lb.scale); put(4, 0.9);
    corners.forEach((c, k) => { const [x, y] = toModel(c); put(5 + 2 * k, x); put(6 + 2 * k, y); });
    data[4 * n] = 0.3; // a weak detection, dropped
    const dets = core.decodePose(data, n, lb, 0.6);
    assert.equal(dets.length, 1);
    dets[0].keypoints.forEach((p, k) => {
      assert.ok(Math.hypot(p[0] - corners[k][0], p[1] - corners[k][1]) < 1e-3, `${size}: coin ${k}`);
    });
    assert.ok(Math.abs(dets[0].box.cx - 545) < 1e-3 && Math.abs(dets[0].box.w - 310) < 1e-3);
  }
});

test('NMS keeps the most confident of overlapping detections', () => {
  const d = (cx, conf) => ({ box: { cx, cy: 50, w: 40, h: 60 }, confidence: conf });
  const kept = core.nms([d(50, 0.7), d(52, 0.9), d(200, 0.8)], 0.45);
  assert.deepEqual(kept.map(k => k.confidence), [0.9, 0.8]);
});

test('shipped model (float32, dynamic input) at 320 and 416: the corners of a card placed on a photo are found', { skip: NO_LFS }, async () => {
  const sharp = (await import('sharp')).default;
  const ort = await import('onnxruntime-node');
  const { fileURLToPath } = await import('node:url');
  const file = (p) => fileURLToPath(new URL(p, import.meta.url));
  const W = 1200; const H = 900; const x0 = 420; const y0 = 150; const cw = 372; const ch = 520;
  const card = await sharp(file('../public/cards/ogn-001-298.webp')).resize(cw, ch, { fit: 'fill' }).png().toBuffer();
  const { data } = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 60, g: 70, b: 60, alpha: 1 } } })
    .composite([{ input: card, left: x0, top: y0 }]).raw().toBuffer({ resolveWithObject: true });
  for (const expected of [320, 416]) {
    const session = await ort.InferenceSession.create(file('../public/models/yolo11s-pose-riftbound-dyn.onnx'));
    const size = expected;
    const lb = core.letterbox(W, H, size);
    const top = Math.floor(lb.padY);
    const { data: boxed } = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
      .resize(lb.newW, lb.newH, { fit: 'fill' })
      .extend({ top, bottom: size - lb.newH - top, left: 0, right: size - lb.newW, background: { r: 114, g: 114, b: 114, alpha: 1 } })
      .raw().toBuffer({ resolveWithObject: true });
    const out = await session.run({ images: new ort.Tensor('float32', core.rgbaToCHW(boxed, size), [1, 3, size, size]) });
    const o = out.output0;
    const dets = core.nms(core.decodePose(o.data, o.dims[2], { ...lb, padX: 0, padY: top }, 0.6));
    assert.equal(dets.length, 1);
    const want = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]];
    const diag = Math.hypot(cw, ch);
    dets[0].keypoints.forEach((p, k) => {
      const e = Math.hypot(p[0] - want[k][0], p[1] - want[k][1]) / diag;
      assert.ok(e < 0.03, `${size} px, coin ${k} : écart ${(100 * e).toFixed(1)} % de la diagonale`);
    });
  }
});

test('turned picture: corners put back in the original photo keep the card\'s own TL, TR, BR, BL', async () => {
  const { unrotatePoint, unrotateDetection } = await import('../src/lib/yoloCore.js');
  const W = 400; const H = 300;
  // where a point (x, y) of the original lands once the picture is turned clockwise
  const turn = ([x, y], deg) => (deg === 90 ? [H - y, x] : deg === 180 ? [W - x, H - y] : deg === 270 ? [y, W - x] : [x, y]);
  for (const deg of [0, 90, 180, 270]) {
    for (const p of [[0, 0], [10, 20], [399, 1], [123, 299]]) assert.deepEqual(unrotatePoint(turn(p, deg), deg, W, H), p, `${deg}° ${p}`);
  }
  // a card lying sideways, top towards the right of the photo: upright once the photo is turned by 270°
  const card = [[300, 50], [300, 250], [100, 250], [100, 50]]; // its TL, TR, BR, BL in the photo
  const seen = { box: { cx: 150, cy: 200, w: 200, h: 200 }, confidence: 0.9, keypoints: card.map(p => turn(p, 270)) };
  const back = unrotateDetection(seen, 270, W, H);
  assert.deepEqual(back.keypoints, card);
  assert.equal(back.orientation, 270);
});

test('4 orientations: switch only when a turned picture finds clearly more cards; « best » mode merges', async () => {
  const { mergeOrientations, fewCards } = await import('../src/lib/yoloCore.js');
  const det = (cx, conf) => ({ box: { cx, cy: 50, w: 40, h: 60 }, confidence: conf });
  const r = mergeOrientations([
    { deg: 0, dets: [det(50, 0.7)] },
    { deg: 270, dets: [det(52, 0.9), det(150, 0.8)] },
    { deg: 90, dets: [det(250, 0.65)] },
    { deg: 180, dets: [] },
  ], 0.45, 'best');
  assert.equal(r.deg, 270);
  assert.deepEqual(r.dets.map(d => d.box.cx), [52, 150, 250]); // card at 50 = card at 52 (same card)
  // a frame spanning two found cards (IoU small with each) is not added
  const two = mergeOrientations([{ deg: 0, dets: [det(50, 0.9), det(100, 0.9)] }, { deg: 90, dets: [{ box: { cx: 75, cy: 50, w: 100, h: 70 }, confidence: 0.95 }] }], 0.45, 'best');
  assert.equal(two.dets.length, 2);
  // the app's rule: the upright cards unless a turned picture finds clearly more (≥ 2 more, ≥ 1.5 ×)
  const four = [det(10, 0.9), det(60, 0.9), det(110, 0.9), det(160, 0.9)];
  assert.equal(mergeOrientations([{ deg: 0, dets: four.slice(0, 2) }, { deg: 90, dets: four }]).deg, 90);
  assert.equal(mergeOrientations([{ deg: 0, dets: four.slice(0, 3) }, { deg: 90, dets: four }]).deg, 0, 'one more is not clearly more');
  assert.equal(mergeOrientations([{ deg: 0, dets: [] }, { deg: 270, dets: four.slice(0, 1) }]).deg, 270);
  assert.equal(fewCards([], 100, 100), true);
  assert.equal(fewCards([det(50, 0.9)], 100, 100), true, '1 card of 24 % of the picture');
  assert.equal(fewCards([{ box: { w: 70, h: 90 } }], 100, 100), false);
});
