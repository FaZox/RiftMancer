// « Mes cartes »: list / grid of the collection with filters, selection, export, import.
import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Trash2, Layers, Search, X, ChevronDown, SlidersHorizontal, Upload, LayoutGrid, List, ArrowUpDown, Plus } from 'lucide-react';
import { useBackHandler } from '../../lib/backButton.js';
import { euro } from '../../lib/prices.js';
import ImportCsvDialog from './ImportCsvDialog.jsx';
import ScannerCardRow from '../scanner/ScannerCardRow.jsx';
import MoveDialog from '../organize/MoveDialog.jsx';
import { EXPORT_FORMATS } from '../../lib/exporters/index.js';
import { LANGUAGES, DOMAIN_COLORS, domainLabel, rarityLabel, typeLabel } from '../../data/sampleCards.js';
import { displayLanguage, useDisplayFrench } from '../../lib/cardLocale.js';
import { SORTS } from '../../lib/catalog.js';
import useCollectionFilter from '../../hooks/useCollectionFilter.js';
import { GridTile, locationOf, placeOf, selectClass } from './collectionShared.jsx';
import { requestOpen } from '../../lib/navRequest.js';import { tx } from '../../lib/i18n.js';


// ─── Cards: search, filters, sort, virtualized list ─────────────────────
export const EMPTY_FILTERS = { set: 'all', type: 'all', rarity: 'all', domain: 'all', language: 'all', finish: 'all', location: 'all' };

