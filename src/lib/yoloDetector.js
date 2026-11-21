/**
 * Card detector: YOLO11s-pose (4 corners of each card), ONNX, in the app.
 *
 * ONE model file, float32 with a dynamic input size
 * (model/export_yolo_sizes.py --dynamic, model/MODELS.md), run at the size of
 * each scan mode. Shipped with the app everywhere (PC and Android) — no
 * other model, no download.
 */

import { isNative } from './nativeAssets.js';
import { letterbox, rgbaToCHW, decodePose, nms, unrotateDetection, fewCards, mergeOrientations } from './yoloCore.js';
import { warpQuadRegion } from './perspectiveCrop.js';
import { DETECTOR, setScanSize } from './scanRules.js';

/**
 * Input size per scan mode (benches of 2026-11-13/14, model/MODELS.md):
 *   camera: one card close up        → 320 px (≈ 6× less work than 768)
 *   photo:  imported photo or grid   → 416 px (≈ 3× less work than 768)
 */
export const MODE_SIZES = { camera: 320, photo: 416 };

export const MODEL_URL = DETECTOR.url;

/**
 * ONNX Runtime is bundled with the app (no CDN) so the detector works
 * offline; its WASM files are copied to public/ort/ by scripts/copy-ort.mjs.
 * Only the build that is needed is loaded:
 *   - WebGPU build (graphics card, 29 MB engine) — PC / browser with a GPU;
 *   - plain WASM build otherwise (no GPU, Android app).
 * Several WASM threads need cross-origin isolation (COOP/COEP headers sent by
 * the PC app's server); otherwise one thread.
 */
export async function loadOrt(gpu) {
  const ort = gpu ? await import('onnxruntime-web/webgpu') : await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = '/ort/';
  ort.env.wasm.numThreads = canShareMemory() ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
  return ort;
}

/**
 * Several WASM threads need memory shared between workers (SharedArrayBuffer).
 * Browsers give it to cross-origin isolated pages (PC app: COOP/COEP headers);
 * Android's WebView may give it without isolation (it has no COOP support) —
 * so the feature itself is tested, not only `crossOriginIsolated`.
 */
export function canShareMemory() {
  if (typeof SharedArrayBuffer === 'undefined' || typeof MessageChannel === 'undefined') return false;
  try {
    new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
    return true;
  } catch {
    return false;
  }
}

// Detection states
export const DetectorState = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  WARMING: 'warming',
  READY: 'ready',
  ERROR: 'error',
};

class YOLODetector {
  constructor() {
    this.model = null;
    // Per scan mode: { session, inputSize } — one session (dynamic input) for both
    this.models = {};
    this.onnxSession = null;
    this.state = DetectorState.UNLOADED;
    this.inputSize = MODE_SIZES.photo;
    this.confidenceThreshold = 0.6;
    this.iouThreshold = 0.45;
    // Minimum Laplacian variance for a crop to be considered "sharp enough"
    // to identify. Out-of-focus background cards typically score < 50;
    // well-focused cards score > 300. 100 is a conservative middle ground.
    this.sharpnessThreshold = 100;
    this.error = null;          // technical message when the detector could not start
    this._warmupComplete = false;
    this.ort = null; // ONNX Runtime module in use
    // Engine loader and session factory (replaced in the tests)
    this._loadOrt = loadOrt;
    this._createSession = (url, opts) => this.ort.InferenceSession.create(url, opts);
  }

