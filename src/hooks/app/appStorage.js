/**
 * What the app keeps between two launches outside the database (part of
 * useAppController, split in lot 11.5): the « À ajouter » list and the values
 * given to the cards just scanned, in localStorage, saved at each change and
 * again when the app is hidden or closed.
 */
import { useEffect } from 'react';

export const STORAGE_KEYS = {
  PENDING_CARDS: 'riftbound_pending_cards',
  BATCH_DEFAULTS: 'riftbound_batch_defaults',
};

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('[Storage] Failed to save:', err);
  }
}

export function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (err) {
    console.warn('[Storage] Failed to load:', err);
    return fallback;
  }
}

/** Saves the « À ajouter » list and the scan defaults: at each change, and when the app is hidden or closed. */
export function usePersistedScanState(pendingCards, batchDefaults) {
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PENDING_CARDS, pendingCards);
  }, [pendingCards]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.BATCH_DEFAULTS, batchDefaults);
  }, [batchDefaults]);

  // Force save on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveToStorage(STORAGE_KEYS.PENDING_CARDS, pendingCards);
        saveToStorage(STORAGE_KEYS.BATCH_DEFAULTS, batchDefaults);
      }
    };

    const handleBeforeUnload = () => {
      saveToStorage(STORAGE_KEYS.PENDING_CARDS, pendingCards);
      saveToStorage(STORAGE_KEYS.BATCH_DEFAULTS, batchDefaults);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [pendingCards, batchDefaults]);
}
