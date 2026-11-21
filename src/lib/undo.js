/**
 * « Annuler » after a simple deletion (lot 6 a): instead of asking « Supprimer ? »,
 * delete at once and show the UndoBar for a few seconds. Any screen can offer
 * it; the app controller shows it (UndoBar).
 */
const subs = new Set();
export function offerUndo({ message, run }) {
  const u = { message, run, at: Date.now() };
  for (const fn of subs) fn(u);
  return u;
}
export function onUndo(fn) { subs.add(fn); return () => subs.delete(fn); }
