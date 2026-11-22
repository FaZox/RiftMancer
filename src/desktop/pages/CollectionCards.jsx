// PC collection: grid / table of the cards with filters, selection, export, import.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, LayoutGrid, List, Upload, Download, Trash2, CheckSquare, X, Minus, Plus, ChevronDown, MapPin } from 'lucide-react';
import useCollectionFilter, { EMPTY_FILTERS } from '../../hooks/useCollectionFilter.js';
import { useDisplayFrench, getLocalizedName, displayLanguage, DEFAULT_LANGUAGE } from '../../lib/cardLocale.js';
import PriceText from '../../components/common/PriceText.jsx';
import { euro, priceChange, unitPrice, priceRef, pct } from '../../lib/prices.js';
import { EXPORT_FORMATS } from '../../lib/exporters/index.js';
import { SORTS } from '../../lib/catalog.js';
import { LANGUAGES, CONDITIONS, domainLabel, rarityLabel, typeLabel, isFoilOnly } from '../../data/sampleCards.js';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import MoveDialog from '../../components/organize/MoveDialog.jsx';
import ImportCsvDialog from '../../components/collection/ImportCsvDialog.jsx';
import { GridTile, placeOf, PLACE_STYLE } from '../../components/collection/CollectionTab.jsx';
import { requestOpen } from '../../lib/navRequest.js';import { tx } from '../../lib/i18n.js';


export const SIZES = [['s', tx('Petites'), 140], ['m', tx('Moyennes'), 180], ['l', tx('Grandes'), 230]];

export const PAGE = 300; // cards rendered at once (« Afficher plus » for the rest)

