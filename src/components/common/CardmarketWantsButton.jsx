import React, { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { sendToCardmarketWants } from '../../lib/cardmarket.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Ajouter aux souhaits Cardmarket »: copies the cards (« 2 Jinx, Demolitionist »
 * per line) and opens the Cardmarket wants page, where the list is pasted.
 * items: [{ cardData, quantity }].
 */
export default function CardmarketWantsButton({ items, label = tx('Souhaits Cardmarket'), className = 'btn-secondary text-sm' }) {
  const [done, setDone] = useState(null);
  const count = items.reduce((n, i) => n + (i.quantity > 0 ? i.quantity : 0), 0);
  const run = async () => {
    const r = await sendToCardmarketWants(items);
    setDone(r);
    setTimeout(() => setDone(null), 9000);
  };
  return (
    <div className="space-y-1">
      <button onClick={run} disabled={!count} className={className}
        title={tx('Copie la liste et ouvre vos souhaits Cardmarket : il reste à coller (Ctrl+V) la liste')}>
        <ExternalLink className="w-4 h-4" /> {label}{count ? ` (${count})` : ''}
      </button>
      {done && (
        <p className="text-xs text-[#7fd6a4] flex items-start gap-1.5">
          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {done.copied
            ? tx('Liste copiée ({lines} carte{v1}). Sur Cardmarket, ouvrez ou créez une liste de souhaits et collez-la.', { lines: done.lines, v1: done.lines > 1 ? 's' : '' })
            : tx('Cardmarket est ouvert, mais la copie a échoué : recopiez la liste à la main.')}
        </p>
      )}
    </div>
  );
}
