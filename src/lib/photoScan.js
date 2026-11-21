/**
 * Recognising cards on a photo: detection (YOLO), crop of each card (with
 * perspective correction), and matching against the catalog. Shared by the
 * phone scanner (components/scan/ScanTab) and the PC scanner (desktop/).
 */
import { getMatcher, isAccepted, toCardData } from './cardMatcher.js';
import { learnFromChoice } from './learning.js';
import { getDetector } from './yoloDetector.js';
import { warpQuadToPortrait } from './perspectiveCrop.js';import { tx } from './i18n.js';


export function cropRotated(img, cx, cy, w, h, angle) {
  // Use card diagonal (not image diagonal) for intermediate canvas — saves memory
  const cardDiag = Math.sqrt(w * w + h * h);
  const size = Math.ceil(cardDiag) + 4;
  const big = document.createElement('canvas');
  big.width = size;
  big.height = size;
  const bctx = big.getContext('2d');
  const bcx = size / 2;
  const bcy = size / 2;
  bctx.translate(bcx, bcy);
  bctx.rotate(-angle);
  bctx.drawImage(img, -cx, -cy);

  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  c.getContext('2d').drawImage(big, bcx - w / 2, bcy - h / 2, w, h, 0, 0, w, h);

  if (w > h) {
    const rot = document.createElement('canvas');
    rot.width = Math.round(h);
    rot.height = Math.round(w);
    const rctx = rot.getContext('2d');
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(c, -c.width / 2, -c.height / 2);
    return rot;
  }
  return c;
}

/**
 * Identifies a cropped card (see CardMatcher.identify: centred score, margin,
 * reprint groups) and adds `top3`, the best candidates in the card-data shape
 * used by the detail panel (« laquelle ? »).
 */
export async function identifyCard(cropCanvas, matcher) {
  if (!matcher?.ready) return null;
  const r = await matcher.identify(cropCanvas);
  if (!r) return null;
  const top3 = r.top.slice(0, 5).map(t => ({
    ...toCardData(t.card),
    sim: (t.similarity * 100).toFixed(1),
    similarity: t.similarity,
  }));
  return { ...r, top3 };
}

/**
 * Detections added by the user: the AI learns the ones it got wrong or was
 * unsure about (the card chosen in the detail panel is the right one).
 */
export function learnFromDetections(dets) {
  for (const det of dets) {
    const m = det?.matchResult;
    const chosen = det?.activeCardId || m?.card?.id;
    if (m && chosen) learnFromChoice(m, chosen);
  }
}

/** A detection worth showing: recognised (accepted) or a doubtful match to confirm. */
export function isListedDetection(det) {
  const m = det?.matchResult;
  return !!m && (m.accepted || m.recognized !== false);
}

/** Detection accepted without asking (pre-checked, added by « tout ajouter »). */
export function isAcceptedDetection(det) {
  return isAccepted(det?.matchResult);
}

export function resolveMatchCardData(det) {
  const cardId = det.activeCardId || det.matchResult?.card?.id;
  if (!cardId) return null;
  const matchEntry = det.matchResult?.top3?.find(m => m.id === cardId);
  if (!matchEntry) return null;
  return {
    id: matchEntry.id,
    name: matchEntry.name,
    collectorNumber: matchEntry.collectorNumber,
    code: matchEntry.code,
    set: matchEntry.set,
    setName: matchEntry.setName,
    domain: matchEntry.domain,
    domains: matchEntry.domains,
    rarity: matchEntry.rarity,
    type: matchEntry.type,
    energy: matchEntry.energy,
    might: matchEntry.might,
    tags: matchEntry.tags,
    illustrator: matchEntry.illustrator,
    text: matchEntry.text,
  };
}

/** Resize image to fit within maxDim, returns a new Image element */
const MAX_IMAGE_DIM = 2048;
export function resizeImage(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM) return img;
  const scale = MAX_IMAGE_DIM / Math.max(w, h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  canvas.getContext('2d').drawImage(img, 0, 0, nw, nh);
  const resized = new Image();
  resized.src = canvas.toDataURL('image/png');
  resized.width = nw;
  resized.height = nh;
  return resized;
}

/** Convert a pending card to CardDetailPanel's detection format */
export function pendingToDetection(card) {
  const sim = card.similarity || card.confidence || 1;
  return {
    matchResult: {
      card: { id: card.cardData.id },
      similarity: sim,
      accepted: true,
      recognized: true,
      level: card.level || 'sure',
      top3: [{
        id: card.cardData.id,
        name: card.cardData.name,
        collectorNumber: card.cardData.collectorNumber,
        code: card.cardData.code,
        set: card.cardData.set,
        setName: card.cardData.setName,
        domain: card.cardData.domain,
        domains: card.cardData.domains,
        rarity: card.cardData.rarity,
        type: card.cardData.type,
        energy: card.cardData.energy,
        might: card.cardData.might,
        tags: card.cardData.tags,
        illustrator: card.cardData.illustrator,
        text: card.cardData.text,
        sim: (sim * 100).toFixed(1),
        similarity: sim,
      }],
    },
    cropCanvas: null,
    confidence: card.confidence || 1,
  };
}


/** Loads a File as an Image; resolves { original, image } (image ≤ 2048 px). */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const original = new Image();
    original.onload = () => {
      const image = resizeImage(original);
      if (image === original) resolve({ original, image });
      else image.onload = () => resolve({ original, image });
    };
    original.onerror = () => reject(new Error(tx('Image illisible')));
    original.src = URL.createObjectURL(file);
  });
}

/**
 * Finds and identifies every card on a photo. `image` is the (resized) image
 * the detector sees, `original` the full-resolution one used for the crops.
 * Returns the recognised detections — accepted ones and doubtful ones (the
 * user confirms those, see isAcceptedDetection).
 */
export async function detectCards(image, original = image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const detector = getDetector();
  if (detector.state !== 'ready') throw new Error(tx('Détecteur pas prêt'));
  const raw = await detector.detectPhoto(canvas);
  if (!raw?.length) return [];
  const scale = (original.naturalWidth || original.width) / canvas.width;
  const matcher = getMatcher();
  const out = [];
  for (const det of raw) {
    const crop = det.keypoints?.length === 4
      ? warpQuadToPortrait(original, det.keypoints.map(([x, y]) => [x * scale, y * scale]))
      : cropRotated(original, det.box.cx * scale, det.box.cy * scale, det.box.w * scale, det.box.h * scale, det.box.angle ?? 0);
    const matchResult = matcher.ready ? await identifyCard(crop, matcher) : null;
    out.push({
      cx: det.box.cx, cy: det.box.cy, w: det.box.w, h: det.box.h,
      corners: det.keypoints || null, confidence: det.confidence, cropCanvas: crop, matchResult,
    });
  }
  return matcher.ready ? out.filter(isListedDetection) : out;
}

/** The user moved the 4 corners of a detection: re-crop and re-identify it. */
export async function rematchCorners(det, corners, image, original = image) {
  const scale = (original.naturalWidth || original.width) / (image.naturalWidth || image.width);
  const crop = warpQuadToPortrait(original, corners.map(([x, y]) => [x * scale, y * scale]));
  const matcher = getMatcher();
  return { ...det, corners, cropCanvas: crop, matchResult: matcher.ready ? await identifyCard(crop, matcher) : null, activeCardId: undefined };
}
