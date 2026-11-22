import React, { useState, useMemo, useCallback } from 'react';
import { Layers, Heart, BarChart3, Bell } from 'lucide-react';
import { usePrices, unitPrice, stacksValue, euro, priceChange, priceAlerts, priceRef, pct } from '../../lib/prices.js';
import CardZoom from './CardZoom.jsx';
import { CardsView } from './CardsView.jsx';
import { ProgressView } from './ProgressView.jsx';
import { WishlistView } from './WishlistView.jsx';
import SyncReminderBanner from './SyncReminderBanner.jsx';
import SearchButton from '../common/SearchButton.jsx';
import { tx, locale, tp } from '../../lib/i18n.js';
import { useHelpPage } from '../../lib/help.js';
export { locationOf, placeOf, PLACE_STYLE, GridTile } from './collectionShared.jsx';
export { ProgressView } from './ProgressView.jsx';
export { WishlistView, AlertInput } from './WishlistView.jsx';
export { ValueChart, ValueView } from './ValueView.jsx';

const VIEWS = [
  { id: 'cards', label: tx('Mes cartes'), icon: Layers },
  { id: 'progress', label: tx('Progression'), icon: BarChart3 },
  { id: 'wishlist', label: tx('Souhaits'), icon: Heart },
];
// Valeur et Stats : onglet « Valeur » ; Échanges : onglet « Plus » (design Hextech).

export default function CollectionTab({
  scannedCards,
  wishlist,
  org,
  onMoveStack,
  onUpdateCard,
  onRemoveCard,
  onRemoveCopy,
  onDeleteStacks,
  onClearAll,
  onExport,
  onAddCopy,
  collection,
  defaultLanguage,
  onImportEntries,
}) {
  const [view, setView] = useState('cards');
  const [zoom, setZoom] = useState(null); // { cardId, language, list?, index? }
  useHelpPage(view === 'cards' ? null : view); // Progression, Souhaits: their own tour

  // Copies owned per card (all languages / finishes)
  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const s of scannedCards) m.set(s.cardData.id, (m.get(s.cardData.id) || 0) + s.quantity);
    return m;
  }, [scannedCards]);

  // list (optional): the cards shown, in order — swiping in the zoom walks through it
  const openCard = useCallback((cardId, language = 'French', list = null) => {
    const index = list ? list.findIndex(c => c.cardId === cardId) : -1;
    setZoom({ cardId, language, list: index >= 0 ? list : null, index });
  }, []);
  const stepZoom = useCallback((delta) => setZoom(z => {
    const i = z.index + delta;
    if (!z.list || i < 0 || i >= z.list.length) return z;
    return { ...z, ...z.list[i], index: i };
  }), []);
  const { prices: allPrices } = usePrices();
  const alerts = useMemo(() => priceAlerts(allPrices, wishlist.items), [allPrices, wishlist.items]);
  const header = useMemo(() => {
    const copies = scannedCards.reduce((n, s) => n + s.quantity, 0);
    const value = allPrices ? stacksValue(allPrices, scannedCards).value : null;
    // Price change of the cards you own now, over 7 days (not the growth of
    // the collection: adding cards must not count as a rise).
    let week = null;
    if (allPrices && value) {
      // Only cards whose own price history covers the 7 days count.
      let old = 0; let cur = 0;
      for (const st of scannedCards) {
        const u = unitPrice(allPrices, st.cardData.id, st.foil, priceRef(), st.promo);
        if (u == null) continue;
        const ch = st.promo ? null : priceChange(allPrices, st.cardData.id, 7, priceRef(), !!st.foil);
        if (ch == null) continue;
        cur += st.quantity * u; old += st.quantity * (u / (1 + ch / 100));
      }
      if (old > 0) week = ((cur - old) / old) * 100;
    }
    return { copies, unique: ownedByCard.size, value, week };
  }, [scannedCards, allPrices, ownedByCard]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Header: title, value, view switcher */}
      <div className="px-4 pt-5 lg:px-8 lg:pt-7 flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <h1 className="h-title text-[22px] flex-1">{tx('Collection')}</h1>
          <span className="lg:hidden self-center"><SearchButton /></span>
          {header.value != null && <span className="font-display font-bold text-lg text-rift-100">{euro(header.value)}</span>}
        </div>
        <SyncReminderBanner className="mt-3 mb-2" />
        <p className="text-[13px] text-rift-400 mt-0.5">
          {tp(header.copies, '{n} carte', '{n} cartes', { n: header.copies.toLocaleString(locale()) })} · {tp(header.unique, '{n} différente', '{n} différentes', { n: header.unique.toLocaleString(locale()) })}
          {header.week != null && (
            <> · <span className={header.week >= 0 ? 'text-state-ok' : 'text-state-bad'}>{pct(header.week)} {tx('cette semaine')}</span></>
          )}
        </p>
        <div className="seg mt-3 mb-1 lg:max-w-xl" role="tablist" aria-label={tx('Vues de la collection')} data-help="collection.views">
          {VIEWS.map(v => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className="whitespace-nowrap">
              {v.label}
              {v.id === 'wishlist' && alerts.length > 0
                ? <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-state-ok" title={tx('Cartes sous votre prix d’alerte')}><Bell className="w-3 h-3" />{alerts.length}</span>
                : v.id === 'wishlist' && wishlist.items.length > 0 && <span className="font-normal text-rift-400">{wishlist.items.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {view === 'cards' && (
        <CardsView
          scannedCards={scannedCards}
          onUpdateCard={onUpdateCard}
          onRemoveCard={onRemoveCard}
          onDeleteStacks={onDeleteStacks}
          onClearAll={onClearAll}
          onExport={onExport}
          onOpen={openCard}
          org={org}
          onMoveStack={onMoveStack}
          onImportEntries={onImportEntries}
          defaultLanguage={defaultLanguage}
        />
      )}
      {view === 'progress' && <ProgressView ownedByCard={ownedByCard} wishlist={wishlist} onOpen={openCard} />}
      {view === 'wishlist' && <WishlistView ownedByCard={ownedByCard} wishlist={wishlist} onOpen={openCard} />}

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
