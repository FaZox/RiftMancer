import React, { useMemo, useRef, useState } from 'react';
import { Heart, Search } from 'lucide-react';
import CardTile from '../../components/cards/CardTile.jsx';
import HexPortal from '../../components/common/HexPortal.jsx';
import { useDialog } from '../../components/common/Dialog.jsx';
import { BackButton, BoosterImage, BigButton } from '../../components/collection/CollectionParts.jsx';
import { allCards } from '../../lib/catalog.js';
import { compareCollector } from '../../lib/catalogOrder.js';
import { setProgress, nextMilestone, setArt } from '../../lib/collectionStats.js';
import { stacksValue, euro } from '../../lib/prices.js';
import { displayName } from '../../lib/cardLocale.js';
import { rarityIcon, domainIcon } from '../../lib/symbols.js';
import { DOMAIN_COLORS, rarityLabel, domainLabel } from '../../data/sampleCards.js';
import { thumbSrc } from '../../lib/nativeAssets.js';
import { motionOk } from '../../lib/motion.js';
import { useHelpPage } from '../../lib/help.js';
import { tx } from '../../lib/i18n.js';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'showcase'];
const DOMAINS = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];
const num = (c) => String(c.collectorNumber || '').replace(/\/.*/, '');

function Bar({ icon, label, value, total, color = '#e8c973' }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="w-[74px] truncate text-rift-300">{label}</span>
      <span className="flex-1 h-1.5 bg-[#18263c]"><span className="block h-full" style={{ width: `${total ? (100 * value) / total : 0}%`, background: color }} /></span>
      <span className="w-14 text-right font-mono text-rift-400">{value}/{total}</span>
    </div>
  );
}

