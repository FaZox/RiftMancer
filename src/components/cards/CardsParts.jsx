// Parts of the « Cartes » tab, shared by the PC « Atelier » page and the phone tab:
// ActiveChips (active filters with their icon), SyntaxHelp, MobileFilters (the phone's
// bottom sheet: possession, boosters, domains, energy discs, might hexagons, rarity gems,
// types, sort), CardsGrid (virtual grid, optional custom tile) and useCardsActions.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';

import Sheet from '../common/Sheet.jsx';

import CardTileLegacy from '../collection/CardTile.jsx';

import { useDialog } from '../common/Dialog.jsx';

import { DOMAIN_COLORS } from '../../data/sampleCards.js';

import { domainIcon, rarityIcon, typeIcon, MASK_ICON } from '../../lib/symbols.js';

import { OPTIONS, VALUE_LABEL, selectionFor, toggleOption, removeToken, tokenLabel, canonValue, SYNTAX_HELP } from '../../lib/cardQuery.js';

import { gridRows, CARD_SORTS } from '../../lib/cardsBrowser.js';

import { rememberScroll } from '../../hooks/useCardsBrowser.js';

import { setImage } from '../../lib/setImages.js';

import { euro } from '../../lib/prices.js';

import { locale, tx, tp } from '../../lib/i18n.js';

const n = (v) => v.toLocaleString(locale());

const OP_SHORT = { ':': '', '!=': '≠', '<': '<', '<=': '≤', '>': '>', '>=': '≥' };

const maskUrl = (src) => ({ '--mmi': `url(${src})` });

/** Icon of a filter token for its chip (domain rune, energy disc, might, gem, type, set). */
function tokenIcon(t) {
  if (t.type !== 'term' || !t.values.length) return null;
  const v0 = t.values[0];
  switch (t.key) {
    case 'd': {
      if (t.values.length !== 1) return null;
      const d = canonValue('d', v0);
      const ic = d && domainIcon(d);
      return ic ? <img src={ic} alt="" aria-hidden="true" /> : null;
    }
    case 'e': return <span className="men" aria-hidden="true">{(OP_SHORT[t.op] || '') + v0}</span>;
    case 'p': return <span className="mmask" style={maskUrl(MASK_ICON.might)} aria-hidden="true" />;
    case 'r': {
      if (t.values.length !== 1) return null;
      const r = canonValue('r', v0);
      const ic = r && rarityIcon(r);
      return ic ? <img src={ic} alt="" aria-hidden="true" /> : null;
    }
    case 't': {
      if (t.values.length !== 1) return null;
      const ic = typeIcon(v0);
      return ic ? <span className="mmask" style={maskUrl(ic)} aria-hidden="true" /> : null;
    }
    case 's': {
      const img = setImage(v0);
      return img ? <img src={img} alt="" aria-hidden="true" style={{ height: 12, width: 'auto' }} /> : null;
    }
    default: return null;
  }
}

/** Chips of the active filters (each with its icon and ✕). */
export function ActiveChips({ b, className = '', withClear = true }) {
  const tokens = b.parsed.tokens;
  if (!tokens.length && !withClear) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tokens.map((t, i) => (
        <button key={`${i}-${t.raw}`} type="button" className="tk" aria-pressed="true"
          aria-label={tx('Retirer le filtre {label}', { label: tokenLabel(t) })}
          onClick={() => b.setQuery(q => removeToken(q, i))}>
          {tokenIcon(t)}
          {tokenLabel(t)} <b aria-hidden="true">×</b>
        </button>
      ))}
      {withClear && tokens.length > 0 && (
        <button type="button" onClick={() => b.setQuery('')} className="h-8 px-2 text-xs font-semibold text-rift-400 hover:text-rift-100">{tx('Tout effacer')}</button>
      )}
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

/**
 * The phone's filter sheet (maquette écran 5), top to bottom: possession, extensions
 * (boosters scrolling), domains (6 named runes), energy (8 discs 0 → 7+), might
 * (8 hexagons), rarity (5 gems), type (2 columns with counts), sort. Every filter
 * writes into the search line, so the grid behind updates live.
 */
