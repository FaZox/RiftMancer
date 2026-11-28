import React, { useEffect, useMemo, useState } from 'react';
import CollectionTreasure from './CollectionTreasure.jsx';
import CollectionSetPage from './CollectionSetPage.jsx';
import CollectionJournal from './CollectionJournal.jsx';
import useReliquary from '../../components/collection/useReliquary.jsx';
import useValueData from '../../hooks/useValueData.js';
import { onRequest, takeRequest } from '../../lib/navRequest.js';
import { useHelpPage } from '../../lib/help.js';

/**
 * PC collection: « Salle du trésor » (masterpiece, medallions, set portals, shelves), a set page (« Atlas ») and
 * the « Chronique » of the latest additions. Adding cards happens from the card sheet (« ＋ Ma collection »);
 * the wish list has its own page. The treasure stays mounted behind the other views (scroll position kept).
 */
export default function CollectionPage({ scannedCards, copies, wishlist, org, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, defaultLanguage, onSearch }) {
  const [view, setView] = useState(() => { const r = takeRequest('set'); return r ? { kind: 'set', code: r.code } : { kind: 'treasure' }; });
  const { prices, history } = useValueData(scannedCards);
  useHelpPage(view.kind === 'treasure' ? 'collection' : view.kind === 'set' ? 'set' : 'journal');
  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const s of scannedCards) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
    return m;
  }, [scannedCards]);
  // « Open that set » from elsewhere (Valeur, global search)
  useEffect(() => onRequest((r) => { if (r.kind === 'set') { takeRequest('set'); setView({ kind: 'set', code: r.code }); } }), []);

  const zoom = useReliquary({ stacks: scannedCards, wishlist, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, org, defaultLanguage });
  const onOpen = (id, o) => zoom.open(id, o);
  const treasure = view.kind === 'treasure';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className={treasure ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
        <CollectionTreasure scannedCards={scannedCards} ownedByCard={ownedByCard} copies={copies} wishlist={wishlist} prices={prices} history={history}
          onOpen={onOpen} onOpenSet={(code) => setView({ kind: 'set', code })} onOpenJournal={() => setView({ kind: 'journal' })} onSearch={onSearch} />
      </div>
      {view.kind === 'set' && (
        <CollectionSetPage key={view.code} code={view.code} scannedCards={scannedCards} ownedByCard={ownedByCard} wishlist={wishlist} prices={prices}
          onOpen={onOpen} onBack={() => setView({ kind: 'treasure' })} />
      )}
      {view.kind === 'journal' && <CollectionJournal copies={copies} prices={prices} onOpen={onOpen} onBack={() => setView({ kind: 'treasure' })} />}
      {zoom.element}
    </div>
  );
}
