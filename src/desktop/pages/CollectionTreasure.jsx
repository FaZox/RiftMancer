import React, { useMemo } from 'react';
import { Heart } from 'lucide-react';
import CardTile from '../../components/cards/CardTile.jsx';
import HexPortal from '../../components/common/HexPortal.jsx';
import useTilt from '../../components/common/useTilt.js';
import { useDialog } from '../../components/common/Dialog.jsx';
import { ShelfPack, ProgressRing, Sparkline, Shelf } from '../../components/collection/CollectionParts.jsx';
import { allCards, isBaseCard } from '../../lib/catalog.js';
import { compareCollector } from '../../lib/catalogOrder.js';
import { setProgress, masterpiece, collectionSummary, recentAdds, setArt, localDay } from '../../lib/collectionStats.js';
import { unitPrice, priceRef, euro, valueHistory, stacksValue } from '../../lib/prices.js';
import { displayName } from '../../lib/cardLocale.js';
import { thumbSrc } from '../../lib/nativeAssets.js';
import { tx, locale } from '../../lib/i18n.js';

const nf = (n) => Math.round(n).toLocaleString(locale());
const DUST = Array.from({ length: 26 }, (_, i) => ({ left: 4 + ((i * 53) % 22), top: 55 + ((i * 37) % 45), dur: 4 + ((i * 29) % 50) / 10, delay: -((i * 31) % 80) / 10 }));

