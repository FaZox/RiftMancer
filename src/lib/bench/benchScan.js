/**
 * The scanner's proposal for a bench photo (MODULE-BANC.md 2): the same
 * chain as the app — YOLO at the size of the scan mode (camera 320 px,
 * photo 416 px), straightening, cascade colours → AI with the current
 * thresholds — but every detection is kept (the user confirms or corrects
 * each one, or says it is not a card).
 */
import { getDetector, MODE_SIZES, MODEL_URL } from '../yoloDetector.js';
import { cameraAutoAccept, MODE_SIZES_KEY, sameDetector } from '../scanRules.js';
import { getMatcher, toCardData } from '../cardMatcher.js';
import { DECISION_PRUDENT } from '../matchIndex.js';
import { warpQuadToPortrait } from '../perspectiveCrop.js';
import { APP_VERSION } from '../appVersion.js';
import { isJpeg, stripJpegMetadata } from './jpegClean.js';
import { benchKey, codeIndex, drawSplit, labelFor, localIso, newPhotoName } from './benchFormat.js';
import { addItem, takenNames } from './benchStore.js';

let indexCache = { cards: null, index: null };
/** Printed codes of the catalog (benchKey). */
export function catalogIndex() {
  const m = getMatcher();
  if (indexCache.cards !== m.cards) indexCache = { cards: m.cards, index: codeIndex(m.cards) };
  return indexCache.index;
}

/** How the bench writes a catalog card (« OGN-042 », or its id). */
export function keyOf(card) {
  return benchKey(card, catalogIndex());
}

/** Detector, AI engine, thresholds and app version of a proposal (_collecte.json). */
export function chainInfo(mode) {
  const matcher = getMatcher();
  const header = matcher.ai?.state === 'ready' ? matcher.ai.header : null;
  const fused = sameDetector(header?.detectorSha256) ? header.decision?.[MODE_SIZES_KEY[mode]] : null;
  const t = fused ? { ...DECISION_PRUDENT, ...fused } : DECISION_PRUDENT;
  return {
    appVersion: APP_VERSION,
    detector: `${(getDetector().modelUrl || MODEL_URL).split('/').pop().replace(/\.onnx$/, '')}@${MODE_SIZES[mode]}`,
    engine: header?.engine || 'grid16',
    thresholds: [t.abs, t.margin],
  };
}

