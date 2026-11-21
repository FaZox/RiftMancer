/**
 * Engines backed by an image model in ONNX (DINOv2, MobileNetV4, SigLIP 2…).
 *
 * Pre-processing (AMELIORATIONS-MODELES.md 2.1): the whole crop is resized to
 * the model input (no « center crop »: it would cut the name, costs, Might),
 * then normalised with the model's own mean / std.
 * Output: the CLS token (or pooled output) or the mean of the patch tokens.
 */
import { ART_TOP, ART_LEFT, ART_RIGHT } from '../fingerprint.js';
import { flipH, rotate180 } from '../fingerprint.js';

const IMAGENET = { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] };
const HALF = { mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] };

/**
 * Engine settings. `file`: path of the model, relative to the models folder
 * (model/embedders in the bench, public/models in the app).
 * `pooling`: 'cls' (token 0 / pooler output) | 'mean' (mean of the patch tokens) | 'out' (output as is).
 * `skipTokens`: tokens before the patches (CLS, + 4 registers for « with registers »).
 * DINOv2 (onnx-community): input `pixel_values` [batch, 3, h, w] (h, w multiples
 * of 14, dynamic), output `last_hidden_state` [batch, 1 + patches, 384] already
 * layer-normed — its token 0 is the « pooler output ».
 */
