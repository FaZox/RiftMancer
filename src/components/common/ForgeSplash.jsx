import React, { useEffect, useRef, useState } from 'react';
import '../../styles/splash.css';
import { APP_VERSION } from '../../lib/appVersion.js';
import { getPrefs } from '../../lib/uiPrefs.js';
import { SPLASH, SPLASH_CALM, leaveDelay, gaugeStart, gaugeFinish, halfKeyframes } from '../../lib/splashTiming.js';
import { tx } from '../../lib/i18n.js';

/**
 * Loading screen, proposal A « Forge hextech » (B.6.13, chosen 18/11/2026;
 * mockups pc-15 / tel-18, docs/maquettes/splash.css). CSS and SVG only.
 *   - the gold gauge (Gauge below) is two half-rings turned by the browser
 *     itself, so it stays smooth while the phone loads the models: full at
 *     2.4 s when the app is ready by then, else it waits near the end and
 *     finishes once the app is ready (splashTiming.js); the step text is the
 *     real step. Calm: a still arc that shows the real progress;
 *   - the hexagon is already there (same as Android's native launch screen,
 *     so the passage is invisible), its fill and the scan frame come in once;
 *   - rings, sparks, beam and background turn while waiting; « Réduire les
 *     animations » / prefers-reduced-motion: still emblem, progress only;
 *   - durations: useSplashGate.
 */
export const STAGE_TEXT = {
  db: tx('Ouverture de la collection…'),
  collection: tx('Ouverture de la collection…'),
  model: tx('Préparation du scanner…'),
  matcher: tx('Chargement des cartes…'),
  ai: tx('Démarrage de la reconnaissance…'),
  ready: tx('Démarrage de la reconnaissance…'),
};
const ARC = 930; // circumference of r = 148
const SPARKS = [[-120, 0], [-70, 0.7], [-30, 1.9], [20, 0.3], [64, 1.3], [110, 2.4], [-96, 2.9], [86, 3.2], [0, 1.1], [140, 0.9]];
const HEX = '170,82 246,126 246,214 170,258 94,214 94,126';

const isCalm = () => !getPrefs().cardAnimations || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export default function ForgeSplash({ progress = 0, stage = 'db', leaving = false, pc = false, ready = false }) {
  const calm = isCalm();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className={`forge ${pc ? '' : 'ph'} ${calm ? 'calm' : ''} ${leaving ? 'leaving' : ''}`} role="status" aria-label={tx('Chargement : {v0}', { v0: STAGE_TEXT[stage] || STAGE_TEXT.db })}>
      {!calm && SPARKS.map(([x, d], i) => <i key={i} className="spark" style={{ '--x': `${x}px`, animationDelay: `${d}s` }} />)}
      <div className="emblem">
        <svg viewBox="0 0 340 340" aria-hidden="true">
          <g className="ring1">
            <circle cx="170" cy="170" r="164" fill="none" stroke="#c8a84e" strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 10" />
            {[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x="167" y="6" width="6" height="14" fill="#e8c973" transform={`rotate(${a} 170 170)`} />)}
          </g>
          <g className="ring2"><circle cx="170" cy="170" r="132" fill="none" stroke="#8fb8e8" strokeOpacity=".3" strokeWidth="1" strokeDasharray="60 14 6 14" /></g>
          <circle cx="170" cy="170" r="148" fill="none" stroke="#2a3a55" strokeWidth="3" />
          {calm && (
            <circle className="arc" cx="170" cy="170" r="148" fill="none" stroke="#e8c973" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={ARC} style={{ strokeDashoffset: ARC * (1 - p) }} />
          )}
          <polygon className="hexfill" points={HEX} fill="rgba(200,168,78,.16)" />
          <polygon className="hexline" points={HEX} fill="none" stroke="#e8c973" strokeWidth="4" strokeLinejoin="round" />
          <g className="frame" fill="none" stroke="#f3dc9a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M134 152v-18h18M188 134h18v18M206 188v18h-18M152 206h-18v-18" />
            <path className="beam" d="M128 170h84" stroke="#fff3c4" />
          </g>
        </svg>
        {!calm && <Gauge ready={ready} />}
      </div>
      <div className="name">{tx('RIFTMANCER')}</div>
      <div className="status" key={stage}>{STAGE_TEXT[stage] || STAGE_TEXT.db}</div>
      <div className="ver">v{APP_VERSION}</div>
    </div>
  );
}

