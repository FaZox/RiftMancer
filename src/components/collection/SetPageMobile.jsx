import React, { useMemo, useRef, useState } from 'react';

import { Heart } from 'lucide-react';

import HexPortal from '../common/HexPortal.jsx';

import Sheet from '../common/Sheet.jsx';

import CardTileMobile from '../cards/CardTileMobile.jsx';

import { useDialog } from '../common/Dialog.jsx';

import { BoosterImage } from './CollectionParts.jsx';

import { allCards } from '../../lib/catalog.js';

import { compareCollector } from '../../lib/catalogOrder.js';

import { setProgress, nextMilestone, setArt } from '../../lib/collectionStats.js';

import { stacksValue, euro } from '../../lib/prices.js';

import { displayName } from '../../lib/cardLocale.js';

import { rarityIcon, domainIcon } from '../../lib/symbols.js';

import { OPTIONS, VALUE_LABEL, RARITIES } from '../../lib/cardQuery.js';

import { rarityLabel } from '../../data/sampleCards.js';

import { thumbSrc } from '../../lib/nativeAssets.js';

import { motionOk } from '../../lib/motion.js';

import { useHelpPage } from '../../lib/help.js';

import { tx } from '../../lib/i18n.js';

const num = (c) => String(c.collectorNumber || '').replace(/\/.*/, '');

/**
 * Page d'extension « Atlas » téléphone (maquette écran 2) : « ‹ Ma collection »,
 * en-tête sur l'art de la carte phare (booster flottant, faits, portail 86 px),
 * bandeau du prochain palier, ruban de complétion (toucher = aller à la carte,
 * appui long = aperçu), barre collante Toutes / Possédées / Manq. + Filtres
 * (feuille du bas : gemmes de rareté, runes de domaine), grille de 3 colonnes
 * avec alvéoles sombres et ＋ doré au coin des manquantes, et le bouton
 * « ♥ Ajouter les manquantes aux souhaits » en bas.
 */
