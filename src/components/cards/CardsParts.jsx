// « Cartes » tab (ONGLET-CARTES, design A « Bibliothèque »): the parts shared by the PC page and the phone tab.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Heart, X, Layers, Swords } from 'lucide-react';
import CardTile from '../collection/CardTile.jsx';
import Sheet from '../common/Sheet.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { DOMAIN_COLORS } from '../../data/sampleCards.js';

import { domainIcon } from '../../lib/symbols.js';

import { OPTIONS, VALUE_LABEL, selectionFor, toggleOption, toggleFlag, flagOn, removeToken, tokenLabel, SYNTAX_HELP } from '../../lib/cardQuery.js';
import { gridRows, deckWithCards } from '../../lib/cardsBrowser.js';
import { rememberScroll } from '../../hooks/useCardsBrowser.js';
import { euro } from '../../lib/prices.js';
import { locale, tx, tp } from '../../lib/i18n.js';

const n = (v) => v.toLocaleString(locale());

/** Section title of the filters (11 px capitals). */
const Fh = ({ children }) => <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500">{children}</p>;

/** Square buttons 0…6, 7+ (energy, might). */
function Squares({ b, k, label }) {
  const sel = selectionFor(b.parsed, k);
  return (
    <div>
      <Fh>{label}</Fh>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {OPTIONS[k].map(v => (
          <button key={v} type="button" aria-pressed={sel.has(v)} onClick={() => b.setQuery(q => toggleOption(q, k, v))}
            className={`min-w-[44px] h-11 lg:min-w-[30px] lg:h-[30px] flex items-center justify-center border text-[13px] font-bold ${sel.has(v) ? 'bg-gold-500/20 border-gold-400 text-gold-400' : 'bg-rift-800 border-rift-600 text-rift-300 hover:border-gold-500/50'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Chips of a key (type, rarity). */
function Chips({ b, k, label }) {
  const sel = selectionFor(b.parsed, k);
  return (
    <div>
      <Fh>{label}</Fh>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {OPTIONS[k].map(v => (
          <button key={v} type="button" className="chip max-lg:h-11 max-lg:px-3 max-lg:text-[13px]" aria-pressed={sel.has(v)}
            onClick={() => b.setQuery(q => toggleOption(q, k, v))}>{VALUE_LABEL[k][v]}</button>
        ))}
      </div>
    </div>
  );
}

/** Six domains: full hexagon when chosen, outline of its colour otherwise; the name under it. */
export function DomainHexes({ b, row = false }) {
  const sel = selectionFor(b.parsed, 'd');
  return (
    <div className={row ? 'flex gap-1.5 overflow-x-auto -mr-4 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'grid grid-cols-3 gap-1.5'} role="group" aria-label={tx('Domaines')}>
      {OPTIONS.d.map(d => {
        const on = sel.has(d);
        const hex = DOMAIN_COLORS[d].hex;
        const icon = domainIcon(d);
        const click = () => b.setQuery(q => toggleOption(q, 'd', d));
        return row ? (
          <button key={d} type="button" aria-pressed={on} onClick={click}
            className={`flex-shrink-0 h-11 pl-2 pr-3 inline-flex items-center gap-2 border text-[13px] font-semibold ${on ? 'bg-gold-500/20 border-gold-400 text-gold-400 shadow-[inset_0_-2px_0_theme(colors.gold.400)]' : 'bg-rift-800 border-rift-600 text-rift-300'}`}>
            {icon
              ? <img src={icon} alt="" className={`w-4 h-4 object-contain ${on ? '' : 'opacity-60'}`} />
              : <span className="hexagon w-3.5 h-4" style={{ background: hex }} aria-hidden="true" />}
            {VALUE_LABEL.d[d]}
          </button>
        ) : (
          <button key={d} type="button" aria-pressed={on} onClick={click}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold ${on ? 'text-rift-100' : 'text-rift-300 hover:text-rift-100'}`}>
            {icon
              ? <img src={icon} alt="" className={`w-[34px] h-[38px] object-contain ${on ? '' : 'opacity-40'}`} />
              : <span className="hexagon w-[34px] h-[38px]" style={on ? { background: hex } : { background: '#18263c', boxShadow: `inset 0 0 0 2px ${hex}` }} aria-hidden="true" />}
            {VALUE_LABEL.d[d]}
          </button>
        );
      })}
    </div>
  );
}

