/**
 * The scanner's detector and the rules that depend on the scan (scanner of
 * the test apps validated by the user on 2026-11-17, lot 1.4 — one chain):
 *   - detector: epoch 40 of the 85° retraining (model/MODELS.md); its SHA-256
 *     ties it to the recognition thresholds of the catalog header
 *     (embeddings.detectorSha256, scripts/build-embeddings.mjs); sameWeights:
 *     former SHA-256 of the same weights (21/11/2026: only the description in
 *     the file's metadata changed — it held a path of the author's PC),
 *     accepted as the same detector by sameDetector();
 *   - the thresholds follow the detector's input size (camera 320, photo 416);
 *   - camera mode: a card under 2 % of the frame is never accepted
 *     automatically — the scanner asks.
 */
export const DETECTOR = {
  url: '/models/yolo11s-pose-riftbound-dyn.onnx',
  sha256: '06df918b37a7dcb64305c5f4681d02f87904ffac6a67d30af14cbbd13d89f417',
  sameWeights: ['980a89fd434d01cdbf33d095e649c006d76d4d7c51bcb02bbce048c48be5f0d1'],
};

/** Same detector (same weights): a catalog, a pack or a bench made for it keeps its thresholds. */
export function sameDetector(a, b = DETECTOR.sha256) {
  const canon = (s) => (s === DETECTOR.sha256 || DETECTOR.sameWeights.includes(s) ? DETECTOR.sha256 : s);
  return !!a && !!b && canon(a) === canon(b);
}

// Input size of the last detection (camera 320, photo 416): the thresholds follow it.
let scanSize = 416;
export function setScanSize(size) { scanSize = size; }
/** Key of the catalog header's thresholds for the last detection: 320 or 416. */
export function scanSizeKey() { return scanSize <= 320 ? 320 : 416; }
/** Threshold key per scan mode (yoloDetector.MODE_SIZES). */
export const MODE_SIZES_KEY = { camera: 320, photo: 416 };

export const CAMERA_MIN_AREA = 0.02;
/** Camera mode: a card under 2 % of the frame is never accepted automatically. */
export function cameraAutoAccept(result, kps, frameW, frameH) {
  if (!result?.accepted || !kps?.length) return result;
  const a = Math.abs(kps.reduce((s, p, i) => { const q = kps[(i + 1) % 4]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  if (a >= CAMERA_MIN_AREA * frameW * frameH) return result;
  return { ...result, accepted: false, level: 'uncertain', smallCard: true };
}