function toCanvas(img) {
  if (img instanceof HTMLCanvasElement) return img;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

function ensurePortrait(canvas) {
  if (canvas.width <= canvas.height) return canvas;
  const rot = document.createElement('canvas');
  rot.width = canvas.height;
  rot.height = canvas.width;
  const ctx = rot.getContext('2d');
  ctx.translate(rot.width / 2, rot.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rot;
}

/** Small JPEG (data URL) of a picture, for lists. */
export function thumbnail(source, max = 240) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/**
 * Proposal of the scanner for each card found on a picture.
 *   image     picture given to YOLO (photo: reduced to 2048 px, as the app)
 *   original  full-resolution picture the cards are cut from
 *   mode      'camera' (320 px) or 'photo' (416 px)
 * @returns {Promise<{ detections: object[], info: object }>} each detection:
 *   { corners: [[x, y] ×4] in 0–1 of the picture, crop: data URL,
 *     scanner: { key, id, cardData } | null, level, candidates: cardData[] }
 */
export async function analyzePicture(image, original, mode) {
  const detector = getDetector();
  if (detector.state !== 'ready') throw new Error('Le détecteur n’est pas prêt : attendez la fin de son chargement (onglet Scanner).');
  const matcher = getMatcher();
  if (!matcher.ready) throw new Error('Le catalogue n’est pas encore chargé.');
  const canvas = toCanvas(image);
  const raw = mode === 'camera' ? await detector.detect(canvas, { mode }) : await detector.detectPhoto(canvas);
  const ow = original.naturalWidth || original.width;
  const scale = ow / canvas.width;
  const detections = [];
  for (const d of raw) {
    const kps = d.keypoints?.length === 4 ? d.keypoints : null;
    const crop = mode === 'camera' || !kps
      ? ensurePortrait(d.cropCanvas)
      : warpQuadToPortrait(original, kps.map(([x, y]) => [x * scale, y * scale]));
    let m = await matcher.identify(crop);
    if (mode === 'camera') m = cameraAutoAccept(m, d.keypoints, canvas.width, canvas.height);
    const recognized = !!m?.recognized;
    detections.push({
      corners: kps ? kps.map(([x, y]) => [x / canvas.width, y / canvas.height]) : null,
      crop: thumbnail(crop, 300),
      scanner: recognized ? { key: keyOf(m.card), id: m.card.id, cardData: toCardData(m.card) } : null,
      level: recognized ? m.level : null,
      similarity: recognized ? m.similarity : null,
      candidates: (m?.top || []).slice(0, 5).map(t => ({ ...toCardData(t.card), similarity: t.similarity })),
    });
  }
  return { detections, info: chainInfo(mode) };
}

/**
 * The card of a detection decided by the user (golden rule: always a
 * choice). `choice`: { cardData } (catalog card) or { freeCode } (missing
 * from the catalog, already normalised). `det`: the detection, or null for a
 * card YOLO missed.
 */
export function decideCard(det, choice) {
  const final = choice.cardData ? keyOf(choice.cardData) : choice.freeCode;
  const finalId = choice.cardData ? choice.cardData.id : null;
  const scanner = det?.scanner?.key || null;
  return {
    final,
    finalId,
    scanner,
    scannerId: det?.scanner?.id || null,
    level: det?.level || null,
    label: labelFor(final, scanner),
    corners: det?.corners || null,
  };
}

/** JPEG bytes of a picked file, without GPS / device data (other formats converted). */
export async function jpegFromFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isJpeg(bytes)) return stripJpegMetadata(bytes).bytes;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Image illisible.'));
    i.src = URL.createObjectURL(file);
  });
  return jpegFromCanvas(toCanvas(img));
}

/** JPEG of a camera picture (quality 95). */
export async function jpegFromCanvas(canvas) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion en JPEG impossible.'))), 'image/jpeg', 0.95));
  return stripJpegMetadata(new Uint8Array(await blob.arrayBuffer())).bytes;
}

/**
 * Saves a photo in « Ma collecte ». `cards`: decided cards (decideCard).
 * @returns {Promise<object>} the saved item
 */
export async function saveCollected({ type, source, info, cards, rejectedBoxes = 0, jpeg, thumbSource, width, height }) {
  const now = new Date();
  const item = {
    name: newPhotoName(now, await takenNames()),
    type,
    source,
    date: localIso(now),
    ...info,
    split: drawSplit(),
    cards,
    rejectedBoxes,
    width,
    height,
    thumb: thumbSource ? thumbnail(thumbSource) : null,
  };
  await addItem(item, jpeg);
  return item;
}

/**
 * Option « Proposer de garder les scans hésitants pour le banc » (2.3): the
 * camera picture of a doubtful scan, labelled with the card the user chose
 * (a human decision). `result`: the scan result (useCardDetection), with its
 * `frame`; `chosen`: cardData picked by the user.
 */
export async function keepHesitantScan(result, chosen) {
  if (!result?.frame) throw new Error('Image du scan indisponible.');
  const best = result.match?.card;
  const det = {
    scanner: best && result.match?.recognized ? { key: keyOf(best), id: best.id } : null,
    level: result.match?.recognized ? result.level || null : null,
  };
  const card = decideCard(det, { cardData: chosen });
  return saveCollected({
    type: 'carte',
    source: 'scan-hesitant',
    info: chainInfo('camera'),
    cards: [card],
    jpeg: await jpegFromCanvas(result.frame),
    thumbSource: result.frame,
    width: result.frame.width,
    height: result.frame.height,
  });
}
