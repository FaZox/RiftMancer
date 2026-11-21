// PC deck editor: resizable card catalog and the preview column.
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Check, Search, Swords } from 'lucide-react';
import CardTile from '../../components/collection/CardTile.jsx';
import CardImage from '../../components/common/CardImage.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { fullImageSrc } from '../../lib/nativeAssets.js';
import { legendChampion, isChampionFor, fitsLegend, banStatus, frenchDate } from '../../lib/deckRules.js';
import { getBanlist } from '../../lib/banlist.js';
import { allCards, compareCollector } from '../../lib/catalog.js';
import { euro } from '../../lib/prices.js';
import { tx } from '../../lib/i18n.js';

export const CATALOG_MIN = 320;     // px

export const CATALOG_DEFAULT = 400; // px

export const DECK_MIN = 520;        // px: the deck stays visible

export const PREVIEW_W = 300;       // px: the preview column

export const TYPES = [
  ['all', tx('Tout')], ['unit', tx('Unités')], ['spell', tx('Sorts')], ['gear', tx('Équipements')], ['rune', tx('Runes')], ['battlefield', tx('Champs')],
];

export const MAX = 240;

/**
 * Catalog panel: search, click a card to add it (or to choose the legend /
 * champion). The card under the mouse is shown in big in the « aperçu » at the
 * bottom of the panel — it never covers the deck — with its own buttons.
 */
