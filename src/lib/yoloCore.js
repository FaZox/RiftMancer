/**
 * Card detector (YOLO11-pose, 4 corners) — the pure parts, without DOM:
 * letterbox geometry, input tensor, decoding of the output, NMS. Shared by
 * yoloDetector.js (app), scripts/eval-detector.mjs and photos-prepare.mjs
 * (Node), so that all of them read the model the same way, at any input size.
 */

/** Input size of a model: from the session (fixed-size export), else the file name (…-416…), else 768. */
export function modelInputSize(session, url = '') {
  const meta = session?.inputMetadata?.[0];
  const dims = meta?.shape || meta?.dims;
  const s = Array.isArray(dims) ? Number(dims[dims.length - 1]) : NaN;
  if (Number.isInteger(s) && s > 0) return s;
  const m = /-(\d{3,4})(?:-q8)?\.onnx/.exec(String(url));
  return m ? Number(m[1]) : 768;
}

/**
 * Letterbox: the image keeps its proportions inside a size × size square,
 * centred, grey borders (114).
 */
export function letterbox(srcW, srcH, size) {
  const scale = Math.min(size / srcW, size / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  return { size, scale, newW, newH, padX: (size - newW) / 2, padY: (size - newH) / 2 };
}

/** size × size RGBA → planar RGB floats 0–1 (NCHW, batch 1). */
export function rgbaToCHW(rgba, size) {
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = rgba[i * 4] / 255;
    out[plane + i] = rgba[i * 4 + 1] / 255;
    out[2 * plane + i] = rgba[i * 4 + 2] / 255;
  }
  return out;
}

/**
 * YOLO11-pose single-class output [1, 13, N] → detections in the source
 * image's pixels. Channels: cx, cy, w, h, conf, then the 4 corners
 * (TL, TR, BR, BL) as x, y.
 * @returns {{ box: { cx, cy, w, h }, confidence: number, keypoints: number[][] }[]}
 */
export function decodePose(data, n, lb, confidence) {
  const { scale, padX, padY } = lb;
  const out = [];
  for (let i = 0; i < n; i++) {
    const conf = data[4 * n + i];
    if (conf < confidence) continue;
    const keypoints = [];
    for (let k = 0; k < 4; k++) {
      keypoints.push([(data[(5 + k * 2) * n + i] - padX) / scale, (data[(6 + k * 2) * n + i] - padY) / scale]);
    }
    out.push({
      box: {
        cx: (data[i] - padX) / scale,
        cy: (data[n + i] - padY) / scale,
        w: data[2 * n + i] / scale,
        h: data[3 * n + i] / scale,
      },
      confidence: conf,
      keypoints,
    });
  }
  return out;
}

/**
 * A point found on the picture turned by `deg` degrees clockwise (0, 90, 180,
 * 270) back in the original W × H picture.
 */
export function unrotatePoint([u, v], deg, W, H) {
  if (deg === 90) return [v, H - u];
  if (deg === 180) return [W - u, H - v];
  if (deg === 270) return [W - v, u];
  return [u, v];
}

/**
 * A detection made on the picture turned by `deg` back in the original
 * picture. The corners keep their labels (TL, TR, BR, BL of the CARD), so the
 * straightened crop comes out upright whatever the card's orientation.
 */
export function unrotateDetection(d, deg, W, H) {
  if (!deg) return d;
  const [cx, cy] = unrotatePoint([d.box.cx, d.box.cy], deg, W, H);
  const swap = deg !== 180;
  return {
    ...d,
    orientation: deg,
    box: { ...d.box, cx, cy, w: swap ? d.box.h : d.box.w, h: swap ? d.box.w : d.box.h },
    keypoints: d.keypoints?.map(p => unrotatePoint(p, deg, W, H)),
  };
}

/**
 * Photo mode, cards lying sideways or upside down (photo taken with the phone
 * flat): retry when the upright pass found few cards — none, or cards covering
 * less than `minCover` of the picture (0.6: measured on the real grids, model/MODELS.md).
 */
export function fewCards(dets, W, H, minCover = 0.6) {
  if (!dets.length) return true;
  const area = dets.reduce((s, d) => s + d.box.w * d.box.h, 0);
  return area / (W * H) < minCover;
}

