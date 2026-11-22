// Price curves: periods (1, 3, 6 months, all), time scale, point under the finger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangePoints, rangeFull, chartGeometry, nearestPoint, rangeChange, CHART_RANGES } from '../src/lib/priceChart.js';

const TODAY = Date.parse('2026-11-22T12:00:00Z');
const ago = (n) => new Date(TODAY - n * 86400000).toISOString().slice(0, 10);
// a point a week for half a year, then every day of the last month (as the history keeps them)
const pts = [...Array.from({ length: 22 }, (_, i) => ({ d: ago(180 - i * 7), v: 10 + i })), ...Array.from({ length: 31 }, (_, i) => ({ d: ago(30 - i), v: 40 + i }))];

test('the periods keep the points of their last days', () => {
  assert.deepEqual(CHART_RANGES.map(([k]) => k), ['1m', '3m', '6m', 'all']);
  assert.equal(rangePoints(pts, '1m', TODAY).length, 31);
  assert.equal(rangePoints(pts, '1m', TODAY)[0].d, ago(30));
  assert.ok(rangePoints(pts, '3m', TODAY).every(p => p.d >= ago(91)));
  assert.equal(rangePoints(pts, 'all', TODAY).length, pts.length);
  assert.equal(rangePoints([{ d: ago(1), v: null }, { d: ago(0), v: 2 }], 'all', TODAY).length, 1); // days without a price
  // the history covers 6 months, not more
  assert.equal(rangeFull(pts, '6m', TODAY), false);
  assert.equal(rangeFull(pts, '3m', TODAY), true);
  assert.equal(rangeFull(pts, 'all', TODAY), true);
});

test('points are placed by date, the highest price at the top', () => {
  const p = [{ d: '2026-01-01', v: 1 }, { d: '2026-01-02', v: 3 }, { d: '2026-01-11', v: 2 }];
  const g = chartGeometry(p);
  assert.equal(g.x(p[1]), 10); // 1 day out of 10, not halfway
  assert.equal(g.y(p[1]), 0);
  assert.equal(g.y(p[0]), 100);
  assert.equal(g.line, 'M0,100 L10,0 L100,50');
  assert.deepEqual([g.min, g.max], [1, 3]);
  assert.equal(chartGeometry([p[0]]), null);
  assert.equal(chartGeometry([{ d: '2026-01-01', v: 2 }, { d: '2026-01-02', v: 2 }]).y({ v: 2 }), 50); // flat: in the middle
});

test('the point under the finger and the change over the period', () => {
  const p = [{ d: '2026-01-01', v: 1 }, { d: '2026-01-02', v: 3 }, { d: '2026-01-11', v: 2 }];
  assert.equal(nearestPoint(p, 0).d, '2026-01-01');
  assert.equal(nearestPoint(p, 0.12).d, '2026-01-02');
  assert.equal(nearestPoint(p, 0.9).d, '2026-01-11');
  assert.equal(nearestPoint(p, 7).d, '2026-01-11');
  assert.equal(rangeChange(p), 100);
  assert.equal(rangeChange([p[0]]), null);
});
