/**
 * Are animations allowed? Off when Réglages → « Animations des cartes » is off (class rf-calm
 * on <html>, src/lib/uiPrefs.js) or when the system asks for reduced motion.
 * Every effect of the PC redesign (flight, portal, carousel, dust, tilt, waves) checks this.
 */
export function motionOk() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('rf-calm')) return false;
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

/** Web Animations API wrapper: runs `keyframes` on `el` and resolves when done (at once when motion is off or unsupported). */
export function animate(el, keyframes, options) {
  if (!el || !motionOk() || typeof el.animate !== 'function') return Promise.resolve();
  const a = el.animate(keyframes, options);
  return a.finished.catch(() => {});
}