export const store = {
  get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

// ─── Cards: toolbar + grid / table ─────────────────────────────────────────
export function CardsPanel({
  scannedCards, org, onOpen, onUpdateCard, onRemoveCard, onDeleteStacks, onMoveStack, onExport, onImportEntries, defaultLanguage,
}) {
  const [allFrench, setAllFrench] = useDisplayFrench();
  const {
    prices, searchQuery, setSearchQuery, filters, setFilters, setFilter, sort, setSort,
    options, nameOf, priceOf, estimatedOf, filteredCards, totalValue, isFiltered,
  } = useCollectionFilter(scannedCards, allFrench);
  const [layout, setLayoutState] = useState(() => store.get('rb.pc.layout', 'grid'));
  const setLayout = (v) => { setLayoutState(v); store.set('rb.pc.layout', v); };
  const [size, setSizeState] = useState(() => store.get('rb.pc.cardSize', 'l'));
  const setSize = (v) => { setSizeState(v); store.set('rb.pc.cardSize', v); };
  const [shown, setShown] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [moving, setMoving] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const toggle = useCallback((key) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), []);
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  const deleteSelected = () => {
    onDeleteStacks(filteredCards.filter(c => selected.has(c.key)));
    stopSelecting();
  };

  // The zoom walks through the cards in the order shown
  const openInList = useCallback((cardId, language) => {
    const seen = new Set(); const list = [];
    for (const c of filteredCards) {
      if (seen.has(c.cardData.id)) continue;
      seen.add(c.cardData.id);
      list.push({ cardId: c.cardData.id, language: displayLanguage(c.language) });
    }
    onOpen(cardId, language, list);
  }, [filteredCards, onOpen]);

  const week = useMemo(() => {
    if (!prices) return null;
    let now = 0; let before = 0;
    for (const s of scannedCards) {
      // % over 7 days, from the app's own history of that finish (none for promos)
      const ch = s.promo ? null : priceChange(prices, s.cardData.id, 7, priceRef(), !!s.foil);
      const u = unitPrice(prices, s.cardData.id, s.foil, priceRef(), s.promo);
      if (u == null || ch == null) continue;
      now += u * s.quantity; before += (u / (1 + ch / 100)) * s.quantity;
    }
    return before > 0 ? ((now - before) / before) * 100 : null;
  }, [prices, scannedCards]);

  const locationOptions = [
    ['none', tx('Sans emplacement')],
    ...org.boxes.items.map(b => [`box:${b.id}`, tx('Boîte : {name}', { name: b.name })]),
    ...org.decks.items.map(d => [`deck:${d.id}`, tx('Deck : {name}', { name: d.name })]),
    ['loan', tx('Prêtées')],
  ];
  const minWidth = SIZES.find(s => s[0] === size)?.[2] || 180;
  const visible = filteredCards.slice(0, shown);
  const filteredTotal = filteredCards.reduce((n, c) => n + c.quantity, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Toolbar: search, filters, display */}
      <div className="flex-shrink-0 px-8 py-3 space-y-3 border-b border-rift-600/40 bg-rift-900">
        <div className="flex items-center gap-3">
          <div className="relative w-[340px]" data-help="collection.search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rift-500 pointer-events-none" />
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShown(PAGE); }}
              placeholder={tx('Nom, numéro…')} className="input-field !pl-9 h-10" />
          </div>
          <Sel label={tx('Tri')} value={sort} onChange={setSort} options={SORTS.map(s => [s.value, s.label])} noAll help="collection.sort" />
          {/* Add a card by its name or number (the global search in « add » mode) */}
          <button data-help="collection.add" onClick={() => requestOpen({ kind: 'search', mode: 'add' })} className="btn-primary h-10 px-4 text-sm" title={tx('Ajouter une carte par son nom ou son numéro')}>
            <Plus className="w-4 h-4" /> {tx('Ajouter')}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setAllFrench(!allFrench)} aria-pressed={allFrench} title={tx('Afficher tous les noms en français')}
              className={`h-10 px-3 text-sm border ${allFrench ? 'bg-gold-500/15 border-gold-500/60 text-gold-400' : 'border-rift-600 text-rift-300 hover:text-rift-100'}`}>
              {tx('Noms en français')}
            </button>
            {layout === 'grid' && (
              <div className="flex border border-rift-600" role="group" aria-label={tx('Taille des cartes')}>
                {SIZES.map(([id, label]) => (
                  <button key={id} onClick={() => setSize(id)} aria-pressed={size === id} title={`Cartes ${label.toLowerCase()}`}
                    className={`h-10 px-3 text-sm ${size === id ? 'bg-gold-500/15 text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>
                    {id.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <div className="flex border border-rift-600" role="group" aria-label={tx('Affichage')} data-help="collection.layout">
              <button onClick={() => setLayout('grid')} aria-pressed={layout === 'grid'} title={tx('Grille')}
                className={`h-10 px-3 flex items-center gap-1.5 text-sm ${layout === 'grid' ? 'bg-gold-500/15 text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>
                <LayoutGrid className="w-4 h-4" /> {tx('Grille')}
              </button>
              <button onClick={() => setLayout('table')} aria-pressed={layout === 'table'} title={tx('Tableau (modifier état, langue, quantité…)')}
                className={`h-10 px-3 flex items-center gap-1.5 text-sm ${layout === 'table' ? 'bg-gold-500/15 text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>
                <List className="w-4 h-4" /> {tx('Tableau')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-help="collection.filters">
          <Sel label={tx('Domaine')} value={filters.domain} onChange={v => setFilter('domain', v)}
            options={['fury', 'calm', 'mind', 'body', 'chaos', 'order', 'colorless'].filter(d => options.domains.has(d) || filters.domain === d).map(d => [d, domainLabel(d)])} />
          <Sel label={tx('Extension')} value={filters.set} onChange={v => setFilter('set', v)} options={[...options.sets]} />
          <Sel label={tx('Type')} value={filters.type} onChange={v => setFilter('type', v)} options={[...options.types].map(v => [v, typeLabel(v)])} />
          <Sel label={tx('Rareté')} value={filters.rarity} onChange={v => setFilter('rarity', v)} options={[...options.rarities].map(v => [v, rarityLabel(v)])} />
          <Sel label={tx('Langue')} value={filters.language} onChange={v => setFilter('language', v)}
            options={[...options.languages].map(([v, n]) => [v, `${LANGUAGES.find(l => l.value === v)?.label || v} (${n})`])} />
          <Sel label={tx('Finition')} value={filters.finish} onChange={v => setFilter('finish', v)} options={[['foil', tx('Foil')], ['promo', tx('Promo')], ['standard', tx('Standard')]]} />
          <Sel label={tx('Emplacement')} value={filters.location} onChange={v => setFilter('location', v)} options={locationOptions} />
          {isFiltered && (
            <button onClick={() => { setFilters(EMPTY_FILTERS); setSearchQuery(''); }} className="h-9 px-2 text-sm text-rift-300 hover:text-rift-100 underline-offset-2 hover:underline">
              {tx('Effacer')}
            </button>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 px-8 h-14 flex items-center gap-3 border-b border-rift-600/30">
        {selecting ? (
          <>
            <button onClick={stopSelecting} className="btn-ghost h-9 px-3 text-sm"><X className="w-4 h-4" /> {tx('Annuler')}</button>
            <span className="text-sm font-semibold text-rift-100">{selected.size} {tx('sélectionnée')}{selected.size > 1 ? 's' : ''}</span>
            <button onClick={() => setSelected(new Set(filteredCards.map(c => c.key)))} className="btn-ghost h-9 px-3 text-sm">{tx('Tout sélectionner')}</button>
            <button disabled={!selected.size} onClick={deleteSelected}
              className="btn-secondary h-9 px-4 text-sm !text-state-bad !border-state-bad/50 ml-auto"><Trash2 className="w-4 h-4" /> {tx('Supprimer la sélection')}</button>
          </>
        ) : (
          <>
            <p className="text-sm text-rift-300">
              {isFiltered ? tx('{filteredTotal} carte{v1} affichée{v2}', { filteredTotal, v1: filteredTotal > 1 ? 's' : '', v2: filteredTotal > 1 ? 's' : '' }) : `${filteredCards.length} ligne${filteredCards.length > 1 ? 's' : ''}`}
              {totalValue != null && totalValue > 0 && <> · <span className="font-semibold text-gold-400">{euro(totalValue)}</span></>}
              {!isFiltered && week != null && Math.abs(week) >= 0.05 && (
                <span className={week >= 0 ? 'text-state-ok' : 'text-state-bad'}> · {pct(week)} {tx('cette semaine')}</span>
              )}
            </p>
            <div className="ml-auto flex items-center gap-2" data-help="collection.io">
              {onImportEntries && (
                <button onClick={() => setImporting(true)} className="btn-ghost h-9 px-3 text-sm"><Upload className="w-4 h-4" /> {tx('Importer')}</button>
              )}
              <div className="relative">
                <button onClick={() => setExportOpen(o => !o)} disabled={!scannedCards.length} className="btn-ghost h-9 px-3 text-sm">
                  <Download className="w-4 h-4" /> {tx('Exporter')} <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-60 bg-rift-800 border border-gold-500/30 shadow-xl">
                    {EXPORT_FORMATS.map(f => (
                      <button key={f.id} onClick={() => { setExportOpen(false); onExport(f.id); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-rift-200 hover:bg-rift-700">{f.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button data-help="collection.select" onClick={() => setSelecting(true)} disabled={!filteredCards.length} className="btn-ghost h-9 px-3 text-sm">
                <CheckSquare className="w-4 h-4" /> {tx('Sélectionner')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-5">
        {scannedCards.length === 0 ? (
          <div className="py-24 text-center space-y-2">
            <p className="font-display text-xl text-gold-400">{tx('Aucune carte dans votre collection')}</p>
            <p className="text-sm text-rift-400">{tx('Scannez des cartes (onglet Scanner) ou importez un fichier CSV.')}</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <p className="py-24 text-center text-sm text-rift-400">{tx('Aucune carte ne correspond à ces filtres.')}</p>
        ) : layout === 'grid' ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
            {visible.map((card, i) => (
              <GridTile key={card.key} card={card} name={nameOf(card)} price={prices ? priceOf(card) : null} place={placeOf(card, org)}
                onOpen={openInList} selecting={selecting} selected={selected.has(card.key)} onToggle={toggle} hd help={i === 0 ? 'collection.card' : undefined} />
            ))}
          </div>
        ) : (
          <StackTable
            cards={visible} org={org} nameOf={nameOf} priceOf={prices ? priceOf : null} estimatedOf={estimatedOf} onOpen={openInList}
            onUpdate={onUpdateCard} onRemove={onRemoveCard} onMove={setMoving}
            selecting={selecting} selected={selected} onToggle={toggle}
          />
        )}
        {filteredCards.length > shown && (
          <div className="text-center pt-6">
            <button onClick={() => setShown(n => n + PAGE)} className="btn-secondary px-6 text-sm">
              {tx('Afficher plus (')}{filteredCards.length - shown} {tx('restantes)')}
            </button>
          </div>
        )}
      </div>

      {moving && <MoveDialog stack={moving} org={org} onMove={onMoveStack} onClose={() => setMoving(null)} />}
      {importing && (
        <ImportCsvDialog defaultLanguage={defaultLanguage} onClose={() => setImporting(false)}
          onImport={(entries) => { onImportEntries(entries); setImporting(false); }} />
      )}
    </div>
  );
}

/** Compact labelled select for the toolbar (« Tous » = no filter). */
export function Sel({ label, value, onChange, options, noAll = false, help }) {
  const active = !noAll && value !== 'all';
  return (
    <label data-help={help} className={`h-9 flex items-center gap-2 pl-3 pr-1 border text-sm ${active ? 'border-gold-500/60 bg-gold-500/10' : 'border-rift-600'}`}>
      <span className="text-rift-400">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-8 bg-transparent text-rift-100 pr-1 focus:outline-none cursor-pointer max-w-[220px]">
        {!noAll && <option value="all" className="bg-rift-800">{tx('Tous')}</option>}
        {options.map(([v, l]) => <option key={v} value={v} className="bg-rift-800">{l}</option>)}
      </select>
    </label>
  );
}

// ─── Table: every stack, edited in place ───────────────────────────────────
export function StackTable({ cards, org, nameOf, priceOf, estimatedOf, onOpen, onUpdate, onRemove, onMove, selecting, selected, onToggle }) {
  const set = (card, field, value) => onUpdate(card, { ...card, [field]: value });
  const th = 'sticky top-0 z-10 bg-rift-900 text-left text-xs font-semibold uppercase tracking-wider text-rift-400 py-2.5 px-2 border-b border-gold-500/30';
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          {selecting && <th className={`${th} w-10`} />}
          <th className={`${th} w-14`} />
          <th className={th}>{tx('Carte')}</th>
          <th className={th}>{tx('Extension')}</th>
          <th className={th}>{tx('Rareté')}</th>
          <th className={th}>{tx('Langue')}</th>
          <th className={th}>{tx('État')}</th>
          <th className={`${th} text-center`}>{tx('Foil')}</th>
          <th className={`${th} text-center`}>{tx('Promo')}</th>
          <th className={`${th} text-center`}>{tx('Quantité')}</th>
          <th className={th}>{tx('Emplacement')}</th>
          <th className={`${th} text-right`} title={tx('Prix payé pour un exemplaire (sert à la plus-value)')}>{tx('Payé')}</th>
          <th className={`${th} text-right`}>{tx('Prix')}</th>
          <th className={`${th} w-12`} />
        </tr>
      </thead>
      <tbody>
        {cards.map(card => {
          const d = card.cardData;
          const name = nameOf(card);
          const other = getLocalizedName(d, displayLanguage(card.language) === 'French' ? 'English' : 'French');
          const place = placeOf(card, org);
          const price = priceOf ? priceOf(card) : null;
          const foilOnly = isFoilOnly(d);
          const td = 'py-2 px-2 border-b border-rift-700/70 align-middle';
          return (
            <tr key={card.key} className={`hover:bg-rift-800/60 ${selected.has(card.key) ? 'bg-gold-500/10' : ''}`}>
              {selecting && (
                <td className={td}>
                  <input type="checkbox" checked={selected.has(card.key)} onChange={() => onToggle(card.key)} aria-label={tx('Sélectionner {name}', { name })} className="w-4 h-4 accent-[#c8aa6e]" />
                </td>
              )}
              <td className={td}>
                <button onClick={() => onOpen(d.id, displayLanguage(card.language))} className="block w-10 h-14 overflow-hidden bg-rift-800" title={tx('Voir en grand')}>
                  <img src={thumbSrc(d.id)} onError={e => handleImageError(e, d.id)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              </td>
              <td className={td}>
                <button onClick={() => onOpen(d.id, displayLanguage(card.language))} className="text-left hover:text-gold-400">
                  <span className="block font-semibold text-rift-100">{name}</span>
                  {other && other !== name && <span className="block text-xs text-rift-500">{other}</span>}
                </button>
              </td>
              <td className={`${td} text-rift-300 whitespace-nowrap`}>{d.setName || d.set} <span className="text-rift-500 font-mono">#{d.collectorNumber || d.number}</span></td>
              <td className={`${td} text-rift-300`}>{rarityLabel(d.rarity)}</td>
              <td className={td}>
                <select value={card.language || DEFAULT_LANGUAGE} onChange={e => set(card, 'language', e.target.value)}
                  className="h-8 bg-rift-800 border border-rift-600 text-rift-100 px-1.5 focus:outline-none focus:border-gold-500/60">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.short}</option>)}
                </select>
              </td>
              <td className={td}>
                <select value={card.condition} onChange={e => set(card, 'condition', e.target.value)}
                  className="h-8 bg-rift-800 border border-rift-600 text-rift-100 px-1.5 focus:outline-none focus:border-gold-500/60">
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </td>
              <td className={`${td} text-center`}>
                <input type="checkbox" checked={!!card.foil} disabled={foilOnly} onChange={e => set(card, 'foil', e.target.checked)}
                  aria-label={tx('Foil')} className="w-4 h-4 accent-[#c8aa6e]" />
              </td>
              <td className={`${td} text-center`}>
                <input type="checkbox" checked={!!card.promo} onChange={e => set(card, 'promo', e.target.checked)}
                  aria-label={tx('Promo')} className="w-4 h-4 accent-[#c8aa6e]" />
              </td>
              <td className={td}>
                <div className="flex items-center justify-center">
                  <button onClick={() => set(card, 'quantity', Math.max(1, card.quantity - 1))} aria-label={tx('Un de moins')}
                    className="w-8 h-8 bg-rift-800 border border-rift-600 flex items-center justify-center text-rift-200 hover:border-gold-500/50"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="w-9 text-center font-mono text-rift-100">{card.quantity}</span>
                  <button onClick={() => set(card, 'quantity', Math.min(99, card.quantity + 1))} aria-label={tx('Un de plus')}
                    className="w-8 h-8 bg-rift-800 border border-rift-600 flex items-center justify-center text-rift-200 hover:border-gold-500/50"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </td>
              <td className={td}>
                <button onClick={() => onMove(card)} className={`flex items-center gap-1.5 text-left hover:underline ${place ? PLACE_STYLE[place[0]] : 'text-rift-500'}`}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {place ? place[1] : tx('Ranger…')}
                </button>
              </td>
              <td className={`${td} text-right`}><PaidCell value={card.paid} onChange={(v) => set(card, 'paid', v)} /></td>
              <td className={`${td} text-right whitespace-nowrap`}><PriceText value={price} estimated={price != null && estimatedOf ? estimatedOf(card) : null} className="font-semibold text-gold-400" /></td>
              <td className={`${td} text-right`}>
                <button onClick={() => onRemove(card)} aria-label={`Supprimer ${name}`} title={tx('Supprimer')}
                  className="w-8 h-8 inline-flex items-center justify-center text-rift-500 hover:text-state-bad"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Price paid for one copy (€), saved when the field loses focus. */
export function PaidCell({ value, onChange }) {
  const fmt = (v) => (v ? String(v).replace('.', ',') : '');
  const [text, setText] = useState(fmt(value));
  useEffect(() => { setText(fmt(value)); }, [value]);
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    const next = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
    if (next !== (value || null)) onChange(next);
  };
  return (
    <span className="inline-flex items-center gap-1 h-8 px-2 bg-rift-800 border border-rift-600 focus-within:border-gold-500/60">
      <input type="text" inputMode="decimal" value={text} placeholder="—" aria-label={tx('Prix payé (€)')}
        onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-14 bg-transparent text-right text-rift-100 focus:outline-none" />
      <span className="text-rift-500">€</span>
    </span>
  );
}
