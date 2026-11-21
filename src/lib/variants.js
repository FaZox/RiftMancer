import { tx } from './i18n.js';
/**
 * Variants of a card (lot 8.4, docs/ETUDE-VARIANTES.md): what the scan can
 * tell apart, said in words.
 *   - alternate art (« OGN-066a »): another illustration — a card of its own,
 *     recognised as such;
 *   - signed (« OGN-299* », id « ogn-299-star-298 »): the same picture with a
 *     gold signature — grouped with the normal card, the scanner asks which;
 *   - foil: not visible on a photo, chosen by the user.
 * Pure: tests/variants.test.mjs.
 */

/** 'alt' | 'signed' | null, from the card id. */
export function variantOf(id) {
  const s = String(id || '');
  if (/-star-/.test(s)) return 'signed';
  if (/^[a-z]{3}-(r|sp)?\d+[a-z]-/.test(s)) return 'alt';
  return null;
}

export const VARIANT_LABEL = { alt: tx('Illustration alternative'), signed: tx('Signée') };

/** Button of a printing in « Même illustration » (same set twice: « OGN » / « OGN signée »). */
export function printingLabel(card) {
  const v = variantOf(card?.id);
  return `${card?.set || ''}${v === 'signed' ? tx(' signée') : v === 'alt' ? ' illustration alt.' : ''}`;
}
