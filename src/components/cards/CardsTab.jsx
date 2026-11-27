// Phone « Cartes » tab (ONGLET-CARTES, design A « Bibliothèque »): the whole catalog, owned or not.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Eye, ArrowUpDown, SlidersHorizontal, ScanLine, Check, Layers } from 'lucide-react';
import CardZoom from '../collection/CardZoom.jsx';
import Sheet from '../common/Sheet.jsx';
import useCardsBrowser from '../../hooks/useCardsBrowser.js';
import { CardsFilters, OwnershipSeg, ActiveChips, DomainHexes, SyntaxHelp, CardsGrid, useCardsActions, SelectionBar, DeckChooser } from './CardsParts.jsx';
import { CARD_SORTS } from '../../lib/cardsBrowser.js';
import { hasKeys } from '../../lib/cardQuery.js';
import { takeRequest, onRequest } from '../../lib/navRequest.js';
import { locale, tx, tp } from '../../lib/i18n.js';

const ibtn = 'relative w-11 h-11 flex items-center justify-center border border-rift-600 text-rift-200 flex-shrink-0';
const ibtnOn = 'bg-gold-500/20 border-gold-400 text-gold-400';

export default function CardsTab({ scannedCards, wishlist, org, onAddCopy, onRemoveCopy, onUpdateCard, onQuickAdd, notify, onFind }) {
  const b = useCardsBrowser({ scannedCards, decks: org.decks.items, wishlist });
  const a = useCardsActions({ b, wishlist, decks: org.decks, onQuickAdd, notify });
  const scrollRef = useRef(null);
  const [sheet, setSheet] = useState(null); // 'filters' | 'sort' | 'help'
  const [zoomId, setZoomId] = useState(() => takeRequest('cardsFind')?.cardId || null);
  useEffect(() => onRequest((q) => { if (q.kind === 'cardsFind') setZoomId(takeRequest('cardsFind')?.cardId || null); }), []);

  const press = useCallback((id) => { if (a.selecting) a.toggle(id); else setZoomId(id); }, [a]);
  // Long press: choose several cards (then a tap ticks or unticks)
  const hold = useCallback((id) => { a.setSelecting(true); a.toggle(id); }, [a]);

  const idx = zoomId ? b.items.findIndex(g => g.card.id === zoomId) : -1;
  const nFilters = b.parsed.tokens.length;
  const fmt = (v) => v.toLocaleString(locale());

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-4 pt-[18px] pb-2.5 flex flex-col gap-3 border-b border-gold-500/15">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <h1 className="h-title text-[24px] leading-tight">{tx('Cartes')}</h1>
            <p className="text-[13px] text-rift-400">{tx('{owned} / {total} possédées', { owned: fmt(b.ownedCount), total: fmt(b.cards.length) })}</p>
          </div>
          <button type="button" className={`${ibtn} ${b.view.dimMissing ? ibtnOn : ''}`} aria-pressed={b.view.dimMissing} aria-label={tx('Griser les manquantes')}
            onClick={() => b.setView({ dimMissing: !b.view.dimMissing })}><Eye className="w-[22px] h-[22px]" /></button>
          <button type="button" className={ibtn} aria-label={tx('Trier')} onClick={() => setSheet('sort')}><ArrowUpDown className="w-[22px] h-[22px]" /></button>
          <button type="button" className={`${ibtn} ${nFilters ? ibtnOn : ''}`} onClick={() => setSheet('filters')}
            aria-label={nFilters ? tp(nFilters, 'Filtres, {n} actif', 'Filtres, {n} actifs', { n: nFilters }) : tx('Filtres')}>
            <SlidersHorizontal className="w-[22px] h-[22px]" />
            {nFilters > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4 px-1 bg-gold-500 text-rift-900 text-[11px] font-bold flex items-center justify-center">{nFilters}</span>}
          </button>
        </div>
        <label className="h-[46px] flex items-center gap-2.5 px-3 bg-rift-800 border border-gold-500/50 focus-within:border-gold-400">
          <Search className="w-5 h-5 text-gold-500 flex-shrink-0" aria-hidden="true" />
          <input type="text" value={b.input} onChange={e => b.setInput(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off"
            placeholder={tx('Nom, numéro ou t:unité d:fureur')} aria-label={tx('Rechercher une carte')}
            className={`flex-1 min-w-0 bg-transparent outline-none text-[15px] text-rift-100 placeholder:text-rift-500 ${hasKeys(b.input) ? 'font-mono' : ''}`} />
          <button type="button" onClick={() => setSheet('help')} aria-label={tx('Aide sur la syntaxe de recherche')}
            className="w-8 h-11 -my-1 flex items-center justify-center font-mono text-[12px] text-rift-400">?</button>
          {onFind && (
            <button type="button" onClick={onFind} aria-label={tx('Trouver une carte avec le scanner')} title={tx('Trouver une carte avec le scanner')}
              className="w-11 h-11 -my-1 -mr-2 flex items-center justify-center text-gold-500"><ScanLine className="w-5 h-5" /></button>
          )}
        </label>
        <OwnershipSeg b={b} />
        <DomainHexes b={b} row />
      </header>

      {a.selecting ? (
        <div className="flex-shrink-0 px-4 py-2 border-b border-gold-500/15 bg-rift-900">
          <SelectionBar a={a} />
        </div>
      ) : nFilters > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-gold-500/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ActiveChips b={b} className="flex-nowrap w-max" />
        </div>
      )}

      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {b.items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="font-display text-lg text-gold-400">{tx('Aucune carte ne correspond')}</p>
            <button type="button" onClick={() => { b.setQuery(''); b.setView({ ownership: 'all' }); }} className="btn-secondary mx-auto text-sm">{tx('Tout effacer')}</button>
          </div>
        ) : (
          <CardsGrid b={b} scrollRef={scrollRef} fixedCols={3} minWidth={100} gap={10} hd={false} showPrice
            selection={a.selecting ? a.selected : null} onTilePress={press} onTileZoom={hold} />
        )}
      </main>

      <Sheet open={sheet === 'filters'} title={tx('Filtres')} onClose={() => setSheet(null)}
        footer={(
          <>
            {nFilters > 0 && <button type="button" className="btn-ghost min-h-[44px]" onClick={() => b.setQuery('')}>{tx('Tout effacer')}</button>}
            <button type="button" className="btn-primary min-h-[44px]" onClick={() => setSheet(null)}>{tp(b.items.length, 'Voir {n} carte', 'Voir {n} cartes', { n: fmt(b.items.length) })}</button>
          </>
        )}>
        <CardsFilters b={b} />
      </Sheet>

      <Sheet open={sheet === 'sort'} title={tx('Trier')} onClose={() => setSheet(null)}>
        <div className="flex flex-col" role="radiogroup" aria-label={tx('Trier')}>
          {CARD_SORTS.map(s => (
            <button key={s.value} type="button" role="radio" aria-checked={b.view.sort === s.value}
              onClick={() => { b.setView({ sort: s.value }); setSheet(null); }}
              className={`min-h-[48px] px-2 flex items-center gap-3 border-b border-rift-700 text-left text-[15px] ${b.view.sort === s.value ? 'text-gold-400 font-semibold' : 'text-rift-100'}`}>
              <span className="w-5">{b.view.sort === s.value && <Check className="w-5 h-5" />}</span>{s.label}
            </button>
          ))}
          <button type="button" className="toggle mt-4 min-h-[44px] justify-start gap-2" aria-pressed={b.view.grouped} onClick={() => b.setView({ grouped: !b.view.grouped })}>
            <Layers className="w-4 h-4" /> {tx('Regrouper les impressions')}
          </button>
        </div>
      </Sheet>

      {sheet === 'help' && <SyntaxHelp onClose={() => setSheet(null)} />}
      <DeckChooser a={a} decks={org.decks} />

      {zoomId && (
        <CardZoom
          cardId={zoomId}
          stacks={scannedCards}
          wanted={wishlist.byCard.get(zoomId)?.quantity || 0}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onRemoveCopy={onRemoveCopy}
          onUpdateCard={onUpdateCard}
          onClose={() => setZoomId(null)}
          onPrev={idx > 0 ? () => setZoomId(b.items[idx - 1].card.id) : null}
          onNext={idx >= 0 && idx < b.items.length - 1 ? () => setZoomId(b.items[idx + 1].card.id) : null}
          position={idx >= 0 ? `${idx + 1} / ${b.items.length}` : null}
        />
      )}
    </div>
  );
}