function Medallion({ value, label, green = false }) {
  return (
    <div className="relative w-[104px] h-[118px] flex-shrink-0" role="group" aria-label={`${label} : ${value}`}>
      <span className="hexagon absolute inset-0 bg-gold-500/70" aria-hidden="true" />
      <span className="hexagon absolute inset-[2px] bg-[#0a1220]" aria-hidden="true" />
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-display font-bold leading-none ${green ? 'text-state-ok text-[22px]' : 'text-gold-400 text-[26px]'}`}>{value}</span>
        <span className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-rift-400">{label}</span>
      </span>
    </div>
  );
}

function Masterpiece({ card, price, onOpen }) {
  const tilt = useTilt(9);
  if (!card) return <div />;
  return (
    <div className="relative w-[205px]" data-cardid={card.id}>
      <div {...tilt} className="rf-holo rf-holo-on relative" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.6), 0 0 36px rgba(200,170,110,.35)' }}>
        <button type="button" onClick={() => onOpen(card.id)} className="block w-full" aria-label={displayName(card)}>
          <img src={thumbSrc(card.id)} alt="" className="block w-full h-auto" draggable={false} />
        </button>
      </div>
      <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-[4] whitespace-nowrap px-3 py-[3px] bg-gold-500 text-rift-900 text-[11px] font-bold uppercase tracking-[.12em] hex-cut-sm">
        ★ {tx('Pièce maîtresse')}{price != null ? ` · ${euro(price)}` : ''}
      </p>
    </div>
  );
}

/** « Salle du trésor »: masterpiece, medallions, set portals, value curve, then the shelves. */
export default function CollectionTreasure({ scannedCards, ownedByCard, copies, wishlist, prices, history, onOpen, onOpenSet, onOpenJournal, onSearch }) {
  const { ask } = useDialog();
  const catalog = useMemo(() => allCards(), []);
  const progress = useMemo(() => setProgress(ownedByCard, catalog), [ownedByCard, catalog]);
  const priceFor = (cd, s) => (prices ? unitPrice(prices, cd.id, !!s?.foil, priceRef(), !!s?.promo) : null);
  const master = useMemo(() => masterpiece(scannedCards, priceFor), [scannedCards, prices]); // eslint-disable-line react-hooks/exhaustive-deps
  const masterPrice = master && prices ? unitPrice(prices, master.id, false) ?? unitPrice(prices, master.id, true) : null;
  const pts = useMemo(() => valueHistory(history).slice(-30), [history]);
  const value = useMemo(() => (prices ? stacksValue(prices, scannedCards).value : 0), [prices, scannedCards]);
  const summary = useMemo(() => collectionSummary(scannedCards, {
    catalogSize: catalog.length, value, copies,
    valueAt: pts.length ? (t) => { const day = localDay(t); let v = null; for (const p of pts) if (p.d <= day) v = p.v; return v; } : null,
  }), [scannedCards, catalog, value, copies, pts]);
  const nSets = progress.filter(s => s.owned > 0).length;
  const byId = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

  const recentIds = useMemo(() => {
    const seen = new Set(); const out = [];
    for (const d of recentAdds(copies, { days: 30 })) for (const c of d.cards) if (!seen.has(c.cardId) && byId.has(c.cardId)) { seen.add(c.cardId); out.push(c.cardId); }
    return out.slice(0, 40);
  }, [copies, byId]);

  const missingToWish = async () => {
    const toAdd = catalog.filter(c => isBaseCard(c) && !ownedByCard.has(c.id) && !wishlist.byCard.has(c.id));
    if (!toAdd.length) return;
    if (await ask({ title: tx('Ajouter aux souhaits ?'), message: tx('{n} carte(s) manquante(s) ajoutée(s) à la liste de souhaits.', { n: toAdd.length }), confirmLabel: tx('Ajouter') })) toAdd.forEach(c => wishlist.setWanted(c.id, 1));
  };

  const shelfOf = (code) => catalog.filter(c => c.set === code && ownedByCard.has(c.id)).sort(compareCollector);
  const tileProps = (list) => ({
    onOpen: (id) => onOpen(id, { list }), onAdd: (id) => onOpen(id, { list, forge: true }), onWish: (id) => wishlist.setWanted(id, wishlist.byCard.has(id) ? 0 : 1),
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-16">
      {/* Hero */}
      <div className="relative grid grid-cols-[205px_minmax(0,1fr)_360px] gap-10 pt-[34px] pr-[34px] pb-[30px] pl-10 min-h-[420px] items-center border-b border-gold-500/15" data-help="collection.hero">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(420px 300px at 22% 55%, #e8c97333, transparent 70%), radial-gradient(600px 260px at 80% 0, #3a8fd922, transparent 70%)' }} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {DUST.map((d, i) => <i key={i} className="rf-dust absolute rounded-full bg-gold-400" style={{ left: `${d.left}%`, top: `${d.top}%`, width: 3, height: 3, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />)}
        </div>
        <Masterpiece card={master} price={masterPrice} onOpen={(id) => onOpen(id, { list: [id] })} />
        <div className="relative z-[1] min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400">{tx('Ta collection')}</p>
          <h1 className="font-display text-[34px] tracking-[.03em] font-bold text-rift-100 mt-1 mb-0.5">{tx('{n} cartes, {s} extensions', { n: nf(summary.total), s: nSets })}</h1>
          <p className="mt-2 text-[14px] text-rift-300">
            {tx('+{n} cette semaine', { n: summary.addedWeek })}
            {summary.valueSinceMonday != null && summary.valueSinceMonday !== 0 && <> · <span className={summary.valueSinceMonday > 0 ? 'text-state-ok' : 'text-state-bad'}>{tx('la valeur a pris {v} depuis lundi', { v: `${summary.valueSinceMonday > 0 ? '+' : '−'}${euro(Math.abs(summary.valueSinceMonday))}` })}</span></>}
          </p>
          <div className="mt-5 flex gap-4 flex-wrap">
            <Medallion value={nf(summary.total)} label={tx('Cartes')} />
            <Medallion value={nf(summary.different)} label={tx('Différentes')} />
            <Medallion value={prices ? euro(summary.value) : '—'} label={tx('Valeur')} green />
            <Medallion value={`${Math.round(summary.pct * 100)}%`} label={tx('Complète')} />
          </div>
        </div>
        <div className="relative z-[1] min-w-0 self-stretch flex flex-col justify-between gap-[14px]" data-help="collection.portals">
          <button type="button" onClick={onSearch} className="w-full h-10 flex items-center gap-2.5 px-3.5 border border-gold-500/35 bg-[#0a1220cc] text-left text-[14px] text-rift-500 hover:border-gold-400 hex-cut-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="#e8c973" strokeWidth="1.8" aria-hidden="true"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" /></svg>
            <span className="flex-1">{tx('Chercher dans ma collection…')}</span><kbd className="font-mono text-[11px] border border-rift-600 px-[5px] py-px">{tx('Ctrl K')}</kbd>
          </button>
          <div className="flex items-center">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500 mr-auto">{tx('Extensions')}</h2>
            <button type="button" onClick={missingToWish} className="text-[12px] font-semibold text-[#ff8ab8] hover:underline flex items-center gap-1"><Heart className="w-3.5 h-3.5" aria-hidden="true" /> {tx('Manquantes → souhaits')}</button>
          </div>
          <div className="flex flex-col items-center gap-2 -mx-4">
            {[progress.slice(0, 3), progress.slice(3, 6)].map((row, ri) => (
            <div key={ri} className="flex gap-[10px]">
            {row.map(s => {
              const missing = s.total - s.owned;
              return (
                <div key={s.code} className="group relative w-[100px] flex flex-col items-center gap-[3px]">
                  <HexPortal pct={s.pct} art={setArt(s.code, catalog)?.id} size={84} complete={s.pct >= 1} onClick={() => onOpenSet(s.code)}
                    title={tx('{name} : {owned} / {total}, {missing} manquantes', { name: s.name, owned: s.owned, total: s.total, missing })}>
                    <b className="font-display text-[19px] font-bold text-rift-100 leading-none">{Math.round(s.pct * 100)}%</b>
                    <small className="text-[11px] text-rift-300 mt-0.5">{s.owned}/{s.total}</small>
                  </HexPortal>
                  <b className={`text-[11.5px] font-semibold whitespace-nowrap ${s.pct >= 1 ? 'text-gold-400' : 'text-rift-300'}`}>{s.name}</b>
                  <div className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-10 px-2.5 py-1.5 bg-rift-800 border border-gold-500/40 text-[11.5px] whitespace-nowrap text-rift-300 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity" aria-hidden="true">
                    {s.pct >= 1 ? <em className="not-italic text-gold-400">✦ {tx('Extension complète !')}</em> : <><em className="not-italic text-gold-400">{tx('{n} manquantes', { n: missing })}</em> · ♥ {tx('ajouter aux souhaits')}</>}
                  </div>
                </div>
              );
            })}
            </div>
          ))}
          </div>
          {pts.length > 1 && (
            <div className="pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500 mb-1">{tx('Valeur')} · 30 {tx('j')}</p>
              <Sparkline points={pts} width={340} height={44} />
              <p className="text-[12px] text-state-ok mt-0.5">{euro(pts[0].v)} → {euro(pts.at(-1).v)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shelves */}
      {recentIds.length > 0 && (
        <Shelf title={tx('Derniers ajouts')} meta={tx('{n} cette semaine', { n: summary.addedWeek })} helpId="collection.shelves" onSeeAll={onOpenJournal}
          lead={<span className="w-[60px] h-[60px] grid place-items-center text-[20px] text-state-ok flex-shrink-0" aria-hidden="true">✦</span>}>
          {recentIds.map(id => <CardTile key={id} card={byId.get(id)} name={displayName(byId.get(id))} width={118} {...tileProps(recentIds)} />)}
        </Shelf>
      )}
      {progress.filter(s => s.owned > 0).map(s => {
        const list = shelfOf(s.code);
        const ids = list.map(c => c.id);
        return (
          <Shelf key={s.code} title={s.name} meta={`${s.owned} / ${s.total}`} onSeeAll={() => onOpenSet(s.code)}
            lead={<><ProgressRing pct={s.pct} size={60} /><ShelfPack code={s.code} /></>}>
            {list.slice(0, 80).map(c => <CardTile key={c.id} card={c} name={displayName(c)} owned={ownedByCard.get(c.id)} width={118} foil={false} {...tileProps(ids)} />)}
          </Shelf>
        );
      })}
    </div>
  );
}
