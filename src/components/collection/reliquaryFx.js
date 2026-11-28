/**
 * Effects of the « Reliquaire » card sheet (Web Animations API, transform / opacity / filter only).
 * Every function resolves at once when animations are off (rf-calm, reduced motion) — src/lib/motion.js.
 */
import { motionOk } from '../../lib/motion.js';

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const done = (a) => (a ? a.finished.catch(() => {}) : Promise.resolve());

/** Flight (FLIP) of the card from the thumbnail it was opened from to the altar. */
export function flyIn(el, fromRect) {
  if (!motionOk() || !el || !fromRect || typeof el.animate !== 'function') return Promise.resolve();
  const to = el.getBoundingClientRect();
  if (!to.width || !fromRect.width) return Promise.resolve();
  const dx = fromRect.left + fromRect.width / 2 - (to.left + to.width / 2);
  const dy = fromRect.top + fromRect.height / 2 - (to.top + to.height / 2);
  const s = fromRect.width / to.width;
  return done(el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-6deg)` },
    { transform: 'none' },
  ], { duration: 520, easing: EASE }));
}

/** Pops the hexagons one after the other (450 ms, 70 ms apart, from 300 ms). */
export function popHexes(els) {
  if (!motionOk()) return Promise.resolve();
  return Promise.all(els.filter(Boolean).map((el, i) => done(el.animate(
    [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: 450, delay: 300 + i * 70, easing: EASE, fill: 'backwards' },
  ))));
}

/** « Portail » out: a golden ring turns while the old card is sucked into it. */
export function portalOut(card, ring, dir = 1) {
  if (!motionOk() || !card) return Promise.resolve();
  const anims = [done(card.animate([
    { transform: 'scale(1) rotate(0)', clipPath: 'circle(75%)', filter: 'brightness(1)', opacity: 1 },
    { transform: `scale(.15) rotate(${dir * 200}deg)`, clipPath: 'circle(20%)', filter: 'brightness(2.5)', opacity: 0 },
  ], { duration: 380, easing: 'ease-in', fill: 'forwards' }))];
  if (ring) anims.push(done(ring.animate([
    { transform: 'scale(.4) rotate(0)', opacity: 0 },
    { opacity: 1, offset: 0.25 },
    { opacity: 1, offset: 0.7 },
    { transform: 'scale(1) rotate(360deg)', opacity: 0 },
  ], { duration: 900, easing: 'ease-in-out' })));
  return anims[0];
}

/** « Portail » in: the new card springs out of the ring. */
export function portalIn(card, dir = 1) {
  if (!card || typeof card.animate !== 'function') return Promise.resolve();
  card.getAnimations().forEach(a => a.cancel());
  if (!motionOk()) return Promise.resolve();
  return done(card.animate([
    { transform: `scale(.15) rotate(${-dir * 200}deg)`, clipPath: 'circle(20%)', filter: 'brightness(2.5)', opacity: 0 },
    { transform: 'scale(1.06) rotate(0)', clipPath: 'circle(75%)', filter: 'brightness(1.2)', opacity: 1, offset: 0.8 },
    { transform: 'scale(1) rotate(0)', clipPath: 'circle(75%)', filter: 'brightness(1)', opacity: 1 },
  ], { duration: 460, easing: EASE }));
}

/** The hexagons make a half-turn (the value changes in the middle), 55 ms apart. */
export function flipHexes(els, half) {
  els.forEach(el => el?.getAnimations?.().forEach(a => { if (half === 'in') a.cancel(); })); // drop the held half-turn of the « out » phase
  if (!motionOk()) return Promise.resolve();
  const frames = half === 'out' ? [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }] : [{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }];
  return Promise.all(els.filter(Boolean).map((el, i) => done(el.animate(frames, { duration: 210, delay: i * 55, easing: 'ease-in-out', fill: half === 'out' ? 'forwards' : 'none' }))));
}

/** The dossier slides out / in by 30 px in the direction of the navigation. */
export function slideDossier(el, half, dir = 1) {
  if (!motionOk() || !el) return Promise.resolve();
  const frames = half === 'out'
    ? [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 30}px)`, opacity: 0 }]
    : [{ transform: `translateX(${dir * 30}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }];
  return done(el.animate(frames, { duration: half === 'out' ? 170 : 300, easing: 'ease-out', fill: half === 'out' ? 'forwards' : 'none' }));
}

/** Pivot (rotateY) of the card when another printing is picked, without leaving the sheet. */
export async function pivot(el, swap) {
  if (!motionOk() || !el) { swap(); return; }
  await done(el.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }));
  swap();
  el.getAnimations().forEach(a => a.cancel());
  await done(el.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 260, easing: EASE }));
}

/** `count` mini cards fly in an arc from `fromRect` to `toRect` (the badge of the « Ma collection » tab). */
export function flyCopies(src, count, fromRect, toRect) {
  if (!motionOk() || !fromRect || !toRect) return Promise.resolve();
  const n = Math.min(count, 8);
  const all = [];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('img');
    el.src = src; el.alt = ''; el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'fixed', left: `${fromRect.left + fromRect.width / 2 - 22}px`, top: `${fromRect.top + fromRect.height / 2 - 31}px`, width: '44px', height: '62px', objectFit: 'cover', zIndex: 120, pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,.6)' });
    document.body.appendChild(el);
    const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
    all.push(done(el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(.8) rotate(${(i - n / 2) * 14}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.2) rotate(0)`, opacity: 0.2 },
    ], { duration: 700, delay: i * 90, easing: 'ease-in-out', fill: 'both' })).then(() => el.remove()));
  }
  return Promise.all(all);
}