export function Catalog({ width, onResizeStart, onResetWidth, pick, setPick, toSide, setToSide, legend, ownedByCard, countOf, onPick, onZoom, onHover, previewId }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [respectLegend, setRespectLegend] = useState(true);
  const champ = legend ? legendChampion(legend) : '';
  const hoverTimer = useRef(null);
  const hoverIn = (c) => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => onHover(c), 100); };
  const hoverOut = () => clearTimeout(hoverTimer.current);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const out = [];
    for (const c of allCards()) {
      if (pick === 'legend') { if (c.type !== 'legend') continue; }
      else if (pick === 'champion') { if (!isChampionFor(c, legend)) continue; }
      else {
        if (c.type === 'legend') continue;
        if (type !== 'all' && c.type !== type) continue;
        if (respectLegend && legend && !fitsLegend(c, legend)) continue;
      }
      if (onlyOwned && !ownedByCard.has(c.id)) continue;
      if (q && !c.name.toLowerCase().includes(q) && !(c.nameEn || '').toLowerCase().includes(q)
        && !getLocalizedName(c, displayLanguage()).toLowerCase().includes(q) && !(c.collectorNumber || '').toLowerCase().includes(q)) continue;
      out.push(c);
    }
    return out.sort(compareCollector);
  }, [query, type, onlyOwned, respectLegend, legend, ownedByCard, pick]);

  const title = pick === 'legend' ? tx('Choisir la Légende') : pick === 'champion' ? tx('Choisir le champion « {champ} »', { champ }) : tx('Ajouter des cartes');
  return (
    <aside className="relative flex-shrink-0 flex flex-col border-l border-gold-500/20 bg-rift-800/40" style={{ width, minWidth: CATALOG_MIN, maxWidth: `calc(100% - ${DECK_MIN + PREVIEW_W}px)` }}>
      {/* Drag handle: pull left to make the catalog bigger (double-click: default size) */}
      <div role="separator" aria-orientation="vertical" aria-label={tx('Redimensionner le catalogue')} title={tx('Glisser pour redimensionner · double-clic : taille par défaut')}
        onPointerDown={onResizeStart} onDoubleClick={onResetWidth}
        className="group absolute -left-1.5 top-0 bottom-0 w-3 z-20 cursor-col-resize flex items-center justify-center">
        <span className="w-[3px] h-full bg-transparent group-hover:bg-gold-500/60 transition-colors" />
        <span className="absolute top-1/2 -translate-y-1/2 w-2.5 h-12 bg-rift-700 border border-gold-500/50 group-hover:bg-gold-500/40" />
      </div>

      <div className="px-5 pt-4 pb-3 space-y-3 border-b border-rift-600/40">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-gold-400 flex-1">{title}</h2>
          {pick !== 'cards' && legend && <button onClick={() => setPick('cards')} className="text-sm text-rift-300 hover:text-rift-100">{tx('Annuler')}</button>}
        </div>
        {pick === 'cards' && (
          <div>
            <p className="text-xs text-rift-400 mb-1">{tx('Un clic sur une carte l’ajoute à :')}</p>
            <div className="seg" role="group" aria-label={tx('Un clic ajoute')}>
              <button aria-pressed={!toSide} onClick={() => setToSide(false)}>{!toSide && <Check className="w-4 h-4" />} {tx('Deck')}</button>
              <button aria-pressed={toSide} onClick={() => setToSide(true)}>{toSide && <Check className="w-4 h-4" />} {tx('Réserve')}</button>
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rift-500 pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('Nom (FR ou EN) ou numéro…')} className="input-field !pl-9 h-10" />
        </div>
        {pick === 'cards' && (
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(([v, l]) => <button key={v} className="chip" aria-pressed={type === v} onClick={() => setType(v)}>{l}</button>)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-rift-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} className="accent-[#c8aa6e]" /> {tx('Seulement mes cartes')}</label>
          {legend && pick === 'cards' && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={respectLegend} onChange={e => setRespectLegend(e.target.checked)} className="accent-[#c8aa6e]" /> {tx('Domaines de la Légende')}</label>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <p className="text-xs text-rift-500 mb-3">{results.length} {tx('carte')}{results.length > 1 ? 's' : ''}{results.length > MAX ? tx(' — affinez la recherche ({MAX} affichées)', { MAX }) : ''} {tx('· clic :')} {pick === 'cards' ? (toSide ? tx('ajouter à la Réserve') : 'ajouter au Deck') : 'choisir'} {tx('· clic droit / molette : fiche complète')}</p>
        {/* Always 2 cards per row: big enough to recognise them, the preview column shows them in big */}
        <div className="grid gap-3 grid-cols-2">
          {results.slice(0, MAX).map(c => {
            const inDeck = countOf(c.id);
            return (
              <div key={c.id} onMouseEnter={() => hoverIn(c)} onMouseLeave={hoverOut}
                className={previewId === c.id ? 'outline outline-2 outline-gold-400/70 outline-offset-2' : ''}>
                <CardTile cardData={c} owned={ownedByCard.has(c.id) || !onlyOwned}
                  badge={inDeck ? `×${inDeck}` : (ownedByCard.get(c.id) || undefined)}
                  badgeClass={inDeck ? 'bg-gold-400 text-rift-900' : 'bg-rift-700 text-rift-200'}
                  onOpen={() => onPick(c)} onZoom={onZoom} hd />
              </div>
            );
          })}
        </div>
      </div>

    </aside>
  );
}

/** Column on the right: the last card hovered (deck or catalog), readable, with its buttons. */
export function PreviewColumn({ card, pick, inDeck, owned, price, missing, onAddTo, onPick, onZoom }) {
  const canSide = card && card.type !== 'rune' && card.type !== 'battlefield' && card.type !== 'legend';
  return (
    <aside aria-label={tx('Aperçu')} className="flex-shrink-0 border-l border-gold-500/20 bg-[#0e1322] overflow-y-auto p-4 space-y-3" style={{ width: PREVIEW_W }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rift-500">{tx('Aperçu')}</p>
      {!card ? (
        <p className="text-sm text-rift-400">{tx('Passez la souris sur une carte du deck ou du catalogue pour la lire ici.')}</p>
      ) : (
        <>
          <button onClick={() => onZoom(card.id)} title={tx('Fiche complète')} className="block w-full">
            <CardImage cardData={card} src={fullImageSrc(card.id)} className="rounded-[8px]" />
          </button>
          <p className="font-display text-lg font-bold text-gold-400 leading-tight">{getLocalizedName(card, displayLanguage())}</p>
          {(() => { const b = banStatus(card, getBanlist()); return b?.banned ? <p className="text-sm text-state-bad">{tx('Bannie en Standard')}{b.since ? ` depuis le ${frenchDate(b.since)}` : ''}</p> : null; })()}
          {(card.energy != null || card.might != null || price != null) && (
            <div className="flex items-center gap-3 flex-wrap">
              {card.energy != null && (
                <span title={tx('Énergie')} className="flex items-center gap-1.5 text-sm text-rift-300">
                  <span className="hexagon w-7 h-7 flex items-center justify-center bg-[#1d3a5c] text-[#8fd0ff] font-bold">{card.energy}</span> {tx('Énergie')}
                </span>
              )}
              {card.might != null && (
                <span title={tx('Puissance')} className="flex items-center gap-1.5 text-sm text-rift-300">
                  <span className="h-7 px-1.5 flex items-center gap-1 bg-[#4a1f1a] border border-[#e2463a]/50 text-[#ffb4a2] font-bold"><Swords className="w-3.5 h-3.5" />{card.might}</span> {tx('Puissance')}
                </span>
              )}
            </div>
          )}
          {price != null && (
            <p className="text-sm text-rift-300">
              <span className="font-display text-lg font-bold text-gold-400">{euro(price)}</span> {tx('l’unité')}
              {missing > 0 && <span className="block text-[#ff8a80] font-semibold">{missing} {tx('manquante')}{missing > 1 ? 's' : ''} · {euro(price * missing)}</span>}
            </p>
          )}
          <p className="text-sm text-rift-300">
            {inDeck > 0 ? <span className="text-gold-400 font-semibold">{inDeck} {tx('dans le deck')}</span> : tx('Pas dans le deck')}
            {' · '}{owned > 0 ? tx('{owned} possédée{v1}', { owned, v1: owned > 1 ? 's' : '' }) : <span className="text-rift-500">{tx('non possédée')}</span>}
          </p>
          {pick === 'cards' ? (
            <div className="flex gap-2">
              <button onClick={() => onAddTo(card, false)} className="btn-primary flex-1 h-10 text-sm"><Plus className="w-4 h-4" /> {tx('Deck')}</button>
              {canSide && <button onClick={() => onAddTo(card, true)} className="btn-secondary flex-1 h-10 text-sm"><Plus className="w-4 h-4" /> {tx('Réserve')}</button>}
            </div>
          ) : (
            <button onClick={() => onPick(card)} className="btn-primary w-full h-10 text-sm">{tx('Choisir')}</button>
          )}
          <button onClick={() => onZoom(card.id)} className="text-xs text-rift-400 hover:text-rift-100 hover:underline">{tx('Fiche complète')}</button>
        </>
      )}
    </aside>
  );
}
