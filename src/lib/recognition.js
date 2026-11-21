/**
 * Recognition engine of the app (Réglages → Scanner → « Moteur de
 * reconnaissance »): starts / stops the AI engine of the card matcher, follows
 * its state for the UI, and measures the speed on this device (4.6).
 */
import { useEffect, useState } from 'react';
import { getMatcher } from './cardMatcher.js';
import { getDetector, loadOrt, canShareMemory } from './yoloDetector.js';
import { getPrefs } from './uiPrefs.js';
import { fullImageSrc } from './nativeAssets.js';
import { warpQuadToPortrait } from './perspectiveCrop.js';
import { CornerCache, frameSignature } from './cornerCache.js';
import { rememberSpeed } from './errorLog.js';import { tx } from './i18n.js';


/** How the browser app gets ONNX Runtime and the model file (public/models/). */
async function browserIO() {
  // Same ONNX Runtime instance as the detector when it is loaded.
  const ort = getDetector().ort || await loadOrt(false);
  return {
    ort,
    // AI model on the CPU (WASM): as fast as the graphics card for one small image
    executionProviders: ['wasm'],
    loadModel: async (file) => {
      const resp = await fetch(`/models/${file}`);
      if (!resp.ok) throw new Error(tx('Modèle IA introuvable ({status})', { status: resp.status }));
      return new Uint8Array(await resp.arrayBuffer());
    },
  };
}

/** Applies the preference: AI engine started (in the background) or stopped. */
export function startRecognition() {
  const matcher = getMatcher();
  if (!matcher.ready) return Promise.resolve();
  if (getPrefs().recognition === 'grid16') {
    matcher.stopAI();
    return Promise.resolve();
  }
  return matcher.startAI(browserIO);
}

/** « Réessayer » after a failure. */
export function retryRecognition() {
  const matcher = getMatcher();
  matcher.stopAI();
  return startRecognition();
}

/** { state: 'off' | 'loading' | 'ready' | 'error', error } of the AI engine. */
export function useAIStatus() {
  const [status, setStatus] = useState(() => getMatcher().aiStatus());
  useEffect(() => {
    const m = getMatcher();
    setStatus(m.aiStatus());
    return m.onAIChange(setStatus);
  }, []);
  return status;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(tx('Image illisible : {src}', { src })));
    img.src = src;
  });
}

/**
 * « Tester la vitesse »: `n` catalog cards, each drawn on a grey background
 * (like a photo of the card on a table) → detection (YOLO), straightening,
 * identification. Averages in ms; `right` = cards recognised as themselves
 * (or a reprint with the same artwork).
 * `detection`: the scan mode measured, 'camera' (320 px) or 'photo' (416 px).
 */
export async function runSpeedTest({ n = 20, onProgress, detection = 'camera' } = {}) {
  const matcher = getMatcher();
  const detector = getDetector();
  if (!matcher.ready) throw new Error(tx('Catalogue pas encore chargé'));
  const detectOpts = { mode: detection };
  const used = detector.models?.[detection];
  const yoloModel = used ? `${used.inputSize} px` : '—';
  // Wait for the AI engine if it is starting (its loading time is not a scan).
  await matcher._aiForScan();
  const step = Math.max(1, Math.floor(matcher.cards.length / n));
  const ids = [];
  for (let i = 0; i < matcher.cards.length && ids.length < n; i += step) ids.push(matcher.cards[i]);
  let yolo = 0;
  let ident = 0;
  let cropTime = 0;
  let aiUsed = 0;
  let withAI = 0;
  let aiOnly = 0;
  let right = 0;
  let detected = 0;
  // Auto scan, still picture: corners reused (no YOLO), card identified again
  let stable = 0;
  let stableN = 0;
  const corners = new CornerCache();
  for (let k = 0; k < ids.length; k++) {
    const card = ids[k];
    const img = await loadImage(fullImageSrc(card.id));
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * 1.6);
    canvas.height = Math.round(h * 1.4);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2);
    let crop = img;
    let kps = null;
    const t0 = performance.now();
    const crop0 = detector.cropMs || 0;
    if (detector.state === 'ready') {
      const dets = await detector.detect(canvas, detectOpts);
      if (dets[0]?.keypoints?.length === 4) {
        kps = dets[0].keypoints;
        // the detector's own camera crop (full perspective, card's box only), timed on its own line
        crop = dets[0].cropCanvas;
        if (crop.width > crop.height) crop = warpQuadToPortrait(canvas, kps);
        detected++;
      }
    }
    const t1 = performance.now();
    const cropDt = (detector.cropMs || 0) - crop0;
    cropTime += cropDt; yolo += t1 - t0 - cropDt;
    const c2 = crop instanceof HTMLCanvasElement ? crop : (() => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      return c;
    })();
    const r = await matcher.identify(c2);
    ident += performance.now() - t1;
    if (matcher.lastTiming?.aiUsed) aiUsed++;
    // The same card again with the AI forced: its time when the colours hesitate.
    if (matcher.lastTiming?.engine === 'ai') {
      const t2 = performance.now();
      await matcher.identify(c2, { forceAI: true });
      withAI += performance.now() - t2;
      aiOnly += matcher.lastTiming.aiMs;
    }
    if (r && (r.card.id === card.id || (card.artGroup && r.card.artGroup === card.artGroup))) right++;
    if (kps) {
      corners.store(frameSignature(canvas), kps, canvas.width, canvas.height, r?.recognized ? r.card.id : null);
      const t3 = performance.now();
      const hit = corners.reuse(frameSignature(canvas), canvas.width, canvas.height);
      const again = hit && detector.cropCard(canvas, hit.kps);
      if (again) {
        const r2 = await matcher.identify(again);
        if (corners.acceptReused(r2?.recognized ? r2.card.id : null)) {
          stable += performance.now() - t3;
          stableN++;
        }
      }
    }
    onProgress?.(k + 1, ids.length);
  }
  const m = ids.length || 1;
  return rememberSpeed({
    n: ids.length,
    // Processor cores used by ONNX Runtime (several only with cross-origin isolation)
    threads: (getDetector().ort?.env?.wasm?.numThreads) || 1,
    isolated: !!self.crossOriginIsolated,
    sharedMemory: canShareMemory(),
    engine: matcher.lastTiming?.engine || 'grid16',
    yoloModel,
    yoloMs: Math.round(yolo / m),
    // the perspective crop, out of the detection time
    cropMs: Math.round(cropTime / m),
    identifyMs: Math.round(ident / m),
    // AI needed (colours unsure) for `aiUsed` cards; when it is, identification takes withAIMs
    aiUsed,
    withAIMs: Math.round(withAI / m),
    aiMs: Math.round(aiOnly / m),
    totalMs: Math.round((yolo + ident) / m),
    // Auto scan with a still picture (corners reused): ms per card, cards measured
    stableMs: stableN ? Math.round(stable / stableN) : null,
    stableN,
    detected,
    right,
  }, detection);
}
