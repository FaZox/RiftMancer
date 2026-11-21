import { tx } from './i18n.js';
/**
 * Records modified on both sides between two syncs (lot 3.4, B.6.10): the
 * most recent version was kept; the sync history says so, with the cards' names.
 */
const KIND = { copies: 'carte', wishlist: 'souhait', boxes: tx('boîte'), decks: 'deck', people: 'personne', loans: tx('prêt'), trades: tx('échange'), matches: 'match', learned: 'exemple appris' };

/** « 2 fiches modifiées des deux côtés : la plus récente a été gardée » */
export function conflictSummary(n) {
  return n > 1
    ? tx('{n} fiches modifiées des deux côtés : la plus récente a été gardée', { n })
    : tx('1 fiche modifiée des deux côtés : la plus récente a été gardée');
}

/**
 * One line per conflict: « Jinx, Rebelle (carte) — version du téléphone gardée ».
 * `cardName(cardId)` gives a card's name (catalog), null when unknown.
 */
export function conflictLine(c, cardName = () => null) {
  const name = (c.cardId && cardName(c.cardId)) || c.name || c.cardId || c.id;
  const kind = KIND[c.collection] || c.collection;
  const kept = c.kept === 'phone' ? tx('version du téléphone gardée') : tx('version du PC gardée');
  return `${name} (${kind}${c.deleted ? tx(', supprimé') : ''}) — ${kept}`;
}
