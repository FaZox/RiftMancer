// Phone « Cartes » tab — « Atelier » mobile (maquette mobile-reference.html écrans 4–5) :
// en-tête « Cartes » + menu ⋯, recherche pleine largeur avec le compteur, ligne qui
// défile (bouton « Filtres » + badge hexagonal, filtres actifs en étiquettes, « Toutes ▾ »),
// grille de 3 colonnes (2 via ⋯) avec toutes les cartes en couleur et les noms complets.
// Toucher une carte = zoom « Reliquaire » (fenêtre de ±30 cartes) ; ＋ = zoom + panneau d'ajout.
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Search, MoreHorizontal, Heart, Layers, ScanLine, Check, SlidersHorizontal } from 'lucide-react';

import CardZoom from '../collection/CardZoom.jsx';

import Sheet from '../common/Sheet.jsx';

import CardTileMobile from './CardTileMobile.jsx';

import useCardsBrowser from '../../hooks/useCardsBrowser.js';

import { ActiveChips, SyntaxHelp, CardsGrid, useCardsActions, MobileFilters } from './CardsParts.jsx';

import { hasKeys } from '../../lib/cardQuery.js';

import { takeRequest, onRequest } from '../../lib/navRequest.js';

import { locale, tx, tp } from '../../lib/i18n.js';

const WINDOW = 30; // cards each side of the opened one kept for the carousel

