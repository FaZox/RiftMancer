// Adapted from OpenRift packages/shared/src/scan/edge-snap.ts and geometry.ts (AGPL-3.0)
// https://github.com/openriftapp/openrift, commit fb7f633c — Copyright Eiko Wagenknecht.
/**
 * Tightens a coarse card outline (the detector's 4 corners) onto the picture
 * (REPRODUIRE-SCANNER-OPENRIFT.md, A.2): each side moves to the strongest
 * nearby edge along its normal (24 points, 10 % skipped near the corners,
 * radius 4 % of the side, at least 3 px), outliers over 2 px from the median
 * are dropped, a line is refitted, and the corners become the intersections of
 * the refitted sides. A corner that would move too far keeps the whole outline
 * as it was. The pixel check (alignedVerify.js) compares fixed positions, so
 * the outline must be tight.
 *
 * gray: { data: Uint8Array, width, height }; quad: [[x, y] × 4] in order.
 */
const SAMPLES_PER_SIDE = 24;
const CORNER_SKIP = 0.1;
const RADIUS_FRACTION = 0.04;
const MIN_RADIUS = 3;
const OUTLIER_PX = 2;
const MAX_CORNER_SHIFT = 2;
const CORNER_SLACK_PX = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const upperMedian = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function intersectLines(first, second) {
  const cross = first.direction.x * second.direction.y - first.direction.y * second.direction.x;
  if (Math.abs(cross) < 1e-6) return null;
  const dx = second.point.x - first.point.x;
  const dy = second.point.y - first.point.y;
  const t = (dx * second.direction.y - dy * second.direction.x) / cross;
  return { x: first.point.x + first.direction.x * t, y: first.point.y + first.direction.y * t };
}

export function subPixelMinimum(before, at, after) {
  const curvature = before - 2 * at + after;
  if (!Number.isFinite(curvature) || curvature <= 0) return 0;
  return clamp((before - after) / (2 * curvature), -0.5, 0.5);
}

function sample(gray, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= gray.width || y0 + 1 >= gray.height) return NaN;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * gray.width + x0;
  const d = gray.data;
  const top = d[i] * (1 - fx) + d[i + 1] * fx;
  const bottom = d[i + gray.width] * (1 - fx) + d[i + gray.width + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

function fitSide(gray, a, b) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return null;
  const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const normal = { x: -direction.y, y: direction.x };
  const radius = Math.max(MIN_RADIUS, Math.round(length * RADIUS_FRACTION));
  const hits = [];
  for (let index = 0; index < SAMPLES_PER_SIDE; index++) {
    const t = CORNER_SKIP + ((1 - 2 * CORNER_SKIP) * index) / (SAMPLES_PER_SIDE - 1);
    const base = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const strengths = [];
    for (let offset = -radius - 1; offset <= radius + 1; offset++) {
      const before = sample(gray, base.x + normal.x * (offset - 1), base.y + normal.y * (offset - 1));
      const after = sample(gray, base.x + normal.x * (offset + 1), base.y + normal.y * (offset + 1));
      strengths.push(Math.abs(after - before));
    }
    let best = 0;
    let bestOffset = NaN;
    for (let step = 1; step < strengths.length - 1; step++) {
      const strength = strengths[step];
      if (strength > best) {
        best = strength;
        bestOffset = step - radius - 1 + subPixelMinimum(-strengths[step - 1], -strength, -strengths[step + 1]);
      }
    }
    if (Number.isFinite(bestOffset)) hits.push({ t, offset: bestOffset });
  }
  if (hits.length < SAMPLES_PER_SIDE / 2) return null;
  const median = upperMedian(hits.map(h => h.offset));
  const agreeing = hits.filter(h => Math.abs(h.offset - median) <= OUTLIER_PX);
  if (agreeing.length < SAMPLES_PER_SIDE / 2) return null;
  const n = agreeing.length;
  const meanT = agreeing.reduce((s, h) => s + h.t, 0) / n;
  const meanOffset = agreeing.reduce((s, h) => s + h.offset, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const h of agreeing) {
    covariance += (h.t - meanT) * (h.offset - meanOffset);
    variance += (h.t - meanT) ** 2;
  }
  const slope = variance > 0 ? covariance / variance : 0;
  const offsetAt = (t) => meanOffset + slope * (t - meanT);
  const start = { x: a.x + normal.x * offsetAt(0), y: a.y + normal.y * offsetAt(0) };
  const end = { x: b.x + normal.x * offsetAt(1), y: b.y + normal.y * offsetAt(1) };
  const fitted = Math.hypot(end.x - start.x, end.y - start.y);
  if (!(fitted > 1e-6)) return null;
  return { point: start, direction: { x: (end.x - start.x) / fitted, y: (end.y - start.y) / fitted } };
}

/** quad [[x, y] × 4] → the tightened quad (same format), or the same quad when a side cannot be fitted. */
export function snapQuadToEdges(gray, quad) {
  const pts = quad.map(([x, y]) => ({ x, y }));
  const lines = [];
  for (let side = 0; side < 4; side++) {
    const line = fitSide(gray, pts[side], pts[(side + 1) % 4]);
    if (!line) return quad;
    lines.push(line);
  }
  const snapped = pts.map((original, corner) => {
    const point = intersectLines(lines[(corner + 3) % 4], lines[corner]);
    const next = pts[(corner + 1) % 4];
    const side = Math.hypot(next.x - original.x, next.y - original.y);
    const maxShift = side * RADIUS_FRACTION * MAX_CORNER_SHIFT + CORNER_SLACK_PX;
    return point && Math.hypot(point.x - original.x, point.y - original.y) <= maxShift ? point : null;
  });
  return snapped.every(Boolean) ? snapped.map(p => [p.x, p.y]) : quad;
}
