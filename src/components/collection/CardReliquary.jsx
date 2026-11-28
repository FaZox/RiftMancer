import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Heart, Plus, Minus, Trash2, Swords } from 'lucide-react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { usePrices, unitPrice, euro, priceRef } from '../../lib/prices.js';
import EnergyBadge from '../common/EnergyBadge.jsx';
import useTilt from '../common/useTilt.js';
import ErrataNote from '../common/ErrataNote.jsx';
import ReliquaryRulings from './ReliquaryRulings.jsx';
import ReliquaryPrice from './ReliquaryPrice.jsx';
import AddCopiesPanel from './AddCopiesPanel.jsx';
import { PurchaseEditor } from './PurchaseEditor.jsx';
import Sheet from '../common/Sheet.jsx';
import { usePcInterface } from '../../lib/pcInterface.js';
import { deckWithCards } from '../../lib/cardsBrowser.js';
import { fullImageSrc, downloadedImageSrc, thumbSrc, isNative, handleImageError } from '../../lib/nativeAssets.js';
import { getLocalizedText, rulesTextHtml, displayLanguage, displayName } from '../../lib/cardLocale.js';
import { MASK_ICON, rarityIcon, symbolsReady, domainIcon, typeIcon } from '../../lib/symbols.js';
import { rulingsFor } from '../../lib/rulings.js';
import { printsOf, printKindLabel } from '../../lib/prints.js';
import { useHelpPage } from '../../lib/help.js';
import { useBackHandler } from '../../lib/backButton.js';
import { motionOk } from '../../lib/motion.js';
import { DOMAIN_COLORS, LANGUAGES, domainLabel, rarityLabel, typeLabel } from '../../data/sampleCards.js';
import { conditionShort } from '../../lib/conditions.js';
import { flyIn, popHexes, portalOut, portalIn, flipHexes, slideDossier, pivot, flyCopies } from './reliquaryFx.js';
import { tx } from '../../lib/i18n.js';

