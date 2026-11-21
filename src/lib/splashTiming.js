/**
 * Durations of the loading screen (B.6.13), as a plan.
 *
 * SPLASH (since 20/11/2026, the user's choice): a fixed time, so that the
 * whole animation always plays — shown at once, kept `minShown` ms (the intro
 * ends at 1.05 s, one sweep of the beam lasts 2.4 s), longer only if the app
 * needs it, then `exit` ms to leave.
 * SPLASH_CALM (« Réduire les animations » / prefers-reduced-motion): the
 * former rule — nothing if ready in under 300 ms, else at least 900 ms.
 * useSplashGate (ForgeSplash.jsx) applies the same rule in real time.
 */
export const SPLASH = { delay: 0, minShown: 2400, exit: 300 };
export const SPLASH_CALM = { delay: 300, minShown: 900, exit: 300 };

/**
 * The gold gauge (not calm): it must stay smooth on a phone busy loading the
 * models, so it is a rotation animated by the browser itself (Web Animations,
 * run by the compositor), planned once instead of redrawn by the app.
 *   - it fills at a steady pace and is full at `minShown` when the app is
 *     ready by then;
 *   - else it stops at `hold`, creeps slowly to `creepTo`, and once the app is
 *     ready it ends in `finishMs` — never a jump, never full before ready.
 */
export const GAUGE = { hold: 0.92, creepTo: 0.98, creepMs: 15000, finishMs: 350 };

/** Time (ms since the screen appeared) after which the app's readiness no longer lets the gauge end at `minShown`. */
const holdAt = ({ minShown } = SPLASH, g = GAUGE) => g.hold * minShown;

/** How long after « ready » (at `elapsedMs`) the screen starts leaving: the gauge is full by then. */
export function leaveDelay(elapsedMs, timing = SPLASH, g = GAUGE) {
  if (timing.delay > 0) return Math.max(0, timing.minShown - elapsedMs); // calm: the former rule
  return elapsedMs < holdAt(timing, g) ? timing.minShown - elapsedMs : Math.max(timing.minShown - elapsedMs, g.finishMs);
}

export function splashPlan(readyMs, timing = SPLASH) {
  const { delay, exit } = timing;
  if (delay > 0 && readyMs < delay) return null;
  const leaveAt = readyMs + leaveDelay(readyMs - delay, timing); // counted from when the screen appeared
  return { showAt: delay, leaveAt, goneAt: leaveAt + exit };
}

/**
 * The real progress capped by the time (calm screen and accessibility label):
 * fills over the fixed time, never ahead of the real start-up.
 */
export function arcProgress(progress, elapsedMs, { minShown } = SPLASH) {
  const real = Math.max(0, Math.min(1, progress));
  return minShown > 0 ? Math.min(real, Math.max(0, elapsedMs) / minShown) : real;
}

// ─── The gauge's path: points { t (ms since shown), p (0–1) }, linear between ───
export function gaugeStart({ minShown } = SPLASH, g = GAUGE) {
  const h = holdAt({ minShown }, g);
  return [{ t: 0, p: 0 }, { t: h, p: g.hold }, { t: h + g.creepMs, p: g.creepTo }];
}

export function gaugeAt(points, t) {
  if (t <= points[0].t) return points[0].p;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (t <= b.t) return a.p + ((b.p - a.p) * (t - a.t)) / (b.t - a.t);
  }
  return points[points.length - 1].p;
}

/** The app is ready at `t`: from where the gauge is, full at `minShown` (same pace) or in `finishMs`. */
export function gaugeFinish(points, t, { minShown } = SPLASH, g = GAUGE) {
  const p = gaugeAt(points, t);
  const end = t < holdAt({ minShown }, g) ? minShown : t + g.finishMs;
  return [{ t, p }, { t: end, p: 1 }];
}

/**
 * The two half-rings: the right one turns 0 → 180° while the gauge goes from
 * 0 to ½ (12 to 6 o'clock), the left one while it goes from ½ to 1.
 * Returns Web Animations keyframes for both, linear, over the path.
 */
export function halfKeyframes(points) {
  const pts = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if ((a.p - 0.5) * (b.p - 0.5) < 0) pts.push({ t: a.t + ((0.5 - a.p) * (b.t - a.t)) / (b.p - a.p), p: 0.5 });
    pts.push(b);
  }
  const start = pts[0].t;
  const duration = Math.max(1, pts[pts.length - 1].t - start);
  const frames = (angle) => pts.map(x => ({ offset: (x.t - start) / duration, transform: `rotate(${+angle(x.p).toFixed(2)}deg)` }));
  return {
    start, duration,
    right: frames(p => Math.min(p, 0.5) * 360),
    left: frames(p => Math.max(0, p - 0.5) * 360),
  };
}
