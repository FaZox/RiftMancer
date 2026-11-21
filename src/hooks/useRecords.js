/**
 * Generic synced records (boxes, decks, people, loans): load, save, delete.
 * Deleting keeps a tombstone so the deletion reaches the other device.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { loadRecords, putRecords, onExternalChange, newId } from '../lib/collectionDB.js';

export default function useRecords(collection) {
  const [items, setItems] = useState([]);
  const ref = useRef(items);

  const reload = useCallback(async () => {
    try {
      const loaded = await loadRecords(collection);
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      ref.current = loaded;
      setItems(loaded);
    } catch (err) {
      console.error(`[${collection}] Load failed:`, err);
    }
  }, [collection]);

  useEffect(() => { reload(); return onExternalChange(reload); }, [reload]);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const write = useCallback((rec) => {
    const next = ref.current.filter(i => i.id !== rec.id);
    if (!rec.deleted) next.push(rec);
    next.sort((a, b) => a.createdAt - b.createdAt);
    ref.current = next;
    setItems(next);
    putRecords(collection, [rec]).catch(err => console.error(`[${collection}] Save failed:`, err));
    return rec;
  }, [collection]);

  /** Create (no id) or update (id) a record; returns the saved record. */
  const save = useCallback((fields) => {
    const now = Date.now();
    const cur = fields.id ? ref.current.find(i => i.id === fields.id) : null;
    return write({
      ...(cur || { id: newId(), createdAt: now }),
      ...fields,
      deleted: false,
      updatedAt: now,
    });
  }, [write]);

  const remove = useCallback((id) => {
    const cur = ref.current.find(i => i.id === id);
    if (cur) write({ ...cur, deleted: true, updatedAt: Date.now() });
  }, [write]);

  return { items, byId, save, remove };
}
