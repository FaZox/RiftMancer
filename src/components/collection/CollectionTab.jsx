import React, { useState, useMemo, useCallback, useEffect } from 'react';

import CardZoom from './CardZoom.jsx';

import TreasureMobile from './TreasureMobile.jsx';

import SetPageMobile from './SetPageMobile.jsx';

import JournalMobile from './JournalMobile.jsx';

import { usePrices } from '../../lib/prices.js';

import { takeRequest, onRequest } from '../../lib/navRequest.js';

import { useBackHandler } from '../../lib/backButton.js';

import { useHelpPage } from '../../lib/help.js';

// Ré-exports gardés pour les autres onglets (ValueTab, page PC des souhaits).
export { WishlistView, AlertInput } from './WishlistView.jsx';
export { ValueChart, ValueView } from './ValueView.jsx';

/**
 * Onglet Collection du téléphone : un aiguillage entre la « Salle du trésor »,
 * la page d'extension « Atlas » et la Chronique (comme la page PC). Les souhaits
 * vivent dans « Plus » (♥ de l'en-tête → requestOpen({ kind: 'more', id: 'wishlist' })).
 * Le zoom carte est le « Reliquaire » mobile (CardZoom délègue à CardReliquary sur téléphone).
 */
export default function CollectionTab({
  scannedCards,
  copies,
  wishlist,
  org,
  onAddCopy,
  onAddCopies,
  onRemoveCopy,
  onUpdateCard,
  defaultLanguage,
}) {
  const [view, setView] = useState(() => { const r = takeRequest('set'); return r ? { kind: 'set', code: r.code } : { kind: 'treasure' }; });
  const [zoom, setZoom] = useState(null); // { cardId, language, list, forge }
  useHelpPage(view.kind === 'treasure' ? 'collection' : view.kind === 'set' ? 'set' : 'journal');
  useBackHandler(view.kind !== 'treasure', () => setView({ kind: 'treasure' }));
  useEffect(() => onRequest((r) => { if (r.kind === 'set') { takeRequest('set'); setView({ kind: 'set', code: r.code }); } }), []);

  const { prices } = usePrices();

  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const s of scannedCards) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
    return m;
  }, [scannedCards]);

  // list (facultatif) : les cartes affichées, dans l'ordre — le balayage du zoom les parcourt
  const open = useCallback((cardId, { list = null, language = 'French', forge = false } = {}) => {
    setZoom({ cardId, language, list, forge });
  }, []);

  const treasure = view.kind === 'treasure';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className={treasure ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
        <TreasureMobile scannedCards={scannedCards} ownedByCard={ownedByCard} copies={copies} wishlist={wishlist}
          onOpen={open} onOpenSet={(code) => setView({ kind: 'set', code })} onOpenJournal={() => setView({ kind: 'journal' })} />
      </div>
      {view.kind === 'set' && (
        <SetPageMobile key={view.code} code={view.code} scannedCards={scannedCards} ownedByCard={ownedByCard} wishlist={wishlist} prices={prices}
          onOpen={open} onBack={() => setView({ kind: 'treasure' })} />
      )}
      {view.kind === 'journal' && (
        <JournalMobile copies={copies} prices={prices} onOpen={open} onBack={() => setView({ kind: 'treasure' })} />
      )}

      {zoom && (
        <CardZoom
          cardId={zoom.cardId}
          language={zoom.language}
          list={zoom.list}
          forge={zoom.forge}
          stacks={scannedCards}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onAddCopies={onAddCopies}
          onRemoveCopy={onRemoveCopy}
          onUpdateCard={onUpdateCard}
          org={org}
          defaultLanguage={defaultLanguage}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