const maskStyle = (src) => ({ backgroundColor: 'currentColor', WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` });
const preload = (src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(true); i.onerror = () => resolve(false); i.src = src; });
const hdSources = (id) => [...new Set([fullImageSrc(id), downloadedImageSrc(id)].filter(Boolean))].filter(s => !s.includes('/thumbs/'));

/** Hexagon next to the card (70 × 80, gold edge, night fill). */
const Hex = React.forwardRef(function Hex({ label, aria, className = '', style, children }, ref) {
  return (
    <div ref={ref} role="img" aria-label={aria} title={aria} className={`absolute ${className}`} style={{ width: 70, height: 80, ...style }}>
      <span className="hexagon absolute inset-0 bg-gold-500/80" aria-hidden="true" />
      <span className="hexagon absolute inset-[2px] bg-[#0a1220]" aria-hidden="true" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-px text-center leading-none">{children}<small className="uppercase text-gold-400" style={{ fontSize: 8.5, letterSpacing: '.06em' }}>{label}</small></span>
    </div>
  );
});

/**
 * « Reliquaire » (PC card sheet): the card on a lit altar with four hexagons around it, the neighbouring
 * cards floating behind it, and the full file in tabs. Same props as CardZoom (+ list / index / forge /
 * onAddCopies / org). Navigation with the « Portail » effect. Android keeps CardZoom.
 */
export default function CardReliquary({
  cardId: openedId, language: initialLanguage, stacks, wanted, byCard, onSetWanted, onAddCopy, onAddCopies = null,
  onRemoveCopy = null, onUpdateCard = null, onClose, onPrev = null, onNext = null, position = null, deckControls = null,
  list = null, forge = false, org = null, defaultLanguage = 'English',
}) {
  const mobile = !usePcInterface;
  useHelpPage('card');
  const [cardId, setCardId] = useState(openedId);
  useEffect(() => { setCardId(openedId); }, [openedId]);
  const cardData = getMatcher().getCardData(cardId);
  const [language, setLanguage] = useState(displayLanguage(initialLanguage) === 'English' ? 'English' : 'French');
  const [tab, setTab] = useState('infos');
  const [forgeOpen, setForgeOpen] = useState(!!forge && !!onAddCopies);
  const [dosFull, setDosFull] = useState(false); // mobile: dossier sheet expanded
  const [deckFor, setDeckFor] = useState(false); // mobile: « + Deck » sheet
  useBackHandler(true, () => {
    // Phone: back closes the add sheet first, then folds the dossier, then the zoom.
    if (mobile) {
      if (forgeOpen) { setForgeOpen(false); return true; }
      if (deckFor) { setDeckFor(false); return true; }
      if (dosFull) { setDosFull(false); return true; }
    }
    onClose();
    return true;
  });
  const [bump, setBump] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const { prices } = usePrices();
  const [imgSrc, setImgSrc] = useState(thumbSrc(openedId));
  const currentWanted = byCard ? (byCard.get(cardId)?.quantity || 0) : wanted;

  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const ringRef = useRef(null);
  const dossierRef = useRef(null);
  const badgeRef = useRef(null);
  const hexRefs = useRef([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const preloaded = useRef({ id: null, src: null });
  const pendingEnter = useRef(null); // { dir } while the new card must spring out of the portal
  const tilt = useTilt(8);
  const drag = useRef(null);
  const stageRef = useRef(null);
  const grabRef = useRef(null);
  const grabMoved = useRef(0);

  // ─── Neighbours (carousel) ─────────────────────────────────────────────────
  const idx = list ? list.indexOf(cardId) : -1;
  const hasList = idx >= 0;
  const neighbour = (off) => (hasList ? list[idx + off] : null);

  // ─── Image: thumbnail at once, HD as soon as loaded ────────────────────────
  const [noHd, setNoHd] = useState(false);
  useEffect(() => {
    setTab(t => (t === 'mine' && forgeOpen ? t : 'infos'));
    setNoHd(false);
    if (preloaded.current.id === cardId && preloaded.current.src) { setImgSrc(preloaded.current.src); return undefined; }
    setImgSrc(thumbSrc(cardId));
    const sources = hdSources(cardId);
    if (!sources.length) { setNoHd(isNative); return undefined; }
    const full = new Image(); let i = 0;
    full.onload = () => setImgSrc(sources[i]);
    full.onerror = () => { if (++i < sources.length) full.src = sources[i]; else setNoHd(isNative); };
    full.src = sources[0];
    return () => { full.onload = null; full.onerror = null; };
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Open: flight from the thumbnail, hexagons pop ─────────────────────────
  useLayoutEffect(() => {
    mounted.current = true;
    const src = document.querySelector(`[data-cardid="${CSS.escape(String(openedId))}"] img`) || document.querySelector(`[data-cardid="${CSS.escape(String(openedId))}"]`);
    const from = src?.getBoundingClientRect();
    flyIn(cardRef.current, from);
    popHexes(hexRefs.current);
    const opener = document.activeElement;
    rootRef.current?.focus();
    return () => { mounted.current = false; if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Portal in (after the new card is rendered) ────────────────────────────
  useLayoutEffect(() => {
    const p = pendingEnter.current;
    if (!p) return;
    pendingEnter.current = null;
    Promise.all([portalIn(cardRef.current, p.dir), flipHexes(hexRefs.current, 'in'), slideDossier(dossierRef.current, 'in', p.dir)])
      .finally(() => { if (mounted.current) { dossierRef.current?.getAnimations().forEach(a => a.cancel()); busy.current = false; } });
  }, [cardId]);

  const go = useCallback(async (toId, dir) => {
    if (!toId || toId === cardId || busy.current) return;
    busy.current = true;
    const sources = hdSources(toId);
    let src = null;
    for (const s of sources) { if (await preload(s)) { src = s; break; } } // the next HD image BEFORE the effect (no empty flash)
    if (!mounted.current) return;
    preloaded.current = { id: toId, src };
    if (motionOk()) {
      cardRef.current?.classList.add('anim');
      await Promise.all([portalOut(cardRef.current, ringRef.current, dir), flipHexes(hexRefs.current, 'out'), slideDossier(dossierRef.current, 'out', dir)]);
      if (!mounted.current) return;
      pendingEnter.current = { dir };
    }
    setForgeOpen(false);
    setCardId(toId);
    if (!motionOk()) busy.current = false;
    requestAnimationFrame(() => cardRef.current?.classList.remove('anim'));
  }, [cardId]);

  const goRel = useCallback((d) => {
    if (hasList) { const t = list[idx + d]; if (t) go(t, d); return; }
    if (d < 0) onPrev?.(); else onNext?.();
  }, [hasList, list, idx, go, onPrev, onNext]);

  // other printing picked in the « Impressions » tab: the card pivots
  const pickPrint = useCallback((id) => {
    if (id === cardId || busy.current) return;
    busy.current = true;
    const sources = hdSources(id);
    (async () => {
      let src = null;
      for (const s of sources) { if (await preload(s)) { src = s; break; } }
      preloaded.current = { id, src };
      await pivot(cardRef.current, () => { setCardId(id); });
      busy.current = false;
    })();
  }, [cardId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select')) { if (e.key === 'Escape') onClose(); return; }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goRel(-1);
      else if (e.key === 'ArrowRight') goRel(1);
      else if (e.key === 'Tab' && rootRef.current) { // keep the focus inside the dialog
        const f = [...rootRef.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goRel]);

  // ─── Data ──────────────────────────────────────────────────────────────────
  const owned = useMemo(() => stacks.filter(s => s.cardData.id === cardId), [stacks, cardId]);
  if (!cardData) return null;
  const name = displayName(cardData, language);
  const text = getLocalizedText(cardData, language);
  const ownedTotal = owned.reduce((n, s) => n + s.quantity, 0);
  const domains = (cardData.domains?.length ? cardData.domains : (cardData.domain ? [cardData.domain] : [])).filter(Boolean);
  const colors = (domains.length ? domains : ['colorless']).map(d => (DOMAIN_COLORS[d] || DOMAIN_COLORS.colorless).hex);
  const isLandscape = cardData.type === 'battlefield';
  const ownedValue = prices ? owned.reduce((v, s) => v + (unitPrice(prices, cardId, s.foil, priceRef(), s.promo) || 0) * s.quantity, 0) : null;
  const paidStacks = owned.filter(s => s.paid > 0);
  const paidCount = paidStacks.reduce((n, s) => n + s.quantity, 0);
  const paidAvg = paidCount ? paidStacks.reduce((v, s) => v + s.paid * s.quantity, 0) / paidCount : null;
  const paidDate = owned.map(s => s.paidAt).filter(Boolean).sort().at(-1) || null;
  const m = getMatcher();
  const prints = printsOf(cardData, m.cards || []);
  const rulings = rulingsFor(cardData, m.rulings, m.cards || []);
  const rulingsN = rulings?.rulings?.length || 0;
  const mainDomain = domains[0] || 'colorless';
  const dc = colors[0];

  const submitForge = (o) => {
    const rect = cardRef.current?.getBoundingClientRect();
    const added = onAddCopies({ cardId, ...o });
    setForgeOpen(false);
    setTab('mine');
    if (!added?.length) return;
    requestAnimationFrame(() => {
      const to = badgeRef.current?.getBoundingClientRect();
      flyCopies(thumbSrc(cardId), added.length, rect, to).then(() => {
        if (!mounted.current) return;
        setBump(true); setTimeout(() => mounted.current && setBump(false), 600);
      });
    });
  };

  const TABS = [
    { id: 'infos', label: tx('Infos') },
    { id: 'mine', label: tx('Ma collection'), n: ownedTotal },
    { id: 'price', label: tx('Prix') },
    { id: 'prints', label: tx('Impressions'), n: prints.length > 1 ? prints.length : 0 },
    { id: 'rulings', label: tx('Rulings'), n: rulingsN },
  ];
  const setHex = (i) => (el) => { hexRefs.current[i] = el; };
  const mightIcon = symbolsReady();
  const nav = (off) => {
    const id = neighbour(off);
    if (!id) return null;
    const a = Math.abs(off);
    return (
      <button key={off} type="button" tabIndex={-1} onClick={() => go(id, off > 0 ? 1 : -1)} aria-label={off > 0 ? tx('Carte suivante') : tx('Carte précédente')}
        className="absolute top-1/2 left-1/2 w-[260px] -ml-[130px] -mt-[182px] -z-10 transition-[transform,opacity,filter] duration-[550ms]"
        style={{ transform: `translateX(${off * 235}px) translateZ(${-260 * a}px) rotateY(${-off * 32}deg)`, opacity: a === 1 ? 0.55 : 0.22, filter: `brightness(.6)${a > 1 ? ' blur(1.5px)' : ''}` }}>
        <img src={thumbSrc(id)} alt="" onError={e => handleImageError(e, id)} className="block w-full h-auto" draggable={false} />
      </button>
    );
  };

  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y) * 1.5) goRel(dx < 0 ? 1 : -1);
  };

  const onGrabDown = (e) => { grabRef.current = { y: e.clientY, moved: false }; };
  const onGrabMove = (e) => { const g = grabRef.current; if (g && Math.abs(e.clientY - g.y) > 10) { g.moved = true; grabMoved.current = Date.now(); } };
  const onGrabUp = (e) => {
    const g = grabRef.current; grabRef.current = null;
    if (!g || !g.moved) return;
    const dy = e.clientY - g.y;
    if (dy < -40) setDosFull(true);
    else if (dy > 40) setDosFull(false);
  };
  const onGrabClick = () => { if (Date.now() - grabMoved.current > 250) setDosFull(v => !v); };

  const rarityLbl = rarityLabel(cardData.rarity);
  const ztab = (t) => (
    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
      className={`relative px-3.5 pt-2.5 pb-[11px] font-bold text-[13px] tracking-[.02em] flex items-center gap-[7px] ${tab === t.id ? 'text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>
      {t.label}
      {t.n ? <i ref={t.id === 'mine' ? badgeRef : undefined} className={`hexagon not-italic min-w-[18px] h-5 px-[3px] bg-gold-500/20 text-gold-400 text-[11px] grid place-items-center ${t.id === 'mine' && bump ? 'rf-bump' : ''}`}>{t.n}</i> : null}
      <span className={`absolute left-2.5 right-2.5 -bottom-px h-0.5 bg-gold-400 transition-transform duration-200 ${tab === t.id ? 'scale-x-100' : 'scale-x-0'}`} />
    </button>
  );
  const zbtn = 'h-[38px] px-4 border border-rift-600 text-rift-300 font-bold text-[12.5px] hex-cut-sm hover:border-gold-500/60';
  const zbtnP = 'h-[38px] px-4 bg-gold-500 text-rift-900 font-bold text-[12.5px] hex-cut-sm hover:brightness-110 inline-flex items-center gap-1.5';
  const Fact = ({ k, children }) => (
    <div className="border border-rift-600 bg-[#0a1220aa] px-3 py-2.5">
      <small className="block text-[11px] tracking-[.14em] uppercase text-rift-500 mb-1">{k}</small>
      <b className="text-[14px] text-rift-100 flex items-center gap-1.5">{children}</b>
    </div>
  );
  const idSpan = 'h-[30px] inline-flex items-center gap-[7px] px-[11px] border border-rift-600 bg-[#0a1220aa] text-[12.5px] font-semibold text-rift-300';

  const tabPanels = (
    <>
{tab === 'infos' && (
  <>
    <div className="relative border border-gold-500/25 px-5 py-[18px] text-[15px] leading-[1.7] text-rift-100" style={{ background: 'linear-gradient(180deg,#111c2ef0,#0d1626f0)' }}>
      <span className="absolute -left-px -top-px w-[18px] h-[18px] border-l-2 border-t-2 border-gold-400" aria-hidden="true" />
      <span className="absolute -right-px -bottom-px w-[18px] h-[18px] border-r-2 border-b-2 border-gold-400" aria-hidden="true" />
      {text ? (
        <ErrataNote cardData={cardData} text={text} language={language}>
          <div dangerouslySetInnerHTML={{ __html: rulesTextHtml(text, { gold: true }) }} />
        </ErrataNote>
      ) : <i className="text-rift-500">{tx('Cette carte n’a pas de texte de règles.')}</i>}
    </div>
    <div className="flex justify-between items-center mt-2 mb-[18px] text-[11.5px] text-rift-500">
      <span>{!text ? '' : text.unofficial ? tx('Traduction française non officielle · terminologie officielle Riftbound') : !text.translated ? tx('Traduction indisponible — texte anglais') : language === 'French' ? tx('Texte officiel (français)') : tx('Texte officiel (anglais)')}</span>
      <div className="flex border border-rift-600" role="group" aria-label={tx('Langue')} data-help="card.lang">
        {['French', 'English'].map(l => (
          <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={language === l}
            className={`px-2.5 py-[3px] text-[11.5px] font-bold ${language === l ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400'}`}>{l === 'French' ? tx('FR') : tx('EN')}</button>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2.5 mb-4">
      <Fact k={tx('Type')}>{typeIcon(cardData.type) && <span className="block w-4 h-4" style={maskStyle(typeIcon(cardData.type))} aria-hidden="true" />}{typeLabel(cardData.type)}</Fact>
      <Fact k={tx('Domaine')}>{domains.length ? domains.map(d => <span key={d} className="inline-flex items-center gap-1.5">{domainIcon(d) && <img src={domainIcon(d)} alt="" className="w-4 h-4" />}{domainLabel(d)}</span>) : '—'}</Fact>
      <Fact k={tx('Rareté')}>{rarityIcon(cardData.rarity) && <img src={rarityIcon(cardData.rarity)} alt="" className="w-4 h-4 object-contain" />}{rarityLbl}</Fact>
      <Fact k={tx('Extension')}>{cardData.setName}</Fact>
      <Fact k={tx('Numéro')}>{cardData.code || cardData.collectorNumber}</Fact>
      <Fact k={tx('Illustration')}><span className="text-[12.5px]">{cardData.illustrator || '—'}</span></Fact>
    </div>
    {cardData.power > 0 && (
      <p className="flex items-center gap-2 text-[13px] text-rift-300 mb-3" title={tx('Coût de recyclage : {n} rune(s) {domain}', { n: cardData.power, domain: domainLabel(mainDomain) })}>
        {tx('Coût de recyclage :')}
        <span className="flex">{Array.from({ length: cardData.power }, (_, i) => (domainIcon(mainDomain) ? <img key={i} src={domainIcon(mainDomain)} alt="" className="w-6 h-6" /> : <span key={i} className="w-5 h-5 rounded-full" style={{ background: dc }} />))}</span>
        {tx('{n} rune(s)', { n: cardData.power })}
      </p>
    )}
    {cardData.tags?.length > 0 && (
      <div className="flex gap-1.5 flex-wrap">{cardData.tags.map(t => <span key={t} className="text-[12px] border border-rift-600 px-[9px] py-0.5 text-rift-400">{t}</span>)}</div>
    )}
  </>
)}

{tab === 'mine' && (ownedTotal > 0 ? (
  <>
    <div className="flex items-center gap-4 mb-3.5">
      <div className="hexagon w-[72px] h-[82px] grid place-items-center font-display text-[30px] font-bold text-rift-900" style={{ background: 'linear-gradient(160deg,#e8c973,#a8893a)' }}>{ownedTotal}</div>
      <p className="text-[13px] text-rift-400"><b className="block text-[16px] text-rift-100">{tx('{n} exemplaire(s) dans ta collection', { n: ownedTotal })}</b>
        {tx('{n} version(s)', { n: owned.length })}{ownedValue > 0 && <> · {tx('valeur ≈')} {euro(ownedValue)}</>}</p>
    </div>
    {owned.map(s => {
      const lg = LANGUAGES.find(l => l.value === s.language);
      const place = s.boxId ? tx('Boîte : {name}', { name: org?.boxes?.byId?.get(s.boxId)?.name || '…' }) : s.deckId ? tx('Deck : {name}', { name: org?.decks?.byId?.get(s.deckId)?.name || '…' }) : s.loanId ? tx('Prêtée') : tx('Sans emplacement');
      return (
        <div key={s.key} className="grid grid-cols-[auto_1fr_auto_auto] gap-3.5 items-center px-3 py-2.5 border border-rift-600 bg-[#0a1220aa] mb-1.5">
          <div className="hexagon w-9 h-10 grid place-items-center font-bold text-[12px] text-rift-100 bg-rift-700" style={s.foil ? { background: 'linear-gradient(135deg,#ff5fa2,#ffd86b,#6bffb8,#6bc7ff,#b06bff)', color: '#0a1220' } : undefined}>{s.foil ? '★' : lg?.short || s.language}</div>
          <div>
            <b className="text-rift-100 text-[13.5px]">{lg?.label || s.language}{s.foil ? ' · Foil' : ''} · {conditionShort(s.condition)}{s.promo ? ` · ${tx('Promo')}` : ''}</b>
            <small className="block text-rift-500 text-[12px]">📦 {place}</small>
          </div>
          <div className="text-rift-400 text-[12px] text-right">{s.paid > 0 ? `${tx('Payé')} ${euro(s.paid)}` : <span className="opacity-60">{tx('prix payé ?')}</span>}</div>
          <div className="flex items-center gap-1">
            {onRemoveCopy && <button type="button" onClick={() => onRemoveCopy(s)} aria-label={s.quantity === 1 ? tx('Supprimer cet exemplaire') : tx('Un exemplaire de moins')} className={`w-7 h-[30px] border border-rift-600 font-bold ${s.quantity === 1 ? 'text-state-bad' : 'text-gold-400'}`}>{s.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 mx-auto" /> : '−'}</button>}
            <span className="min-w-[26px] text-center font-bold text-gold-400">{s.quantity}</span>
            {onRemoveCopy && <button type="button" onClick={() => (onAddCopies ? onAddCopies({ cardId, quantity: 1, language: s.language, foil: s.foil, condition: s.condition, boxId: s.boxId, deckId: s.deckId }) : onAddCopy(cardId, s.language || language))} aria-label={tx('Ajouter un exemplaire')} className="w-7 h-[30px] border border-rift-600 text-gold-400 font-bold">+</button>}
          </div>
        </div>
      );
    })}
    <div className="flex gap-2 mt-3 flex-wrap">
      <button type="button" className={zbtnP} onClick={() => (onAddCopies ? setForgeOpen(true) : onAddCopy(cardId, language))}>+ {tx('Ajouter un exemplaire')}</button>
      {onUpdateCard && <button type="button" className={zbtn} onClick={() => { const s = owned[0]; onUpdateCard(s, { ...s, promo: !s.promo }); }}>{owned[0]?.promo ? tx('Ce ne sont pas des promos') : tx('Marquer comme promo')}</button>}
      {onUpdateCard && <button type="button" className={zbtn} onClick={() => { setTab('price'); setShowPaid(true); }}>{tx('Modifier mon prix payé')}</button>}
    </div>
  </>
) : (
  <div className="text-rift-500 py-[30px] text-center">{tx('Tu n’as pas encore cette carte.')}
    <div className="flex gap-2 mt-3 justify-center flex-wrap">
      <button type="button" className={zbtnP} onClick={() => (onAddCopies ? setForgeOpen(true) : onAddCopy(cardId, language))}>+ {tx('Ajouter un exemplaire')}</button>
      <button type="button" className={zbtn} onClick={() => onSetWanted(cardId, currentWanted > 0 ? currentWanted : 1)}>♥ {tx('Ajouter aux souhaits')}</button>
    </div>
  </div>
))}

{tab === 'price' && (
  <>
    {showPaid && owned.length > 0 && onUpdateCard && (
      <div className="mb-4"><PurchaseEditor key={cardId} owned={owned} paid={paidAvg} paidAt={paidDate} onSave={(paid, paidAt) => { owned.forEach(s => onUpdateCard(s, { ...s, paid, paidAt })); setShowPaid(false); }} /></div>
    )}
    <ReliquaryPrice prices={prices} cardId={cardId} cardData={cardData} paidAvg={paidAvg} hasOwned={owned.length > 0 && !!onUpdateCard} onEditPaid={() => setShowPaid(s => !s)} />
  </>
)}

{tab === 'prints' && (
  <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }} data-help="card.prints">
    {(prints.length ? prints : [cardData]).map(p => {
      const n = stacks.filter(s => s.cardData.id === p.id).reduce((a, s) => a + s.quantity, 0);
      const cur = p.id === cardId;
      return (
        <button key={p.id} type="button" onClick={() => pickPrint(p.id)} aria-current={cur || undefined} className="text-center text-[11.5px] text-rift-400">
          <span className={`block mb-1.5 rounded-md ${cur ? 'ring-2 ring-gold-400' : ''} ${p.rarity === 'showcase' || p.rarity === 'epic' ? 'rf-holo rf-holo-on relative' : ''}`}>
            <img src={thumbSrc(p.id)} onError={e => handleImageError(e, p.id)} alt="" loading="lazy" className="w-full h-auto rounded-md" />
          </span>
          <b className="flex justify-center items-center gap-[5px] text-rift-100 text-[12px]">{rarityIcon(p.rarity) && <img src={rarityIcon(p.rarity)} alt="" className="w-3.5 h-3.5 object-contain" />}{p.setName || p.set}</b>
          {String(p.code || '').split('/')[0]} · {n ? <span className="text-state-ok">{tx('possédée')}</span> : tx('manquante')}
          {printKindLabel(p) && <span className="block text-rift-500">{printKindLabel(p)}</span>}
        </button>
      );
    })}
  </div>
)}

{tab === 'rulings' && <ReliquaryRulings cardData={cardData} />}
    </>
  );

  // ── Phone: full-screen « Reliquaire » (mobile maquette, screen 6): top bar with
  // ✕ / set · number / ♥, the card between its two neighbours, the 4 hexagons at the
  // edge of the stage, « ＋ Ma collection » + « + Deck », and the file as a bottom sheet.
  if (mobile) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const androidMajor = /Android (\d+)/.exec(ua)?.[1];
    // Rays off on old Android (< 10) or small machines (<= 4 cores)
    const lowEnd = isNative && ((androidMajor != null && Number(androidMajor) < 10) || ((navigator.hardwareConcurrency || 8) <= 4));
    const raysOn = !lowEnd;
    const ztabM = (t) => (
      <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'on' : ''}>
        {t.label}
        {t.n ? <i ref={t.id === 'mine' ? badgeRef : undefined} className={t.id === 'mine' && bump ? 'rf-bump' : ''}>{t.n}</i> : null}
      </button>
    );
    return (
      <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={name}
        className={`zm ${forgeOpen ? 'forge' : ''}`} style={{ '--dc': dc }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {raysOn && <div className="rays" aria-hidden="true" />}
        <div className="ztop">
          <button type="button" className="x" onClick={onClose} aria-label={tx('Fermer')}>✕</button>
          <div className="eb">
            {rarityIcon(cardData.rarity) && <img src={rarityIcon(cardData.rarity)} alt="" />}
            <span className="truncate">{cardData.setName} · {cardData.code?.split('/')[0] || cardData.collectorNumber}</span>
          </div>
          <button type="button" className={`hrt ${currentWanted > 0 ? 'on' : ''}`} onClick={() => onSetWanted(cardId, currentWanted > 0 ? 0 : 1)}
            aria-pressed={currentWanted > 0} aria-label={currentWanted > 0 ? tx('Retirer des souhaits') : tx('Ajouter aux souhaits')} data-help="card.wish">♥</button>
        </div>

        <div ref={stageRef} className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {[-1, 1].map(off => {
            const id = neighbour(off);
            if (!id) return null;
            return (
              <button key={off} type="button" tabIndex={-1} className={`ghost ${off < 0 ? 'l' : 'r'}`} onClick={() => go(id, off)}
                aria-label={off > 0 ? tx('Carte suivante') : tx('Carte précédente')}>
                <img src={thumbSrc(id)} alt="" onError={(e) => handleImageError(e, id)} draggable={false} />
              </button>
            );
          })}
          <div className="cardwrap">
            <div ref={cardRef} {...tilt} className="card rf-holo rf-holo-on select-none">
            {isLandscape ? (
              <span className="mcard block w-full overflow-hidden" style={{ aspectRatio: '7 / 5' }} role="img" aria-label={name}>
                <img src={imgSrc} alt="" draggable={false} onError={(e) => { if (imgSrc !== thumbSrc(cardId)) setImgSrc(thumbSrc(cardId)); else handleImageError(e, cardId); }}
                  className="absolute top-1/2 left-1/2 max-w-none object-cover" style={{ width: '71.43%', height: '140%', transform: 'translate(-50%, -50%) rotate(90deg)' }} />
              </span>
            ) : (
              <span className="mcard block w-full"><img src={imgSrc} alt={name} draggable={false}
                onError={(e) => { if (imgSrc !== thumbSrc(cardId)) setImgSrc(thumbSrc(cardId)); else handleImageError(e, cardId); }}
                className="block w-full h-auto" /></span>
            )}
          </div>
          <Hex ref={setHex(0)} className="sat s1" style={{ width: 54, height: 62 }} label={tx('Énergie')} aria={cardData.energy != null ? tx('Énergie {n}', { n: cardData.energy }) : tx('Énergie : aucune')}>
            {cardData.energy != null ? <span className="men">{cardData.energy}</span> : <span className="text-rift-500 text-lg">—</span>}
          </Hex>
          <Hex ref={setHex(1)} className="sat s2" style={{ width: 54, height: 62 }} label={tx('Puiss.')} aria={cardData.might != null ? tx('Puissance {n}', { n: cardData.might }) : tx('Puissance : aucune')}>
            {cardData.might != null ? (
              <b>{mightIcon ? <span className="mmask" style={maskStyle(MASK_ICON.might)} aria-hidden="true" /> : '⚔'} {cardData.might}</b>
            ) : <span className="text-rift-500 text-lg">—</span>}
          </Hex>
          <Hex ref={setHex(2)} className="sat s3" style={{ width: 54, height: 62 }} label={rarityLbl} aria={`${tx('Rareté')} : ${rarityLbl}`}>
            {rarityIcon(cardData.rarity) ? <img src={rarityIcon(cardData.rarity)} alt="" className="big" /> : <span className="text-gold-400 text-lg">◆</span>}
          </Hex>
          <Hex ref={setHex(3)} className="sat s4" style={{ width: 54, height: 62 }} label={domainLabel(domains[0] || 'colorless')} aria={`${tx('Domaine')} : ${domains.map(domainLabel).join(', ') || '—'}`}>
            {domains.length && domainIcon(domains[0]) ? <img src={domainIcon(domains[0])} alt="" className="big" /> : <span className="text-rift-500 text-lg">—</span>}
          </Hex>
          </div>
        </div>

        {((hasList && list.length > 1) || (!hasList && position)) && (
          <div className="pager">
            <button type="button" onClick={() => goRel(-1)} disabled={hasList ? idx <= 0 : !onPrev} aria-label={tx('Carte précédente')}>‹</button>
            <span className="tabular-nums">{hasList ? <><b>{idx + 1}</b> / {list.length}</> : position}</span>
            <button type="button" onClick={() => goRel(1)} disabled={hasList ? idx >= list.length - 1 : !onNext} aria-label={tx('Carte suivante')}>›</button>
            <span className="sw" data-help="card.swipe">{tx('← balaie →')}</span>
          </div>
        )}

        <div className="ctas">
          {deckControls ? (
            <div className="add !flex !items-center !justify-start gap-3 !bg-rift-800 !text-rift-100 border border-gold-500/50" style={{ clipPath: 'none', borderRadius: 2 }}>
              <span className="text-[13px] text-rift-300">{deckControls.label || tx('Dans le deck')}</span>
              <button type="button" onClick={deckControls.onMinus} disabled={!deckControls.count} aria-label={tx('Un exemplaire de moins dans le deck')} className="w-9 h-9 border border-rift-600 flex items-center justify-center disabled:opacity-30">{deckControls.count === 1 ? <Trash2 className="w-4 h-4 text-state-bad" /> : <Minus className="w-4 h-4" />}</button>
              <b className="font-display text-xl text-gold-400 min-w-6 text-center">{deckControls.count}</b>
              <button type="button" onClick={deckControls.onPlus} aria-label={tx('Un exemplaire de plus dans le deck')} className="w-9 h-9 bg-gold-500 text-rift-900 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <button type="button" className="add" data-help="card.forge" onClick={() => (onAddCopies ? setForgeOpen(true) : onAddCopy(cardId, language))}>
                ＋ {onAddCopies ? tx('Ma collection') : tx('Ajouter un exemplaire')}
              </button>
              {org?.decks && (
                <button type="button" className="dk" onClick={() => setDeckFor(true)}>+ {tx('Deck')}</button>
              )}
            </>
          )}
        </div>

        <div ref={dossierRef} className={`dos ${dosFull ? 'full' : ''}`}>
          <div className="grab" data-help="card.sheet" title={tx('Tirer pour agrandir')}
            onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onClick={onGrabClick} />
          <h3 className="truncate px-[18px]">{name}</h3>
          <div className="idl">
            <span>{typeIcon(cardData.type) && <span className="mmask" style={maskStyle(typeIcon(cardData.type))} aria-hidden="true" />}{typeLabel(cardData.type)}{(cardData.superTypes || []).includes('champion') ? ` · ${tx('Champion')}` : ''}</span>
            <span>{domains.map(d => domainIcon(d) && <img key={d} src={domainIcon(d)} alt="" />)}{domains.map(domainLabel).join(' / ') || '—'}</span>
            {cardData.energy != null && <span><span className="men">{cardData.energy}</span> {tx('Énergie')}</span>}
            {cardData.might != null && <span>{mightIcon ? <span className="mmask" style={maskStyle(MASK_ICON.might)} aria-hidden="true" /> : '⚔'} {cardData.might} {tx('Puissance')}</span>}
          </div>
          <div className="tabsm" role="tablist" aria-label={tx('Sections')} data-help="card.tabs">{TABS.map(ztabM)}</div>
          <div className="db" role="tabpanel">{tabPanels}</div>
        </div>

        {forgeOpen && onAddCopies && (
          <Sheet open title={`＋ ${tx('Ajouter à ma collection')}`} onClose={() => setForgeOpen(false)}>
            <AddCopiesPanel key={cardId} cardData={cardData} defaultLanguage={initialLanguage || defaultLanguage} org={org} onAdd={submitForge} onCancel={() => setForgeOpen(false)} />
          </Sheet>
        )}
        {deckFor && org?.decks && (
          <Sheet open title={tx('Ajouter à un deck')} onClose={() => setDeckFor(false)}>
            {org.decks.items.length === 0 ? (
              <p className="text-sm text-rift-400 py-4">{tx('Aucun deck pour l’instant : créez-en un dans l’onglet Decks.')}</p>
            ) : (
              <div className="flex flex-col">
                {org.decks.items.map(d => (
                  <button key={d.id} type="button" onClick={() => { org.decks.save(deckWithCards(d, [cardData])); setDeckFor(false); }}
                    className="min-h-[52px] px-2 flex items-center gap-3 border-b border-rift-700 text-left hover:bg-rift-700/60">
                    <Swords className="w-4 h-4 text-gold-400" aria-hidden="true" />
                    <span className="flex-1 text-[15px] text-rift-100">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={name}
      className="fixed inset-0 z-[70] text-rift-100 outline-none overflow-hidden"
      style={{ '--dc': dc, transition: '--dc .7s' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* background: halo of the domain colour, then rays turning slowly (mock-up .bg / .rays) */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true"
        style={{ background: 'radial-gradient(700px 520px at 25% 55%, color-mix(in srgb, var(--dc) 30%, transparent), transparent 70%), #04070de8', backdropFilter: 'blur(6px)' }} />
      <div className="rf-rays absolute left-[23%] top-[55%] w-[900px] h-[900px] -ml-[450px] -mt-[450px] pointer-events-none" aria-hidden="true"
        style={{ background: 'repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--dc) 14%, transparent) 0 4deg, transparent 4deg 18deg)', WebkitMask: 'radial-gradient(circle, #000 0, transparent 62%)', mask: 'radial-gradient(circle, #000 0, transparent 62%)' }} />

      <div className="relative h-full grid grid-cols-[minmax(0,46%)_minmax(0,1fr)]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {/* ── Altar ── */}
        <div className="relative min-w-0 overflow-hidden flex flex-col items-center justify-center pt-5 pb-[30px]" style={{ perspective: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="relative w-[330px] z-[2]">
            {[-2, -1, 1, 2].map(nav)}
            <div ref={ringRef} className="absolute left-1/2 top-1/2 w-[130%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none opacity-0"
              style={{ border: '3px solid #c8aa6e', boxShadow: '0 0 40px var(--dc), inset 0 0 30px var(--dc)', background: 'conic-gradient(from 0deg, rgba(200,170,110,.35), transparent 20%, rgba(200,170,110,.35) 40%, transparent 60%, rgba(200,170,110,.35) 80%, transparent)', WebkitMask: 'radial-gradient(circle, transparent 62%, #000 64%)', mask: 'radial-gradient(circle, transparent 62%, #000 64%)' }} aria-hidden="true" />
            <div ref={cardRef} {...tilt} className="rf-holo rf-holo-on relative select-none cursor-grab active:cursor-grabbing rounded-xl"
              style={{ boxShadow: '0 40px 70px #000e, 0 0 60px color-mix(in srgb, var(--dc) 45%, transparent)' }}
              onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              {isLandscape ? (
                <span className="relative block w-full aspect-[7/5] overflow-hidden rounded-xl" role="img" aria-label={name}>
                  <img src={imgSrc} alt="" onError={(e) => { if (imgSrc !== thumbSrc(cardId)) setImgSrc(thumbSrc(cardId)); else handleImageError(e, cardId); }} draggable={false}
                    className="absolute top-1/2 left-1/2 max-w-none object-cover" style={{ width: '71.43%', height: '140%', transform: 'translate(-50%, -50%) rotate(90deg)' }} />
                </span>
              ) : (
                <img src={imgSrc} alt={name} draggable={false} onError={(e) => { if (imgSrc !== thumbSrc(cardId)) setImgSrc(thumbSrc(cardId)); else handleImageError(e, cardId); }} className="block w-full h-auto rounded-xl" />
              )}
            </div>

            {/* the four hexagons, outside the card, no link between them */}
            <Hex ref={setHex(0)} label={tx('Énergie')} aria={cardData.energy != null ? tx('Énergie {n}', { n: cardData.energy }) : tx('Énergie : aucune')} style={{ right: 'calc(100% + 16px)', top: 36 }}>
              {cardData.energy != null ? <EnergyBadge value={cardData.energy} size="lg" /> : <span className="text-rift-500 text-lg">—</span>}
            </Hex>
            <Hex ref={setHex(1)} label={tx('Puissance')} aria={cardData.might != null ? tx('Puissance {n}', { n: cardData.might }) : tx('Puissance : aucune')} style={{ left: 'calc(100% + 16px)', top: 36 }}>
              {cardData.might != null ? (
                <span className="flex items-center gap-[3px] text-rift-100">
                  {mightIcon ? <span className="block w-[22px] h-[22px]" style={maskStyle(MASK_ICON.might)} aria-hidden="true" /> : <span aria-hidden="true">⚔</span>}
                  <span className="font-display text-[24px] font-bold leading-none">{cardData.might}</span>
                </span>
              ) : <span className="text-rift-500 text-lg">—</span>}
            </Hex>
            <Hex ref={setHex(2)} label={rarityLbl} aria={`${tx('Rareté')} : ${rarityLbl}`} style={{ right: 'calc(100% + 16px)', bottom: 60 }}>
              {rarityIcon(cardData.rarity) ? <img src={rarityIcon(cardData.rarity)} alt="" className="w-7 h-7 object-contain" /> : <span className="text-gold-400 text-lg">◆</span>}
            </Hex>
            <Hex ref={setHex(3)} label={domainLabel(domains[0] || 'colorless')} aria={`${tx('Domaine')} : ${domains.map(domainLabel).join(', ') || '—'}`} style={{ left: 'calc(100% + 16px)', bottom: 60 }}>
              {domains.length ? (
                <span className="flex gap-0.5">{domains.slice(0, 2).map(d => (domainIcon(d) ? <img key={d} src={domainIcon(d)} alt="" className="w-6 h-6" /> : <span key={d} className="w-5 h-5 rounded-full" style={{ background: (DOMAIN_COLORS[d] || DOMAIN_COLORS.colorless).hex }} />))}</span>
              ) : <span className="text-rift-500 text-lg">—</span>}
            </Hex>
          </div>

          {/* pedestal (mock-up .pedestal): glow + gold line right under the card */}
          <div className="relative z-[3] w-[400px] h-[46px] -mt-2 pointer-events-none" aria-hidden="true">
            <span className="rf-breathe absolute left-[10%] right-[10%] top-2.5 h-[26px] rounded-[50%]" style={{ background: 'radial-gradient(ellipse, color-mix(in srgb, var(--dc) 70%, transparent), transparent 70%)', filter: 'blur(6px)' }} />
            <span className="absolute left-[18%] right-[18%] top-[21px] h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #e8c973, transparent)', boxShadow: '0 0 14px #e8c973' }} />
          </div>
          {((hasList && list.length > 1) || (!hasList && position)) && (
            <div className="relative z-[2] flex items-center gap-3.5 mt-1.5 text-rift-400 text-[12.5px]" data-help="card.nav">
              <button type="button" onClick={() => goRel(-1)} disabled={hasList ? idx <= 0 : !onPrev} aria-label={tx('Carte précédente')} className="hexagon w-10 h-[46px] bg-gold-500/20 text-gold-400 text-[18px] hover:bg-gold-500/35 disabled:opacity-30">‹</button>
              <span className="tabular-nums font-display text-[15px]">{hasList ? <><b className="text-gold-400">{idx + 1}</b> / {list.length}</> : position}</span>
              <button type="button" onClick={() => goRel(1)} disabled={hasList ? idx >= list.length - 1 : !onNext} aria-label={tx('Carte suivante')} className="hexagon w-10 h-[46px] bg-gold-500/20 text-gold-400 text-[18px] hover:bg-gold-500/35 disabled:opacity-30">›</button>
            </div>
          )}
          {noHd && <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-rift-500">{tx('Image en haute définition après la première synchro')}</p>}
        </div>

        {/* ── Dossier ── */}
        <div className="relative min-w-0 h-full flex flex-col min-h-0 pt-[34px] pr-10 pb-6 pl-2.5" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <button type="button" onClick={onClose} aria-label={tx('Fermer')} title={tx('Fermer')}
            className="hexagon absolute top-[18px] right-[22px] z-20 w-10 h-[46px] bg-white/10 text-rift-300 hover:bg-gold-500/30 hover:text-gold-400 flex items-center justify-center text-[16px]">✕</button>
          <div ref={dossierRef} className="rf-dossier flex flex-col min-h-0 flex-1">
            <div className="text-[11px] tracking-[.2em] uppercase text-gold-400 flex gap-2.5 items-center">
              {rarityIcon(cardData.rarity) && <img src={rarityIcon(cardData.rarity)} alt="" className="w-4 h-4 object-contain" />}
              <span>{cardData.setName} · {cardData.code?.split('/')[0] || cardData.collectorNumber}</span>
            </div>
            <h2 className="font-display text-[38px] leading-[1.1] font-bold text-rift-100 tracking-[.02em] mt-1.5 mb-2.5">{name}</h2>
            <div className="flex flex-wrap gap-2 mb-[18px]">
              <span className={idSpan}>{typeIcon(cardData.type) && <span className="block w-4 h-4" style={maskStyle(typeIcon(cardData.type))} aria-hidden="true" />}{typeLabel(cardData.type)}</span>
              <span className={idSpan}>{domains.map(d => domainIcon(d) && <img key={d} src={domainIcon(d)} alt="" className="w-4 h-4" />)}{domains.map(domainLabel).join(' / ') || '—'}</span>
              {cardData.energy != null && <span className={idSpan}><EnergyBadge value={cardData.energy} size="inline" /> {tx('Énergie')}</span>}
              {cardData.might != null && <span className={idSpan}>{mightIcon ? <span className="block w-4 h-4" style={maskStyle(MASK_ICON.might)} aria-hidden="true" /> : '⚔'} {cardData.might} {tx('Puissance')}</span>}
              {onAddCopies && (
                <button type="button" onClick={() => setForgeOpen(o => !o)} aria-pressed={forgeOpen} data-help="card.forge"
                  className={`${idSpan} !border-gold-400 !text-rift-900 font-extrabold hover:brightness-110`} style={{ background: 'linear-gradient(160deg,#e8c973,#a8893a)' }}>＋ {tx('Ma collection')}</button>
              )}
              <button type="button" onClick={() => onSetWanted(cardId, currentWanted > 0 ? 0 : 1)} aria-pressed={currentWanted > 0} data-help="card.wish"
                aria-label={currentWanted > 0 ? tx('Retirer des souhaits') : tx('Ajouter aux souhaits')}
                className={`${idSpan} ${onAddCopies ? '' : 'ml-auto'} !border-[#ff8a8066] !text-[#ff8a80]`}>
                <Heart className={`w-3.5 h-3.5 ${currentWanted > 0 ? 'fill-[#ff8a80]' : ''}`} aria-hidden="true" /> {tx('Souhaits')}
              </button>
            </div>

            {deckControls && (
              <div className="mb-4 flex items-center gap-3 min-h-[46px] px-3 bg-rift-800 border border-gold-500/50">
                <span className="text-sm text-rift-300 mr-auto">{deckControls.label || tx('Dans le deck')}</span>
                <button type="button" onClick={deckControls.onMinus} disabled={!deckControls.count} aria-label={tx('Un exemplaire de moins dans le deck')}
                  className="w-9 h-9 flex items-center justify-center border border-rift-600 disabled:opacity-30">{deckControls.count === 1 ? <Trash2 className="w-4 h-4 text-state-bad" /> : <Minus className="w-4 h-4" />}</button>
                <span className="w-8 text-center font-display text-xl font-bold text-gold-400">{deckControls.count}</span>
                <button type="button" onClick={deckControls.onPlus} aria-label={tx('Un exemplaire de plus dans le deck')} className="w-9 h-9 flex items-center justify-center bg-gold-500 text-rift-900"><Plus className="w-4 h-4" /></button>
              </div>
            )}

            {forgeOpen && onAddCopies ? (
              <div className="min-h-0 overflow-auto pr-2.5">
                <AddCopiesPanel key={cardId} cardData={cardData} defaultLanguage={initialLanguage || defaultLanguage} org={org} onAdd={submitForge} onCancel={() => setForgeOpen(false)} />
              </div>
            ) : (
              <>
                <div className="flex gap-1 border-b border-rift-600 mb-4" role="tablist" aria-label={tx('Sections')} data-help="card.tabs">{TABS.map(ztab)}</div>
                <section className="flex-1 min-h-0 overflow-auto pr-2.5 [scrollbar-width:thin]" role="tabpanel">
                  {tabPanels}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
