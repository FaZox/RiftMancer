/**
 * Collection state: per-copy records (IndexedDB) shown as stacks.
 *
 * The UI and the CSV exporters keep working with "stacks"
 * ({ key, cardData, quantity, language, foil, promo, condition, boxId,
 *    deckId, loanId, paid, copyIds }),
 * derived here from the copies. Every mutation writes only the copies it
 * touches, instead of re-serialising the whole collection.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { placePatch } from '../lib/binder.js';
import { getMatcher } from '../lib/cardMatcher.js';
import { loadCopies, putCopies, makeCopy, migrateLegacyCollection, onExternalChange } from '../lib/collectionDB.js';
import { migrateCopies } from '../lib/conditions.js';

/**
 * Copies still on the American condition scale (made before lot 1.3, or just
 * received from a device not yet updated) move to Cardmarket's; the change is
 * saved like an edit, so the sync carries it to the other devices.
 */
async function withCardmarketConditions(copies) {
  const changed = migrateCopies(copies);
  if (!changed.length) return copies;
  await (await import('../lib/localBackup.js')).backupBeforeMigration(); // lot 3.1
  await putCopies(changed);
  console.log(`[Collection] ${changed.length} copies moved to the Cardmarket condition scale`);
  const byId = new Map(changed.map(c => [c.id, c]));
  return copies.map(c => byId.get(c.id) || c);
}

export function stackKey(c) {
  // Copies in different places (box, deck, loan) are separate stacks.
  // Copies bought at different prices are separate stacks too.
  return `${c.cardId}|${c.language}|${c.foil ? 1 : 0}|${c.promo ? 1 : 0}|${c.condition}|${c.boxId || ''}|${c.deckId || ''}|${c.loanId || ''}|${c.paid || ''}|${c.paidAt || ''}`;
}

