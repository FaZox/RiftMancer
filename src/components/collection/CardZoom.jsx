import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Heart, Plus, Minus, Sparkles, ExternalLink, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { usePrices, unitPrice, priceInfo, hasFinishPrice, euro, cardmarketUrl, priceVolatile, priceRef, PRICE_REF_LABEL, ESTIMATE_LABEL } from '../../lib/prices.js';
import PriceText from '../common/PriceText.jsx';
import PriceHistory from '../common/PriceHistory.jsx';
import RiftStage from './RiftStage.jsx';
import { fullImageSrc, downloadedImageSrc, thumbSrc, isNative } from '../../lib/nativeAssets.js';
import { getLocalizedName, getLocalizedText, rulesTextHtml, displayLanguage } from '../../lib/cardLocale.js';
import ErrataNote from '../common/ErrataNote.jsx';
import PrintsList from './PrintsList.jsx';
import { MIGHT_ICON, rarityIcon, symbolsReady, domainIcon } from '../../lib/symbols.js';
import { useHelpPage } from '../../lib/help.js';
import RulingsList from './RulingsList.jsx';
import { useBackHandler } from '../../lib/backButton.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import {
  DOMAIN_COLORS, LANGUAGES, domainLabel, rarityLabel, typeLabel,
} from '../../data/sampleCards.js';
import { conditionShort } from '../../lib/conditions.js';
import { tx, locale } from '../../lib/i18n.js';

const TABS = [
  { id: 'infos', label: tx('Infos') },
  { id: 'price', label: tx('Prix') },
  { id: 'mine', label: tx('Ma collection') },
];

/**
 * « Vitrine » card view: the card large on a halo of its domain colour, then
 * Infos / Prix / Ma collection, and « Ajouter » always at hand.
 */
