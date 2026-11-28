import React, { useMemo } from 'react';
import { WishlistPanel } from './CollectionWishlist.jsx';
import useReliquary from '../../components/collection/useReliquary.jsx';
import { useHelpPage } from '../../lib/help.js';
import { tx } from '../../lib/i18n.js';

/** « Souhaits » page (sidebar entry under Collection): the wish list table, cards open in the card sheet. */
export default function WishlistPage({ scannedCards, wishlist, org, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, defaultLanguage }) {
  useHelpPage('wishlist');
  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const s of scannedCards) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
    return m;
  }, [scannedCards]);
  const zoom = useReliquary({ stacks: scannedCards, wishlist, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, org, defaultLanguage });
  const n = wishlist.items.length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-7 pb-4 border-b border-gold-500/15">
        <h1 className="h-title text-[28px] leading-none">{tx('Souhaits')}</h1>
        <p className="text-sm text-rift-400 mt-2">{n} {tx('carte')}{n > 1 ? 's' : ''}</p>
      </header>
      <WishlistPanel ownedByCard={ownedByCard} wishlist={wishlist} onOpen={(id) => zoom.open(id)} />
      {zoom.element}
    </div>
  );
}
