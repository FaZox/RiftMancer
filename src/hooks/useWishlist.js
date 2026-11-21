/**
 * Wish list: cards you want, with the number of copies wanted.
 * One record per card (id "wish:<cardId>"), synced with the PC like the
 * collection. Removing a card keeps a deleted tombstone for the sync.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { loadWishlist, putWishlist, onExternalChange } from '../lib/collectionDB.js';

export default function useWishlist() {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);

  const reload = useCallback(async () => {
    try {
      const loaded = await loadWishlist();
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      itemsRef.current = loaded;
      setItems(loaded);
    } catch (err) {
      console.error('[Wishlist] Load failed:', err);
    }
  }, []);

  useEffect(() => { reload(); return onExternalChange(reload); }, [reload]);

  const byCard = useMemo(() => new Map(items.map(i => [i.cardId, i])), [items]);

  /** Set how many copies of a card you want (0 removes it from the list). */
  const setWanted = useCallback((cardId, quantity) => {
    const now = Date.now();
    const id = `wish:${cardId}`;
    const cur = itemsRef.current.find(i => i.id === id);
    const q = Math.max(0, quantity | 0);
    const rec = q === 0
      ? { ...(cur || { id, cardId, createdAt: now, quantity: 0 }), deleted: true, updatedAt: now }
      : { ...(cur || { id, cardId, createdAt: now }), quantity: q, deleted: false, updatedAt: now };
    const next = itemsRef.current.filter(i => i.id !== id);
    if (q > 0) next.push(rec);
    itemsRef.current = next;
    setItems(next);
    putWishlist([rec]).catch(err => console.error('[Wishlist] Save failed:', err));
  }, []);

  /** Price alert: notify when the Cardmarket price is at or below `maxPrice` (0/null = off). */
  const setMaxPrice = useCallback((cardId, maxPrice) => {
    const id = `wish:${cardId}`;
    const cur = itemsRef.current.find(i => i.id === id);
    if (!cur) return;
    const rec = { ...cur, maxPrice: maxPrice > 0 ? Math.round(maxPrice * 100) / 100 : null, updatedAt: Date.now() };
    const next = itemsRef.current.map(i => (i.id === id ? rec : i));
    itemsRef.current = next;
    setItems(next);
    putWishlist([rec]).catch(err => console.error('[Wishlist] Save failed:', err));
  }, []);

  return { items, byCard, setWanted, setMaxPrice };
}
