/**
 * Price curves (card sheet, Value): the period shown (1, 3, 6 months or all)
 * and the line, on a time scale — the history has a point a day for the last
 * month and one a week before (priceBuilder.js thinHistory), so points are
 * placed by date, not one after the other. Pure functions (tests/priceChart.test.mjs);
 * drawn by components/common/PriceChart.jsx.
 */
const DAY = 86400000;

/** Periods of the curve: key, days (null = all of it). Labels in PriceChart.jsx. */
export const CHART_RANGES = [['1m', 31], ['3m', 92], ['6m', 183], ['all', null]];

const time = (d) => Date.parse(`${d}T00:00:00Z`);

/** The points of a period: [{ d: 'YYYY-MM-DD', v }] from `days` days before today. */
export function rangePoints(points, range, today = Date.now()) {
  const days = CHART_RANGES.find(([k]) => k === range)?.[1];
  const list = (points || []).filter(p => p?.v != null);
  if (!days) return list;
  const from = new Date(today - (days - 1) * DAY).toISOString().slice(0, 10);
  return list.filter(p => p.d >= from);
}

/** Does the history go back further than this period? (else the longer ones show the same curve) */
export function rangeFull(points, range, today = Date.now()) {
  const days = CHART_RANGES.find(([k]) => k === range)?.[1];
  if (!days || !points?.length) return true;
  return time(points[0].d) <= today - (days - 1) * DAY;
}

/**
 * Line of the curve in a 0–100 box (x by date, y by price, highest at the
 * top): { line, area, min, max, x(point), y(point) }. Null under two points.
 */
export function chartGeometry(points) {
  if (!points || points.length < 2) return null;
  const t0 = time(points[0].d); const t1 = time(points[points.length - 1].d);
  const tspan = t1 - t0 || 1;
  const vs = points.map(p => p.v);
  const min = Math.min(...vs); const max = Math.max(...vs);
  const span = max - min || 1;
  const x = (p) => ((time(p.d) - t0) / tspan) * 100;
  // a flat curve sits in the middle
  const y = (p) => (max === min ? 50 : 100 - ((p.v - min) / span) * 100);
  const r = (n) => Math.round(n * 100) / 100;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${r(x(p))},${r(y(p))}`).join(' ');
  return { line, area: `${line} L100,100 L0,100 Z`, min, max, x, y };
}

/** The point nearest to a position across the curve (0 to 1, left to right). */
export function nearestPoint(points, frac) {
  if (!points?.length) return null;
  const t0 = time(points[0].d); const t1 = time(points[points.length - 1].d);
  const t = t0 + Math.min(1, Math.max(0, frac)) * (t1 - t0);
  let best = points[0];
  for (const p of points) if (Math.abs(time(p.d) - t) < Math.abs(time(best.d) - t)) best = p;
  return best;
}

/** Change from the first to the last point of the period, in % (null when it cannot be told). */
export function rangeChange(points) {
  if (!points || points.length < 2 || !points[0].v) return null;
  return ((points[points.length - 1].v - points[0].v) / points[0].v) * 100;
}
