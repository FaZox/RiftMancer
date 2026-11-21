// Lot 6 / B.6.13: loading screen A « Forge hextech », lot 6 b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers.mjs';

const { splashPlan, arcProgress, SPLASH, SPLASH_CALM, GAUGE, leaveDelay, gaugeStart, gaugeAt, gaugeFinish, halfKeyframes } = await import('../src/lib/splashTiming.js');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('durations: a fixed 2.4 s from the launch so the whole animation plays, longer only if needed', () => {
  assert.deepEqual(SPLASH, { delay: 0, minShown: 2400, exit: 300 });
  assert.deepEqual(splashPlan(100), { showAt: 0, leaveAt: 2400, goneAt: 2700 }, 'a quick start still plays it all');
  assert.deepEqual(splashPlan(2000), { showAt: 0, leaveAt: 2400, goneAt: 2700 }, 'ready before the gauge waits: full at 2.4 s');
  assert.deepEqual(splashPlan(5000), { showAt: 0, leaveAt: 5350, goneAt: 5650 }, 'ready later: the gauge ends in 350 ms, then the screen leaves');
  assert.equal(leaveDelay(2300), 350);
});

test('calm (« Réduire les animations »): the former rule, nothing under 300 ms, 900 ms minimum', () => {
  assert.deepEqual(SPLASH_CALM, { delay: 300, minShown: 900, exit: 300 });
  assert.equal(splashPlan(250, SPLASH_CALM), null);
  assert.deepEqual(splashPlan(400, SPLASH_CALM), { showAt: 300, leaveAt: 1200, goneAt: 1500 });
});

test('the arc fills over the fixed time, never ahead of the real start-up', () => {
  assert.equal(arcProgress(1, 1200), 0.5, 'ready early: the arc takes its time');
  assert.equal(arcProgress(0.3, 2000), 0.3, 'slow start: the arc waits for the real progress');
  assert.equal(arcProgress(1, 3000), 1);
  assert.equal(arcProgress(1, -5), 0);
});

test('the gauge: steady pace, full at 2.4 s when ready, else waits near the end and ends once ready — never full before', () => {
  const start = gaugeStart();
  assert.equal(gaugeAt(start, 0), 0);
  assert.equal(Math.round(gaugeAt(start, 1200) * 100), 50, 'steady pace: half at 1.2 s');
  assert.equal(gaugeAt(start, 0.92 * 2400), GAUGE.hold);
  assert.ok(gaugeAt(start, 60000) < 1, 'never full while the app is loading');
  const early = gaugeFinish(start, 1000);
  assert.deepEqual(early.map(p => p.t), [1000, 2400], 'ready at 1 s: full at 2.4 s');
  assert.ok(Math.abs((1 - early[0].p) / 1.4 - early[0].p / 1.0) < 1e-9, 'same pace as before');
  const late = gaugeFinish(start, 5000);
  assert.equal(late[1].t, 5350);
  assert.ok(late[0].p > GAUGE.hold && late[0].p < GAUGE.creepTo, 'from where it stood: no jump');
  // the two half-rings: right one 0→180° up to ½, left one after, through the ½ crossing
  const k = halfKeyframes([{ t: 0, p: 0 }, { t: 2000, p: 1 }]);
  assert.equal(k.duration, 2000);
  assert.deepEqual(k.right.map(f => [f.offset, f.transform]), [[0, 'rotate(0deg)'], [0.5, 'rotate(180deg)'], [1, 'rotate(180deg)']]);
  assert.deepEqual(k.left.map(f => [f.offset, f.transform]), [[0, 'rotate(0deg)'], [0.5, 'rotate(0deg)'], [1, 'rotate(180deg)']]);
});

test('the arc follows the real start-up, no wait added in the app; same background as the native screens', () => {
  const splash = read('src/components/common/ForgeSplash.jsx');
  assert.match(splash, /strokeDashoffset: ARC \* \(1 - p\)/, 'arc = the progress given');
  assert.match(splash, /el\.current\.animate\(frames/, 'the gauge is animated by the browser, not redrawn by the app');
  assert.doesNotMatch(splash, /setInterval/, 'nothing redrawn on a timer while the phone loads');
  const gcss = read('src/styles/splash.css');
  assert.match(gcss, /\.forge \.gauge \.turn\{[^}]*will-change:transform/);
  for (const t of ['Ouverture de la collection…', 'Chargement des cartes…', 'Préparation du scanner…', 'Démarrage de la reconnaissance…']) assert.ok(splash.includes(t), t);
  const css = read('src/styles/splash.css');
  assert.doesNotMatch(css, /.arc{[^}]*animation/, 'the arc is never a timed loop');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.forge\.calm/);
  const ctrl = read('src/hooks/useAppController.js');
  assert.doesNotMatch(ctrl, /setTimeout\(r, 400\)/, 'the former 400 ms wait is gone');
  assert.match(read('capacitor.config.json'), /"backgroundColor": "#070d18"/);
  assert.match(read('electron/main.cjs'), /backgroundColor: '#070d18'/);
  assert.match(read('android/app/src/main/res/values/styles.xml'), /windowSplashScreenBackground">#070d18/);
});

test('lot 6 b: « restored » only when a « À ajouter » list was waiting', () => {
  const ctrl = read('src/hooks/useAppController.js');
  assert.match(ctrl, /const restoredCount = pendingCards\.length;/);
  assert.doesNotMatch(ctrl, /Session restaurée/);
});
