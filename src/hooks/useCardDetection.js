import { useState, useRef, useCallback } from 'react';
import { getDetector, DetectorState } from '../lib/yoloDetector.js';
import { getMatcher, toCardData } from '../lib/cardMatcher.js';
import { CornerCache, frameSignature } from '../lib/cornerCache.js';
import { cameraAutoAccept } from '../lib/scanRules.js';

/**
 * Hook for single-frame card detection (tap to scan).
 *
 * Orchestrates:
 *   1. YOLO detection on a captured frame
 *   2. Card matching on detected crops (via CardMatcher)
 */
export function useCardDetection() {
  const [detectorState, setDetectorState] = useState(DetectorState.UNLOADED);
  // { error }: why the detector could not start
  const [detectorInfo, setDetectorInfo] = useState({ error: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);

  const detectorRef = useRef(null);
  // Auto scan: corners of the card kept while the picture does not move
  const cornersRef = useRef(new CornerCache());
  // Set synchronously: a second tap during a scan is refused at once
  // (the isProcessing state only updates at the next render).
  const busyRef = useRef(false);

  /**
   * Initialize the YOLO detector
   */
  const initDetector = useCallback(async () => {
    const detector = getDetector();
    detectorRef.current = detector;
    setDetectorState(DetectorState.LOADING);
    setDetectorInfo({ error: null });
    try {
      await detector.initialize();
    } catch (error) {
      console.error('[Detection] Init failed:', error);
    }
    setDetectorState(detector.state);
    setDetectorInfo({ error: detector.error });
  }, []);

  /** « Réessayer » after the AI failed to start. */
  const retryDetector = useCallback(() => initDetector(), [initDetector]);

  /**
   * Ensure canvas is in portrait orientation
   */
  function ensurePortrait(canvas) {
    if (canvas.width <= canvas.height) return canvas;
    const rot = document.createElement('canvas');
    rot.width = canvas.height;
    rot.height = canvas.width;
    const rctx = rot.getContext('2d');
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return rot;
  }

  /**
   * Identify a card from a crop canvas using the CardMatcher.
   */
  function identifyCard(cropCanvas, matcher) {
    return matcher.identify(cropCanvas);
  }

  /** { cx, cy, w, h } around 4 corners. */
  function boxOf(kps) {
    const xs = kps.map(p => p[0]);
    const ys = kps.map(p => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const w = Math.max(...xs) - x0;
    const h = Math.max(...ys) - y0;
    return { cx: x0 + w / 2, cy: y0 + h / 2, w, h };
  }

  /**
   * Resolve card data from a matcher card to full card format.
   */
  function resolveCardData(matcherCard) {
    return matcherCard ? toCardData(matcherCard) : null;
  }

  /**
   * Detect cards in a single frame (tap to scan).
   * Captures one frame, runs YOLO + matching, returns result.
   * `reuseCorners` (auto scan): while the picture is still, the corners found
   * by the last YOLO run are used again and YOLO is skipped (cornerCache —
   * never the corners of a previous card). `result.timing` says what ran.
   */
  const detectSingleFrame = useCallback(async (captureFrame, { reuseCorners = false, explain = false } = {}) => {
    if (busyRef.current) return null;
    if (!detectorRef.current || detectorRef.current.state !== DetectorState.READY) return null;

    const matcher = getMatcher();
    if (!matcher.ready) return null;

    const frame = captureFrame?.();
    if (!frame) return null;

    busyRef.current = true;
    setIsProcessing(true);
    setLastDetection(null);

    try {
      const cache = cornersRef.current;
      const timing = { reused: false, signatureMs: 0, yoloMs: 0, identifyMs: 0 };
      let sig = null;
      let bestDetection = null;
      let matchResult = null;

      // Step 0 (auto scan): same picture as the last YOLO run → same corners
      if (reuseCorners) {
        const t0 = performance.now();
        sig = frameSignature(frame);
        timing.signatureMs = performance.now() - t0;
        const hit = cache.reuse(sig, frame.width, frame.height);
        const crop = hit && detectorRef.current.cropCard(frame, hit.kps);
        if (crop) {
          const t1 = performance.now();
          const m = await identifyCard(ensurePortrait(crop), matcher);
          timing.identifyMs = performance.now() - t1;
          if (cache.acceptReused(m?.recognized ? m.card.id : null)) {
            timing.reused = true;
            matchResult = m;
            bestDetection = { box: boxOf(hit.kps), confidence: null, keypoints: hit.kps };
          }
          // Otherwise: another card, or not recognised → YOLO on this frame
        } else if (hit) {
          cache.clear(); // blurry: YOLO decides
        }
      } else {
        cache.clear(); // tap scan: the next auto scan starts from YOLO
      }

      if (!matchResult) {
        // Step 1: YOLO detection
        // Camera: one card close up → the small model (MODE_SIZES.camera)
        const t0 = performance.now();
        const detections = await detectorRef.current.detect(frame, { mode: 'camera' });
        timing.yoloMs = performance.now() - t0;

        if (detections.length === 0) {
          cache.clear();
          setLastDetection(null);
          // Hands-free: an empty table is not a failed scan (no sound)
          return explain ? { matched: false, empty: true } : null;
        }

        bestDetection = detections[0];

        // Step 2: Ensure portrait orientation
        const crop = ensurePortrait(bestDetection.cropCanvas);

        // Step 3: Match using card matcher
        const t1 = performance.now();
        matchResult = await identifyCard(crop, matcher);
        timing.identifyMs = performance.now() - t1;
        if (sig) cache.store(sig, bestDetection.keypoints, frame.width, frame.height, matchResult?.recognized ? matchResult.card.id : null);
      }
      if (reuseCorners) console.debug('[Detection] auto scan', timing);
      // A card under 2 % of the frame is never accepted automatically (scanRules.js)
      matchResult = cameraAutoAccept(matchResult, bestDetection?.keypoints, frame.width, frame.height);

      // Nothing that looks like a card of the catalog.
      if (!matchResult || !matchResult.recognized) {
        setLastDetection({
          box: bestDetection.box,
          confidence: bestDetection.confidence,
          matched: false,
        });
        return null;
      }

      // Step 4: Resolve full card data
      const cardData = resolveCardData(matchResult.card);
      if (!cardData) return null;

      const result = {
        cardData,
        // Other likely cards, best first (to correct a wrong match)
        alternatives: (matchResult.top || [])
          .filter(t => t.card.id !== matchResult.card.id)
          .slice(0, 5)
          .map(t => ({ cardData: resolveCardData(t.card), similarity: t.similarity })),
        // Doubtful match: the best candidates to choose from (best first).
        candidates: (matchResult.top || []).slice(0, 5)
          .map(t => ({ cardData: resolveCardData(t.card), similarity: t.similarity })),
        // Reprints with the same artwork (OGN / RAD / VEN…): the set is asked.
        printings: (matchResult.sameArt || []).map(resolveCardData),
        accepted: matchResult.accepted,
        level: matchResult.level,
        // The matcher's own result (learning: learnFromChoice)
        match: matchResult,
        similarity: matchResult.similarity,
        confidence: bestDetection.confidence,
        box: bestDetection.box,
        timing,
        matched: true,
        timestamp: Date.now(),
        // Camera picture of the scan (bench collection: « garder les scans hésitants »)
        frame,
      };

      setLastDetection(result);
      return result;
    } catch (error) {
      console.error('[Detection] Frame processing error:', error);
      return null;
    } finally {
      busyRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  return {
    detectorState,
    detectorInfo,
    retryDetector,
    isProcessing,
    lastDetection,
    initDetector,
    detectSingleFrame,
  };
}
