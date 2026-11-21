import React, { useCallback, useMemo, useState } from 'react';
import CardZoom from '../../components/collection/CardZoom.jsx';
import { ProgressView } from '../../components/collection/CollectionTab.jsx';
import { CardsPanel } from './CollectionCards.jsx';
import { WishlistPanel } from './CollectionWishlist.jsx';import { tx } from '../../lib/i18n.js';


const VIEWS = [
  { id: 'cards', label: tx('Mes cartes') },
  { id: 'progress', label: tx('Progression') },
  { id: 'wishlist', label: tx('Souhaits') },
];
/**
 * PC collection: a toolbar with every filter in sight, a grid whose card size
 * you choose, or a table where each stack is edited in place (language,
 * condition, foil, quantity, location). Click a card to open it.
 */
export default function CollectionPage({
  scannedCards, wishlist, org, onMoveStack, onAddCopy, onRemoveCopy, onUpdateCard, onRemoveCard, onDeleteStacks,
  onExport, onImportEntries, defaultLanguage,
}) {
  const [view, setView] = useState('cards');
  const [zoom, setZoom] = useState(null); // { cardId, language, list, index }
  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const s of scannedCards) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
    return m;
  }, [scannedCards]);

  const openCard = useCallback((cardId, language = 'French', list = null) => {
    const index = list ? list.findIndex(c => c.cardId === cardId) : -1;
    setZoom({ cardId, language, list: index >= 0 ? list : null, index });
  }, []);
  const stepZoom = useCallback((d) => setZoom(z => {
    const i = z.index + d;
    if (!z.list || i < 0 || i >= z.list.length) return z;
    return { ...z, ...z.list[i], index: i };
  }), []);

  const total = scannedCards.reduce((n, s) => n + s.quantity, 0);
  const wishCount = wishlist.items.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Page header */}
      <header className="flex-shrink-0 px-8 pt-7 pb-4 flex items-end gap-6 border-b border-gold-500/15">
        <div className="min-w-0">
          <h1 className="h-title text-[28px] leading-none">{tx('Collection')}</h1>
          <p className="text-sm text-rift-400 mt-2">{total} {tx('carte')}{total > 1 ? 's' : ''} · {ownedByCard.size} {tx('différente')}{ownedByCard.size > 1 ? 's' : ''}</p>
        </div>
        <div className="seg ml-6 w-[420px]" role="tablist" aria-label={tx('Vues')}>
          {VIEWS.map(v => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
              {v.label}{v.id === 'wishlist' && wishCount > 0 && <span className="ml-1.5 text-rift-400 font-normal">{wishCount}</span>}
            </button>
          ))}
        </div>
      </header>

      {view === 'cards' && (
        <CardsPanel
          scannedCards={scannedCards} org={org} onOpen={openCard} onUpdateCard={onUpdateCard}
          onRemoveCard={onRemoveCard} onDeleteStacks={onDeleteStacks} onMoveStack={onMoveStack}
          onExport={onExport} onImportEntries={onImportEntries} defaultLanguage={defaultLanguage}
        />
      )}
      {view === 'progress' && <ProgressView ownedByCard={ownedByCard} wishlist={wishlist} onOpen={openCard} />}
      {view === 'wishlist' && <WishlistPanel ownedByCard={ownedByCard} wishlist={wishlist} onOpen={openCard} />}

      {zoom && (
        <CardZoom
          cardId={zoom.cardId}
          language={zoom.language}
          stacks={scannedCards}
          wanted={wishlist.byCard.get(zoom.cardId)?.quantity || 0}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onRemoveCopy={onRemoveCopy}
          onUpdateCard={onUpdateCard}
          onClose={() => setZoom(null)}
          onPrev={zoom.list && zoom.index > 0 ? () => stepZoom(-1) : null}
          onNext={zoom.list && zoom.index < zoom.list.length - 1 ? () => stepZoom(1) : null}
          position={zoom.list ? `${zoom.index + 1} / ${zoom.list.length}` : null}
        />
      )}
    </div>
  );
}