export function MobileFilters({ b }) {
  const setOptions = useMemo(() => [...b.sets.keys()].map(s => s.toLowerCase()), [b.sets]);
  const sel = (key, options) => selectionFor(b.parsed, key, options);
  const selSets = sel('s', setOptions); const selD = sel('d'); const selE = sel('e'); const selP = sel('p'); const selR = sel('r'); const selT = sel('t');
  const tog = (key, v, options) => () => b.setQuery(q => toggleOption(q, key, v, options));
  const typeCounts = useMemo(() => {
    const m = {};
    for (const c of b.cards) { m[c.type] = (m[c.type] || 0) + 1; if ((c.superTypes || []).includes('champion')) m.champion = (m.champion || 0) + 1; }
    return m;
  }, [b.cards]);
  return (
    <div>
      <h6>{tx('Possession')}</h6>
      <div className="segm" style={{ height: 36 }} role="group" aria-label={tx('Possession')}>
        {[['all', tx('Toutes')], ['owned', tx('Possédées')], ['missing', tx('Manquantes')]].map(([v, l]) => (
          <button key={v} type="button" className={b.view.ownership === v ? 'on' : ''} aria-pressed={b.view.ownership === v}
            onClick={() => b.setView({ ownership: v, scroll: 0 })}>{l}</button>
        ))}
      </div>

      <h6>{tx('Extensions')}</h6>
      <div className="setsm" role="group" aria-label={tx('Extensions')}>
        {[...b.sets.values()].map(s => {
          const on = selSets.has(s.set.toLowerCase());
          const img = setImage(s.set);
          return (
            <button key={s.set} type="button" className={on ? 'on' : ''} aria-pressed={on} aria-label={s.setName} title={`${s.setName} ${s.own}/${s.total}`}
              onClick={tog('s', s.set.toLowerCase(), setOptions)}>
              {img ? <img src={img} alt="" /> : <span className="emb">{s.set}</span>}
              {s.set}
            </button>
          );
        })}
      </div>

      <h6>{tx('Domaines')}</h6>
      <div className="domm" role="group" aria-label={tx('Domaines')}>
        {OPTIONS.d.map(d => {
          const on = selD.has(d); const ic = domainIcon(d);
          return (
            <button key={d} type="button" className={on ? 'on' : ''} aria-pressed={on} aria-label={VALUE_LABEL.d[d]} onClick={tog('d', d)}>
              {ic ? <img src={ic} alt="" /> : <span className="hexagon w-[26px] h-[30px]" style={{ background: DOMAIN_COLORS[d].hex }} aria-hidden="true" />}
              {VALUE_LABEL.d[d]}
            </button>
          );
        })}
      </div>

      <h6><span className="men" aria-hidden="true">⚡</span>{tx('Énergie')}</h6>
      <div className="nums" role="group" aria-label={tx('Énergie')}>
        {OPTIONS.e.map(v => (
          <button key={v} type="button" className={`ec ${selE.has(v) ? 'on' : ''}`} aria-pressed={selE.has(v)} aria-label={`${tx('Énergie')} ${v}`} onClick={tog('e', v)}>{v}</button>
        ))}
      </div>

      <h6><span className="mmask" style={maskUrl(MASK_ICON.might)} aria-hidden="true" />{tx('Puissance')}</h6>
      <div className="nums" role="group" aria-label={tx('Puissance')}>
        {OPTIONS.p.map(v => (
          <button key={v} type="button" className={`mh2 ${selP.has(v) ? 'on' : ''}`} aria-pressed={selP.has(v)} aria-label={`${tx('Puissance')} ${v}`} onClick={tog('p', v)}>{v}</button>
        ))}
      </div>

      <h6>{tx('Rareté')}</h6>
      <div className="gemm" role="group" aria-label={tx('Rareté')}>
        {OPTIONS.r.map(v => (
          <button key={v} type="button" className={selR.has(v) ? 'on' : ''} aria-pressed={selR.has(v)} aria-label={VALUE_LABEL.r[v]} title={VALUE_LABEL.r[v]} onClick={tog('r', v)}>
            {rarityIcon(v) ? <img src={rarityIcon(v)} alt="" /> : VALUE_LABEL.r[v]}
          </button>
        ))}
      </div>

      <h6>{tx('Type')}</h6>
      <div className="typm" role="group" aria-label={tx('Type')}>
        {OPTIONS.t.map(v => {
          const ic = typeIcon(v);
          return (
            <button key={v} type="button" className={selT.has(v) ? 'on' : ''} aria-pressed={selT.has(v)} onClick={tog('t', v)}>
              {ic && <span className="mmask" style={maskUrl(ic)} aria-hidden="true" />}
              {VALUE_LABEL.t[v]}
              <small>{n(typeCounts[v] || 0)}</small>
            </button>
          );
        })}
      </div>

      <h6>{tx('Tri')}</h6>
      <select className="placem" style={{ appearance: 'none' }} value={b.view.sort} onChange={(e) => b.setView({ sort: e.target.value })} aria-label={tx('Trier')}>
        {CARD_SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}

// ─── Grid ──────────────────────────────────────────────────────────────────
/**
 * Virtual grid by rows. `cols` from `fixedCols` or the width. `renderTile(g)`:
 * custom tile (phone: CardTileMobile); otherwise the default Tile below.
 */
export function CardsGrid({ b, scrollRef, minWidth, fixedCols, fewer = 0, gap, hd, selection, onTilePress, onTileZoom, onQuickAdd, showPrice, renderTile = null, withSets = undefined }) {
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
  const sets = withSets ?? (b.view.sort === 'collector');
  const rows = useMemo(() => gridRows(b.items, cols, sets), [b.items, cols, sets]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.type === 'set' ? 48 : Math.round(tileW * 1.4) + (showPrice ? 76 : 30) + gap),
    overscan: 4,
    getItemKey: (i) => (rows[i]?.type === 'set' ? `set-${rows[i].set}` : `row-${i}`),
  });
  useEffect(() => { virtualizer.measure(); }, [tileW, virtualizer]);

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
                {row.items.map(g => (renderTile ? renderTile(g) : (
                  <Tile key={g.card.id} g={g} b={b} dim={dim} hd={hd} showPrice={showPrice} selected={selection?.has(g.card.id)}
                    onPress={onTilePress} onZoom={onTileZoom} onQuickAdd={onQuickAdd} />
                )))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Default tile (kept for callers without renderTile).
const Tile = React.memo(function Tile({ g, b, dim, hd, showPrice, selected, onPress, onZoom, onQuickAdd }) {
  const c = g.card;
  const missing = g.owned === 0;
  const price = showPrice ? b.priceOf(c) : null;
  const extra = g.prints.length - 1;
  const name = b.nameOf(c);
  const wishlistBadge = b.wishlist?.byCard?.has(c.id) ? '♥' : undefined;
  const ownedBadge = g.owned > 0 ? `×${g.owned}` : undefined;
  return (
    <div className="relative group">
      <CardTileLegacy cardData={c} name={name} hd={hd} dim={dim && missing} tag={dim && missing ? tx('Manquante') : null}
        badge={ownedBadge || wishlistBadge}
        badgeClass={ownedBadge ? undefined : wishlistBadge ? 'bg-pink-500/80 text-white' : undefined}
        selected={selected}
        onPress={onPress} onZoom={onZoom}
        meta={(
          <p className="mt-0.5 flex justify-between gap-1 text-[11px] text-rift-500">
            <span className="font-mono truncate">#{c.collectorNumber}{extra > 0 && <span className="ml-1 font-sans text-rift-400">+{extra}</span>}</span>
            {showPrice && <span className="text-rift-300">{price != null ? euro(price) : ''}</span>}
          </p>
        )} />
    </div>
  );
});

// ─── Actions ───────────────────────────────────────────────────────────────
/**
 * « Manquantes → souhaits » of the tab (menu ⋯ phone, menu ⋯ PC): every missing
 * card of the current view is added to the wish list (with a confirmation).
 */
export function useCardsActions({ b, wishlist, notify }) {
  const { ask } = useDialog();
  const wishCards = async (cards, confirm) => {
    const toAdd = cards.filter(c => !wishlist.byCard.has(c.id));
    if (!toAdd.length) { notify?.(tx('Ces cartes sont déjà dans vos souhaits'), 'info'); return; }
    if (confirm && !(await ask({ title: tx('Ajouter aux souhaits ?'), message: tp(toAdd.length, '{n} carte manquante ajoutée à la liste de souhaits.', '{n} cartes manquantes ajoutées à la liste de souhaits.', { n: toAdd.length }), confirmLabel: tx('Ajouter') }))) return;
    toAdd.forEach(c => wishlist.setWanted(c.id, 1));
    notify?.(tp(toAdd.length, '{n} carte ajoutée aux souhaits', '{n} cartes ajoutées aux souhaits', { n: toAdd.length }), 'success');
  };
  return { missingToWish: () => wishCards(b.items.filter(g => g.owned === 0).map(g => g.card), true) };
}