/**
 * Detections of the 4 orientations ({ deg, dets } already put back in the
 * original picture) → one set of cards. Modes, measured end to end
 * (model/MODELS.md, 2026-11-14), on 200 cards of real grids / 6 897 simulated:
 *   'switch' (the app): the upright cards, unless a turned picture finds
 *     clearly more → 170 / 6 138 (as without retrying: 141 / 6 138);
 *   'best': the orientation finding the most, plus the others' cards in empty
 *     places → 186 / 6 102; 'upright' → 186 / 6 112; 'nms' → 186 / 6 095:
 *     turned pictures show the simulated cards (already turned up to 75°)
 *     at angles never learnt, and false frames appear.
 */
export function mergeOrientations(passes, iou = 0.45, mode = 'switch') {
  if (mode === 'switch') {
    // the upright cards, unless a turned picture finds clearly more cards
    // (≥ 2 more and ≥ 1.5 ×): then all the cards of that orientation
    const up = passes[0];
    let best = up;
    for (const p of passes.slice(1)) if (p.dets.length > best.dets.length) best = p;
    const clearly = best !== up && best.dets.length >= up.dets.length + 2 && best.dets.length >= 1.5 * up.dets.length;
    return clearly || (!up.dets.length && best.dets.length) ? { deg: best.deg, dets: best.dets } : { deg: 0, dets: up.dets };
  }
  if (mode === 'upright') {
    // the upright pass stays (all its cards); a turned pass replaces one of them
    // only with the same card found more surely, and adds cards in empty places
    const kept = [...passes[0].dets];
    const others = passes.slice(1).flatMap(p => p.dets).sort((a, b) => b.confidence - a.confidence);
    for (const d of others) {
      const k = kept.findIndex(x => boxIoU(d.box, x.box) > iou);
      if (k >= 0) { if (d.confidence > kept[k].confidence && !kept[k].turned) kept[k] = { ...d, turned: true }; continue; }
      if (!kept.some(x => boxCover(d.box, x.box) > 0.5 || boxIoU(d.box, x.box) > 0.1)) kept.push({ ...d, turned: true });
    }
    return { deg: null, dets: kept };
  }
  if (mode === 'nms') {
    // every orientation together: for each place, the most confident detection
    const all = passes.flatMap(p => p.dets).sort((a, b) => b.confidence - a.confidence);
    const kept = [];
    for (const d of all) if (!kept.some(k => boxIoU(d.box, k.box) > iou || boxCover(d.box, k.box) > 0.5)) kept.push(d);
    return { deg: null, dets: kept };
  }
  const score = p => p.dets.length + p.dets.reduce((s, d) => s + d.confidence, 0) / 1000;
  const best = [...passes].sort((a, b) => score(b) - score(a))[0];
  const kept = [...best.dets];
  const others = passes.filter(p => p !== best).flatMap(p => p.dets).sort((a, b) => b.confidence - a.confidence);
  // an added card must not cover a kept one either: a frame spanning two
  // cards of the grid overlaps each of them little (IoU) but contains them
  for (const d of others) if (!kept.some(k => boxIoU(d.box, k.box) > iou || boxCover(d.box, k.box) > 0.5)) kept.push(d);
  return { deg: best.deg, dets: kept };
}

/** Share of the smaller of two { cx, cy, w, h } boxes covered by the other one. */
export function boxCover(a, b) {
  const x1 = Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const y1 = Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  const x2 = Math.min(a.cx + a.w / 2, b.cx + b.w / 2);
  const y2 = Math.min(a.cy + a.h / 2, b.cy + b.h / 2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const small = Math.min(a.w * a.h, b.w * b.h);
  return small > 0 ? inter / small : 0;
}

/** Axis-aligned IoU of two { cx, cy, w, h } boxes. */
export function boxIoU(a, b) {
  const x1 = Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const y1 = Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  const x2 = Math.min(a.cx + a.w / 2, b.cx + b.w / 2);
  const y2 = Math.min(a.cy + a.h / 2, b.cy + b.h / 2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Non-maximum suppression: the most confident detection of each overlapping group. */
export function nms(dets, iou = 0.45) {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const d of sorted) if (!kept.some(k => boxIoU(d.box, k.box) > iou)) kept.push(d);
  return kept;
}
