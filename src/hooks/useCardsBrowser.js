import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allCards } from '../lib/catalog.js';
import { getMatcher } from '../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage, useDisplayFrench } from '../lib/cardLocale.js';
import { isBanned } from '../lib/deckRules.js';
import { isFoilOnly } from '../data/sampleCards.js';
import { usePrices, unitPrice, priceRef } from '../lib/prices.js';
import { parseQuery } from '../lib/cardQuery.js';
import { browseCards, ownedMap, deckCardIds, setProgress } from '../lib/cardsBrowser.js';
import { takeRequest, onRequest } from '../lib/navRequest.js';

/**
 * State of the « Cartes » tab (ONGLET-CARTES 1.2 « Mémoire », 1.3, 1.5): the
 * line of text, ownership, sort, size, grouping and « Griser les manquantes »,
 * kept when you change tab and between launches (localStorage rm.cards.view.v1),
 * with the scroll position.
 */
export const VIEW_KEY = 'rm.cards.view.v1';
export const DEFAULT_VIEW = { query: '', ownership: 'all', sort: 'collector', size: 'l', tile: 170, grouped: true, dimMissing: false, scroll: 0, cols: 3 };

let memory = null; // the view while the app runs (no storage read at each tab change)
function loadView() {
  if (memory) return memory;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') || {}; } catch { saved = {}; }
  memory = { ...DEFAULT_VIEW, ...saved };
  return memory;
}
function saveView(v) {
  memory = v;
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)); } catch { /* private window: kept for this run */ }
}
/** Scroll position: in memory at once, written with the rest of the view. */
export function rememberScroll(y) { if (memory) memory = { ...memory, scroll: y }; }

/** Request from another screen: { kind: 'cards', query?, ownership? } (global search, Progression). */
function applyRequest(v, r) {
  return r ? { ...v, query: r.query ?? v.query, ownership: r.ownership ?? v.ownership, scroll: 0 } : v;
}

export default function useCardsBrowser({ scannedCards, decks, wishlist }) {
  const [view, setViewState] = useState(() => {
    const v = applyRequest(loadView(), takeRequest('cards'));
    if (v !== memory) saveView(v);
    return v;
  });
  const setView = useCallback((patch) => setViewState(v => {
    const next = { ...v, ...(typeof patch === 'function' ? patch(v) : patch) };
    saveView(next);
    return next;
  }), []);
  useEffect(() => onRequest((q) => { if (q.kind === 'cards') setView(v => applyRequest(v, takeRequest('cards'))); }), [setView]);
  // Save the scroll position when leaving the tab
  useEffect(() => () => { if (memory) saveView(memory); }, []);

  // The text field answers at once, the results 150 ms after the last key
  const [input, setInputState] = useState(view.query);
  const lastQuery = useRef(view.query);
  const latest = useRef(view.query); // the line as typed or clicked last (filters build on it)
  const setInput = useCallback((q) => { latest.current = q; setInputState(q); }, []);
  useEffect(() => { if (view.query !== lastQuery.current) { lastQuery.current = view.query; latest.current = view.query; setInputState(view.query); } }, [view.query]);
  useEffect(() => {
    if (input === view.query) return undefined;
    const t = setTimeout(() => { lastQuery.current = input; setView({ query: input, scroll: 0 }); }, 150);
    return () => clearTimeout(t);
  }, [input, view.query, setView]);
  /** Set the line at once (filters, chips): the field and the results together. `q`: text or (line) => text. */
  const setQuery = useCallback((q) => {
    const next = typeof q === 'function' ? q(latest.current) : q;
    lastQuery.current = next; setInput(next); setView({ query: next, scroll: 0 });
  }, [setView, setInput]);

  const [allFrench] = useDisplayFrench();
  const { prices } = usePrices();
  const cards = allCards();
  const owned = useMemo(() => ownedMap(scannedCards), [scannedCards]);
  const inDecks = useMemo(() => deckCardIds(decks), [decks]);
  const parsed = useMemo(() => parseQuery(view.query), [view.query]);

  const nameOf = useCallback((c) => getLocalizedName(c, displayLanguage()), [allFrench]); // eslint-disable-line react-hooks/exhaustive-deps
  const priceOf = useCallback((c) => (prices ? unitPrice(prices, c.id, isFoilOnly(c), priceRef()) : null), [prices]);
  const ctx = useMemo(() => {
    const m = getMatcher();
    return {
      extra: (c) => m.getCard(c.id),
      banned: (c) => isBanned(c),
      inDeck: (c) => inDecks.has(c.id),
      foil: (c) => isFoilOnly(c),
    };
  }, [inDecks]);

  const result = useMemo(() => {
    const t0 = performance.now();
    const r = browseCards(cards, { parsed, owned, ownership: view.ownership, sort: view.sort, grouped: view.grouped, ctx, nameOf, priceOf });
    r.ms = performance.now() - t0;
    return r;
  }, [cards, parsed, owned, view.ownership, view.sort, view.grouped, ctx, nameOf, priceOf]);

  const sets = useMemo(() => setProgress(cards, owned), [cards, owned]);
  const ownedCount = useMemo(() => { let n = 0; for (const c of cards) if (owned.get(c.id)?.total) n++; return n; }, [cards, owned]);

  return {
    view, setView, input, setInput, setQuery, parsed, cards, owned, sets, ownedCount,
    items: result.items, counts: result.counts, filterMs: result.ms, nameOf, priceOf,
    wishlist,
  };
}