export default function CardsTab({ scannedCards, wishlist, org, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, notify, defaultLanguage, onFind }) {
  const b = useCardsBrowser({ scannedCards, decks: org.decks.items, wishlist });
  const a = useCardsActions({ b, wishlist, notify });
  const scrollRef = useRef(null);
  const [sheet, setSheet] = useState(null); // 'filters' | 'help'
  const [menu, setMenu] = useState(false);
  const [ownMenu, setOwnMenu] = useState(null); // anchor rect
  const [zoom, setZoom] = useState(() => { const r = takeRequest('cardsFind'); return r?.cardId ? { id: r.cardId, list: null, forge: false } : null; });
  useEffect(() => onRequest((q) => {
    if (q.kind === 'cardsFind') { const r = takeRequest('cardsFind'); if (r?.cardId) setZoom({ id: r.cardId, list: null, forge: false }); }
  }), []);

  const open = useCallback((id, forge = false) => {
    const i = b.items.findIndex(g => g.card.id === id);
    if (i < 0) { setZoom({ id, list: null, forge }); return; }
    const list = b.items.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).map(g => g.card.id);
    setZoom({ id, list, forge });
  }, [b.items]);

  const nFilters = b.parsed.tokens.length;
  const cols = b.view.cols === 2 ? 2 : 3;
  const fmt = (v) => v.toLocaleString(locale());
  const ownLabel = { all: tx('Toutes'), owned: tx('Possédées'), missing: tx('Manquantes') }[b.view.ownership] || tx('Toutes');
  const ownBtnRef = useRef(null);

  const menuItem = 'w-full flex items-center gap-2 px-3 h-11 text-[13px] text-rift-100 hover:bg-rift-700 disabled:opacity-40 text-left';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 flex flex-col">
        <div className="mh">
          <h2>{tx('Cartes')}</h2>
          <div className="relative">
            <button type="button" className="ib" style={{ position: 'relative' }} aria-haspopup="menu" aria-expanded={menu} aria-label={tx('Plus d’actions')} title={tx('Plus d’actions')} onClick={() => setMenu(m => !m)} data-help="cards.actions">
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-10 z-30 w-[240px] bg-rift-800 border border-gold-500/40 shadow-xl py-1" onMouseLeave={() => setMenu(false)}>
                <button role="menuitem" type="button" disabled={!b.counts.missing} onClick={() => { setMenu(false); a.missingToWish(); }} className={menuItem}>
                  <Heart className="w-4 h-4 text-[#ff8ab8]" aria-hidden="true" /> {tx('Manquantes → souhaits')}
                </button>
                <button role="menuitemcheckbox" aria-checked={b.view.grouped} type="button" onClick={() => { b.setView({ grouped: !b.view.grouped }); setMenu(false); }} className={menuItem}>
                  <Layers className="w-4 h-4" aria-hidden="true" /> {tx('Regrouper les impressions')} {b.view.grouped ? <Check className="w-4 h-4 ml-auto" aria-hidden="true" /> : null}
                </button>
                <button role="menuitemcheckbox" aria-checked={cols === 2} type="button" onClick={() => { b.setView({ cols: cols === 3 ? 2 : 3 }); setMenu(false); }} className={menuItem}>
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> {cols === 3 ? tx('Grille de 2 colonnes') : tx('Grille de 3 colonnes')}
                </button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setSheet('help'); }} className={menuItem}>
                  <span className="w-4 text-center font-mono text-[13px]" aria-hidden="true">?</span> {tx('Aide sur la syntaxe de recherche')}
                </button>
                {onFind && (
                  <button role="menuitem" type="button" onClick={() => { setMenu(false); onFind(); }} className={menuItem}>
                    <ScanLine className="w-4 h-4" aria-hidden="true" /> {tx('Trouver une carte avec le scanner')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <label className="qm">
          <Search aria-hidden="true" />
          <input type="text" value={b.input} onChange={e => b.setInput(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off"
            placeholder={tx('Nom, mot-clé ou effet…')} aria-label={tx('Rechercher une carte')}
            className={hasKeys(b.input) ? 'font-mono' : ''} />
          <span className="k">{tp(b.items.length, '{n} carte', '{n} cartes', { n: fmt(b.items.length) })}</span>
        </label>

        <div className="crow">
          <button type="button" className="fbt" onClick={() => setSheet('filters')} data-help="cards.filtersheet"
            aria-label={nFilters ? tp(nFilters, 'Filtres, {n} actif', 'Filtres, {n} actifs', { n: nFilters }) : tx('Filtres')}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} aria-hidden="true"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg>
            {tx('Filtres')}
            {nFilters > 0 && <i>{nFilters}</i>}
          </button>
          <ActiveChips b={b} className="flex-nowrap w-max" withClear={false} />
          <button ref={ownBtnRef} type="button" className="tk dash" aria-haspopup="menu" aria-expanded={!!ownMenu}
            onClick={() => { const r = ownBtnRef.current?.getBoundingClientRect(); setOwnMenu(ownMenu ? null : { top: (r?.bottom || 0) + 4, left: Math.max(8, (r?.left || 0) - 120) }); }}>
            {ownLabel} ▾
          </button>
        </div>
      </header>

      {ownMenu && (
        <div role="menu" className="fixed z-50 w-[180px] bg-rift-800 border border-gold-500/40 shadow-xl py-1"
          style={{ top: ownMenu.top, left: ownMenu.left }} onMouseLeave={() => setOwnMenu(null)}>
          {[['all', tx('Toutes')], ['owned', tx('Possédées')], ['missing', tx('Manquantes')]].map(([v, l]) => (
            <button key={v} role="menuitemradio" aria-checked={b.view.ownership === v} type="button"
              onClick={() => { b.setView({ ownership: v, scroll: 0 }); setOwnMenu(null); }} className={menuItem}>
              {l} {b.view.ownership === v && <Check className="w-4 h-4 ml-auto" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-[14px] pb-6">
        {b.items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="font-display text-lg text-gold-400">{tx('Aucune carte ne correspond')}</p>
            <button type="button" onClick={() => { b.setQuery(''); b.setView({ ownership: 'all' }); }} className="btn-secondary mx-auto text-sm">{tx('Tout effacer')}</button>
          </div>
        ) : (
          <CardsGrid b={b} scrollRef={scrollRef} fixedCols={cols} gap={10} withSets={false}
            renderTile={(g) => (
              <CardTileMobile key={g.card.id} card={g.card} name={b.nameOf(g.card)} owned={g.owned}
                wished={wishlist.byCard.has(g.card.id)}
                onOpen={(id) => open(id)} onAdd={(id) => open(id, true)} />
            )} />
        )}
      </main>

      <Sheet open={sheet === 'filters'} title={tx('Filtres')} onClose={() => setSheet(null)}
        action={(nFilters > 0 || b.view.ownership !== 'all') ? (
          <button type="button" onClick={() => { b.setQuery(''); b.setView({ ownership: 'all' }); }}>{tx('Tout effacer')}</button>
        ) : undefined}
        footer={(
          <button type="button" className="go" onClick={() => setSheet(null)}>
            {tp(b.items.length, 'Voir {n} carte', 'Voir {n} cartes', { n: fmt(b.items.length) })}
          </button>
        )}>
        <MobileFilters b={b} />
      </Sheet>

      {sheet === 'help' && <SyntaxHelp onClose={() => setSheet(null)} />}

      {zoom && (
        <CardZoom
          cardId={zoom.id}
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
