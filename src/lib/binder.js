/**
 * Binders (scanner « Grille », step 3): a box whose copies also know their
 * page and pocket — « Classeur rouge · p. 4, case 7 ». Fields of a copy
 * (collectionDB.makeCopy): binderPage (1…), binderSlot (1…, reading order),
 * binderCols (pockets per row on that page, 3 or 4). Only with a boxId; a
 * copy moved to another place loses them. Pure: tests/binder.test.mjs.
 */

export const BINDER_FIELDS = ['binderPage', 'binderSlot', 'binderCols'];

/** « p. 4, case 7 » (or « p. 4 » without a pocket). */
export function slotLabel(page, slot) {
  return slot ? `p. ${page}, case ${slot}` : `p. ${page}`;
}

/** The page / pocket of a copy, or null. */
export function binderSlotOf(copy) {
  return copy?.boxId && copy.binderPage > 0 ? { page: copy.binderPage, slot: copy.binderSlot || null } : null;
}

/**
 * Where the copies of a stack are in the binder: « p. 4, case 7 »,
 * « p. 4, cases 2 et 7 », « p. 4, case 7 · p. 6, case 1 », at most 3 then « + 2 ».
 * slots: [[page, slot], …].
 */
export function slotsLabel(slots) {
  if (!slots?.length) return '';
  const byPage = new Map();
  for (const [page, slot] of slots) {
    if (!(page > 0)) continue;
    if (!byPage.has(page)) byPage.set(page, new Set());
    if (slot) byPage.get(page).add(slot);
  }
  const parts = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, set]) => {
    const s = [...set].sort((a, b) => a - b);
    if (!s.length) return `p. ${page}`;
    if (s.length === 1) return `p. ${page}, case ${s[0]}`;
    return `p. ${page}, cases ${s.slice(0, -1).join(', ')} et ${s[s.length - 1]}`;
  });
  return parts.length > 3 ? `${parts.slice(0, 3).join(' · ')} + ${parts.length - 3}` : parts.join(' · ');
}

/** The page after the last one used in this box (1 for an empty binder). */
export function nextBinderPage(copies, boxId) {
  let max = 0;
  for (const c of copies || []) if (!c.deleted && c.boxId === boxId && c.binderPage > max) max = c.binderPage;
  return max + 1;
}

/** Copies already recorded on that page of that box (a page taken twice). */
export function pageCount(copies, boxId, page) {
  let n = 0;
  for (const c of copies || []) if (!c.deleted && c.boxId === boxId && c.binderPage === page) n++;
  return n;
}

/**
 * A copy after a place change (patchCopies): moved to another box, a deck or
 * lent, it loses its page and pocket.
 */
export function placePatch(copy, patch) {
  const next = { ...copy, ...patch };
  const leaves = ('boxId' in patch && (patch.boxId || null) !== (copy.boxId || null))
    || (patch.deckId && patch.deckId !== copy.deckId) || (patch.loanId && patch.loanId !== copy.loanId);
  if (leaves && BINDER_FIELDS.some(k => copy[k] != null)) for (const k of BINDER_FIELDS) next[k] = null;
  return next;
}

/**
 * The pages of a binder, for the box screen: [{ page, cols, cells: [{ slot, copies }] }]
 * (every pocket of the page, empty ones too) + the copies without a page.
 */
export function binderPages(copies) {
  const pages = new Map();
  const loose = [];
  for (const c of copies) {
    if (!(c.binderPage > 0) || !(c.binderSlot > 0)) { loose.push(c); continue; }
    let p = pages.get(c.binderPage);
    if (!p) { p = { page: c.binderPage, colsVotes: new Map(), bySlot: new Map() }; pages.set(c.binderPage, p); }
    const cols = c.binderCols > 0 ? c.binderCols : 3;
    p.colsVotes.set(cols, (p.colsVotes.get(cols) || 0) + 1);
    if (!p.bySlot.has(c.binderSlot)) p.bySlot.set(c.binderSlot, []);
    p.bySlot.get(c.binderSlot).push(c);
  }
  const out = [...pages.values()].sort((a, b) => a.page - b.page).map(p => {
    const cols = [...p.colsVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const maxSlot = Math.max(...p.bySlot.keys());
    const size = Math.max(cols * 3, Math.ceil(maxSlot / cols) * cols);
    const cells = Array.from({ length: size }, (_, i) => ({ slot: i + 1, copies: p.bySlot.get(i + 1) || [] }));
    return { page: p.page, cols, cells };
  });
  return { pages: out, loose };
}
