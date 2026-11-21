/**
 * Language of the app (interface): English by default, French to choose
 * (Réglages → Affichage). First launch: French when the phone / PC is set in
 * French, English otherwise.
 *
 * The texts stay written in French in the code and are the keys:
 *   tx('Ajouter à la collection')            → « Add to collection » in English
 *   tx('{n} cartes ajoutées', { n: 3 })      → « 3 cards added »
 *   tp(n, '{n} carte', '{n} cartes')         → singular / plural by language
 * The English texts are in src/i18n/en.js (tests/i18n.test.mjs: none missing).
 * Changing the language reloads the app: every text, constants included, is
 * read again in the new language. Card names and texts follow the language
 * (cardLocale, same stored key), the « Affichage » option still changes them.
 * Leaf module (imports only en.js and uiLang.js): any file may import it.
 */
import EN from '../i18n/en.js';
import { detectLang, LANG_KEY, DISPLAY_FRENCH_KEY } from './uiLang.js';

export const LANGUAGES = [['en', 'English'], ['fr', 'Français']];

let lang = detectLang();
if (typeof document !== 'undefined') document.documentElement.lang = lang;
// PC app: its own dialogs and messages follow the language too (electron/i18n.cjs)
try { globalThis.window?.riftboundDesktop?.setLang?.(lang); } catch { /* not the PC app */ }

/** 'en' or 'fr'. */
export const getLang = () => lang;
/** Locale for dates and numbers. */
export const locale = () => (lang === 'fr' ? 'fr-FR' : 'en-GB');

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s);

/** The text in the app's language (French source text as the key). */
export function tx(fr, vars) {
  return fill(lang === 'fr' ? fr : (EN[fr] ?? fr), vars);
}

/** Singular / plural: French keeps the singular for 0 and 1, English for 1 only. */
export function tp(n, one, many, vars) {
  const v = { n, ...vars };
  if (lang === 'fr') return fill(n <= 1 ? one : many, v);
  return fill(n === 1 ? (EN[one] ?? one) : (EN[many] ?? many), v);
}

/** Changes the language (and the card language with it), then reloads the app. */
export function setLang(next, { reload = true } = {}) {
  if (next !== 'en' && next !== 'fr') return;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* storage unavailable */ }
  try { localStorage.setItem(DISPLAY_FRENCH_KEY, next === 'fr' ? '1' : '0'); } catch { /* storage unavailable */ }
  lang = next;
  if (reload && typeof window !== 'undefined') window.location.reload();
}
