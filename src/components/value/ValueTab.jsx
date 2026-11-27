import React, { useCallback, useState } from 'react';
import { ValueView } from '../collection/CollectionTab.jsx';
import StatsView from '../collection/StatsView.jsx';
import CardZoom from '../collection/CardZoom.jsx';
import { tx } from '../../lib/i18n.js';

const VIEWS = [
  { id: 'value', label: tx('Valeur') },
  { id: 'stats', label: tx('Statistiques') },
];

/** « Valeur » tab: Cardmarket value of the collection + statistics. */
export default function ValueTab({ scannedCards, wishlist, onAddCopy }) {
  const [view, setView] = useState('value');
  const [zoom, setZoom] = useState(null);
  const openCard = useCallback((cardId) => setZoom(cardId), []);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-5 lg:px-8 lg:pt-7 flex-shrink-0">
        <h1 className="h-title text-[22px]">{tx('Valeur')}</h1>
        <div className="seg mt-3 mb-1 lg:max-w-md" role="tablist" aria-label={tx('Vues')}>
          {VIEWS.map(v => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>
      {view === 'value' && <ValueView scannedCards={scannedCards} wishItems={wishlist.items} onOpen={openCard} />}
      {view === 'stats' && <StatsView scannedCards={scannedCards} />}
      {zoom && (
        <CardZoom
          cardId={zoom}
          stacks={scannedCards}
          wanted={wishlist.byCard.get(zoom)?.quantity || 0}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
