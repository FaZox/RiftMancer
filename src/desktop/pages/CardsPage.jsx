// PC « Cartes » page (ONGLET-CARTES, design A « Bibliothèque »): the whole catalog, owned or not.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Heart, Download, Eye, Layers, SlidersHorizontal, X } from 'lucide-react';
import CardZoom from '../../components/collection/CardZoom.jsx';
import ThemedSelect from '../../components/common/ThemedSelect.jsx';
import useCardsBrowser from '../../hooks/useCardsBrowser.js';
import { CardsFiltersDesktop, OwnershipSeg, ActiveChips, SyntaxHelp, CardsGrid, useCardsActions, SelectionBar, DeckChooser } from '../../components/cards/CardsParts.jsx';
import { CARD_SORTS, viewCsv } from '../../lib/cardsBrowser.js';
import { hasKeys } from '../../lib/cardQuery.js';
import { saveTextFile } from '../../lib/saveText.js';
import { locale, tx, tp } from '../../lib/i18n.js';

export default function CardsPage({ scannedCards, wishlist, org, onAddCopy, onRemoveCopy, onUpdateCard, onQuickAdd, notify }) {
  const b = useCardsBrowser({ scannedCards, decks: org.decks.items, wishlist });
  const a = useCardsActions({ b, wishlist, decks: org.decks, onQuickAdd, notify });
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [help, setHelp] = useState(false);
  const [zoom, setZoom] = useState(null); // index in b.items
  const [filtersOpen, setFiltersOpen] = useState(false); // the left filter menu is shown on demand

  // Ctrl+F: the search of the page (Ctrl+K stays the global search)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const open = useCallback((id) => { const i = b.items.findIndex(g => g.card.id === id); if (i >= 0) setZoom(i); }, [b.items]);
  const press = useCallback((id, e) => {
    if (e?.ctrlKey || e?.metaKey || e?.shiftKey || a.selected.size) { a.toggle(id, !!e?.shiftKey); return; }
    open(id);
  }, [a, open]);

  const exportView = () => {
    const name = `riftmancer-cartes-${new Date().toISOString().slice(0, 10)}.csv`;
    saveTextFile(name, viewCsv(b.items, { nameOf: b.nameOf, priceOf: b.priceOf }), 'text/csv')
      .then(() => notify?.(tp(b.items.length, '{n} carte exportée', '{n} cartes exportées', { n: b.items.length }), 'success'))
      .catch(() => {});
  };

  const minWidth = 230; // même taille que la Collection (« Grandes »)
  const zoomCard = zoom != null ? b.items[zoom]?.card : null;
  const mono = hasKeys(b.input);
  const nSets = b.sets.size;
  const nFilters = b.parsed.tokens.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 mr-auto">
            <h1 className="h-title text-[24px] leading-none">{tx('Cartes')}</h1>
            <p className="mt-1 text-[13px] text-rift-400 truncate">
              {tx('Tout le catalogue Riftbound, possédé ou non')} · {tp(nSets, '{n} set', '{n} sets', { n: nSets })} · {tx('{owned} / {total} possédées', { owned: b.ownedCount.toLocaleString(locale()), total: b.cards.length.toLocaleString(locale()) })}
            </p>
          </div>
          <div className="flex gap-2" data-help="cards.actions">
            <button type="button" className="chip h-9" onClick={a.missingToWish} disabled={!b.counts.missing}>
              <Heart className="w-4 h-4" aria-hidden="true" /> {tx('Manquantes → souhaits')}
            </button>
            <button type="button" className="chip h-9" onClick={exportView} disabled={!b.items.length}>
              <Download className="w-4 h-4" aria-hidden="true" /> {tx('Exporter la vue')}
            </button>
            <button type="button" className="chip h-9" aria-pressed={filtersOpen} data-help="cards.filters"
              aria-label={nFilters ? tp(nFilters, 'Filtres, {n} actif', 'Filtres, {n} actifs', { n: nFilters }) : tx('Filtres')}
              onClick={() => setFiltersOpen(o => !o)}>
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> {tx('Filtres')}
              {nFilters > 0 && <span className="min-w-[18px] h-4 px-1 bg-gold-500 text-rift-900 text-[11px] font-bold flex items-center justify-center">{nFilters}</span>}
            </button>
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <label className="w-[380px] max-w-full xl:w-[460px] flex-shrink-0 h-[42px] flex items-center gap-2.5 px-3.5 bg-rift-800 border border-gold-500/50 focus-within:border-gold-400" data-help="cards.search">
            <Search className="w-5 h-5 text-gold-500 flex-shrink-0" aria-hidden="true" />
            <span className="sr-only">{tx('Rechercher une carte')}</span>
            <input ref={inputRef} type="text" value={b.input} onChange={e => b.setInput(e.target.value)} spellCheck={false}
              placeholder={tx('Nom FR/EN, numéro, ou syntaxe (t:unité e<=3)')}
              className={`flex-1 min-w-0 bg-transparent outline-none text-[15px] text-rift-100 placeholder:text-rift-500 ${mono ? 'font-mono' : ''}`} />
            <span className="text-[12px] text-rift-500 whitespace-nowrap hidden xl:inline">{tx('Ctrl F')}</span>
            <button type="button" onClick={() => setHelp(true)} aria-label={tx('Aide sur la syntaxe de recherche')} title={tx('Aide sur la syntaxe de recherche')}
              className="font-mono text-[11px] text-rift-400 border border-rift-600 px-1.5 py-0.5 hover:text-gold-400 hover:border-gold-500/50">?</button>
          </label>
          <OwnershipSeg b={b} />
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button type="button" className="chip !h-9 !w-9 !px-0" aria-pressed={b.view.dimMissing} aria-label={tx('Griser les manquantes')} title={tx('Griser les manquantes')}
              onClick={() => b.setView({ dimMissing: !b.view.dimMissing })}>
              <Eye className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" className="chip !h-9 !w-9 !px-0" aria-pressed={b.view.grouped} aria-label={tx('Regrouper les impressions')}
              title={tx('Une vignette par carte, ses autres impressions regroupées')}
              onClick={() => b.setView({ grouped: !b.view.grouped })}>
              <Layers className="w-4 h-4" aria-hidden="true" />
            </button>
            <ThemedSelect value={b.view.sort} onChange={(v) => b.setView({ sort: v })} label={tx('Trier')} className="w-[190px]"
              buttonClassName="h-9 px-3 bg-rift-800 border border-rift-600 hover:border-gold-500/50 text-rift-300 text-xs font-semibold"
              options={CARD_SORTS.map(s => ({ value: s.value, label: s.label }))} />
          </div>
        </div>

        {(a.selected.size > 0 || nFilters > 0) && (
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {a.selected.size > 0 ? (
              <SelectionBar a={a} className="flex-1" />
            ) : (
              <>
                <span className="text-[13px] text-rift-300 mr-1">{tp(b.items.length, '{n} résultat', '{n} résultats', { n: b.items.length.toLocaleString(locale()) })}</span>
                <ActiveChips b={b} />
              </>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 flex gap-6 px-8">
        {filtersOpen && (
          <aside aria-label={tx('Filtres')} data-help="cards.filters"
            className="relative z-20 w-[280px] flex-shrink-0 overflow-y-auto py-[18px] pr-1 border-r border-gold-500/15">
            <div className="flex items-center justify-between mb-3 pr-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500">{tx('Filtres')}</p>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label={tx('Fermer')} title={tx('Fermer')}
                className="w-8 h-8 flex items-center justify-center border border-rift-600 text-rift-400 hover:text-rift-100 hover:border-gold-500/50">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <CardsFiltersDesktop b={b} />
          </aside>
        )}
        <section aria-label={tx('Résultats')} ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto pt-4 pb-10" data-help="cards.grid">
          {b.items.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <p className="font-display text-xl text-gold-400">{tx('Aucune carte ne correspond')}</p>
              <button type="button" onClick={() => { b.setQuery(''); b.setView({ ownership: 'all' }); }} className="btn-secondary mx-auto text-sm">{tx('Tout effacer')}</button>
            </div>
          ) : (
            <CardsGrid b={b} scrollRef={scrollRef} fixedCols={6} minWidth={minWidth} gap={24} hd showPrice
              selection={a.selected} onTilePress={press} onTileZoom={open} onQuickAdd={onQuickAdd} />
          )}
        </section>
      </div>

      {help && <SyntaxHelp onClose={() => setHelp(false)} />}
      <DeckChooser a={a} decks={org.decks} />
      {zoomCard && (
        <CardZoom
          cardId={zoomCard.id}
          stacks={scannedCards}
          wanted={wishlist.byCard.get(zoomCard.id)?.quantity || 0}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onRemoveCopy={onRemoveCopy}
          onUpdateCard={onUpdateCard}
          onClose={() => setZoom(null)}
          onPrev={zoom > 0 ? () => setZoom(zoom - 1) : null}
          onNext={zoom < b.items.length - 1 ? () => setZoom(zoom + 1) : null}
          position={`${zoom + 1} / ${b.items.length}`}
        />
      )}
    </div>
  );
}