/**
 * The gold gauge, smooth even while the phone is busy: two half-rings whose
 * rotation is planned once (Web Animations, run by the compositor) — the app
 * only steps in when it is ready, to plan the end (splashTiming.js).
 */
function Gauge({ ready }) {
  const right = useRef(null);
  const left = useRef(null);
  const t0 = useRef(null);
  const plan = useRef(null);
  const anims = useRef([]);
  const play = (points) => {
    const now = performance.now() - t0.current;
    anims.current.forEach(a => a.cancel());
    const k = halfKeyframes(points);
    anims.current = [[right, k.right], [left, k.left]].map(([el, frames]) => {
      if (!el.current?.animate) { el.current?.style.setProperty('transform', frames[frames.length - 1].transform); return { cancel() {} }; }
      return el.current.animate(frames, { duration: k.duration, delay: k.start - now, fill: 'both', easing: 'linear' });
    });
    plan.current = points;
  };
  useEffect(() => {
    t0.current = performance.now();
    play(gaugeStart());
    const list = anims;
    return () => list.current.forEach(a => a.cancel());
  }, []);
  useEffect(() => {
    if (ready && plan.current && plan.current[plan.current.length - 1].p < 1) play(gaugeFinish(plan.current, performance.now() - t0.current));
  }, [ready]);
  return (
    <div className="gauge" aria-hidden="true">
      <div className="side r"><div className="turn" ref={right}><div className="half"><div className="ring" /></div></div></div>
      <div className="side l"><div className="turn" ref={left}><div className="half"><div className="ring" /></div></div></div>
    </div>
  );
}

/**
 * When to show the loading screen (splashTiming.js): a fixed time from the
 * launch so that the whole animation plays (2.4 s, longer only if the app
 * needs it), then a 300 ms exit over the app. Calm: the former rule (nothing
 * under 300 ms, else 900 ms). Returns 'blank' (calm, first 300 ms: the
 * background only) | 'splash' | 'leaving' | 'gone', and the time shown.
 */
export function useSplashGate(isLoading, timing = SPLASH) {
  const { delay, minShown, exit } = timing;
  const [phase, setPhase] = useState(isLoading ? (delay > 0 ? 'blank' : 'splash') : 'gone');
  const shownAt = useRef(isLoading && delay === 0 ? Date.now() : null);
  useEffect(() => {
    if (!isLoading || shownAt.current != null) return undefined;
    const t = setTimeout(() => { shownAt.current = Date.now(); setPhase('splash'); }, delay);
    return () => clearTimeout(t);
  }, [isLoading, delay]);
  useEffect(() => {
    if (isLoading) return undefined;
    if (shownAt.current == null) { setPhase('gone'); return undefined; }
    const wait = leaveDelay(Date.now() - shownAt.current, timing); // the gauge is full by then
    const timers = [
      setTimeout(() => setPhase('leaving'), wait),
      setTimeout(() => setPhase('gone'), wait + exit),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isLoading, minShown, exit, timing]);
  return { phase, shownAt };
}

/** Start-up of the app: the splash while loading, then the app under the leaving splash. */
export function SplashGate({ isLoading, progress, stage, pc = false, children }) {
  const [timing] = useState(() => (isCalm() ? SPLASH_CALM : SPLASH));
  // Nothing redrawn by the app while it loads: the gauge animates itself (Gauge); calm: the real progress
  const { phase } = useSplashGate(isLoading, timing);
  // The splash keeps the same place in the tree while loading and after, so
  // that it is never remounted: its intro must not start again when the app is ready.
  const up = isLoading ? phase !== 'blank' : phase === 'splash' || phase === 'leaving';
  const leaving = !isLoading && phase === 'leaving';
  return (
    <>
      {isLoading ? (phase === 'blank' && <div className="h-[100dvh] bg-[#070d18]" />) : children}
      {up && <ForgeSplash progress={isLoading ? progress : 1} stage={isLoading ? stage : 'ready'} pc={pc} leaving={leaving} ready={!isLoading} />}
    </>
  );
}
