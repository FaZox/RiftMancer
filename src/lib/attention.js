/**
 * « Something to do » on the phone (B.3): a gold dot on the « Plus » tab and
 * on its « Réglages » line — the phone's equivalent of the PC's status zone:
 * changes waiting to be sent for longer than the reminder delay, the PC
 * offering its data, or a sync that failed.
 */
import { useEffect, useState } from 'react';
import { getSyncState, subscribeSync, syncAvailable } from './syncClient.js';
import { usePrefs } from './uiPrefs.js';
import { syncReminder } from './syncReminder.js';

export function needsAttention(s, prefs, now = Date.now()) {
  if (!s?.paired) return false;
  if (s.pcOffer || s.status === 'error') return true;
  return !!syncReminder({ paired: s.paired, pending: s.pending, pendingSince: s.pendingSince, now, days: prefs.syncReminderDays ?? 7, dismissedAt: null });
}

export function useNeedsAttention() {
  const [s, setS] = useState(getSyncState);
  const [prefs] = usePrefs();
  useEffect(() => subscribeSync(setS), []);
  return syncAvailable && needsAttention(s, prefs);
}
