import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Layers, Package, Search, Settings, Swords, User, X } from 'lucide-react';
import { usePcInterface } from '../../lib/pcInterface.js';
import { useBackHandler } from '../../lib/backButton.js';
import { searchAll, recentSearches, rememberSearch, SETTINGS_KEYWORDS } from '../../lib/globalSearch.js';
import { thumbSrc } from '../../lib/nativeAssets.js';
import { SECTIONS } from '../settings/sectionList.js';
import { tx } from '../../lib/i18n.js';

const ICON = { deck: Swords, box: Package, person: User, setting: Settings };

/**
 * Global search (lot 6 e, B.6.11). PC: window of 640 px at the top of the
 * screen (Ctrl+K), arrows and Enter; phone: full screen. Results grouped by
 * type; without a query, the last five searches; nothing found: « Rien trouvé
 * pour "…" » and « Chercher dans toutes les cartes ».
 * `mode` 'add' (Ctrl+N, « ajout rapide »): cards only, all of them; picking
 * one adds an exemplaire.
 * `data`: { cards, owned: Map, decks, boxes, people } · onPick(item).
 */
export default function SearchPalette({ open, mode = 'search', data, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(mode === 'add');
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState(() => recentSearches());
  const input = useRef(null);
  useBackHandler(open, onClose);
  useEffect(() => { if (open) { setQ(''); setSel(0); setAll(mode === 'add'); setRecent(recentSearches()); setTimeout(() => input.current?.focus(), 30); } }, [open, mode]);

  const settings = useMemo(() => SECTIONS.map(s => ({ id: s.id, label: s.label, keywords: SETTINGS_KEYWORDS[s.id] })), []);
  const groups = useMemo(() => {
    const g = searchAll(q, { ...data, settings }, { allCards: all });
    return mode === 'add' ? g.filter(x => x.group === 'cards') : g;
  }, [q, data, settings, all, mode]);
  const flat = groups.flatMap(g => g.items);
  useEffect(() => { setSel(0); }, [q, all]);

  if (!open) return null;
  const pick = (item) => { setRecent(rememberSearch(q)); onPick(item); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); pick(flat[sel]); }
  };

  let n = -1;
  const body = (
    <>
      <div className="flex items-center gap-2 px-3 h-14 border-b border-rift-700 flex-shrink-0">
        {usePcInterface ? <Search size={18} className="text-rift-400" aria-hidden="true" /> : (
          <button onClick={onClose} aria-label={tx('Fermer la recherche')} className="w-11 h-11 -ml-2 flex items-center justify-center text-rift-100"><ArrowLeft size={20} /></button>
        )}
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          placeholder={mode === 'add' ? tx('Ajouter une carte : son nom ou son code') : tx('Rechercher une carte, un deck, une boîte…')}
          aria-label={tx('Rechercher')} role="combobox" aria-expanded={flat.length > 0} aria-controls="search-results"
          aria-activedescendant={flat[sel] ? `sr-${sel}` : undefined}
          className="flex-1 min-w-0 h-10 bg-transparent text-[16px] text-rift-100 placeholder:text-rift-500 focus:outline-none" />
        {q && <button onClick={() => { setQ(''); input.current?.focus(); }} aria-label={tx('Effacer')} className="w-9 h-9 flex items-center justify-center text-rift-400"><X size={16} /></button>}
        {usePcInterface && <kbd className="font-mono text-[11px] text-rift-500 border border-rift-600 px-1.5 py-0.5">{tx('Échap')}</kbd>}
      </div>
      <div id="search-results" role="listbox" aria-label={tx('Résultats')} className="flex-1 overflow-y-auto py-1">
        {!q.trim() && (
          recent.length ? (
            <div>
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-rift-500">{tx('Dernières recherches')}</p>
              {recent.map(r => (
                <button key={r} onClick={() => setQ(r)} className="w-full flex items-center gap-3 px-4 min-h-[44px] text-left text-[15px] text-rift-200 hover:bg-rift-800">
                  <Clock size={16} className="text-rift-500" aria-hidden="true" /> {r}
                </button>
              ))}
            </div>
          ) : <p className="px-4 py-6 text-[14px] text-rift-400">{mode === 'add' ? tx('Tapez le nom ou le code d’une carte.') : tx('Cartes, decks, boîtes, personnes, réglages.')}</p>
        )}
        {q.trim() && !flat.length && (
          <div className="px-4 py-6 space-y-3">
            <p className="text-[15px] text-rift-200">{tx('Rien trouvé pour «')} {q.trim()} »</p>
            {!all && <button onClick={() => setAll(true)} className="btn-secondary min-h-[40px] px-4 text-[14px]">{tx('Chercher dans toutes les cartes')}</button>}
          </div>
        )}
        {groups.map(g => (
          <div key={g.group}>
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-rift-500">{g.label}</p>
            {g.items.map(it => {
              n++;
              const i = n;
              const Icon = ICON[it.type];
              return (
                <button key={`${it.type}:${it.id}`} id={`sr-${i}`} role="option" aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)} onClick={() => pick(it)}
                  className={`w-full flex items-center gap-3 px-4 min-h-[48px] text-left ${i === sel ? 'bg-gold-500/10' : 'hover:bg-rift-800'}`}>
                  {it.cardId
                    ? <img src={thumbSrc(it.cardId)} alt="" className="w-7 h-10 object-cover flex-shrink-0" loading="lazy" />
                    : <span className="w-7 flex justify-center flex-shrink-0">{Icon && <Icon size={18} className="text-gold-400" aria-hidden="true" />}</span>}
                  <span className="flex-1 min-w-0 truncate text-[15px] text-rift-100">{it.label}</span>
                  {it.detail && <span className={`text-[13px] flex-shrink-0 ${it.detail.startsWith('×') ? 'text-gold-400' : 'text-rift-400'}`}>{it.detail}</span>}
                </button>
              );
            })}
          </div>
        ))}
        {mode === 'search' && q.trim() && (
          <button onClick={() => pick({ type: 'cardsTab', query: q.trim() })} className="w-full flex items-center gap-3 px-4 min-h-[44px] text-left text-[14px] text-gold-400 hover:bg-rift-800">
            <Search size={16} aria-hidden="true" /> {tx('Voir tous les résultats dans Cartes')}
          </button>
        )}
        {mode === 'search' && q.trim() && !!flat.length && !all && (
          <button onClick={() => setAll(true)} className="w-full flex items-center gap-3 px-4 min-h-[44px] text-left text-[14px] text-gold-400 hover:bg-rift-800">
            <Layers size={16} aria-hidden="true" /> {tx('Chercher aussi dans toutes les cartes')}
          </button>
        )}
      </div>
    </>
  );

  if (usePcInterface) {
    return (
      <div className="fixed inset-0 z-[70] bg-rift-900/70 fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label={mode === 'add' ? tx('Ajout rapide') : tx('Recherche')}
          className="mx-auto mt-[10vh] w-[640px] max-w-[92vw] max-h-[70vh] flex flex-col bg-rift-800 border border-gold-500/40 shadow-2xl">
          {body}
        </div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={tx('Recherche')} className="fixed inset-0 z-[70] bg-rift-900 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {body}
    </div>
  );
}
