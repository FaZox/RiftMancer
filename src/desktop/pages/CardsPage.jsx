// PC « Cartes » page — « Atelier »: the whole catalog, owned or not, with an always-visible icon filter panel,
// every card in colour, full names, and the « Reliquaire » card sheet.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Heart, Layers } from 'lucide-react';
import CardTile from '../../components/cards/CardTile.jsx';
import AtelierFilters from '../../components/cards/AtelierFilters.jsx';
import ThemedSelect from '../../components/common/ThemedSelect.jsx';
import useReliquary from '../../components/collection/useReliquary.jsx';
import useCardsBrowser from '../../hooks/useCardsBrowser.js';
import { ActiveChips, SyntaxHelp, useCardsActions } from '../../components/cards/CardsParts.jsx';
import { CARD_SORTS } from '../../lib/cardsBrowser.js';
import { displayName } from '../../lib/cardLocale.js';
import { euro } from '../../lib/prices.js';
import { locale, tx } from '../../lib/i18n.js';

const WINDOW = 30; // cards each side of the opened one kept for the carousel
const STEP = 120; // tiles drawn per step while scrolling
const MIN_TILE = 120; const MAX_TILE = 240; const DEFAULT_TILE = 170;

export default function CardsPage({ scannedCards, wishlist, org, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, onQuickAdd, notify, defaultLanguage }) {
  const b = useCardsBrowser({ scannedCards, decks: org.decks.items, wishlist });
  const a = useCardsActions({ b, wishlist, decks: org.decks, onQuickAdd, notify });
  const zoom = useReliquary({ stacks: scannedCards, wishlist, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, org, defaultLanguage });
  const searchRef = useRef(null);
  const scrollRef = useRef(null);
  const sentinel = useRef(null);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [limit, setLimit] = useState(STEP);
  const tile = Math.min(MAX_TILE, Math.max(MIN_TILE, Number(b.view.tile) || DEFAULT_TILE));

  // Ctrl+F: the search of the page (Ctrl+K stays the global search)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Progressive rendering: more tiles as the end of the grid comes into view
  useEffect(() => { setLimit(STEP); scrollRef.current?.scrollTo?.(0, 0); }, [b.items]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) setLimit(n => n + STEP); }, { root: scrollRef.current, rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [b.items, limit]);

  const open = useCallback((id, forge = false) => {
    const i = b.items.findIndex(g => g.card.id === id);
    if (i < 0) return;
    const list = b.items.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).map(g => g.card.id);
    zoom.open(id, { list, forge });
  }, [b.items, zoom]);
  const wish = useCallback((id) => wishlist.setWanted(id, wishlist.byCard.has(id) ? 0 : 1), [wishlist]);
  const nameOf = useCallback((c) => displayName(c), []);

  const shown = b.items.slice(0, limit);
  const n = b.items.length.toLocaleString(locale());
  return (
    <div className="flex-1 min-h-0 flex">
      <AtelierFilters b={b} searchRef={searchRef} onHelp={() => setHelp(true)} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex-shrink-0 px-6 py-3 flex items-center gap-3 flex-wrap border-b border-gold-500/15">
          <h1 className="font-display text-[22px] font-bold text-gold-400 mr-1">{tx('{n} cartes', { n })}</h1>
          <div className="flex-1 min-w-[120px]"><ActiveChips b={b} /></div>
          <ThemedSelect value={b.view.sort} onChange={(v) => b.setView({ sort: v })} label={tx('Trier')} className="w-[190px]"
            buttonClassName="h-9 px-3 bg-rift-800 border border-rift-600 hover:border-gold-500/50 text-rift-300 text-xs font-semibold"
            options={CARD_SORTS.map(s => ({ value: s.value, label: s.label }))} />
          <label className="flex items-center gap-2 text-[12px] text-rift-400" data-help="cards.size">
            {tx('Taille')}
            <input type="range" min={MIN_TILE} max={MAX_TILE} step={10} value={tile} onChange={e => b.setView({ tile: Number(e.target.value) })} className="w-[110px] accent-[#c8aa6e]" aria-label={tx('Taille')} />
          </label>
          <div className="relative" data-help="cards.actions">
            <button type="button" className="chip !h-9 !w-9 !px-0" aria-haspopup="menu" aria-expanded={menu} aria-label={tx('Plus d’actions')} title={tx('Plus d’actions')} onClick={() => setMenu(m => !m)}>
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-10 z-30 w-[240px] bg-rift-800 border border-gold-500/40 shadow-xl py-1" onMouseLeave={() => setMenu(false)}>
                <button role="menuitem" type="button" disabled={!b.counts.missing} onClick={() => { setMenu(false); a.missingToWish(); }} className="w-full flex items-center gap-2 px-3 h-10 text-[13px] text-rift-100 hover:bg-rift-700 disabled:opacity-40">
                  <Heart className="w-4 h-4 text-[#ff8ab8]" aria-hidden="true" /> {tx('Manquantes → souhaits')}
                </button>
                <button role="menuitemcheckbox" aria-checked={b.view.grouped} type="button" onClick={() => { setMenu(false); b.setView({ grouped: !b.view.grouped }); }} className="w-full flex items-center gap-2 px-3 h-10 text-[13px] text-rift-100 hover:bg-rift-700">
                  <Layers className="w-4 h-4" aria-hidden="true" /> {tx('Regrouper les impressions')} {b.view.grouped ? '✓' : ''}
                </button>
              </div>
            )}
          </div>
        </div>

        <section ref={scrollRef} aria-label={tx('Résultats')} className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-12" data-help="cards.grid">
          {b.items.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <p className="font-display text-xl text-gold-400">{tx('Aucune carte ne correspond')}</p>
              <button type="button" onClick={() => { b.setQuery(''); b.setView({ ownership: 'all' }); }} className="btn-secondary mx-auto text-sm">{tx('Tout effacer')}</button>
            </div>
          ) : (
            <div className="grid justify-start" style={{ gridTemplateColumns: `repeat(auto-fill, ${tile}px)`, columnGap: 22, rowGap: 16 }}>
              {shown.map(g => (
                <CardTile key={g.card.id} card={g.card} name={nameOf(g.card)} owned={g.owned} wished={wishlist.byCard.has(g.card.id)} width={tile}
                  foil={false} onOpen={(id) => open(id)} onAdd={(id) => open(id, true)} onWish={wish}
                  caption={`${g.card.set} · ${String(g.card.collectorNumber || '').replace(/\/.*/, '')}${b.priceOf(g.card) != null ? ` · ${euro(b.priceOf(g.card))}` : ''}`} />
              ))}
              {limit < b.items.length && <div ref={sentinel} className="col-span-full h-10" aria-hidden="true" />}
            </div>
          )}
        </section>
      </div>
      {help && <SyntaxHelp onClose={() => setHelp(false)} />}
      {zoom.element}
    </div>
  );
}
