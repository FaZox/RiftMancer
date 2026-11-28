/**
 * Booster pictures of the sets (public/sets/<code>.webp). Like the card pictures
 * they stay out of the public repository: setImage() answers null for a set
 * whose file is missing (the screens then draw the hexagonal emblem with the code).
 * Probed once at startup (initSetImages), like src/lib/symbols.js.
 */
export const SET_IMAGE_CODES = ['ogn', 'rad', 'sfd', 'unl', 'ven'];

const available = new Set();
let checking = null;

const probe = (code) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve([code, img.naturalWidth > 0]);
  img.onerror = () => resolve([code, false]);
  img.src = `/sets/${code}.webp`;
});

/** Checks once which booster files exist (any set code: a file added later is found at the next start). */
export function initSetImages(codes = SET_IMAGE_CODES) {
  if (checking || typeof Image === 'undefined') return checking;
  checking = Promise.all(codes.map(probe)).then((entries) => {
    for (const [code, ok] of entries) if (ok) available.add(code);
    return available.size;
  });
  return checking;
}

/** '/sets/ogn.webp' when the picture exists, else null. */
export function setImage(code) {
  const c = String(code || '').toLowerCase();
  return available.has(c) ? `/sets/${c}.webp` : null;
}
