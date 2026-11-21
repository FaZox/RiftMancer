import React, { useEffect, useState } from 'react';
import Banner from '../common/Banner.jsx';
import { usePrefs } from '../../lib/uiPrefs.js';
import { getSyncState, subscribeSync, syncAvailable, syncNow } from '../../lib/syncClient.js';
import { reminderText, syncReminder } from '../../lib/syncReminder.js';import { tx } from '../../lib/i18n.js';


/**
 * Phone, Collection screen (lot 3.2, B.6.10): « 23 changements non envoyés au
 * PC depuis 9 jours » → « Synchroniser ». Closing it hides it for the delay
 * set in Réglages → Synchronisation.
 */
export default function SyncReminderBanner({ className = '' }) {
  const [prefs, setPrefs] = usePrefs();
  const [s, setS] = useState(getSyncState);
  useEffect(() => subscribeSync(setS), []);
  if (!syncAvailable) return null;
  const due = syncReminder({
    paired: s.paired, pending: s.pending, pendingSince: s.pendingSince,
    days: prefs.syncReminderDays ?? 7, dismissedAt: prefs.syncReminderDismissedAt,
  });
  if (!due) return null;
  const syncing = s.status === 'syncing';
  return (
    <Banner tone="warn" className={className}
      action={{ label: syncing ? 'Synchronisation…' : 'Synchroniser', onClick: () => { if (!syncing) syncNow('both').catch(() => {}); } }}
      onClose={() => setPrefs({ syncReminderDismissedAt: Date.now() })}>
      {reminderText(due)}
      {s.status === 'offline' && <span className="block text-[12px] text-rift-400">{tx('PC injoignable : téléphone et PC sur le même Wi-Fi, appli PC ouverte.')}</span>}
    </Banner>
  );
}
