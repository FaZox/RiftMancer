// Phone « Cartes » tab — « Atelier » mobile (maquette mobile-reference.html écrans 4–5) :
// en-tête « Cartes », recherche pleine largeur avec le compteur, rangée « Filtres » (+ badge)
// et interrupteur « Regrouper les impressions » (le menu ⋯ et ses options ont été retirés :
// ils dépassaient du cadre du téléphone), grille de 3 colonnes, cartes en couleur.
// Toucher une carte = zoom « Reliquaire » (fenêtre de ±30 cartes) ; ＋ = zoom + panneau d'ajout.
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Search, Layers, Check } from 'lucide-react';

import CardZoom from '../collection/CardZoom.jsx';

import Sheet from '../common/Sheet.jsx';

import CardTileMobile from './CardTileMobile.jsx';

import useCardsBrowser from '../../hooks/useCardsBrowser.js';

import { CardsGrid, MobileFilters } from './CardsParts.jsx';

import { hasKeys } from '../../lib/cardQuery.js';

import { takeRequest, onRequest } from '../../lib/navRequest.js';

import { locale, tx, tp } from '../../lib/i18n.js';

const WINDOW = 30; // cards each side of the opened one kept for the carousel

export default function CardsTab({ scannedCards, wishlist, org, onAddCopy, onAddCopies, onRemoveCopy, onUpdateCard, defaultLanguage }) {
  const b = useCardsBrowser({ scannedCards, decks: org.decks.items, wishlist });
  const scrollRef = useRef(null);
  const [sheet, setSheet] = useState(null); // 'filters'
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
  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 flex flex-col">
        <div className="mh">
          <h2>{tx('Cartes')}</h2>
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
          <button type="button" className={`tk ${b.view.grouped ? 'on' : ''}`} aria-pressed={b.view.grouped} data-help="cards.grouped"
            onClick={() => b.setView({ grouped: !b.view.grouped })}>
            <Layers style={{ width: 13, height: 13 }} aria-hidden="true" /> {tx('Regrouper les impressions')}
            {b.view.grouped ? <Check style={{ width: 13, height: 13 }} aria-hidden="true" /> : null}
          </button>
        </div>
      </header>

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
