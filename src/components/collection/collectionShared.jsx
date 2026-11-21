// Shared by the collection views (phone and PC): where a copy is, grid tile.
import React from 'react';
import { Check } from 'lucide-react';
import { euro } from '../../lib/prices.js';
import { fullImageSrc } from '../../lib/nativeAssets.js';
import { LANGUAGES } from '../../data/sampleCards.js';
import CardImage from '../common/CardImage.jsx';
import StatusPill from '../common/StatusPill.jsx';
import { isBanned } from '../../lib/deckRules.js';
import { displayLanguage } from '../../lib/cardLocale.js';
import { slotsLabel } from '../../lib/binder.js';
import { tx } from '../../lib/i18n.js';

const inBinder = (stack) => (stack.slots?.length ? ` · ${slotsLabel(stack.slots)}` : '');

export const selectClass = 'h-8 bg-rift-800 border border-rift-600/40 rounded-lg text-xs text-rift-200 px-2 focus:outline-none focus:border-gold-500/60';

/** Label of where a stack is (box, deck, loan), or '' if nowhere. */
export function locationOf(stack, org) {
  const parts = [];
  if (stack.deckId) parts.push(tx('Deck : {v0}', { v0: org.decks.byId.get(stack.deckId)?.name || '?' }));
  if (stack.boxId) parts.push(`${org.boxes.byId.get(stack.boxId)?.name || tx('Boîte ?')}${inBinder(stack)}`);
  if (stack.loanId) {
    const loan = org.loans.byId.get(stack.loanId);
    parts.push(tx('Prêté : {v0}', { v0: org.people.byId.get(loan?.personId)?.name || '?' }));
  }
  return parts.join(' · ');
}

/** Where a stack is, for the grid: [kind, text] — deck, loan or box (or null). */
export function placeOf(card, org) {
  if (card.loanId) {
    const loan = org.loans.byId.get(card.loanId);
    return ['loan', tx('Prêtée à {v0}', { v0: org.people.byId.get(loan?.personId)?.name || '?' })];
  }
  if (card.deckId) return ['deck', tx('Deck : {v0}', { v0: org.decks.byId.get(card.deckId)?.name || '?' })];
  if (card.boxId) return ['box', tx('Boîte : {v0}{inBinder}', { v0: org.boxes.byId.get(card.boxId)?.name || '?', inBinder: inBinder(card) })];
  return null;
}

export const PLACE_STYLE = {
  loan: 'text-[#f5b47a]', // orange: not at home
  deck: 'text-[#8fc4f5]',
  box: 'text-rift-300',
};

/** Collection grid tile: image, quantity, language, name, where it is, price. */
// hd: full-size picture instead of the thumbnail (PC: sharp at big sizes)
export const GridTile = React.memo(function GridTile({ card, name, price, place, onOpen, selecting, selected, onToggle, hd = false }) {
  const d = card.cardData;
  const lang = LANGUAGES.find(l => l.value === card.language)?.short || 'EN';
  return (
    <button
      onClick={() => (selecting ? onToggle(card.key) : onOpen(d.id, displayLanguage(card.language)))}
      aria-pressed={selecting ? selected : undefined}
      className={`flex flex-col gap-1 min-w-0 ${selecting && !selected ? 'opacity-60' : ''}`}
      title={name}
    >
      <span className={`hex-cut-sm relative block w-full bg-rift-800 ${selected ? 'outline outline-[3px] -outline-offset-[3px] outline-gold-400' : ''}`}>
        {selecting && (
          <span className={`absolute right-1 top-1 z-10 w-6 h-6 flex items-center justify-center border-2 ${selected ? 'bg-gold-400 border-gold-400 text-rift-900' : 'bg-rift-900/80 border-rift-300'}`}>
            {selected && <Check className="w-4 h-4" strokeWidth={3} />}
          </span>
        )}
        <CardImage cardData={d} fit="box" src={hd ? fullImageSrc(d.id) : undefined} imgClassName={isBanned(d) ? 'brightness-[.4]' : ''} />
        {isBanned(d) && <StatusPill kind="bannie" className="absolute left-1 top-1" title={tx('Bannie en Standard')} />}
        <span className="absolute right-0 bottom-0 px-2 py-0.5 bg-gold-500 text-rift-900 text-xs font-bold">×{card.quantity}</span>
        <span className="absolute left-1 bottom-1 px-1 bg-rift-900/85 text-[11px] font-bold text-gold-400">{lang}{card.foil ? ' · F' : ''}</span>
        {(card.promo || d.variant === 'promo') && <StatusPill kind="promo" className="absolute left-1 bottom-6 bg-rift-900/90" />}
      </span>
      <span className="w-full px-1 py-1 border border-[#e8a33a]/55 bg-[#e8a33a]/10 text-center text-[12px] font-semibold leading-tight text-rift-100 line-clamp-2 min-h-[2.9em] flex items-center justify-center">
        {name}
      </span>
      {place && (
        <span className={`w-full text-center text-[11px] leading-tight truncate ${PLACE_STYLE[place[0]]}`}>{place[1]}</span>
      )}
      {price != null && <span className="w-full text-center text-[12px] font-semibold text-gold-400">{euro(price)}</span>}
    </button>
  );
});