/** Set page « Atlas »: booster, milestone, bars, completion ribbon, filters and the grid with empty cells for what is missing. */
export default function CollectionSetPage({ code, scannedCards, ownedByCard, wishlist, prices, onOpen, onBack }) {
  useHelpPage('set');
  const { ask } = useDialog();
  const catalog = useMemo(() => allCards(), []);
  const cards = useMemo(() => catalog.filter(c => c.set === code).sort(compareCollector), [catalog, code]);
  const info = useMemo(() => setProgress(ownedByCard, cards)[0] || { code, name: code, owned: 0, total: 0, pct: 0, byRarity: {}, byDomain: {} }, [ownedByCard, cards, code]);
  const art = setArt(code, cards);
  const value = useMemo(() => (prices ? stacksValue(prices, scannedCards.filter(s => s.cardData.set === code)).value : null), [prices, scannedCards, code]);
  const miles = nextMilestone(info.owned, info.total);
  const missingN = info.total - info.owned;

  const [seg, setSeg] = useState('all'); // all | owned | missing
  const [rars, setRars] = useState(() => new Set());
  const [doms, setDoms] = useState(() => new Set());
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState(null);
  const [tip, setTip] = useState(null);
  const gridRef = useRef(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cards.filter(c => {
      const has = ownedByCard.has(c.id);
      if (seg === 'owned' && !has) return false;
      if (seg === 'missing' && has) return false;
      if (rars.size && !rars.has(c.rarity)) return false;
      if (doms.size && !(c.domains?.length ? c.domains : [c.domain]).some(d => doms.has(d))) return false;
      if (t && !`${displayName(c)} ${displayName(c, 'English')} ${c.code || ''} ${num(c)}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [cards, ownedByCard, seg, rars, doms, q]);
  const ids = useMemo(() => shown.map(c => c.id), [shown]);

  const toggle = (setter) => (v) => setter(s => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const goTo = (id) => {
    setSeg('all'); setRars(new Set()); setDoms(new Set()); setQ('');
    setTimeout(() => {
      const el = gridRef.current?.querySelector(`[data-cardid="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'center' });
      setFlash(id); setTimeout(() => setFlash(null), 1500);
    }, 30);
  };
  const wishMissing = async () => {
    const toAdd = cards.filter(c => !ownedByCard.has(c.id) && !wishlist.byCard.has(c.id));
    if (!toAdd.length) return;
    if (await ask({ title: tx('Ajouter aux souhaits ?'), message: tx('{n} carte(s) manquante(s) ajoutée(s) à la liste de souhaits.', { n: toAdd.length }), confirmLabel: tx('Ajouter') })) toAdd.forEach(c => wishlist.setWanted(c.id, 1));
  };
  const onRibbonKey = (e, i) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); e.currentTarget.nextElementSibling?.focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.previousElementSibling?.focus(); }
    else if (e.key === 'Enter') goTo(cards[i].id);
  };

  const pill = (on) => `h-8 px-3 text-[13px] font-semibold border ${on ? 'border-gold-400 bg-gold-500/15 text-gold-400' : 'border-rift-600 text-rift-300 hover:border-gold-500/50'}`;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-16">
      {/* Header */}
      <header className="relative overflow-hidden px-8 pt-16 pb-6">
        {art && <img src={thumbSrc(art.id)} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[.14] blur-md scale-110 pointer-events-none" style={{ WebkitMask: 'linear-gradient(90deg, #000, transparent 85%)', mask: 'linear-gradient(90deg, #000, transparent 85%)' }} />}
        <div className="absolute top-4 left-8 z-10"><BackButton onClick={onBack} /></div>
        <div className="relative grid grid-cols-[150px_minmax(0,1fr)_170px_320px] gap-8 items-center">
          <div className="flex justify-center"><BoosterImage code={code} width={132} shine /></div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold-500">{tx('Extension')} · {code}</p>
            <h1 className="font-display text-[42px] leading-tight font-bold text-rift-100">{info.name}</h1>
            <p className="mt-1 text-[14px] text-rift-300">
              {tx('{n} cartes', { n: info.total })} · {tx('{n} possédées', { n: info.owned })} · {tx('{n} manquantes', { n: missingN })}
              {value != null && value > 0 && <> · <span className="text-state-ok">≈ {euro(value)} {tx('de valeur')}</span></>}
            </p>
            <p className="mt-2 text-[14px] font-semibold text-gold-400">
              {miles ? `⬢ ${tx('Prochain palier {p} % : encore {n} cartes', { p: Math.round(miles.pct * 100), n: miles.missing })}` : `✦ ${tx('Extension complète !')}`}
            </p>
          </div>
          <HexPortal pct={info.pct} art={art?.id} size={150} complete={info.pct >= 1}>
            <b className="font-display text-[38px] font-bold text-rift-100 leading-none">{Math.round(info.pct * 100)}%</b>
            <small className="text-[11px] text-rift-300 tracking-[0.1em] uppercase mt-1">{tx('complète')}</small>
          </HexPortal>
          <div className="space-y-1.5" aria-label={tx('Par rareté')}>
            {RARITIES.filter(r => info.byRarity[r]).map(r => (
              <Bar key={r} icon={rarityIcon(r) ? <img src={rarityIcon(r)} alt="" className="w-4 h-4 object-contain" /> : '◆'} label={rarityLabel(r)} value={info.byRarity[r][0]} total={info.byRarity[r][1]} />
            ))}
            <div className="h-1" />
            {DOMAINS.filter(d => info.byDomain[d]).map(d => (
              <Bar key={d} icon={domainIcon(d) ? <img src={domainIcon(d)} alt="" className="w-4 h-4" /> : '◆'} label={domainLabel(d)} value={info.byDomain[d][0]} total={info.byDomain[d][1]} color={DOMAIN_COLORS[d].hex} />
            ))}
          </div>
        </div>
      </header>

      {/* Completion ribbon */}
      <div className="relative px-8" data-help="set.ribbon">
        <div role="list" aria-label={tx('Ruban de complétion')} className="relative h-7 flex bg-rift-800/60" onMouseLeave={() => setTip(null)}>
          {cards.map((c, i) => {
            const has = ownedByCard.has(c.id);
            const bg = has ? (c.rarity === 'showcase' ? 'linear-gradient(#fff, #b78cff)' : '#e8c973') : '#1b2b44';
            return (
              <button key={c.id} role="listitem" type="button" tabIndex={i === 0 ? 0 : -1} aria-label={`${num(c)} ${displayName(c)} ${has ? tx('possédée') : tx('manquante')}`}
                className="flex-1 min-w-0 border-r border-rift-900/60 hover:brightness-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                style={{ background: bg }} onMouseEnter={() => setTip(i)} onFocus={() => setTip(i)} onClick={() => goTo(c.id)} onKeyDown={(e) => onRibbonKey(e, i)} />
            );
          })}
          {[0.25, 0.5, 0.75].map(p => <span key={p} className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none" style={{ left: `${p * 100}%` }} aria-hidden="true" />)}
          {tip != null && cards[tip] && (
            <div className="absolute bottom-9 z-30 w-[150px] p-2 bg-rift-800 border border-gold-500/50 text-[12px] pointer-events-none" style={{ left: `clamp(0px, calc(${((tip + 0.5) / cards.length) * 100}% - 75px), calc(100% - 150px))` }}>
              <img src={thumbSrc(cards[tip].id)} alt="" className="w-full h-auto mb-1" />
              <p className="text-rift-100 truncate">{displayName(cards[tip])}</p>
              <p className="text-rift-400">#{num(cards[tip])} · {ownedByCard.has(cards[tip].id) ? tx('possédée') : tx('manquante')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 mt-4 px-8 py-3 bg-rift-900/95 backdrop-blur border-b border-gold-500/20 flex items-center gap-3 flex-wrap">
        <div className="seg w-[360px]" role="group" aria-label={tx('Afficher')}>
          {[['all', tx('Toutes'), info.total], ['owned', tx('Possédées'), info.owned], ['missing', tx('Manquantes'), missingN]].map(([v, l, n]) => (
            <button key={v} type="button" aria-pressed={seg === v} onClick={() => setSeg(v)}>{l} <span className="opacity-70 font-normal">{n}</span></button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label={tx('Rareté')}>
          {RARITIES.filter(r => info.byRarity[r]).map(r => (
            <button key={r} type="button" aria-pressed={rars.has(r)} onClick={() => toggle(setRars)(r)} title={rarityLabel(r)} aria-label={rarityLabel(r)} className={`${pill(rars.has(r))} !px-2`}>
              {rarityIcon(r) ? <img src={rarityIcon(r)} alt="" className="w-4 h-4 object-contain" /> : rarityLabel(r)}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label={tx('Domaines')}>
          {DOMAINS.filter(d => info.byDomain[d]).map(d => (
            <button key={d} type="button" aria-pressed={doms.has(d)} onClick={() => toggle(setDoms)(d)} title={domainLabel(d)} aria-label={domainLabel(d)} className={`${pill(doms.has(d))} !px-2`}>
              {domainIcon(d) ? <img src={domainIcon(d)} alt="" className={`w-4 h-4 ${doms.has(d) ? '' : 'opacity-60'}`} /> : domainLabel(d)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 h-8 px-2.5 bg-rift-800 border border-rift-600 focus-within:border-gold-500/60 w-[240px]">
          <Search className="w-4 h-4 text-gold-500" aria-hidden="true" />
          <span className="sr-only">{tx('Chercher')}</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tx('Chercher dans {name}…', { name: info.name })} className="flex-1 min-w-0 bg-transparent text-[13px] text-rift-100 placeholder:text-rift-500 outline-none" />
        </label>
        {missingN > 0 && <BigButton onClick={wishMissing} className="ml-auto !h-8 !text-[13px]"><Heart className="w-3.5 h-3.5" aria-hidden="true" /> {tx('Ajouter les {n} manquantes aux souhaits', { n: missingN })}</BigButton>}
      </div>

      {/* Grid */}
      <div ref={gridRef} className="px-8 pt-5 grid gap-x-4 gap-y-5 justify-start" style={{ gridTemplateColumns: 'repeat(auto-fill, 124px)' }} data-help="set.grid">
        {shown.map(c => {
          const own = ownedByCard.get(c.id) || 0;
          return (
            <CardTile key={c.id} card={c} name={displayName(c)} owned={own} missing={!own} wished={wishlist.byCard.has(c.id)} width={124} flash={flash === c.id}
              caption={`#${num(c)}`} onOpen={(id) => onOpen(id, { list: ids })} onAdd={(id) => onOpen(id, { list: ids, forge: true })} onWish={(id) => wishlist.setWanted(id, wishlist.byCard.has(id) ? 0 : 1)} />
          );
        })}
        {!shown.length && <p className="col-span-full py-16 text-center text-rift-400">{tx('Aucune carte ne correspond')}</p>}
      </div>
    </div>
  );
}