export default function useCollection() {
  const [copies, setCopiesState] = useState([]);
  const [ready, setReady] = useState(false);
  const copiesRef = useRef(copies);

  const commit = useCallback((next, changed) => {
    copiesRef.current = next;
    setCopiesState(next);
    putCopies(changed).catch(err => console.error('[Collection] Save failed:', err));
  }, []);

  /** Load from IndexedDB (call once the card catalog is ready). */
  const load = useCallback(async () => {
    try {
      await migrateLegacyCollection();
      const loaded = await withCardmarketConditions(await loadCopies());
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      copiesRef.current = loaded;
      setCopiesState(loaded);
    } catch (err) {
      console.error('[Collection] Load failed:', err);
    } finally {
      setReady(true);
    }
  }, []);

  // The sync (or the PC hub receiving phone changes) wrote new data → reload.
  useEffect(() => onExternalChange(async () => {
    try {
      const loaded = await withCardmarketConditions(await loadCopies());
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      copiesRef.current = loaded;
      setCopiesState(loaded);
    } catch (err) {
      console.error('[Collection] Reload failed:', err);
    }
  }), []);

  const stacks = useMemo(() => {
    const matcher = getMatcher();
    const byKey = new Map();
    for (const c of copies) {
      const key = stackKey(c);
      let s = byKey.get(key);
      if (!s) {
        const cardData = matcher.getCardData(c.cardId)
          || { id: c.cardId, name: c.cardId, collectorNumber: '' };
        s = {
          key,
          cardData,
          quantity: 0,
          language: c.language,
          foil: c.foil,
          promo: c.promo,
          condition: c.condition,
          boxId: c.boxId || null,
          deckId: c.deckId || null,
          loanId: c.loanId || null,
          paid: c.paid || null,
          paidAt: c.paidAt || null,
          scanTimestamp: c.createdAt,
          copyIds: [],
          slots: [], // [[page, pocket]] in a binder (binder.js)
        };
        byKey.set(key, s);
      }
      s.quantity++;
      s.copyIds.push(c.id);
      if (c.binderPage > 0) s.slots.push([c.binderPage, c.binderSlot || null]);
      if (c.createdAt > s.scanTimestamp) s.scanTimestamp = c.createdAt;
    }
    return [...byKey.values()];
  }, [copies]);

  const totalCopies = copies.length;

  /** Add copies: entries = [{ cardId, quantity, language, foil, promo, condition }]. */
  const addEntries = useCallback((entries) => {
    const now = Date.now();
    const added = [];
    for (const e of entries) {
      const qty = Math.max(1, e.quantity | 0);
      for (let i = 0; i < qty; i++) added.push(makeCopy(e, now));
    }
    if (added.length === 0) return [];
    commit([...copiesRef.current, ...added], added);
    return added;
  }, [commit]);

  /**
   * Apply an edited stack: attribute changes (language, foil, promo,
   * condition, card) go to all its copies; a quantity change adds copies or
   * marks the most recent ones as deleted.
   */
  const updateStack = useCallback((stack, next) => {
    const now = Date.now();
    const ids = new Set(stack.copyIds);
    const attrs = {
      cardId: next.cardData?.id ?? stack.cardData.id,
      language: next.language ?? stack.language,
      foil: !!(next.foil ?? stack.foil),
      promo: !!(next.promo ?? stack.promo),
      condition: next.condition ?? stack.condition,
      boxId: stack.boxId || null,
      deckId: stack.deckId || null,
      loanId: stack.loanId || null,
      paid: (next.paid !== undefined ? next.paid : stack.paid) || null,
      paidAt: (next.paidAt !== undefined ? next.paidAt : stack.paidAt) || null,
    };
    const targetQty = Math.max(0, (next.quantity ?? stack.quantity) | 0);

    const current = copiesRef.current;
    const members = current.filter(c => ids.has(c.id));
    const attrsChanged = members.some(c =>
      c.cardId !== attrs.cardId || c.language !== attrs.language || c.foil !== attrs.foil
      || c.promo !== attrs.promo || c.condition !== attrs.condition || (c.paid || null) !== attrs.paid
      || (c.paidAt || null) !== attrs.paidAt);

    // Keep the oldest copies, delete the newest ones when reducing.
    const keep = new Set(members.slice(0, targetQty).map(c => c.id));
    const changed = [];
    const remaining = [];
    for (const c of current) {
      if (!ids.has(c.id)) { remaining.push(c); continue; }
      if (!keep.has(c.id)) {
        changed.push({ ...c, deleted: true, updatedAt: now });
        continue;
      }
      if (attrsChanged) {
        const u = { ...c, ...attrs, updatedAt: now };
        changed.push(u);
        remaining.push(u);
      } else {
        remaining.push(c);
      }
    }
    const added = [];
    for (let i = members.length; i < targetQty; i++) added.push(makeCopy(attrs, now));
    if (changed.length === 0 && added.length === 0) return;
    commit([...remaining, ...added], [...changed, ...added]);
  }, [commit]);

  /** Delete every copy of a stack. Returns the removed copies (for « Annuler »). */
  const removeStack = useCallback((stack) => deleteCopiesRef.current(stack.copyIds), []);

  const clearAll = useCallback(() => {
    const now = Date.now();
    const removed = copiesRef.current;
    const changed = removed.map(c => ({ ...c, deleted: true, updatedAt: now }));
    commit([], changed);
    return removed;
  }, [commit]);

  /** « Annuler » a deletion: the copies come back (as a new change, so the sync follows). */
  const restoreCopies = useCallback((list) => {
    if (!list?.length) return;
    const now = Date.now();
    const back = list.map(c => ({ ...c, deleted: false, updatedAt: now }));
    const ids = new Set(back.map(c => c.id));
    commit([...copiesRef.current.filter(c => !ids.has(c.id)), ...back], back);
  }, [commit]);

  /** Apply a patch (e.g. { boxId, deckId, loanId }) to the given copies. */
  const patchCopies = useCallback((ids, patch) => {
    const set = ids instanceof Set ? ids : new Set(ids);
    if (set.size === 0) return;
    const now = Date.now();
    const changed = [];
    const next = copiesRef.current.map(c => {
      if (!set.has(c.id)) return c;
      // moved to another place: the binder page and pocket go (binder.js)
      const u = { ...placePatch(c, patch), updatedAt: now };
      changed.push(u);
      return u;
    });
    commit(next, changed);
  }, [commit]);

  /**
   * Move `quantity` copies of a stack to a place. A copy is in at most one
   * place: a box, a deck, or lent (loan). `place` = { boxId?, deckId?, loanId? }
   * (all null = no location).
   */
  const moveStack = useCallback((stack, quantity, place) => {
    const ids = stack.copyIds.slice(0, Math.max(0, quantity | 0));
    patchCopies(ids, { boxId: place.boxId || null, deckId: place.deckId || null, loanId: place.loanId || null });
  }, [patchCopies]);

  /** Delete the given copies (kept as tombstones for the sync). */
  const deleteCopies = useCallback((ids) => {
    const set = ids instanceof Set ? ids : new Set(ids);
    if (set.size === 0) return [];
    const now = Date.now();
    const changed = [];
    const removed = [];
    const next = [];
    for (const c of copiesRef.current) {
      if (set.has(c.id)) { removed.push(c); changed.push({ ...c, deleted: true, updatedAt: now }); } else next.push(c);
    }
    commit(next, changed);
    return removed;
  }, [commit]);
  const deleteCopiesRef = useRef(deleteCopies);
  deleteCopiesRef.current = deleteCopies;

  /** Copies whose `field` (boxId / deckId / loanId) equals `id` lose that location. */
  const clearLocation = useCallback((field, id) => {
    const ids = copiesRef.current.filter(c => c[field] === id).map(c => c.id);
    patchCopies(ids, { [field]: null });
  }, [patchCopies]);

  return {
    ready, load, copies, stacks, totalCopies, addEntries, updateStack, removeStack, clearAll,
    patchCopies, moveStack, clearLocation, deleteCopies, restoreCopies,
  };
}