export function CardsView({ scannedCards, onUpdateCard, onRemoveCard, onDeleteStacks, onClearAll, onExport, onOpen, org, onMoveStack, onImportEntries, defaultLanguage }) {
  const [moving, setMoving] = useState(null);
  // Selection mode: tap cards to select them, then delete them together.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const toggleSelect = useCallback((key) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), []);
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  useBackHandler(selecting, stopSelecting);
  const [importing, setImporting] = useState(false);
  const [layout, setLayoutState] = useState(() => {
    try { return localStorage.getItem('rb.collectionLayout') || 'grid'; } catch { return 'grid'; }
  });
  const setLayout = (v) => { setLayoutState(v); try { localStorage.setItem('rb.collectionLayout', v); } catch { /* ignore */ } };
  const grid = layout === 'grid' || selecting;
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allFrench, setAllFrench] = useDisplayFrench();
  // Search, filters, sort: shared with the PC interface
  const {
    prices, searchQuery, setSearchQuery, filters, setFilters, setFilter, sort, setSort,
    options, nameOf, priceOf, filteredCards, totalValue,
  } = useCollectionFilter(scannedCards, allFrench);
  // Order used to swipe between cards in the zoom (one entry per card)
  const openInList = useCallback((cardId, language) => {
    const seen = new Set();
    const list = [];
    for (const c of filteredCards) {
      if (seen.has(c.cardData.id)) continue;
      seen.add(c.cardData.id);
      list.push({ cardId: c.cardData.id, language: displayLanguage(c.language) });
    }
    onOpen(cardId, language, list);
  }, [filteredCards, onOpen]);

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== 'all').length;
  const isFiltered = !!searchQuery.trim() || activeFilters > 0;

  // Virtualized list: only the rows on screen are rendered, so thousands of
  // stacks stay smooth. The header scrolls with the list (scrollMargin).
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const [listOffset, setListOffset] = useState(0);
  // Re-measured after every render (the header above the list changes with the
  // filters, the selection bar…); React skips the update when the value is the same.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: no dependency list
  useLayoutEffect(() => {
    if (listRef.current) setListOffset(listRef.current.offsetTop);
  });
  // Columns follow the width: 3 on a phone, more on a PC (cards ~150 px wide).
  const [width, setWidth] = useState(390);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Side padding: 16 px each side on a phone, 32 px on a PC (lg:px-8)
  const PAD = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 64 : 32;
  const COLS = Math.max(3, Math.min(12, Math.floor((width - PAD + 10) / 160)));
  const rowCount = grid ? Math.ceil(filteredCards.length / COLS) : filteredCards.length;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (grid ? Math.round(((width - PAD) / COLS) * 1.4) + 90 : 96),
    overscan: 6,
    scrollMargin: listOffset,
    getItemKey: (i) => (grid ? `row-${i}` : filteredCards[i].key),
  });

  const totalCards = scannedCards.reduce((sum, c) => sum + c.quantity, 0);
  const filteredTotalCards = filteredCards.reduce((sum, c) => sum + c.quantity, 0);
  const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8">
        {/* Search, French display, filters, grid / list */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rift-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx('Nom, numéro…')}
              aria-label={tx('Rechercher une carte')}
              className="w-full h-11 pl-9 pr-9 bg-rift-800 border border-rift-600 text-[15px] text-rift-100 placeholder-rift-500 focus:outline-none focus:border-gold-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label={tx('Effacer la recherche')}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-rift-400 hover:text-rift-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setAllFrench(!allFrench)}
            aria-pressed={allFrench}
            title={allFrench ? tx('Noms et textes en français pour toutes les cartes (toucher pour revenir à la langue de chaque carte)') : tx('Afficher toutes les cartes en français')}
            className={`w-11 h-11 border text-xs font-bold ${allFrench ? 'bg-gold-500/15 text-gold-400 border-gold-500/60' : 'bg-rift-800 text-rift-300 border-rift-600'}`}
          >
            {tx('FR')}
          </button>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            aria-label={tx('Filtres et tri{v0}', { v0: activeFilters ? ` (${activeFilters} actifs)` : '' })}
            aria-expanded={filtersOpen}
            className={`relative w-11 h-11 border flex items-center justify-center ${activeFilters || filtersOpen ? 'bg-gold-500/15 text-gold-400 border-gold-500/60' : 'bg-rift-800 text-rift-300 border-rift-600'}`}
          >
            <SlidersHorizontal className="w-[18px] h-[18px]" />
            {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-gold-500 text-rift-900 text-[11px] font-bold flex items-center justify-center">{activeFilters}</span>}
          </button>
          <button
            onClick={() => setLayout(grid ? 'list' : 'grid')}
            aria-label={grid ? tx('Afficher en liste (modifier les exemplaires)') : tx('Afficher en grille')}
            title={grid ? tx('Liste : modifier état, langue, emplacement…') : tx('Grille')}
            className="w-11 h-11 border bg-rift-800 text-rift-300 border-rift-600 flex items-center justify-center"
          >
            {grid ? <List className="w-[18px] h-[18px]" /> : <LayoutGrid className="w-[18px] h-[18px]" />}
          </button>
        </div>

        {/* Domain: a dropdown (the chips took a whole row) */}
        <label className="flex items-center gap-2 text-xs text-rift-400">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mx-[3px]" style={{ background: filters.domain === 'all' ? '#c8aa6e' : DOMAIN_COLORS[filters.domain]?.hex }} />
          <span className="flex-shrink-0">{tx('Domaine')}</span>
          <select value={filters.domain} onChange={e => setFilter('domain', e.target.value)} aria-label={tx('Filtrer par domaine')} className={`${selectClass} flex-1 min-w-0`}>
            <option value="all">{tx('Tous domaines')}</option>
            {['fury', 'calm', 'mind', 'body', 'chaos', 'order', 'colorless'].filter(d => options.domains.has(d) || filters.domain === d).map(d => <option key={d} value={d}>{domainLabel(d)}</option>)}
          </select>
        </label>

        {/* Sort: always visible (price, name, set…), and « Ajouter » (a card by its name or number) */}
        <div className="flex items-center gap-2">
          <label className="flex-1 min-w-0 flex items-center gap-2 text-xs text-rift-400">
            <ArrowUpDown className="w-4 h-4 text-gold-400 flex-shrink-0" />
            <span className="flex-shrink-0">{tx('Trier par')}</span>
            <select value={sort} onChange={e => setSort(e.target.value)} aria-label={tx('Trier par')} className={`${selectClass} flex-1 min-w-0`}>
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <button onClick={() => requestOpen({ kind: 'search', mode: 'add' })} className="btn-primary h-10 px-3 text-sm flex-shrink-0" title={tx('Ajouter une carte par son nom ou son numéro')}>
            <Plus className="w-4 h-4" /> {tx('Ajouter')}
          </button>
        </div>

        {filtersOpen && (
          <div className="panel p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <FilterSelect label={tx('Extension')} value={filters.set} onChange={v => setFilter('set', v)}
              options={[...options.sets].map(([v, l]) => [v, `${l} (${v})`])} />
            <FilterSelect label={tx('Type')} value={filters.type} onChange={v => setFilter('type', v)}
              options={[...options.types].map(v => [v, typeLabel(v)])} />
            <FilterSelect label={tx('Rareté')} value={filters.rarity} onChange={v => setFilter('rarity', v)}
              options={[...options.rarities].map(v => [v, rarityLabel(v)])} />
            <FilterSelect label={tx('Domaine')} value={filters.domain} onChange={v => setFilter('domain', v)}
              options={[...options.domains].map(v => [v, domainLabel(v)])} />
            <FilterSelect label={tx('Langue')} value={filters.language} onChange={v => setFilter('language', v)}
              options={[...options.languages].map(([v, n]) => [v, `${LANGUAGES.find(l => l.value === v)?.label || v} (${n})`])} />
            <FilterSelect label={tx('Finition')} value={filters.finish} onChange={v => setFilter('finish', v)}
              options={[['foil', tx('Foil')], ['promo', tx('Promo')], ['standard', tx('Standard')]]} />
            <FilterSelect label={tx('Emplacement')} value={filters.location} onChange={v => setFilter('location', v)}
              options={[
                ['none', tx('Sans emplacement')],
                ...org.boxes.items.map(b => [`box:${b.id}`, tx('Boîte : {name}', { name: b.name })]),
                ...org.decks.items.map(d => [`deck:${d.id}`, tx('Deck : {name}', { name: d.name })]),
                ['loan', tx('Prêtées')],
              ]} />
            {activeFilters > 0 && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="self-end h-8 text-xs text-rift-300 hover:text-rift-100">
                {tx('Effacer les filtres')}
              </button>
            )}
          </div>
        )}

        {/* Action bar */}
        {selecting ? (
          <div className="sticky top-0 z-20 -mx-4 px-4 lg:-mx-8 lg:px-8 py-2 flex items-center gap-2 bg-rift-900 border-b border-gold-500/30">
            <button onClick={stopSelecting} aria-label={tx('Quitter la sélection')} className="w-10 h-10 flex items-center justify-center text-rift-100"><X className="w-5 h-5" /></button>
            <span className="flex-1 text-sm font-semibold text-rift-100">{selected.size ? tx('{size} à supprimer', { size: selected.size }) : tx('Sélectionnez les cartes à supprimer')}</span>
            <button onClick={() => setSelected(new Set(filteredCards.map(c => c.key)))} className="btn-ghost h-10 px-2.5 text-xs">{tx('Tout')}</button>
            <button
              disabled={selected.size === 0}
              onClick={() => { onDeleteStacks(filteredCards.filter(c => selected.has(c.key))); stopSelecting(); }}
              className="btn-secondary h-10 px-3 text-xs !text-[#ff8a80] !border-[#ff8a80]/50"
            >
              <Trash2 className="w-4 h-4" /> {tx('Supprimer')}
            </button>
          </div>
        ) : (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-rift-300 mr-auto">
            {isFiltered
              ? (filteredTotalCards > 0 ? plural(filteredTotalCards, 'carte') : tx('Aucun résultat'))
              : (totalCards > 0 ? '' : tx('Aucune carte'))}
            {isFiltered && totalValue != null && totalValue > 0 && <span className="ml-1.5 font-semibold text-gold-400">{euro(totalValue)}</span>}
          </span>
          {onImportEntries && (
            <button onClick={() => setImporting(true)} className="btn-ghost h-10 px-2.5 text-xs" title={tx('Importer une collection (CSV)')}>
              <Upload className="w-4 h-4" /> {tx('Importer')}
            </button>
          )}
          {importing && (
            <ImportCsvDialog defaultLanguage={defaultLanguage} onClose={() => setImporting(false)}
              onImport={(entries) => { onImportEntries(entries); setImporting(false); }} />
          )}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((open) => !open)}
              disabled={scannedCards.length === 0}
              className="btn-ghost h-10 px-2.5 text-xs"
            >
              <Download className="w-4 h-4" />
              {tx('Exporter')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportMenuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label={tx('Fermer le menu d’export')} onClick={() => setExportMenuOpen(false)} />
                <div className="absolute right-0 mt-2 z-20 w-56 bg-rift-800 border border-gold-500/40 shadow-xl overflow-hidden">
                  {EXPORT_FORMATS.map((format, i) => (
                    <button
                      key={format.id}
                      onClick={() => { setExportMenuOpen(false); onExport(format.id); }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-rift-700 transition-colors ${i > 0 ? 'border-t border-rift-700/60' : ''}`}
                    >
                      <div className="text-xs font-semibold text-rift-100">{format.label}</div>
                      <div className="text-[11px] text-rift-400 mt-0.5">{format.description}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setSelecting(true)}
            disabled={scannedCards.length === 0}
            className="btn-ghost w-10 h-10 !p-0 text-[#ff8a80] hover:bg-red-400/10 disabled:opacity-30"
            title={tx('Supprimer des cartes : choisissez-les ensuite')}
            aria-label={tx('Supprimer des cartes')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        )}

        {scannedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="w-10 h-10 text-rift-600 mb-3" />
            <p className="text-sm text-rift-400">{tx('Aucune carte dans votre collection')}</p>
            <p className="text-xs text-rift-500 mt-1">{tx('Utilisez l’onglet Scanner pour détecter et ajouter des cartes')}</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-10 h-10 text-rift-600 mb-3" />
            <p className="text-sm text-rift-400">{tx('Aucune carte ne correspond à vos filtres')}</p>
            <p className="text-xs text-rift-500 mt-1">{tx('Essayez une autre recherche ou d’autres filtres')}</p>
          </div>
        ) : (
          <>
            <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                if (grid) {
                  const row = filteredCards.slice(item.index * COLS, item.index * COLS + COLS);
                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 right-0 pb-3 grid gap-2.5"
                      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
                    >
                      {row.map(card => (
                        <GridTile key={card.key} card={card} name={nameOf(card)} price={prices ? priceOf(card) : null} place={placeOf(card, org)} onOpen={openInList}
                          selecting={selecting} selected={selected.has(card.key)} onToggle={toggleSelect} />
                      ))}
                    </div>
                  );
                }
                const card = filteredCards[item.index];
                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 right-0 pb-2"
                    style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
                  >
                    <ScannerCardRow
                      card={card}
                      onUpdate={onUpdateCard}
                      onRemove={onRemoveCard}
                      onOpen={openInList}
                      onMove={setMoving}
                      locationLabel={locationOf(card, org)}
                      price={prices ? priceOf(card) : null}
                    />
                  </div>
                );
              })}
            </div>
            {moving && <MoveDialog stack={moving} org={org} onMove={onMoveStack} onClose={() => setMoving(null)} />}
            <p className="text-[11px] text-rift-500 text-center pt-2">
              {grid
                ? <><span className="lg:hidden">{tx('Touchez une carte')}</span><span className="hidden lg:inline">{tx('Cliquez sur une carte')}</span> {tx('pour la voir en grand · vue Liste pour modifier état, langue, emplacement')}</>
                : tx('NM = Quasi neuf · LP = Légèrement joué · MP = Moyennement joué · HP = Très joué · D = Abîmé')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="text-[11px] text-rift-400 space-y-1">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${selectClass} w-full`}>
        <option value="all">{tx('Tous')}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
