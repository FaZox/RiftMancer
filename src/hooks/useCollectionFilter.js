import { useCallback, useMemo, useState } from 'react';
import { usePrices, priceInfo, priceRef, stacksValue } from '../lib/prices.js';
import { getLocalizedName, DEFAULT_LANGUAGE, displayLanguage } from '../lib/cardLocale.js';
import { stackComparator, priceComparator } from '../lib/catalog.js';

export const EMPTY_FILTERS = { set: 'all', type: 'all', rarity: 'all', domain: 'all', language: 'all', finish: 'all', location: 'all' };

/**
 * Search, filters and sort of the collection stacks — shared by the phone
 * (CollectionTab) and the PC (desktop/CollectionPage) interfaces.
 * `allFrench` (display preference) only re-computes names when it changes.
 */
export default function useCollectionFilter(scannedCards, allFrench) {
  const { prices } = usePrices();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Sort, remembered on this device
  const [sort, setSortState] = useState(() => {
    try { return localStorage.getItem('rb.collection.sort') || 'collector'; } catch { return 'collector'; }
  });
  const setSort = useCallback((v) => {
    setSortState(v);
    try { localStorage.setItem('rb.collection.sort', v); } catch { /* storage unavailable */ }
  }, []);
  const setFilter = useCallback((k, v) => setFilters(f => ({ ...f, [k]: v })), []);

  // Value of a stack (promo and foil copies at their own price when Cardmarket has one)
  const priceOf = useCallback((s) => {
    const u = priceInfo(prices, s.cardData.id, s.foil, priceRef(), s.promo).value;
    return u == null ? null : u * s.quantity;
  }, [prices]);
  // Why a stack's price is estimated (key of ESTIMATE_LABEL), or null
  const estimatedOf = useCallback((s) => priceInfo(prices, s.cardData.id, s.foil, priceRef(), s.promo).estimated, [prices]);

  // Options present in the collection, for the filter menus
  const options = useMemo(() => {
    const sets = new Map(); const types = new Set(); const rarities = new Set(); const domains = new Set(); const languages = new Map();
    for (const c of scannedCards) {
      const d = c.cardData;
      sets.set(d.set, d.setName || d.set);
      if (d.type) types.add(d.type);
      if (d.rarity) rarities.add(d.rarity);
      for (const dom of (d.domains?.length ? d.domains : [d.domain]).filter(Boolean)) domains.add(dom);
      const lang = c.language || DEFAULT_LANGUAGE;
      languages.set(lang, (languages.get(lang) || 0) + c.quantity);
    }
    return { sets, types, rarities, domains, languages };
  }, [scannedCards]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nameOf = useCallback((s) => getLocalizedName(s.cardData, displayLanguage(s.language)), [allFrench]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const out = scannedCards.filter(card => {
      const d = card.cardData;
      const lang = card.language || DEFAULT_LANGUAGE;
      if (filters.language !== 'all' && lang !== filters.language) return false;
      if (filters.set !== 'all' && d.set !== filters.set) return false;
      if (filters.type !== 'all' && d.type !== filters.type) return false;
      if (filters.rarity !== 'all' && d.rarity !== filters.rarity) return false;
      if (filters.domain !== 'all' && !(d.domains?.length ? d.domains : [d.domain]).includes(filters.domain)) return false;
      if (filters.finish === 'foil' && !card.foil) return false;
      if (filters.finish === 'standard' && card.foil) return false;
      if (filters.location !== 'all') {
        const loc = filters.location;
        if (loc === 'none' && (card.boxId || card.deckId || card.loanId)) return false;
        if (loc === 'loan' && !card.loanId) return false;
        if (loc.startsWith('box:') && card.boxId !== loc.slice(4)) return false;
        if (loc.startsWith('deck:') && card.deckId !== loc.slice(5)) return false;
      }
      if (!query) return true;
      return d.name.toLowerCase().includes(query)
        || nameOf(card).toLowerCase().includes(query)
        || (d.collectorNumber || '').toLowerCase().includes(query);
    });
    // Prices: unit price (foil price for foils) or value of the stack.
    const byPrice = priceComparator(sort, (s) => priceInfo(prices, s.cardData.id, s.foil, priceRef(), s.promo).value, nameOf);
    return out.sort(byPrice || stackComparator(sort, nameOf));
  }, [scannedCards, searchQuery, filters, sort, nameOf, prices]);

  const totalValue = useMemo(() => (prices ? stacksValue(prices, filteredCards).value : null), [prices, filteredCards]);
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== 'all').length;
  const isFiltered = !!searchQuery.trim() || activeFilters > 0;

  return {
    prices, searchQuery, setSearchQuery, filters, setFilters, setFilter, sort, setSort,
    options, nameOf, priceOf, estimatedOf, filteredCards, totalValue, activeFilters, isFiltered,
  };
}
