import { locale, tx } from './i18n.js';
/**
 * Errata on the card sheet (lot 7.6, B.6.5): the text shown changed at a
 * content update — the former text and the date. The PC records them when it
 * installs an update (electron/content.cjs) and serves them with the catalog,
 * the phone gets them at the sync. Pure: tests/errata.test.mjs.
 */

/**
 * The erratum of the text shown: `shown` is getLocalizedText()'s result
 * (French text → `textFr`, otherwise the English `text`).
 * → { old, at, isHtml } or null.
 */
export function erratumFor(cardData, shown, language) {
  if (!cardData?.errata?.length || !shown) return null;
  const field = language === 'French' && shown.translated && !shown.isHtml ? 'textFr' : 'text';
  const e = cardData.errata.find(x => x.field === field);
  return e ? { old: e.old, at: e.at, isHtml: field === 'text' } : null;
}

/** « Texte modifié le 12 nov. 2026 ». */
export function errataLabel(at) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? tx('Texte modifié') : tx('Texte modifié le {date}', { date: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) });
}