// onRemoveCopy (collection): one copy of a stack less; onUpdateCard: change a stack (promo)
export default function CardZoom({ cardId: openedId, language: initialLanguage, stacks, wanted, onSetWanted, onAddCopy, onRemoveCopy = null, onUpdateCard = null, onClose, onPrev = null, onNext = null, position = null, deckControls = null }) {
  useBackHandler(true, onClose);
  useHelpPage('card'); // its tour the first time a card is opened
  const [prefs] = usePrefs();
  // « Impressions et variantes »: another printing can be shown in the same sheet
  const [cardId, setCardId] = useState(openedId);
  useEffect(() => { setCardId(openedId); }, [openedId]);
  const cardData = getMatcher().getCardData(cardId);
  const [language, setLanguage] = useState(displayLanguage(initialLanguage) === 'English' ? 'English' : 'French');
  const [tab, setTab] = useState('infos');
  // Thumbnail at once, full-size image as soon as it is loaded (no empty frame).
  const [imgSrc, setImgSrc] = useState(thumbSrc(cardId));
  const [noHd, setNoHd] = useState(false); // phone before its first sync (lot 4.6)
  const { prices } = usePrices();

  useEffect(() => {
    setTab('infos');
    setImgSrc(thumbSrc(cardId));
    setNoHd(false);
    // Full image: with the app (PC), else received from the PC (phone)
    const sources = [...new Set([fullImageSrc(cardId), downloadedImageSrc(cardId)].filter(Boolean))].filter(s => !s.includes('/thumbs/'));
    if (!sources.length) { setNoHd(isNative); return undefined; }
    const full = new Image();
    let i = 0;
    full.onload = () => setImgSrc(sources[i]);
    full.onerror = () => { if (++i < sources.length) full.src = sources[i]; else setNoHd(isNative); };
    full.src = sources[0];
    return () => { full.onload = null; full.onerror = null; };
  }, [cardId]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  // Swipe left / right to change card (only clearly horizontal gestures)
  const touch = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [cardId]);
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNext?.(); else onPrev?.();
  };

  if (!cardData) return null;
  const name = getLocalizedName(cardData, language);
  const otherName = getLocalizedName(cardData, language === 'French' ? 'English' : 'French');
  const text = getLocalizedText(cardData, language);
  const owned = stacks.filter(s => s.cardData.id === cardId);
  const ownedTotal = owned.reduce((n, s) => n + s.quantity, 0);
  // Copies in the language shown (FR / EN): the « − » takes a plain one first
  const inLanguage = owned.filter(s => (s.language || 'English') === language);
  const langCount = inLanguage.reduce((n, s) => n + s.quantity, 0);
  const removeOne = () => {
    const pick = [...inLanguage].sort((a, b) => (a.foil || a.promo) - (b.foil || b.promo) || b.quantity - a.quantity)[0];
    if (pick) onRemoveCopy(pick);
  };
  const langShort = language === 'French' ? tx('FR') : tx('EN');
  const ownedValue = prices ? owned.reduce((v, s) => v + (unitPrice(prices, cardId, s.foil, priceRef(), s.promo) || 0) * s.quantity, 0) : null;
  const domains = (cardData.domains?.length ? cardData.domains : (cardData.domain ? [cardData.domain] : [])).filter(Boolean);
  const colors = (domains.length ? domains : ['colorless']).map(d => (DOMAIN_COLORS[d] || DOMAIN_COLORS.colorless).hex);
  const isLandscape = cardData.type === 'battlefield';
  const normalInfo = priceInfo(prices, cardId, false);
  const price = normalInfo.value;
  // Foil price in the chosen reference (only when the card has a foil price)
  const foilPrice = hasFinishPrice(prices, cardId, true) ? unitPrice(prices, cardId, true) : null;
  const promoInfo = prices?.promo?.[cardId] ? priceInfo(prices, cardId, false, priceRef(), true) : null;
  const ownsFoil = owned.some(s => s.foil);
  // Legends and cards worth more than 20 € get the « légende » stage (lightning)
  const refPrice = price ?? foilPrice;
  const isPrecious = cardData.type === 'legend' || (refPrice != null && refPrice > 20);
  const onImgError = () => { if (imgSrc !== thumbSrc(cardId)) setImgSrc(thumbSrc(cardId)); };
  // What you paid (Prix tab → « Mon achat »): average of the copies with a price, latest date
  const paidStacks = owned.filter(s => s.paid > 0);
  const paidCount = paidStacks.reduce((n, s) => n + s.quantity, 0);
  const paidAvg = paidCount ? paidStacks.reduce((v, s) => v + s.paid * s.quantity, 0) / paidCount : null;
  const paidDate = owned.map(s => s.paidAt).filter(Boolean).sort().at(-1) || null;
  const tabLabel = (t) => (t.id === 'price' && price != null ? tx('Prix · {v0}{euro}', { v0: normalInfo.estimated ? '≈ ' : '', euro: euro(price) }) : t.id === 'mine' ? tx('Ma collection · {ownedTotal}', { ownedTotal }) : t.label);

  return (
    <div className="fixed inset-0 z-50 bg-rift-900 flex flex-col lg:bg-black/80 lg:p-6 2xl:p-10 lg:items-center lg:justify-center" role="dialog" aria-label={name}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* PC: the zoom is a window that fits the screen (card on the left, details on the right) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-none lg:w-full lg:max-w-[1240px] lg:h-full lg:max-h-[min(1000px,94vh)] lg:bg-rift-900 lg:border lg:border-gold-500/30 lg:shadow-[0_0_60px_rgba(0,0,0,.6)] lg:overflow-hidden">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="max-w-xl mx-auto lg:max-w-none lg:h-full lg:grid lg:grid-cols-[600px_minmax(0,1fr)]">
          {/* Hero: the card rises out of a cracked ground, in its domain colour */}
          <RiftStage
            key={cardId /* replays the animation for each card */}
            colors={colors}
            landscape={isLandscape}
            heightClass={'h-[min(70vh,calc(100vw*1.436))] lg:h-full'} /* phone: the 390 × 560 scene takes the whole width */
            still={!prefs.cardAnimations && cardData.type !== 'legend' /* legends keep their scene */}
            legend={isPrecious}
            plaque={cardData.type === 'legend' ? tx('LÉGENDE') : euro(refPrice)}
            onTop={(
              <>
                <button onClick={onClose} aria-label={tx('Retour')} className="absolute top-3 left-3 z-10 w-11 h-11 flex items-center justify-center bg-rift-900/70 border border-gold-500/40 text-rift-100">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div role="group" aria-label={tx('Langue')} data-help="card.lang" className="absolute top-3 right-3 z-10 flex bg-rift-900/70 border border-gold-500/45">
                  {['French', 'English'].map(l => (
                    <button key={l} onClick={() => setLanguage(l)} aria-pressed={language === l}
                      className={`w-11 h-10 text-[13px] font-bold ${language === l ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400'}`}>
                      {l === 'French' ? tx('FR') : tx('EN')}
                    </button>
                  ))}
                </div>
                {position && (
                  <>
                    <span className="absolute top-5 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-rift-900/70 text-xs text-rift-300 tabular-nums">{position}</span>
                    {onPrev && (
                      <button onClick={onPrev} aria-label={tx('Carte précédente')} className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-14 flex items-center justify-center text-rift-100/80 bg-rift-900/40">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                    )}
                    {onNext && (
                      <button onClick={onNext} aria-label={tx('Carte suivante')} className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-14 flex items-center justify-center text-rift-100/80 bg-rift-900/40">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          >
            {isLandscape ? (
              // Battlefield: the file is stored turned 90° — shown turned back, uncut.
              <span className="relative block w-full aspect-[7/5] overflow-hidden" role="img" aria-label={name}>
                <img src={imgSrc} alt="" onError={onImgError} className="absolute top-1/2 left-1/2 max-w-none object-cover"
                  style={{ width: '71.43%', height: '140%', transform: 'translate(-50%, -50%) rotate(90deg)' }} />
              </span>
            ) : (
              <img src={imgSrc} alt={name} onError={onImgError}
                className="block w-full h-auto" />
            )}
          </RiftStage>
          {noHd && <p className="px-5 -mt-1 mb-2 text-center text-[12px] text-rift-400">{tx('Image en haute définition après la première synchro')}</p>}
          {/* PC: details on the right of the card */}
          <div className="min-w-0 lg:h-full lg:overflow-y-auto lg:pt-5 lg:pb-5 lg:pr-2">

          {/* Title */}
          <section className="px-5 pt-1 relative space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {domains.map(d => (
                <span key={d} className="px-2.5 py-0.5 text-xs font-bold text-white inline-flex items-center gap-1" style={{ background: (DOMAIN_COLORS[d] || DOMAIN_COLORS.colorless).hex }}>
                  {domainIcon(d) && <img src={domainIcon(d)} alt="" className="w-3.5 h-3.5 -ml-1" />}{domainLabel(d)}
                </span>
              ))}
              <span className="px-2.5 py-0.5 text-xs bg-rift-700 border border-rift-600 text-rift-100">{typeLabel(cardData.type)}</span>
              <span className="px-2.5 py-0.5 text-xs bg-rift-800 border border-gold-400 text-gold-400">{rarityLabel(cardData.rarity)}</span>
              {(paidAvg != null || paidDate) && (
                <span className="ml-auto self-center text-[13px] text-rift-200" title={tx('Prix payé et date d’achat (onglet Prix)')}>
                  {paidAvg != null && <>{tx('Payé')} <span className="font-semibold text-gold-400">{euro(paidAvg)}</span>{paidStacks.length > 1 && <span className="text-rift-400"> {tx('(moyenne)')}</span>}</>}
                  {paidDate && <>{paidAvg != null ? ' · ' : ''}{tx('le {date}', { date: new Date(`${paidDate}T12:00:00`).toLocaleDateString(locale()) })}</>}
                </span>
              )}
            </div>
            <h2 className="font-display text-[26px] leading-tight font-bold text-gold-400 flex items-center gap-2">
              {/* the rarity's gem, as printed on the card */}
              {rarityIcon(cardData.rarity) && <img src={rarityIcon(cardData.rarity)} alt={rarityLabel(cardData.rarity)} title={rarityLabel(cardData.rarity)} className="w-6 h-6 flex-shrink-0 object-contain" />}
              <span className="min-w-0">{name}</span>
            </h2>
            <p className="text-[13px] text-rift-400">
              {otherName !== name && <>{otherName} · </>}{cardData.setName} #{cardData.collectorNumber}
              {cardData.illustrator && <> {tx('· illustré par')} {cardData.illustrator}</>}
            </p>
          </section>

          {/* Tabs */}
          <div className="seg mx-5 mt-4" role="tablist" aria-label={tx('Sections')} data-help="card.tabs">
            {TABS.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="!text-[13px]">{tabLabel(t)}</button>
            ))}
          </div>

          <section className="px-5 py-4 space-y-3">
            {tab === 'infos' && (
              <>
                {(cardData.energy != null || cardData.might != null || cardData.power) && (
                  <div className={`grid gap-2 ${cardData.power && cardData.might != null && cardData.energy != null ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {cardData.energy != null && (
                      <div className="flex items-center gap-3 p-2.5 bg-rift-800">
                        <span className="hexagon w-9 h-9 flex items-center justify-center bg-[#1d3a5c] text-[#8fd0ff] font-bold">{cardData.energy}</span>
                        <span className="text-[13px] text-rift-400">{tx('Énergie')}</span>
                      </div>
                    )}
                    {cardData.power > 0 && (
                      // recycle cost: runes of the card's (first) domain, as printed under the energy
                      <div className="flex items-center gap-3 p-2.5 bg-rift-800" title={tx('Coût de recyclage : {n} rune(s) {domain}', { n: cardData.power, domain: domainLabel(cardData.domain || domains[0] || 'colorless') })}>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: cardData.power }, (_, i) => (domainIcon(cardData.domain || domains[0])
                            ? <img key={i} src={domainIcon(cardData.domain || domains[0])} alt="" className="w-5 h-5" />
                            : <span key={i} className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white" style={{ background: (DOMAIN_COLORS[cardData.domain] || DOMAIN_COLORS.colorless).hex }}>◆</span>))}
                        </span>
                        <span className="text-[13px] text-rift-400">{tx('Recyclage')}</span>
                      </div>
                    )}
                    {cardData.might != null && (
                      <div className="flex items-center gap-3 p-2.5 bg-rift-800">
                        <span className="hexagon w-9 h-9 flex items-center justify-center bg-[#5a1d19] text-[#ffb4ab] font-bold">{cardData.might}</span>
                        {symbolsReady() && <img src={MIGHT_ICON} alt="" className="w-4 h-4 -mr-1.5" />}
                        <span className="text-[13px] text-rift-400">{tx('Puissance')}</span>
                      </div>
                    )}
                  </div>
                )}
                {text && (
                  <div className="border border-[#e8a33a]/55 bg-[#e8a33a]/10 p-3">
                    {!text.translated && <p className="text-[11px] text-state-warn mb-1">{tx('Traduction indisponible — texte anglais')}</p>}
                    <ErrataNote cardData={cardData} text={text} language={language}>
                      <div className="text-[15px] text-rift-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: rulesTextHtml(text) }} />
                    </ErrataNote>
                  </div>
                )}
                {cardData.tags?.length > 0 && (
                  <p className="text-[13px] text-rift-400">{tx('Mots-clés :')} {cardData.tags.join(' · ')}</p>
                )}
                <RulingsList cardData={cardData} />
                <PrintsList cardData={cardData} stacks={stacks} prices={prices} onOpen={setCardId} />
              </>
            )}

            {tab === 'price' && owned.length > 0 && onUpdateCard && (
              <PurchaseEditor key={cardId} owned={owned} paid={paidAvg} paidAt={paidDate} onSave={(paid, paidAt) => owned.forEach(s => onUpdateCard(s, { ...s, paid, paidAt }))} />
            )}
            {tab === 'price' && (
              !prices ? (
                <p className="text-sm text-rift-400">{tx('Prix disponibles dans l’app PC (et sur le téléphone après une synchro).')}</p>
              ) : (
                <>
                  <div className="panel p-4 flex items-baseline gap-3">
                    <PriceText value={price} estimated={normalInfo.estimated} className="font-display text-3xl font-bold text-gold-400" />
                    <span className="text-xs text-rift-400">{tx('Cardmarket,')} {PRICE_REF_LABEL[priceRef()]}</span>
                    {foilPrice != null && <span className="ml-auto text-sm text-purple-300">{tx('foil')} {euro(foilPrice)}</span>}
                  </div>
                  {normalInfo.estimated && <p className="text-[13px] text-state-warn">{ESTIMATE_LABEL[normalInfo.estimated]} {tx(': pas de prix non foil sur Cardmarket.')}</p>}
                  {foilPrice == null && price != null && ownsFoil && (
                    <p className="text-[13px] text-state-warn">{tx('Pas de prix foil sur Cardmarket : vos foils sont estimés d’après la version non foil (≈), et leur courbe est celle de la version non foil.')}</p>
                  )}
                  {promoInfo?.value != null && (
                    <p className="text-[13px] text-rift-300">{tx('Promo :')} <PriceText value={promoInfo.value} estimated={promoInfo.estimated} className="font-semibold text-gold-400" />
                      {promoInfo.estimated && <span className="text-rift-400"> · {ESTIMATE_LABEL[promoInfo.estimated]}</span>}</p>
                  )}
                  {priceVolatile(prices, cardId) && (
                    <p className="text-xs text-state-warn">{tx('⚠ Prix instable : la tendance (')}{euro(prices.cards[cardId][0])}{tx(') s’écarte de plus de 30 % de la moyenne des ventes sur 7 jours (')}{euro(prices.cards[cardId][3])}{tx('). Carte peu échangée.')}</p>
                  )}
                  <PriceHistory prices={prices} cardId={cardId} />
                  <a href={cardmarketUrl(cardData)} target="_blank" rel="noreferrer" className="btn-secondary text-sm w-full">
                    <ExternalLink className="w-4 h-4" /> {tx('Voir sur Cardmarket')}
                  </a>
                </>
              )
            )}

            {tab === 'mine' && (
              <>
                <div className="panel p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-rift-100">
                    {ownedTotal} {tx('exemplaire')}{ownedTotal > 1 ? 's' : ''}{ownedValue ? <span className="font-normal text-gold-400"> · {euro(ownedValue)}</span> : null}
                  </p>
                  {owned.length === 0 && <p className="text-[13px] text-rift-400">{tx('Vous n’avez pas encore cette carte.')}</p>}
                  {owned.map(s => (
                    <div key={s.key} className="text-[13px] text-rift-300 flex items-center gap-1.5 min-h-[36px]">
                      <span className="mr-auto flex items-center gap-1.5">
                        {s.quantity} × {LANGUAGES.find(l => l.value === s.language)?.short || s.language}
                        {' · '}{conditionShort(s.condition)}
                        {s.foil && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                      </span>
                      {onUpdateCard ? (
                        <button onClick={() => onUpdateCard(s, { ...s, promo: !s.promo })} aria-pressed={!!s.promo}
                          title={s.promo ? tx('Ce ne sont pas des promos') : tx('Marquer comme promo')}
                          className={`h-8 px-2 text-[11px] font-bold uppercase tracking-wider border ${s.promo ? 'text-[#d7a8ff] bg-[#d7a8ff]/15 border-[#d7a8ff]/50' : 'text-rift-500 border-rift-600'}`}>
                          {tx('Promo')}
                        </button>
                      ) : s.promo && <span className="text-[#d7a8ff]">{tx('Promo')}</span>}
                      {onRemoveCopy && (
                        <button onClick={() => onRemoveCopy(s)} aria-label={s.quantity === 1 ? tx('Supprimer cet exemplaire') : tx('Un exemplaire de moins')}
                          className={`w-8 h-8 flex items-center justify-center border ${s.quantity === 1 ? 'border-state-bad/60 text-state-bad' : 'border-rift-600 text-rift-100'}`}>
                          {s.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  ))}
                  {onRemoveCopy && (
                    <button onClick={() => onAddCopy(cardId, language, { promo: true })} className="btn-ghost text-[13px] py-1.5 px-2 -ml-2">
                      <Plus className="w-4 h-4" /> {tx('Ajouter une promo')} {langShort}
                    </button>
                  )}
                </div>
                <div className="panel p-3 flex items-center gap-2">
                  <Heart className={`w-4 h-4 ${wanted > 0 ? 'text-[#ff8ab8] fill-[#ff8ab8]' : 'text-rift-400'}`} />
                  <span className="text-sm text-rift-200 mr-auto">{tx('Liste de souhaits')}</span>
                  {wanted > 0 ? (
                    <div className="flex items-center">
                      <button onClick={() => onSetWanted(cardId, wanted - 1)} aria-label={tx('Un de moins')} className="w-9 h-9 bg-rift-900 border border-rift-600 flex items-center justify-center text-rift-200"><Minus className="w-4 h-4" /></button>
                      <span className="w-8 text-center font-display font-bold text-rift-100">{wanted}</span>
                      <button onClick={() => onSetWanted(cardId, wanted + 1)} aria-label={tx('Un de plus')} className="w-9 h-9 bg-rift-900 border border-rift-600 flex items-center justify-center text-rift-200"><Plus className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => onSetWanted(cardId, 1)} className="btn-ghost text-sm">{tx('Ajouter')}</button>
                  )}
                </div>
              </>
            )}
          </section>
          </div>
        </div>
      </div>

      {/* Actions, always visible */}
      <div className="flex-shrink-0 border-t border-gold-500/30 bg-rift-900" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-xl mx-auto px-5 py-3 flex gap-2 lg:max-w-none lg:px-6 lg:justify-end">
          {deckControls ? (
            // Opened from a deck: change the number of copies IN THE DECK (not the collection)
            <div className="flex-1 lg:flex-none flex items-center gap-3 min-h-[50px] px-3 bg-rift-800 border border-gold-500/50">
              <span className="text-sm text-rift-300 mr-auto lg:mr-2">{deckControls.label || tx('Dans le deck')}</span>
              <button onClick={deckControls.onMinus} disabled={!deckControls.count} aria-label={deckControls.count === 1 ? tx('Retirer la carte du deck') : tx('Un exemplaire de moins dans le deck')}
                className={`w-11 h-11 flex items-center justify-center border disabled:opacity-30 ${deckControls.count === 1 ? 'border-state-bad/60 text-state-bad' : 'border-rift-600 text-rift-100'}`}>
                {deckControls.count === 1 ? <Trash2 className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
              </button>
              <span className="w-8 text-center font-display text-xl font-bold text-gold-400">{deckControls.count}</span>
              <button onClick={deckControls.onPlus} aria-label={tx('Un exemplaire de plus dans le deck')}
                className="w-11 h-11 flex items-center justify-center bg-gold-500 text-rift-900"><Plus className="w-5 h-5" /></button>
            </div>
          ) : onRemoveCopy ? (
            // Opened from the collection: how many copies (in this language), one less, one more
            <div data-help="card.count" className="flex-1 lg:flex-none flex items-center gap-3 min-h-[50px] px-3 bg-rift-800 border border-gold-500/50">
              <span className="text-sm text-rift-300 mr-auto lg:mr-2">
                {tx('Dans ma collection')} · {langShort}
                {ownedTotal > langCount && <span className="block text-[12px] text-rift-500">{tx('{ownedTotal} en tout', { ownedTotal })}</span>}
              </span>
              <button onClick={removeOne} disabled={!langCount} aria-label={langCount === 1 ? tx('Supprimer cet exemplaire') : tx('Un exemplaire de moins')}
                className={`w-11 h-11 flex items-center justify-center border disabled:opacity-30 ${langCount === 1 ? 'border-state-bad/60 text-state-bad' : 'border-rift-600 text-rift-100'}`}>
                {langCount === 1 ? <Trash2 className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
              </button>
              <span className="w-8 text-center font-display text-xl font-bold text-gold-400">{langCount}</span>
              <button onClick={() => onAddCopy(cardId, language)} aria-label={tx('Ajouter un exemplaire')}
                className="w-11 h-11 flex items-center justify-center bg-gold-500 text-rift-900"><Plus className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={() => onAddCopy(cardId, language)} className="btn-primary flex-1 lg:flex-none lg:px-10 text-[15px] min-h-[50px]">
              <Plus className="w-5 h-5" /> {tx('Ajouter un exemplaire')} {language === 'French' ? tx('FR') : tx('EN')}
            </button>
          )}
          <button
            onClick={() => onSetWanted(cardId, wanted > 0 ? 0 : 1)}
            aria-pressed={wanted > 0}
            aria-label={wanted > 0 ? tx('Retirer des souhaits') : tx('Ajouter aux souhaits')}
            data-help="card.wish"
            className="w-[50px] h-[50px] flex items-center justify-center bg-rift-800 border border-gold-500/50"
          >
            <Heart className={`w-5 h-5 ${wanted > 0 ? 'text-[#ff8ab8] fill-[#ff8ab8]' : 'text-gold-400'}`} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

/** « Mon achat » (Prix tab): the price paid for one copy and the purchase date, for every copy of the card. */
function PurchaseEditor({ owned, paid, paidAt, onSave }) {
  const fmt = (v) => (v ? String(Math.round(v * 100) / 100).replace('.', ',') : '');
  const [price, setPrice] = useState(fmt(paid));
  const [date, setDate] = useState(paidAt || '');
  const n = owned.reduce((k, s) => k + s.quantity, 0);
  const save = () => {
    const v = parseFloat(price.replace(',', '.'));
    onSave(Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
  };
  return (
    <div className="panel p-3 space-y-2">
      <p className="text-sm font-semibold text-rift-100">{tx('Mon achat')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-rift-400">
          {tx('Prix payé (un exemplaire)')}
          <span className="inline-flex items-center gap-1 h-11 px-2 bg-rift-900 border border-rift-600 focus-within:border-gold-500/60">
            <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="—"
              className="w-20 bg-transparent text-right text-[15px] text-rift-100 focus:outline-none" />
            <span className="text-rift-500">€</span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-rift-400">
          {tx('Date d’achat')}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-11 px-2 bg-rift-900 border border-rift-600 text-[15px] text-rift-100 focus:outline-none focus:border-gold-500/60 [color-scheme:dark]" />
        </label>
        <button type="button" onClick={save} className="btn-primary min-h-[44px] text-sm">{tx('Enregistrer')}</button>
      </div>
      <p className="text-[12px] text-rift-500">{n > 1 ? tx('Pour vos {n} exemplaires de cette carte.', { n }) : tx('Pour votre exemplaire de cette carte.')}</p>
    </div>
  );
}
