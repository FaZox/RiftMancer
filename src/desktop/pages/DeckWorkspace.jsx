// PC deck editor (layout B: deck | catalog | preview).
import { zoomGesture } from '../../lib/zoomGesture.js';
import React, { useRef, useState } from 'react';
import { ArrowLeft, Plus, Minus, Heart, Share2, Trash2, UserCheck, Undo2, Crown, Star, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import useDeckEditor, { deckZoomControls } from '../../hooks/useDeckEditor.js';
import CardmarketWantsButton from '../../components/common/CardmarketWantsButton.jsx';
import { RiftCard } from '../../components/collection/RiftStage.jsx';
import CardZoom from '../../components/collection/CardZoom.jsx';
import DeckCurve from '../../components/organize/DeckCurve.jsx';
import { ExportDeckDialog, LendDeckDialog } from '../../components/organize/DeckDialogs.jsx';
import { HandDialog, HandIcon } from '../../components/organize/DeckTools.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { fullImageSrc, handleImageError } from '../../lib/nativeAssets.js';
import { ZONES, RULES, cardDomains, legendChampion, isChampionFor, cardKey } from '../../lib/deckRules.js';
import { unitPrice, euro } from '../../lib/prices.js';
import { domainLabel, DOMAIN_COLORS } from '../../data/sampleCards.js';
import { CATALOG_DEFAULT, CATALOG_MIN, Catalog, DECK_MIN, PREVIEW_W, PreviewColumn } from './DeckCatalog.jsx';
import { FormatChip, DeckCheckBanner } from '../../components/organize/DeckFormat.jsx';
import StatusPill from '../../components/common/StatusPill.jsx';
import { useDialog } from '../../components/common/Dialog.jsx';
import DeckVersions from '../../components/organize/DeckVersions.jsx';
import OpponentNotes from '../../components/organize/OpponentNotes.jsx';
import { tx } from '../../lib/i18n.js';

// ─── Editor ────────────────────────────────────────────────────────────────
export function DeckWorkspace({ deck, decks, org, copies, collection, wishlist, ownedByCard, onBack }) {
  const { inform } = useDialog();
  const ed = useDeckEditor({ deck, decks, org, copies, collection, wishlist });
  // Zoom opened from this deck: − / + change the deck, not the collection
  const [zoomId, setZoomId] = useState(null);
  const [view, setView] = useState('deck'); // 'deck' | 'opponents' (lot 7.4)
  const onOpen = (id) => setZoomId(id);
  const { m, check, own, legend, champion, money, slots, countOf, setQty, toggleSide, save, inThisDeck, lendable, activeLoan } = ed;
  const [dialog, setDialog] = useState(null); // 'export' | 'lend'
  const [pick, setPick] = useState(legend ? 'cards' : 'legend'); // what the catalog adds: cards | legend | champion
  const [toSide, setToSide] = useState(false);
  const [catalogW, setCatalogW] = useState(() => {
    try { return Number(localStorage.getItem('rb.pc.catalogW')) || CATALOG_DEFAULT; } catch { return CATALOG_DEFAULT; }
  });
  const rowRef = useRef(null);
  // Drag the left edge of the catalog. The deck keeps at least DECK_MIN px,
  // the catalog at least CATALOG_MIN px; the rest adapts by itself.
  const startResize = (e) => {
    e.preventDefault();
    const row = rowRef.current.getBoundingClientRect();
    const move = (ev) => {
      const w = Math.round(row.right - ev.clientX);
      setCatalogW(Math.max(CATALOG_MIN, Math.min(row.width - DECK_MIN - PREVIEW_W, w)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setCatalogW(w => { try { localStorage.setItem('rb.pc.catalogW', String(w)); } catch { /* ignore */ } return w; });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPick = (c) => {
    if (pick === 'champion') {
      if (!isChampionFor(c, legend)) { inform({ title: tx('Champion impossible'), message: tx('Le champion doit être une unité « {legendChampion} ».', { legendChampion: legendChampion(legend) }) }); return; }
      ed.pickChampion(c); setPick('cards'); return;
    }
    if (ed.addCard(c, toSide) === 'legend') setPick(champion ? 'cards' : 'champion');
  };
  const addTo = (c, side) => { ed.addCard(c, side); };
  // Card shown in the « Aperçu » column (last hovered, in the deck or the catalog)
  const [preview, setPreview] = useState(null);
  // 3 cards per row by default: big enough to read the cards' text
  const [perRow, setPerRowState] = useState(() => { try { return Number(localStorage.getItem('rb.pc.deckPerRow3')) || 3; } catch { return 3; } });
  const setPerRow = (n) => { setPerRowState(n); try { localStorage.setItem('rb.pc.deckPerRow3', String(n)); } catch { /* ignore */ } };
  const [sortBy, setSortByState] = useState(() => { try { return localStorage.getItem('rb.pc.deckSort') || 'cost'; } catch { return 'cost'; } });
  const setSortBy = (v) => { setSortByState(v); try { localStorage.setItem('rb.pc.deckSort', v); } catch { /* ignore */ } };
  const priceOf = (id) => (ed.prices ? unitPrice(ed.prices, id) : null);

  const zones = ZONES.map(z => {
    const items = slots.filter(s => s.zone === z.id).map(s => ({ ...s, card: m.getCardData(s.cardId) })).filter(s => s.card)
      .sort((a, b) => {
        const byName = getLocalizedName(a.card, displayLanguage()).localeCompare(getLocalizedName(b.card, displayLanguage()));
        if (sortBy === 'price') return (priceOf(b.cardId) ?? -1) - (priceOf(a.cardId) ?? -1) || byName;
        if (sortBy === 'name') return byName;
        return (a.card.energy ?? 99) - (b.card.energy ?? 99) || byName;
      });
    return { ...z, items, total: items.reduce((n, s) => n + s.quantity, 0) };
  });
  const counters = [
    ['Deck', check.counts.main, RULES.mainMin],
    ['Runes', check.counts.rune, RULES.runes],
    ['Champs', check.counts.battlefield, RULES.battlefields],
    [tx('Réserve'), check.counts.side, RULES.sideboard],
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header: name, the rules counters, actions */}
      <header className="flex-shrink-0 px-6 h-16 flex items-center gap-4 border-b border-gold-500/15">
        <button onClick={onBack} className="btn-ghost h-10 px-3 text-sm"><ArrowLeft className="w-4 h-4" /> {tx('Decks')}</button>
        <input value={deck.name} onChange={e => save({ name: e.target.value })} aria-label={tx('Nom du deck')}
          className="min-w-[160px] flex-1 max-w-[420px] h-11 px-2 bg-transparent border border-transparent hover:border-rift-600 focus:border-gold-500/60 focus:outline-none font-display text-[24px] font-bold text-gold-400" />
        <FormatChip value={check.format} onChange={(format) => save({ format })} />
        <DeckVersions deck={deck} matches={org.matches.items} onSave={(d) => save({ versions: d.versions })} />
        <div className="seg" role="group" aria-label={tx('Vue du deck')}>
            <button aria-pressed={view === 'deck'} onClick={() => setView('deck')}>{tx('Deck')}</button>
            <button aria-pressed={view === 'opponents'} onClick={() => setView('opponents')}>{tx('Adversaires')}</button>
          </div>
        <div className="flex gap-2">
          {counters.map(([label, n, max]) => {
            const ok = label === 'Réserve' ? n <= max : label === 'Deck' ? n >= max : n === max;
            return (
              <span key={label} className="h-9 px-3 flex items-center gap-1.5 text-sm bg-rift-800 border-b-2" style={{ borderColor: ok ? '#7fd6a4' : '#e8a33a' }}>
                <span className="text-rift-400">{label}</span> <strong className="text-rift-100">{n}</strong><span className="text-rift-500">/{max}</span>
              </span>
            );
          })}
        </div>
        <span className="flex-1" />
        <button onClick={() => setDialog('hand')} className="btn-ghost h-10 px-3 text-sm"><HandIcon className="w-4 h-4" /> {tx('Main de départ')}</button>
        <button onClick={() => setDialog('export')} className="btn-ghost h-10 px-3 text-sm"><Share2 className="w-4 h-4" /> {tx('Partager')}</button>
        <button onClick={() => ed.removeDeck(onBack)} className="btn-ghost h-10 px-3 text-sm text-[#ff8a80]"><Trash2 className="w-4 h-4" /> {tx('Supprimer')}</button>
      </header>
      <DeckCheckBanner check={check} className="flex-shrink-0 mx-6 mt-3" />

      <div ref={rowRef} className="flex-1 min-h-0 flex">
        {/* 1. The deck */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-6">
          {view === 'opponents' ? (
            <div className="max-w-[760px]"><OpponentNotes deck={deck} matches={org.matches.items} onSave={(d) => save({ opponents: d.opponents })} /></div>
          ) : (<>
          <section className="space-y-4">
            <div className="flex gap-6 justify-center">
              <Hero label={tx('Légende')} icon={Crown} card={legend} legend onOpen={onOpen} active={pick === 'legend'} onChoose={() => setPick('legend')}
                sub={legend ? cardDomains(legend).map(domainLabel).join(' · ') : tx('Définit les 2 domaines')} />
              <Hero label={tx('Champion')} icon={Star} card={champion} onOpen={onOpen} active={pick === 'champion'} disabled={!legend} onChoose={() => legend && setPick('champion')}
                sub={legend ? tx('Unité « {legendChampion} »', { legendChampion: legendChampion(legend) }) : tx('Après la Légende')} />
            </div>
            <div className="space-y-3">
              <div className="panel px-4 py-3 space-y-2">
                <p className="text-sm text-rift-200">
                  <strong>{inThisDeck}</strong> {tx('exemplaire')}{inThisDeck > 1 ? 's' : ''} {tx('rangé')}{inThisDeck > 1 ? 's' : ''} {tx('dans ce deck')}
                  {own.missing > 0
                    ? <> · <span className="text-[#ff8a80]">{tx('il manque')} {own.missing} {tx('carte')}{own.missing > 1 ? 's' : ''}</span></>
                    : <> · <span className="text-[#7fd6a4]">{tx('vous avez toutes les cartes')}</span></>}
                  {money && <> {tx('· valeur')} <span className="font-semibold text-gold-400">{euro(money.value)}</span>{money.missingCost > 0 && <> {tx('(manquantes :')} <span className="text-[#ff8a80]">{euro(money.missingCost)}</span>)</>}</>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={ed.assign} className="btn-primary h-9 px-3 text-sm">{tx('Mettre mes exemplaires libres dans ce deck')}</button>
                  {inThisDeck > 0 && <button onClick={ed.release} className="btn-ghost h-9 px-3 text-sm"><Undo2 className="w-4 h-4" /> {tx('Vider le deck')}</button>}
                  {own.missing > 0 && <button onClick={ed.wishMissing} className="btn-ghost h-9 px-3 text-sm"><Heart className="w-4 h-4" /> {tx('Manquantes → souhaits')}</button>}
                  {own.missing > 0 && <CardmarketWantsButton items={ed.missingItems} label={tx('Manquantes → Cardmarket')} className="btn-ghost h-9 px-3 text-sm" />}
                  {!activeLoan && lendable.length > 0 && <button onClick={() => setDialog('lend')} className="btn-ghost h-9 px-3 text-sm"><UserCheck className="w-4 h-4" /> {tx('Prêter le deck')}</button>}
                  {activeLoan && (
                    <span className="h-9 px-3 flex items-center gap-2 text-sm text-sky-200 border border-sky-500/30 bg-sky-500/10">
                      <UserCheck className="w-4 h-4" /> {tx('Prêté à')} {org.people.byId.get(activeLoan.personId)?.name || '—'}
                      <button onClick={ed.giveBack} className="text-[#7fd6a4] hover:underline">{tx('Rendu')}</button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {zones.map((z, zi) => (
            <section key={z.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-bold text-gold-400 flex-1">
                  {z.label} · {z.total}
                  {z.id === 'side' && <span className="font-body font-normal text-sm text-rift-400"> / {RULES.sideboard} {tx('en tournoi')}</span>}
                </h3>
                {zi === 0 && (
                  <span className="flex items-center gap-2 text-xs text-rift-400">
                    {tx('Trier par')}
                    <span className="flex border border-rift-600" role="group" aria-label={tx('Trier les cartes')}>
                      {[['cost', tx('Coût')], ['price', tx('Prix')], ['name', tx('Nom')]].map(([v, l]) => (
                        <button key={v} onClick={() => setSortBy(v)} aria-pressed={sortBy === v}
                          className={`h-8 px-2.5 text-xs font-semibold ${sortBy === v ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>{l}</button>
                      ))}
                    </span>
                  </span>
                )}
                {zi === 0 && (
                  <span className="flex items-center gap-2 text-xs text-rift-400">
                    {tx('Cartes par ligne')}
                    <span className="flex border border-rift-600" role="group" aria-label={tx('Cartes par ligne')}>
                      {[3, 4, 5, 6].map(n => (
                        <button key={n} onClick={() => setPerRow(n)} aria-pressed={perRow === n}
                          className={`w-8 h-8 text-xs font-semibold ${perRow === n ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400 hover:text-rift-100'}`}>{n}</button>
                      ))}
                    </span>
                  </span>
                )}
              </div>
              {z.items.length === 0 ? (
                <p className="text-sm text-rift-500">
                  {z.id === 'side' ? tx('Aucune carte. Survolez une carte du deck et cliquez « Réserve », ou choisissez « en réserve » dans le catalogue.') : tx('Aucune carte — ajoutez-en depuis le catalogue.')}
                </p>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
                  {z.items.map(s => (
                    <div key={s.cardId + s.zone} onMouseEnter={() => setPreview(s.card)}>
                      <DeckCard slot={s} own={own.byName.get(cardKey(s.card))} champion={deck.championId === s.cardId} banned={check.bannedIds.has(s.cardId)}
                        price={ed.prices ? unitPrice(ed.prices, s.cardId) : null}
                        onOpen={() => onOpen(s.cardId)} onMinus={() => setQty(s.cardId, s.zone, s.quantity - 1)}
                        onPlus={() => setQty(s.cardId, s.zone, s.quantity + 1)}
                        onSide={s.zone !== 'rune' && s.zone !== 'battlefield' ? () => toggleSide(s) : null} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          <div className="grid gap-6 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <DeckCurve deck={deck} />
            <textarea value={deck.note || ''} onChange={e => save({ note: e.target.value })} rows={5}
              placeholder={tx('Notes (stratégie, mulligan…)')}
              className="w-full bg-rift-800/50 border border-rift-600/40 text-sm text-rift-100 p-3 focus:outline-none focus:border-gold-500/60" />
          </div>
          </>)}
        </div>

        {/* 2. The catalog */}
        <Catalog width={catalogW} onResizeStart={startResize} onResetWidth={() => { setCatalogW(CATALOG_DEFAULT); try { localStorage.removeItem('rb.pc.catalogW'); } catch { /* ignore */ } }} pick={pick} setPick={setPick} toSide={toSide} setToSide={setToSide} legend={legend}
          ownedByCard={ownedByCard} countOf={countOf} onPick={onPick} onZoom={onOpen} onHover={setPreview} previewId={preview?.id} />

        {/* 3. The preview: its own column, never over anything */}
        <PreviewColumn card={preview} pick={pick} inDeck={preview ? countOf(preview.id) : 0} owned={preview ? (ownedByCard.get(preview.id) || 0) : 0}
          price={preview && ed.prices ? unitPrice(ed.prices, preview.id) : null}
          missing={preview ? (own.byName.get(cardKey(preview))?.missing || 0) : 0}
          onAddTo={addTo} onPick={onPick} onZoom={onOpen} />
      </div>

      {dialog === 'export' && <ExportDeckDialog deck={deck} onClose={() => setDialog(null)} />}
      {dialog === 'hand' && <HandDialog deck={deck} onClose={() => setDialog(null)} />}
      {dialog === 'lend' && <LendDeckDialog deck={deck} count={lendable.length} people={org.people} onLend={ed.lendDeck} onClose={() => setDialog(null)} />}
      {zoomId && (
        <CardZoom cardId={zoomId} stacks={collection.stacks} byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted} onAddCopy={() => {}} onClose={() => setZoomId(null)}
          deckControls={deckZoomControls(ed, deck, m.getCardData(zoomId), toSide && pick === 'cards')} />
      )}
    </div>
  );
}

export function Hero({ label, icon: Icon, card, sub, legend = false, onOpen, onChoose, active, disabled }) {
  const colors = (card ? cardDomains(card) : []).map(d => DOMAIN_COLORS[d]?.hex).filter(Boolean);
  if (!colors.length) colors.push(DOMAIN_COLORS.colorless.hex);
  return (
    <div className={`w-[210px] 2xl:w-[240px] text-center ${disabled ? 'opacity-50' : ''}`}>
      {card ? (
        <button onClick={() => onOpen(card.id)} className="block w-full px-1.5 pt-3 pb-3" title={tx('Voir en grand')}>
          <RiftCard key={card.id} colors={colors} legend={legend} plaque={legend ? tx('LÉGENDE') : null}>
            <img src={fullImageSrc(card.id)} onError={e => handleImageError(e, card.id)} alt="" className="block w-full h-auto" />
          </RiftCard>
        </button>
      ) : (
        <button onClick={onChoose} disabled={disabled} style={{ aspectRatio: '744 / 1039' }}
          className={`w-full flex flex-col items-center justify-center gap-2 border border-dashed ${active ? 'border-gold-400 text-gold-400 bg-gold-500/5' : 'border-rift-600 text-rift-400'}`}>
          <Icon className="w-8 h-8" /><span className="text-sm">{tx('Choisir dans le catalogue')}</span>
        </button>
      )}
      <p className="text-xs text-rift-400 uppercase tracking-wider mt-1">{label}</p>
      <p className="text-sm font-semibold text-rift-100 truncate">{card ? getLocalizedName(card, displayLanguage()) : '—'}</p>
      <p className="text-xs text-rift-500 truncate">{sub}</p>
      {card && <button onClick={onChoose} disabled={disabled} className={`text-sm mt-0.5 hover:underline ${active ? 'text-gold-300 font-bold' : 'text-gold-400'}`}>{active ? tx('Choisissez à droite →') : tx('Changer')}</button>}
    </div>
  );
}

/** A card of the deck as a picture; quantity, −/+ and « Réserve » on hover. */
export function DeckCard({ slot, own, champion, banned, price, onOpen, onMinus, onPlus, onSide }) {
  const { card, quantity, zone } = slot;
  const last = quantity === 1;
  const missing = own?.missing || 0;
  return (
    <div>
    <div className="group relative">
      {/* clic : voir en grand · clic droit : un exemplaire de moins (la carte part au dernier) · molette : voir en grand */}
      <button {...zoomGesture(onOpen, onOpen)} onContextMenu={(e) => { e.preventDefault(); onMinus(); }} className="block w-full"
        title={`${getLocalizedName(card, displayLanguage())} — clic : voir en grand · clic droit : ${last ? 'retirer la carte' : 'un exemplaire de moins'}`}>
        <img src={fullImageSrc(card.id)} onError={e => handleImageError(e, card.id)} alt={getLocalizedName(card, displayLanguage())} loading="lazy"
          className={`w-full aspect-[5/7] object-cover rounded-[6px] ${own?.missing > 0 ? 'opacity-55' : ''} ${banned ? 'brightness-[.4]' : ''}`} />
      </button>
      {banned && <StatusPill kind="bannie" className={`absolute top-1.5 ${champion ? 'left-10' : 'left-1.5'}`} />}
      <span className="absolute top-1.5 right-1.5 min-w-[28px] h-7 px-1.5 flex items-center justify-center bg-rift-900/90 border border-gold-500/60 text-gold-400 font-bold text-sm">×{quantity}</span>
      {champion && <span className="absolute top-1.5 left-1.5 w-7 h-7 flex items-center justify-center bg-gold-500 text-rift-900" title={tx('Champion choisi')}><Star className="w-4 h-4" /></span>}
      {/* Controls on hover */}
      <div className="absolute inset-x-0 bottom-0 flex items-stretch h-9 bg-rift-900/95 border-t border-gold-500/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button onClick={onMinus} aria-label={last ? tx('Retirer la carte') : tx('Retirer un exemplaire')} title={last ? tx('Retirer la carte') : tx('Un de moins')}
          className={`flex-1 flex items-center justify-center ${last ? 'text-[#ff8a80]' : 'text-rift-200'} hover:bg-rift-700`}>
          {last ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
        </button>
        {onSide && (
          <button onClick={onSide} title={zone === 'side' ? tx('Remettre dans le deck') : tx('Mettre en réserve')}
            className="flex-[1.6] flex items-center justify-center gap-1 text-xs text-rift-300 hover:bg-rift-700 border-x border-rift-600">
            {zone === 'side' ? <><ArrowUpFromLine className="w-3.5 h-3.5" /> {tx('Deck')}</> : <><ArrowDownToLine className="w-3.5 h-3.5" /> {tx('Réserve')}</>}
          </button>
        )}
        <button onClick={onPlus} aria-label={tx('Un de plus')} className="flex-1 flex items-center justify-center text-rift-200 hover:bg-rift-700"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
    {/* Under the card: unit price, and the missing copies with what they cost */}
    <div className="pt-1.5 text-sm space-y-0.5">
      {price != null && <p className="text-rift-300">{euro(price)} <span className="text-rift-500">{tx('l’unité')}</span></p>}
      {missing > 0 && (
        <p className="font-semibold text-[#ff8a80]">
          {missing} {tx('manquante')}{missing > 1 ? 's' : ''}{price != null && <> · {euro(price * missing)}</>}
        </p>
      )}
    </div>
    </div>
  );
}