/** Sets with their owned / total progress bar (PC column and phone sheet). */
export function SetsFilter({ b }) {
  const setOptions = useMemo(() => [...b.sets.keys()].map(s => s.toLowerCase()), [b.sets]);
  const selSets = selectionFor(b.parsed, 's', setOptions);
  return (
    <div>
      <Fh>{tx('Sets')}</Fh>
      <div className="flex flex-col gap-2.5" role="group" aria-label={tx('Sets')}>
          {[...b.sets.values()].map(s => {
            const on = selSets.has(s.set.toLowerCase());
            return (
              <button key={s.set} type="button" aria-pressed={on} onClick={() => b.setQuery(q => toggleOption(q, 's', s.set.toLowerCase(), setOptions))}
                className={`text-left min-h-[44px] lg:min-h-0 px-1.5 -mx-1.5 py-1 border-l-2 ${on ? 'border-gold-400 bg-gold-500/10' : 'border-transparent hover:bg-rift-800/60'}`}>
                <span className="flex justify-between gap-2 text-[14px] font-semibold text-rift-100">
                  <span className="truncate">{s.setName}</span>
                  <span className="font-mono text-[11px] text-rift-400 self-center">{n(s.own)}/{n(s.total)}</span>
                </span>
                <span className="block mt-1.5 h-1 bg-[#18263c]"><span className="block h-1 bg-gold-500" style={{ width: `${s.total ? Math.round((100 * s.own) / s.total) : 0}%` }} /></span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/** Every filter of the phone sheet. */
export function CardsFilters({ b, withDomains = true }) {
  return (
    <div className="flex flex-col gap-5">

      {withDomains && <div><Fh>{tx('Domaines')}</Fh><DomainHexes b={b} /></div>}
      <SetsFilter b={b} />
      <Chips b={b} k="t" label={tx('Type')} />
      <Squares b={b} k="e" label={tx('Énergie')} />
      <Squares b={b} k="p" label={tx('Puissance')} />
      <Chips b={b} k="r" label={tx('Rareté')} />
      <div>
        <Fh>{tx('Autres')}</Fh>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx('Autres')}>
          {OPTIONS.is.map(f => (
            <button key={f} type="button" className="chip max-lg:h-11 max-lg:px-3 max-lg:text-[13px]" aria-pressed={flagOn(b.parsed, f)}
              onClick={() => b.setQuery(q => toggleFlag(q, f))}>{VALUE_LABEL.is[f]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// (The PC filter column is now src/components/cards/AtelierFilters.jsx.)

/** Ownership: Toutes · Possédées · Manquantes, with their counts. */
export function OwnershipSeg({ b, className = '' }) {
  const items = [['all', tx('Toutes'), b.counts.all], ['owned', tx('Possédées'), b.counts.owned], ['missing', tx('Manquantes'), b.counts.missing]];
  return (
    <div className={`seg ${className}`} role="tablist" aria-label={tx('Possession')}>
      {items.map(([v, l, c]) => (
        <button key={v} type="button" role="tab" aria-selected={b.view.ownership === v} onClick={() => b.setView({ ownership: v, scroll: 0 })} className="whitespace-nowrap lg:px-4">
          {l} <span className="font-mono text-[11px] font-normal text-rift-500">{n(c)}</span>
        </button>
      ))}
    </div>
  );
}

/** Chips of the active filters (each with ✕) and « Tout effacer ». */
/** Rune icon of a domain chip (hexagon of its colour when the symbols are missing). */
function domainChipIcon(t) {
  if (t.type !== 'term' || t.key !== 'd' || t.values.length !== 1) return null;
  const d = selectionFor({ tokens: [t] }, 'd').values().next().value;
  const ic = domainIcon(d);
  if (ic) return <img src={ic} alt="" className="w-3 h-3 object-contain" aria-hidden="true" />;
  return DOMAIN_COLORS[d] ? <span className="hexagon w-2.5 h-[11px]" style={{ background: DOMAIN_COLORS[d].hex }} aria-hidden="true" /> : null;
}

export function ActiveChips({ b, className = '' }) {
  const tokens = b.parsed.tokens;
  if (!tokens.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tokens.map((t, i) => (
        <button key={`${i}-${t.raw}`} type="button" className="chip max-lg:h-9" aria-pressed="true"
          aria-label={tx('Retirer le filtre {label}', { label: tokenLabel(t) })}
          onClick={() => b.setQuery(q => removeToken(q, i))}>
          {domainChipIcon(t)}
          {tokenLabel(t)} <X className="w-3 h-3" aria-hidden="true" />
        </button>
      ))}
      <button type="button" onClick={() => b.setQuery('')} className="h-8 px-2 text-xs font-semibold text-rift-400 hover:text-rift-100">{tx('Tout effacer')}</button>
    </div>
  );
}

/** Memo of the search syntax (« ? » of the bar). */
export function SyntaxHelp({ onClose }) {
  return (
    <Sheet open title={tx('Syntaxe de recherche')} onClose={onClose}>
      <p className="text-[13px] text-rift-300 mb-3">{tx('Tapez un nom (français ou anglais) ou un numéro, ou combinez des clés. Les termes s’additionnent ; « - » devant une clé l’inverse ; les guillemets regroupent plusieurs mots.')}</p>
      <table className="w-full text-[13px]">
        <tbody>
          {SYNTAX_HELP.map(([k, label, ex]) => (
            <tr key={k} className="border-b border-rift-700/70 align-top">
              <td className="py-2 pr-3 font-mono text-gold-400 whitespace-nowrap">{k}</td>
              <td className="py-2 pr-3 text-rift-200">{label}</td>
              <td className="py-2 font-mono text-[12px] text-rift-400">{ex}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] text-rift-400">{tx('Opérateurs : =  !=  <  <=  >  >=. Exemple : d:esprit t:unité e<=3 own:0')}</p>
    </Sheet>
  );
}

// ─── Grid ──────────────────────────────────────────────────────────────────
/**
 * Virtual grid by rows (set titles when sorted by set and number). `cols`
 * from the width: (width + gap) / (min + gap). Restores the scroll position.
 */
export function CardsGrid({ b, scrollRef, minWidth, fixedCols, fewer = 0, gap, hd, selection, onTilePress, onTileZoom, onQuickAdd, showPrice }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = fixedCols || Math.max(2, Math.floor((width + gap) / (minWidth + gap)) - fewer);
  const tileW = width ? (width - gap * (cols - 1)) / cols : minWidth;
  const withSets = b.view.sort === 'collector';
  const rows = useMemo(() => gridRows(b.items, cols, withSets), [b.items, cols, withSets]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.type === 'set' ? 48 : Math.round(tileW * 1.4) + (showPrice ? 76 : 58) + gap),
    overscan: 4,
    getItemKey: (i) => (rows[i]?.type === 'set' ? `set-${rows[i].set}` : `row-${i}`),
  });
  useEffect(() => { virtualizer.measure(); }, [tileW, virtualizer]);

  // Back to the place you left (tab change, restart), once the rows are there
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !rows.length || !scrollRef.current) return;
    restored.current = true;
    if (b.view.scroll > 0) requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = b.view.scroll; });
  }, [rows.length, scrollRef, b.view.scroll]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const on = () => rememberScroll(el.scrollTop);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, [scrollRef]);
  // New results: back to the top
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [b.view.query, b.view.ownership, b.view.sort, b.view.grouped, scrollRef]);

  const dim = b.view.dimMissing;
  return (
    <div ref={boxRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map(v => {
        const row = rows[v.index];
        return (
          <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} className="absolute left-0 right-0" style={{ transform: `translateY(${v.start}px)` }}>
            {row.type === 'set' ? (
              <div className="flex items-baseline gap-3 pt-3 pb-3">
                <h2 className="font-display text-[15px] lg:text-[18px] font-semibold tracking-wide text-gold-400">{row.setName}</h2>
                <span className="font-mono text-[11px] lg:text-[12px] text-rift-400">{row.set} · {tx('{owned} / {total} de cette sélection', { owned: n(row.owned), total: n(row.total) })}</span>
                <span className="flex-1 h-px bg-gold-500/20" />
              </div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap, paddingBottom: gap }}>
                {row.items.map(g => (
                  <Tile key={g.card.id} g={g} b={b} dim={dim} hd={hd} showPrice={showPrice} selected={selection?.has(g.card.id)}
                    onPress={onTilePress} onZoom={onTileZoom} onQuickAdd={onQuickAdd} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const Tile = React.memo(function Tile({ g, b, dim, hd, showPrice, selected, onPress, onZoom, onQuickAdd }) {
  const c = g.card;
  const missing = g.owned === 0;
  const price = showPrice ? b.priceOf(c) : null;
  const extra = g.prints.length - 1;
  const name = b.nameOf(c);
  // Check if this card is in the wishlist (using c.id which is the specific card/printing id)
  const wishlistBadge = b.wishlist?.byCard?.has(c.id) ? '♥' : undefined;
  const ownedBadge = g.owned > 0 ? `×${g.owned}` : undefined;
  
  return (
    <div className="relative group">
      <CardTile cardData={c} name={name} hd={hd} dim={dim && missing} tag={dim && missing ? tx('Manquante') : null}
        badge={ownedBadge || wishlistBadge} 
        badgeClass={ownedBadge ? undefined : wishlistBadge ? 'bg-pink-500/80 text-white' : undefined}
        selected={selected}
        onPress={onPress} onZoom={onZoom}
        meta={(
          <p className="mt-0.5 flex justify-between gap-1 text-[11px] text-rift-500">
            <span className="font-mono truncate">#{c.collectorNumber}{extra > 0 && <span className="ml-1 font-sans text-rift-400">{tp(extra, '+{n} impression', '+{n} impressions', { n: extra })}</span>}</span>
            {showPrice && <span className="text-rift-300">{price != null ? euro(price) : ''}</span>}
          </p>
        )} />
      {onQuickAdd && (
        <button type="button" onClick={() => onQuickAdd(c)} aria-label={tx('Ajouter un exemplaire de {name}', { name })} title={tx('Ajouter un exemplaire')}
          className="absolute right-1 top-7 w-8 h-8 flex items-center justify-center bg-gold-500 text-rift-900 shadow-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          <Plus className="w-4 h-4" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
});

// ─── Actions ───────────────────────────────────────────────────────────────
/**
 * Selection and actions of the tab: quick add with « Annuler », wish list,
 * add to a deck, « Manquantes → souhaits », CSV of the view.
 */
export function useCardsActions({ b, wishlist, decks, onQuickAdd, notify }) {
  const { ask } = useDialog();
  const [selected, setSelected] = useState(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [deckFor, setDeckFor] = useState(null); // cards waiting for a deck
  const last = useRef(null);
  const ids = useMemo(() => b.items.map(g => g.card.id), [b.items]);

  const clear = useCallback(() => { setSelected(new Set()); setSelecting(false); last.current = null; }, []);
  const toggle = useCallback((id, range = false) => setSelected(prev => {
    const next = new Set(prev);
    if (range && last.current) {
      const a = ids.indexOf(last.current); const z = ids.indexOf(id);
      if (a >= 0 && z >= 0) { for (let i = Math.min(a, z); i <= Math.max(a, z); i++) next.add(ids[i]); return next; }
    }
    if (next.has(id)) next.delete(id); else next.add(id);
    last.current = id;
    return next;
  }), [ids]);
  useEffect(() => { if (selecting && selected.size === 0) setSelecting(false); }, [selecting, selected.size]);

  const cardsOf = (set) => b.items.filter(g => set.has(g.card.id)).map(g => g.card);

  const wishCards = async (cards, confirm) => {
    const toAdd = cards.filter(c => !wishlist.byCard.has(c.id));
    if (!toAdd.length) { notify?.(tx('Ces cartes sont déjà dans vos souhaits'), 'info'); return; }
    if (confirm && !(await ask({ title: tx('Ajouter aux souhaits ?'), message: tp(toAdd.length, '{n} carte manquante ajoutée à la liste de souhaits.', '{n} cartes manquantes ajoutées à la liste de souhaits.', { n: toAdd.length }), confirmLabel: tx('Ajouter') }))) return;
    toAdd.forEach(c => wishlist.setWanted(c.id, 1));
    notify?.(tp(toAdd.length, '{n} carte ajoutée aux souhaits', '{n} cartes ajoutées aux souhaits', { n: toAdd.length }), 'success');
  };

  return {
    selected, selecting, setSelecting, toggle, clear, deckFor, setDeckFor,
    missingToWish: () => wishCards(b.items.filter(g => g.owned === 0).map(g => g.card), true),
    wishSelected: () => { wishCards(cardsOf(selected), false); clear(); },
    addSelected: () => { cardsOf(selected).forEach(c => onQuickAdd(c, { quiet: true })); notify?.(tp(selected.size, '{n} exemplaire ajouté à la collection', '{n} exemplaires ajoutés à la collection', { n: selected.size }), 'success'); clear(); },
    deckSelected: () => setDeckFor(cardsOf(selected)),
    addToDeck: (deck) => {
      decks.save(deckWithCards(deck, deckFor));
      notify?.(tp(deckFor.length, '{n} carte ajoutée au deck {deck}', '{n} cartes ajoutées au deck {deck}', { n: deckFor.length, deck: deck.name }), 'success');
      setDeckFor(null); clear();
    },
  };
}

/** Bar of the selection: what to do with the chosen cards. */
export function SelectionBar({ a, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="toolbar" aria-label={tx('Sélection')}>
      <button type="button" onClick={a.clear} className="btn-ghost min-h-[40px] text-sm"><X className="w-4 h-4" /> {tx('Annuler')}</button>
      <span className="text-sm font-semibold text-rift-100">{tp(a.selected.size, '{n} sélectionnée', '{n} sélectionnées', { n: a.selected.size })}</span>
      <span className="flex-1" />
      <button type="button" onClick={a.wishSelected} className="chip h-10 max-lg:h-11"><Heart className="w-4 h-4" /> {tx('Ajouter aux souhaits')}</button>
      <button type="button" onClick={a.deckSelected} className="chip h-10 max-lg:h-11"><Swords className="w-4 h-4" /> {tx('Ajouter à un deck…')}</button>
      <button type="button" onClick={a.addSelected} className="chip h-10 max-lg:h-11"><Layers className="w-4 h-4" /> {tx('Ajouter un exemplaire')}</button>
    </div>
  );
}

/** Choice of the deck (« Ajouter à un deck… »). */
export function DeckChooser({ a, decks }) {
  if (!a.deckFor) return null;
  return (
    <Sheet open title={tx('Ajouter à un deck')} onClose={() => a.setDeckFor(null)}>
      {decks.items.length === 0 ? (
        <p className="text-sm text-rift-400 py-4">{tx('Aucun deck pour l’instant : créez-en un dans l’onglet Decks.')}</p>
      ) : (
        <div className="flex flex-col">
          {decks.items.map(d => (
            <button key={d.id} type="button" onClick={() => a.addToDeck(d)}
              className="min-h-[52px] px-2 flex items-center gap-3 border-b border-rift-700 text-left hover:bg-rift-700/60">
              <Swords className="w-4 h-4 text-gold-400" aria-hidden="true" />
              <span className="flex-1 text-[15px] text-rift-100">{d.name}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
