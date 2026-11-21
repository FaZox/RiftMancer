import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import CardTile from '../collection/CardTile.jsx';
import { allCards, compareCollector } from '../../lib/catalog.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { fitsLegend } from '../../lib/deckRules.js';

import { useBackHandler } from '../../lib/backButton.js';import { tx } from '../../lib/i18n.js';

const TYPES = [
  ['all', tx('Tout')], ['unit', tx('Unités')], ['spell', tx('Sorts')], ['gear', tx('Équipements')],
  ['rune', tx('Runes')], ['battlefield', tx('Champs de bataille')], ['legend', tx('Légendes')],
];
const MAX_RESULTS = 150;

/**
 * Catalog search to add cards to a deck. `onPick(cardData)` is called on tap;
 * `countOf(cardId)` shows how many are already in the deck.
 */
export default function CardPicker({ title, legend, onlyType, initialQuery = '', ownedByCard, countOf, onPick, onClose, onZoom }) {
  useBackHandler(true, onClose);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(onlyType || 'all');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [respectLegend, setRespectLegend] = useState(true);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const out = [];
    for (const c of allCards()) {
      if (type !== 'all' && c.type !== type) continue;
      if (onlyOwned && !ownedByCard.has(c.id)) continue;
      if (respectLegend && legend && c.type !== 'legend' && !fitsLegend(c, legend)) continue;
      if (q && !c.name.toLowerCase().includes(q) && !(c.nameEn || '').toLowerCase().includes(q) && !getLocalizedName(c, displayLanguage()).toLowerCase().includes(q)
        && !(c.collectorNumber || '').toLowerCase().includes(q) && !(c.code || '').toLowerCase().includes(q)) continue;
      out.push(c);
    }
    return out.sort(compareCollector);
  }, [query, type, onlyOwned, respectLegend, legend, ownedByCard]);

  return (
    <div className="fixed inset-0 z-50 bg-rift-900/95 backdrop-blur-sm flex flex-col">
      <div className="p-4 space-y-3 border-b border-rift-700/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-rift-100 mr-auto">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-rift-300 hover:bg-rift-700" aria-label={tx('Fermer')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rift-500" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tx('Nom (FR ou EN), numéro ou code (OGN-042)…')}
            className="w-full h-10 pl-9 pr-3 bg-rift-800/60 border border-rift-600/30 rounded-xl text-sm text-rift-100 placeholder-rift-500 focus:outline-none focus:border-gold-500/60"
          />
        </div>
        {!onlyType && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TYPES.map(([v, l]) => (
              <button key={v} onClick={() => setType(v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap ${type === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-[11px] text-rift-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} /> {tx('Seulement mes cartes')}</label>
          {legend && (
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={respectLegend} onChange={e => setRespectLegend(e.target.checked)} /> {tx('Domaines de la Légende')}</label>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-[11px] text-rift-500 mb-2">
          {results.length} {tx('carte')}{results.length > 1 ? 's' : ''}{results.length > MAX_RESULTS ? tx(' — affinez la recherche ({MAX_RESULTS} affichées)', { MAX_RESULTS }) : ''} {tx('· touchez une carte pour l’ajouter · maintenez le doigt dessus pour la voir en grand')}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {results.slice(0, MAX_RESULTS).map(c => {
            const inDeck = countOf?.(c.id) || 0;
            return (
              <CardTile
                key={c.id}
                cardData={c}
                owned={ownedByCard.has(c.id) || !onlyOwned}
                badge={inDeck ? `×${inDeck}` : (ownedByCard.get(c.id) || undefined)}
                badgeClass={inDeck ? 'bg-gold-400 text-rift-900' : 'bg-rift-700 text-rift-200'}
                onOpen={() => onPick(c)}
                onZoom={onZoom}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
