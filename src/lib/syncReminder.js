/**
 * « N changements non envoyés au PC depuis X jours » (lot 3.2, B.6.10): shown
 * on the phone's Collection screen when changes have been waiting longer than
 * the delay set in Réglages → Synchronisation (7 days by default). Closing it
 * hides it for the same delay.
 */
export const REMINDER_DAYS = [3, 7, 14, 30];
export const DEFAULT_REMINDER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** { count, days } when the reminder is due, else null. `days` 0 = reminder off. */
export function syncReminder({ paired, pending, pendingSince, now = Date.now(), days = DEFAULT_REMINDER_DAYS, dismissedAt = null }) {
  if (!paired || !days || !(pending > 0) || !pendingSince) return null;
  const waited = now - pendingSince;
  if (waited < days * DAY) return null;
  if (dismissedAt && now - dismissedAt < days * DAY) return null;
  return { count: pending, days: Math.floor(waited / DAY) };
}

export function reminderText({ count, days }) {
  const s = (n) => (n > 1 ? 's' : '');
  return `${count} changement${s(count)} non envoyé${s(count)} au PC depuis ${days} jour${s(days)}.`;
}