  /**
   * Loads the model and runs a warmup inference at each mode's size.
   * Graphics card (WebGPU) when there is one, otherwise WASM; if the model
   * cannot load: state ERROR with `error` (the scanner shows it with
   * « Réessayer ») — never a fake « simulation ».
   */
  async initialize() {
    this.state = DetectorState.LOADING;
    this.onnxSession = null;
    this.models = {};
    this.error = null;
    try {
      // Android app: plain WASM (no WebGPU in its WebView)
      const gpu = !isNative && typeof navigator !== 'undefined' && !!navigator.gpu;
      this.ort = await this._loadOrt(gpu);
      if (!this.ort?.InferenceSession) throw new Error('ONNX Runtime indisponible');
      const opts = (ep) => ({ executionProviders: [ep], graphOptimizationLevel: 'all' });
      const modelUrl = MODEL_URL;
      this.modelUrl = modelUrl;
      console.log('[YOLO] Loading ONNX model:', modelUrl);
      let session = null;
      if (gpu) {
        try {
          session = await this._createSession(modelUrl, opts('webgpu'));
        } catch (e) {
          console.warn('[YOLO] WebGPU failed, retrying with WASM:', e?.message || e);
        }
      }
      if (!session) session = await this._createSession(modelUrl, opts('wasm'));
      this.onnxSession = session;
      for (const [mode, size] of Object.entries(MODE_SIZES)) this.models[mode] = { session, inputSize: size };
      this.modelFormat = 'onnx';

      // Warmup: one inference per size (first-run lag, shapes prepared)
      this.state = DetectorState.WARMING;
      await this._warmup();

      this.state = DetectorState.READY;
      console.log('[YOLO] Detector ready:', Object.entries(this.models).map(([k, m]) => `${k} ${m.inputSize}`).join(', '));
    } catch (error) {
      this.state = DetectorState.ERROR;
      this.onnxSession = null;
      this.models = {};
      this.error = String(error?.message || error);
      console.error('[YOLO] Initialization failed:', error);
      throw error;
    }
  }

  async _run(m, data) {
    const tensor = new this.ort.Tensor('float32', data, [1, 3, m.inputSize, m.inputSize]);
    return m.session.run({ images: tensor });
  }

  async _warmup() {
    for (const m of Object.values(this.models)) await this._run(m, new Float32Array(m.inputSize * m.inputSize * 3).fill(0.5));
    this._warmupComplete = true;
  }

  /**
   * Detect cards in a video frame
   * @param {HTMLCanvasElement|HTMLVideoElement} source - Input frame
   * @param {{ mode?: 'camera' | 'photo' }} [opts] - scan mode (input size, MODE_SIZES)
   * @returns {Array<Detection>} Array of detected cards with OBB coordinates
   *          (nothing when the detector is not ready — never a fake detection)
   *
   * Detection shape:
   * {
   *   box: { cx, cy, w, h },         // Axis-aligned bounding box
   *   confidence: number,
   *   cropCanvas: HTMLCanvasElement,  // Perspective-corrected card image
   *   keypoints: [[x,y]×4]           // TL, TR, BR, BL corners (pose model only)
   * }
   */
  async detect(source, { mode = 'photo' } = {}) {
    if (this.state !== DetectorState.READY) return [];
    const m = this.models[mode] || this.models.photo;
    if (!m) return [];
    setScanSize(m.inputSize); // the recognition thresholds follow the input size (scanRules.js)
    return this._onnxDetect(source, m);
  }

  /**
   * Photo mode (photos, grids): the picture as is, then — when that found few
   * cards (cards lying sideways or upside down: photo taken with the phone
   * flat) — turned by 90, 180 and 270°. Keeps the upright cards unless a
   * turned picture finds clearly more (yoloCore.mergeOrientations 'switch').
   */
  async detectPhoto(source) {
    const first = await this.detect(source, { mode: 'photo' });
    const W = source.width || source.videoWidth;
    const H = source.height || source.videoHeight;
    if (!W || !H || !fewCards(first, W, H)) return first;
    const passes = [{ deg: 0, dets: first }];
    for (const deg of [90, 180, 270]) {
      const c = document.createElement('canvas');
      c.width = deg === 180 ? W : H;
      c.height = deg === 180 ? H : W;
      const ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((deg * Math.PI) / 180); // clockwise, like yoloCore.unrotatePoint
      ctx.drawImage(source, -W / 2, -H / 2);
      const dets = await this.detect(c, { mode: 'photo' });
      // cropCanvas, made on the turned picture from the card's own corners: already upright
      passes.push({ deg, dets: dets.map(d => unrotateDetection(d, deg, W, H)) });
    }
    return mergeOrientations(passes, this.iouThreshold, 'switch').dets;
  }

