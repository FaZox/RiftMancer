/**
 * The short messages at the bottom of the screen (part of useAppController,
 * split in lot 11.5), and the summary shown after each price update (lot 9).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrices } from '../../lib/prices.js';
import { movements, summaryText, takeNewUpdate } from '../../lib/priceMoves.js';
import { getPrefs } from '../../lib/uiPrefs.js';
import { tx } from '../../lib/i18n.js';

export function useNotifications() {
  const [notification, setNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);
  const showNotificationRef = useRef(null);

  const showNotification = useCallback((message, type = 'info', ms = 2000) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, ms);
  }, []);
  showNotificationRef.current = showNotification;

  return { notification, setNotification, showNotification, showNotificationRef, notificationTimeoutRef };
}

/**
 * Lot 9: after each price update (once, not at every start), a summary of
 * the moves of your cards and of the wish list alerts (details in Valeur).
 * Returns the current prices.
 */
export function usePriceSummary({ ready, scannedCards, wishItems, showNotificationRef }) {
  const { prices: currentPrices } = usePrices();
  useEffect(() => {
    if (!currentPrices?.updatedAt || !ready) return;
    if (!takeNewUpdate(currentPrices.updatedAt)) return;
    const text = summaryText(movements(currentPrices, scannedCards, wishItems, getPrefs()));
    if (text) showNotificationRef.current?.(tx('Prix mis à jour : {text} (Valeur)', { text }), 'info', 5000);
  }, [currentPrices, scannedCards, wishItems, ready, showNotificationRef]);
  return currentPrices;
}
