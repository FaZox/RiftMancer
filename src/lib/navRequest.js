/**
 * « Go there and open that » from the global search (lot 6 e): a deck, a box,
 * a settings section. The page that can open it takes the request when it
 * shows (or at once if it is already shown).
 */
let pending = null;
const subs = new Set();

/** request({ kind: 'deck' | 'box' | 'person' | 'setting', id }) */
export function requestOpen(req) {
  pending = req;
  for (const fn of subs) fn(req);
}

/** The request of `kind`, removed once taken (null if none). */
export function takeRequest(kind) {
  if (pending?.kind !== kind) return null;
  const r = pending;
  pending = null;
  return r;
}

export function onRequest(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** The pending request, left in place. */
export const peekRequest = () => pending;