export default function SetPageMobile({ code, scannedCards, ownedByCard, wishlist, prices, onOpen, onBack }) {
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [tip, setTip] = useState(null); // index du trait survolé / appui long
  const gridRef = useRef(null);
  const tipTimer = useRef(null);

  const shown = useMemo(() => cards.filter(c => {
    const has = ownedByCard.has(c.id);
    if (seg === 'owned' && !has) return false;
    if (seg === 'missing' && has) return false;
    if (rars.size && !rars.has(c.rarity)) return false;
    if (doms.size && !(c.domains?.length ? c.domains : [c.domain]).some(d => doms.has(d))) return false;
    return true;
  }), [cards, ownedByCard, seg, rars, doms]);
  const ids = useMemo(() => shown.map(c => c.id), [shown]);

  const toggle = (setter) => (v) => setter(s => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const goTo = (id) => {
    setSeg('all'); setRars(new Set()); setDoms(new Set());
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
  const onSegTouchStart = (i) => { clearTimeout(tipTimer.current); tipTimer.current = setTimeout(() => setTip(i), 450); };
  const onSegTouchEnd = () => { clearTimeout(tipTimer.current); };

  const nFilters = rars.size + doms.size;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4">
      <div className="ahm" style={{ '--set-art': art ? `url(${thumbSrc(art.id)})` : 'none' }}>
        <button type="button" className="back" onClick={onBack}>‹ {tx('Ma collection')}</button>
        <div className="row">
          <BoosterImage code={code} width={92} className="pack rf-booster" shine />
          <div className="min-w-0">
            <div className="eb">{tx('Extension')} · {code}</div>
            <h2>{info.name}</h2>
            <div className="facts">
              <b>{info.total}</b> {tx('cartes')} · <b>{info.owned}</b> {tx('possédées')}<br />
              <b>{missingN}</b> {tx('manquantes')}
              {value != null && value > 0 && <> · <span className="ok">≈ {euro(value)}</span></>}
            </div>
          </div>
          <div className="bp">
            <HexPortal pct={info.pct} art={art?.id} size={86} complete={info.pct >= 1}>
              <span className="pct"><b>{Math.round(info.pct * 100)}%</b><small>{tx('complète')}</small></span>
            </HexPortal>
          </div>
        </div>
        <div className="nextm">
          {miles
            ? <>⬢ {tx('Prochain palier')} <b>{Math.round(miles.pct * 100)} %</b> : {tx('encore {n} cartes', { n: miles.missing })}</>
            : <>✦ {tx('Extension complète !')}</>}
        </div>
      </div>

      {/* Ruban de complétion : toucher = aller à la carte, appui long = aperçu */}
      <div className="ribm" data-help="set.ribbon">
        <p>{tx('Ruban de complétion · touche pour aller à la carte')}</p>
        <div className="ribbon relative">
          {cards.map((c, i) => (
            <i key={c.id} role="button" tabIndex={-1} aria-label={`${num(c)} ${displayName(c)} ${ownedByCard.has(c.id) ? tx('possédée') : tx('manquante')}`}
              className={ownedByCard.has(c.id) ? 'own' : ''}
              onClick={() => { setTip(null); goTo(c.id); }}
              onTouchStart={() => onSegTouchStart(i)} onTouchEnd={onSegTouchEnd} onTouchCancel={onSegTouchEnd} />
          ))}
          {tip != null && cards[tip] && (
            <div className="absolute bottom-[30px] z-30 w-[150px] p-2 border border-gold-500/50 bg-rift-800 text-[12px] pointer-events-none"
              style={{ left: `clamp(0px, calc(${((tip + 0.5) / cards.length) * 100}% - 75px), calc(100% - 150px))` }}>
              <img src={thumbSrc(cards[tip].id)} alt="" className="w-full h-auto mb-1" />
              <p className="text-rift-100 truncate">{displayName(cards[tip])}</p>
              <p className="text-rift-400">#{num(cards[tip])} · {ownedByCard.has(cards[tip].id) ? tx('possédée') : tx('manquante')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Barre collante */}
      <div className="stickm">
        <div className="segm" role="group" aria-label={tx('Afficher')}>
          {[['all', tx('Toutes'), info.total], ['owned', tx('Possédées'), info.owned], ['missing', tx('Manq.'), missingN]].map(([v, l, n]) => (
            <button key={v} type="button" className={seg === v ? 'on' : ''} aria-pressed={seg === v} onClick={() => setSeg(v)}>{l}<small>{n}</small></button>
          ))}
        </div>
        <button type="button" className="fbt" onClick={() => setFiltersOpen(true)} aria-label={tx('Filtres')} data-help="cards.filtersheet">
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} aria-hidden="true"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg>
          {tx('Filtres')}
          {nFilters > 0 && <i>{nFilters}</i>}
        </button>
      </div>

      {/* Grille de 3 colonnes */}
      <div ref={gridRef} className="g3" data-help="set.grid">
        {shown.map(c => {
          const own = ownedByCard.get(c.id) || 0;
          return (
            <CardTileMobile key={c.id} card={c} name={displayName(c)} owned={own} missing={!own} wished={wishlist.byCard.has(c.id)}
              flash={flash === c.id}
              onOpen={(id) => onOpen(id, { list: ids })} onAdd={(id) => onOpen(id, { list: ids, forge: true })} />
          );
        })}
        {!shown.length && <p className="col-span-full py-16 text-center text-rift-400">{tx('Aucune carte ne correspond')}</p>}
      </div>

      {missingN > 0 && (
        <div className="px-[14px] pb-5">
          <button type="button" className="vtall w-full !margin-0 !h-11 !text-[#ff8a80] !border-[#ff8a8077] !bg-[#ff8a8014] inline-flex items-center justify-center gap-2"
            onClick={wishMissing}>
            <Heart size={13} aria-hidden="true" /> {tx('Ajouter les {n} manquantes aux souhaits', { n: missingN })}
          </button>
        </div>
      )}

      <Sheet open={filtersOpen} title={tx('Filtres')} onClose={() => setFiltersOpen(false)}
        action={nFilters > 0 ? <button type="button" onClick={() => { setRars(new Set()); setDoms(new Set()); }}>{tx('Tout effacer')}</button> : undefined}>
        <h6>{tx('Rareté')}</h6>
        <div className="gemm" role="group" aria-label={tx('Rareté')}>
          {RARITIES.filter(r => info.byRarity[r]).map(r => (
            <button key={r} type="button" className={rars.has(r) ? 'on' : ''} aria-pressed={rars.has(r)} aria-label={rarityLabel(r)} title={rarityLabel(r)}
              onClick={() => toggle(setRars)(r)}>
              {rarityIcon(r) ? <img src={rarityIcon(r)} alt="" /> : rarityLabel(r)}
            </button>
          ))}
        </div>
        <h6>{tx('Domaines')}</h6>
        <div className="domm" role="group" aria-label={tx('Domaines')}>
          {OPTIONS.d.map(d => (
            <button key={d} type="button" className={doms.has(d) ? 'on' : ''} aria-pressed={doms.has(d)} aria-label={VALUE_LABEL.d[d]}
              onClick={() => toggle(setDoms)(d)}>
              {domainIcon(d) ? <img src={domainIcon(d)} alt="" /> : VALUE_LABEL.d[d]}
              {VALUE_LABEL.d[d]}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
