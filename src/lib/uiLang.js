/**
 * The app's language at start (i18n.js), without any dependency: the one
 * chosen in Réglages, else French when the phone / PC is in French, else
 * English. Also used by cardLocale.js for the default card language.
 */
export const LANG_KEY = 'rb.lang';
/** Card names and texts in French (cardLocale.js): follows the language when it changes. */
export const DISPLAY_FRENCH_KEY = 'rb.displayFrench';

export function detectLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch { /* storage unavailable */ }
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const first = String(nav?.languages?.[0] || nav?.language || '').toLowerCase();
  return first.startsWith('fr') ? 'fr' : 'en';
}