  /**
   * ONNX model inference pipeline
   */
  async _onnxDetect(source, m) {
    const srcW = source.width || source.videoWidth;
    const srcH = source.height || source.videoHeight;
    const size = m.inputSize;

    // Letterbox preprocess: maintain aspect ratio, pad with 114/255 gray (yoloCore)
    const lb = letterbox(srcW, srcH, size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(source, 0, 0, srcW, srcH, lb.padX, lb.padY, lb.newW, lb.newH);
    const results = await this._run(m, rgbaToCHW(ctx.getImageData(0, 0, size, size).data, size));
    const output = results.output0 || results[Object.keys(results)[0]];
    // [1, 13, N]: box, confidence, 4 corners TL TR BR BL (yoloCore.decodePose)
    const n = output.dims ? output.dims[output.dims.length - 1] : output.data.length / 13;
    const detections = decodePose(output.data, n, lb, this.confidenceThreshold)
      .map(d => ({ ...d, cropCanvas: this._cropCard(source, d.keypoints) }));

    return this._filterByFocus(nms(detections, this.iouThreshold));
  }

  /**
   * Straightened card from known corners (auto scan reusing them), or null
   * when that crop is too blurry (same focus test as detect()).
   */
  cropCard(source, keypoints) {
    setScanSize(MODE_SIZES.camera); // reused corners: the camera's auto scan
    const crop = this._cropCard(source, keypoints);
    if (this.sharpnessThreshold > 0 && this._laplacianVariance(crop) < this.sharpnessThreshold) return null;
    return crop;
  }

  /**
   * The card cut out of the frame with the full perspective correction, reading
   * only the card's box (perspectiveCrop.warpQuadRegion: same pixels as the bench).
   * kps: [[TLx,TLy],[TRx,TRy],[BRx,BRy],[BLx,BLy]] in source image pixels.
   */
  _cropCard(source, kps) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const crop = warpQuadRegion(source, kps);
    if (t0) this.cropMs = (this.cropMs || 0) + performance.now() - t0; // « Tester la vitesse »
    return crop;
  }

  /**
   * Drop detections whose crop is too out-of-focus to identify reliably.
   * Uses Laplacian variance on a 64×64 grayscale downsample — cheap and a
   * reliable proxy for "how much edge detail is in this image".
   */
  _filterByFocus(detections) {
    if (this.sharpnessThreshold <= 0) return detections;
    return detections.filter(d => this._laplacianVariance(d.cropCanvas) >= this.sharpnessThreshold);
  }

  _laplacianVariance(cropCanvas) {
    if (!this._sharpCanvas) this._sharpCanvas = document.createElement('canvas');
    const N = 64;
    this._sharpCanvas.width = N;
    this._sharpCanvas.height = N;
    const ctx = this._sharpCanvas.getContext('2d');
    ctx.drawImage(cropCanvas, 0, 0, N, N);
    const data = ctx.getImageData(0, 0, N, N).data;

    // Grayscale (Rec. 601 luma)
    const gray = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    // 3×3 Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const lap = -4 * gray[y * N + x]
                  + gray[(y - 1) * N + x]
                  + gray[(y + 1) * N + x]
                  + gray[y * N + x - 1]
                  + gray[y * N + x + 1];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    const mean = sum / count;
    return sumSq / count - mean * mean;
  }

  _videoToCanvas(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas;
  }

  dispose() {
    // ONNX sessions don't have a dispose method, just drop them
    this.onnxSession = null;
    this.models = {};
    this.state = DetectorState.UNLOADED;
  }
}

// Singleton instance
let detectorInstance = null;

export function getDetector() {
  if (!detectorInstance) {
    detectorInstance = new YOLODetector();
  }
  return detectorInstance;
}

export default YOLODetector;