export const ENGINE_CONFIGS = {
  dinov2s: { file: 'dinov2s/model.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'cls', skipTokens: 1 },
  'dinov2s-mean': { file: 'dinov2s/model.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-int8': { file: 'dinov2s/model_int8.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'cls', skipTokens: 1 },
  // The engine of the app until 2026-11-14 (public/models/dinov2s-int8.onnx)
  'dinov2s-int8-mean': { file: 'dinov2s/model_int8.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  // Smaller inputs (step 4.6, speed): fewer patches (112 px = 8 × 8, 140 = 10 × 10, 168 = 12 × 12)
  'dinov2s-int8-mean-112': { file: 'dinov2s/model_int8.onnx', width: 112, height: 112, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-int8-mean-140': { file: 'dinov2s/model_int8.onnx', width: 140, height: 140, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-int8-mean-168': { file: 'dinov2s/model_int8.onnx', width: 168, height: 168, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  // float32 / float16 at the app's image size; the app's engine is dinov2s-fp16-mean-168
  // (public/models/dinov2s-fp16.onnx, model/MODELS.md)
  'dinov2s-mean-168': { file: 'dinov2s/model.onnx', width: 168, height: 168, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-fp16-mean-168': { file: 'dinov2s/model_fp16.onnx', width: 168, height: 168, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  // The app's engine since 2026-11-14: DINOv2-small fine-tuned on the cards (model/train_embedder.py,
  // step 3), same format — public/models/dinov2s-ft-fp16.onnx
  'dinov2s-ft-fp16-mean-168': { file: 'dinov2s-ft/model_fp16.onnx', width: 168, height: 168, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-fp16': { file: 'dinov2s/model_fp16.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'cls', skipTokens: 1 },
  'dinov2s-tall': { file: 'dinov2s/model.onnx', width: 224, height: 308, ...IMAGENET, pooling: 'cls', skipTokens: 1 },
  'dinov2s-tall-mean': { file: 'dinov2s/model.onnx', width: 224, height: 308, ...IMAGENET, pooling: 'mean', skipTokens: 1 },
  'dinov2s-reg': { file: 'dinov2s-reg/model.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'cls', skipTokens: 5 },
  'dinov2s-reg-mean': { file: 'dinov2s-reg/model.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'mean', skipTokens: 5 },
  'dinov2s-reg-int8': { file: 'dinov2s-reg/model_int8.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'cls', skipTokens: 5 },
  mnv4s: { file: 'mnv4s/model.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'out' },
  'mnv4s-int8': { file: 'mnv4s/model_int8.onnx', width: 224, height: 224, ...IMAGENET, pooling: 'out' },
  siglip2b: { file: 'siglip2b/model.onnx', width: 224, height: 224, ...HALF, pooling: 'out' },
  'siglip2b-int8': { file: 'siglip2b/model_int8.onnx', width: 224, height: 224, ...HALF, pooling: 'out' },
};

/** Bilinear resize of a region of an RGBA image to w2 × h2, as planar CHW floats (0–1). */
export function resizeToCHW(rgba, w, h, region, w2, h2) {
  const { x0, y0, x1, y1 } = region;
  const out = new Float32Array(3 * w2 * h2);
  const plane = w2 * h2;
  for (let y = 0; y < h2; y++) {
    const sy = Math.min(h - 1, Math.max(0, y0 + ((y + 0.5) * (y1 - y0)) / h2 - 0.5));
    const ya = Math.floor(sy);
    const yb = Math.min(h - 1, ya + 1);
    const fy = sy - ya;
    for (let x = 0; x < w2; x++) {
      const sx = Math.min(w - 1, Math.max(0, x0 + ((x + 0.5) * (x1 - x0)) / w2 - 0.5));
      const xa = Math.floor(sx);
      const xb = Math.min(w - 1, xa + 1);
      const fx = sx - xa;
      const i00 = (ya * w + xa) * 4;
      const i01 = (ya * w + xb) * 4;
      const i10 = (yb * w + xa) * 4;
      const i11 = (yb * w + xb) * 4;
      for (let c = 0; c < 3; c++) {
        const top = rgba[i00 + c] * (1 - fx) + rgba[i01 + c] * fx;
        const bot = rgba[i10 + c] * (1 - fx) + rgba[i11 + c] * fx;
        out[c * plane + y * w2 + x] = (top * (1 - fy) + bot * fy) / 255;
      }
    }
  }
  return out;
}

/** Pixel rectangle of a region: 'full' (whole card) or the illustration up to `bottom`. */
export function regionRect(w, h, region, bottom) {
  if (region === 'full') return { x0: 0, y0: 0, x1: w, y1: h };
  return { x0: Math.round(w * ART_LEFT), y0: Math.round(h * ART_TOP), x1: Math.round(w * ART_RIGHT), y1: Math.round(h * bottom) };
}

/**
 * @param {string} id  key of ENGINE_CONFIGS
 * @param {object} cfg settings (defaults to ENGINE_CONFIGS[id])
 */
export function createOnnxEngine(id, cfg = ENGINE_CONFIGS[id]) {
  if (!cfg) throw new Error(`Moteur inconnu : ${id}`);
  let session = null;
  let ort = null;
  let inputName = null;
  // One run at a time (a session cannot run twice at once in the browser):
  // the camera never piles up embeddings, photos wait their turn.
  let queue = Promise.resolve();
  const engine = {
    id,
    dim: 0,
    regions: ['art', 'full'],
    size: 0,
    /** @param {{ ort, model: string|Uint8Array, executionProviders?: string[] }} opts */
    async init({ ort: ortModule, model, executionProviders = ['cpu'] }) {
      ort = ortModule;
      session = await ort.InferenceSession.create(model, { executionProviders, graphOptimizationLevel: 'all' });
      inputName = session.inputNames.find(n => /pixel|image|input/i.test(n)) || session.inputNames[0];
      engine.size = typeof model === 'string' ? 0 : model.byteLength;
      // dimension from a first run
      const v = await engine._run([new Float32Array(3 * cfg.width * cfg.height)]);
      engine.dim = v[0].length;
    },
    /** Runs the model on a batch of CHW float images (0–1) → vectors. */
    async _run(images) {
      const plane = cfg.width * cfg.height;
      const batch = new Float32Array(images.length * 3 * plane);
      images.forEach((img, b) => {
        for (let c = 0; c < 3; c++) {
          const m = cfg.mean[c];
          const s = cfg.std[c];
          const off = (b * 3 + c) * plane;
          for (let i = 0; i < plane; i++) batch[off + i] = (img[c * plane + i] - m) / s;
        }
      });
      const feeds = { [inputName]: new ort.Tensor('float32', batch, [images.length, 3, cfg.height, cfg.width]) };
      const run = queue.then(() => session.run(feeds));
      queue = run.catch(() => {});
      const out = await run;
      return pickVectors(out, session.outputNames, cfg.pooling, images.length, cfg.skipTokens ?? 1);
    },
    async embedCatalog(rgba, w, h, { region, bottom }) {
      const img = resizeToCHW(rgba, w, h, regionRect(w, h, region, bottom), cfg.width, cfg.height);
      return (await engine._run([img]))[0];
    },
    async embed(rgba, w, h, { region, bottoms, views = ['normal', 'rot180'] }) {
      const imgs = [];
      const keys = [];
      for (const name of views) {
        const data = name === 'normal' ? rgba : name === 'rot180' ? rotate180(rgba) : flipH(rgba, w, h);
        const list = region === 'full' ? [1] : bottoms;
        for (const b of list) {
          imgs.push(resizeToCHW(data, w, h, regionRect(w, h, region, b), cfg.width, cfg.height));
          keys.push([name, b]);
        }
      }
      const vecs = await engine._run(imgs);
      const byView = new Map();
      keys.forEach(([name, b], i) => {
        if (!byView.has(name)) byView.set(name, new Map());
        byView.get(name).set(b, vecs[i]);
      });
      return [...byView].map(([name, byBottom]) => ({ name, byBottom }));
    },
  };
  return engine;
}

/** Output tensor(s) → one vector per image. */
function pickVectors(out, names, pooling, n, skipTokens = 1) {
  const pooled = names.find(k => /pooler|pooled|image_embeds|embedding/i.test(k));
  const hidden = names.find(k => /last_hidden_state/i.test(k));
  let t;
  if (pooling === 'out' || (pooling === 'cls' && pooled)) t = out[pooled || names[0]];
  else t = out[hidden || names[0]];
  const d = t.dims;
  const data = t.data;
  const res = [];
  if (d.length === 2) {
    const dim = d[1];
    for (let b = 0; b < n; b++) res.push(Float32Array.from(data.subarray(b * dim, (b + 1) * dim)));
    return res;
  }
  // [batch, tokens, dim]
  const tokens = d[1];
  const dim = d[2];
  for (let b = 0; b < n; b++) {
    const base = b * tokens * dim;
    if (pooling === 'mean') {
      const v = new Float32Array(dim);
      for (let t2 = skipTokens; t2 < tokens; t2++) for (let j = 0; j < dim; j++) v[j] += data[base + t2 * dim + j];
      for (let j = 0; j < dim; j++) v[j] /= Math.max(1, tokens - skipTokens);
      res.push(v);
    } else {
      res.push(Float32Array.from(data.subarray(base, base + dim))); // CLS token
    }
  }
  return res;
}
