// CORRECTIONS-v3 A.2: the Electron shipped in the PC app must stay maintained and up to date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { electronStatus } from '../scripts/lib/electronCheck.mjs';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const day = (n) => new Date(NOW - n * 86400000).toISOString();
const time = {
  created: day(4000), modified: day(1),
  '42.9.0': day(200), '43.5.0': day(120), '44.6.1': day(60), '45.0.0-beta.3': day(90),
  '45.2.3': day(16), '45.3.0': day(10), '45.4.1': day(1),
};

test('up to date, or a newer patch out for less than 30 days → fine', () => {
  assert.deepEqual(electronStatus({ installed: '45.4.1', time, now: NOW }), { ok: true, problems: [], latest: '45.4.1', behindDays: 0 });
  const s = electronStatus({ installed: '45.2.3', time, now: NOW });
  assert.equal(s.ok, true);
  assert.equal(s.latest, '45.4.1');
  assert.equal(s.behindDays, 10, 'counted from the first newer patch');
});

test('more than 30 days behind the latest patch of the same major → fails', () => {
  const late = { ...time, '45.3.0': day(40) };
  const s = electronStatus({ installed: '45.2.3', time: late, now: NOW });
  assert.equal(s.ok, false);
  assert.match(s.problems[0], /40 jours de retard : 45\.4\.1/);
});

test('a major no longer among the 3 latest → fails; betas and tags ignored', () => {
  const s = electronStatus({ installed: '42.9.0', time, now: NOW });
  assert.equal(s.ok, false);
  assert.match(s.problems[0], /plus maintenu \(versions maintenues : 45, 44, 43\)/);
  assert.equal(electronStatus({ installed: '43.5.0', time, now: NOW }).ok, true);
  assert.equal(electronStatus({ installed: 'x', time, now: NOW }).ok, false);
});
