import React, { useEffect, useState } from 'react';
import { HandDialog, HandIcon } from './DeckTools.jsx';
import {
  ArrowLeft, Plus, Minus, Trash2, Heart, Undo2, Crown, Star,
  Share2, UserCheck, Swords, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { RiftCard } from '../collection/RiftStage.jsx';
import CardPicker from './CardPicker.jsx';
import { ExportDeckDialog, LendDeckDialog } from './DeckDialogs.jsx';
import DeckCurve from './DeckCurve.jsx';
import { FormatChip, DeckCheckBanner } from './DeckFormat.jsx';
import StatusPill from '../common/StatusPill.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { thumbSrc, fullImageSrc, downloadedImageSrc, handleImageError } from '../../lib/nativeAssets.js';
import {
  ZONES, RULES, isChampionFor, legendChampion,
  cardDomains, cardKey,
} from '../../lib/deckRules.js';
import { domainLabel, DOMAIN_COLORS } from '../../data/sampleCards.js';
import { euro } from '../../lib/prices.js';

import { useBackHandler } from '../../lib/backButton.js';
import useDeckEditor, { deckZoomControls } from '../../hooks/useDeckEditor.js';
import CardZoom from '../collection/CardZoom.jsx';
import CardmarketWantsButton from '../common/CardmarketWantsButton.jsx';
import { useDialog } from '../common/Dialog.jsx';
import DeckVersions from './DeckVersions.jsx';
import OpponentNotes from './OpponentNotes.jsx';
import { tx, locale } from '../../lib/i18n.js';
/**
 * Deck editor: list of cards (independent of what you own), rule check, and
 * the link with your physical copies (which copies are in this deck, what is
 * missing).
 */
export default function DeckEditor({ deck, decks, org, copies, ownedByCard, collection, wishlist, onBack }) {
  useBackHandler(true, onBack);
  const [picker, setPicker] = useState(null); // null | 'cards' | 'legend' | 'champion'
  const [dialog, setDialog] = useState(null); // null | 'export' | 'lend'
  const [view, setView] = useState('deck'); // 'deck' | 'opponents' (lot 7.4)
  const [addTo, setAddTo] = useState('deck'); // where « Ajouter des cartes » puts cards: 'deck' | 'side'
  const ed = useDeckEditor({ deck, decks, org, copies, collection, wishlist });
  // Card zoom opened from this deck (tap a card, or hold a card in « Ajouter »):
  // its buttons change the copies in the deck, not in the collection.
  const [zoomId, setZoomId] = useState(null);
  const onOpen = (id) => setZoomId(id);
  const {
    m, people, activeLoan, lendable, check, own, inThisDeck, legend, champion, money,
    save, slots, countOf, setQty, assign, release, wishMissing, toggleSide, lendDeck, giveBack,
  } = ed;
  const addCard = (c) => { if (ed.addCard(c, addTo === 'side') === 'legend') setPicker(null); };
  const pickChampion = (c) => { ed.pickChampion(c); setPicker(null); };
  const removeDeck = () => ed.removeDeck(onBack);

  // One zone of the list (Deck, Runes, Champs de bataille, Réserve)
  const renderZone = (z) => {
    const zs = slots.filter(s => s.zone === z.id)
      .map(s => ({ ...s, card: m.getCardData(s.cardId) }))
      .filter(s => s.card)
      .sort((a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99) || a.card.name.localeCompare(b.card.name));
    const total = zs.reduce((n, s) => n + s.quantity, 0);
    return (
      <section key={z.id} className="space-y-1.5">
        <h3 className="font-display text-[14px] font-bold text-gold-400">
          {z.label} · {total}
          {z.id === 'side' && <span className="font-body font-normal text-[11px] text-rift-400"> / {RULES.sideboard} {tx('en tournoi')}</span>}
        </h3>
        {zs.length === 0 && (
          <p className="text-[11px] text-rift-500">
            {z.id === 'side'
              ? tx('Aucune carte. Appuyez sur « Réserve » sur une carte du deck pour l’y déplacer, ou choisissez « Ajouter en réserve ».')
              : tx('Aucune carte.')}
          </p>
        )}
        {/* PC (wide screens): two columns of rows */}
        <div className="2xl:grid 2xl:grid-cols-2 2xl:gap-x-6">
        {zs.map(s => {
          const o = own.byName.get(cardKey(s.card));
          const movable = s.zone !== 'rune' && s.zone !== 'battlefield';
          const last = s.quantity === 1;
          return (
            <div key={s.cardId + s.zone} className="flex items-center gap-2 py-1.5 border-b border-rift-600/50">
              <button onClick={() => onOpen(s.cardId)} className="w-9 h-12 lg:w-11 lg:h-[60px] rounded-md overflow-hidden flex-shrink-0 bg-rift-800">
                <img src={thumbSrc(s.cardId)} onError={e => handleImageError(e, s.cardId)} alt="" loading="lazy" className={`w-full h-full object-cover ${check.bannedIds.has(s.cardId) ? 'brightness-[.4]' : ''}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs lg:text-sm font-semibold text-rift-100 truncate">
                  {s.card.energy != null && <span className="hexagon inline-flex w-[22px] h-[22px] items-center justify-center bg-[#1d3a5c] text-[#8fd0ff] text-[11px] font-bold mr-1.5 align-middle">{s.card.energy}</span>}
                  {getLocalizedName(s.card, displayLanguage())}
                  {deck.championId === s.cardId && <Star className="inline w-3 h-3 ml-1 text-gold-400" />}
                  {check.bannedIds.has(s.cardId) && <StatusPill kind="bannie" className="ml-1.5 align-middle" />}
                </p>
                {o && (
                  <p className="text-[11px] lg:text-xs text-rift-400">
                    {s.card.might != null && (
                      <span title={tx('Puissance')} className="inline-flex items-center gap-0.5 px-1 mr-1.5 bg-[#4a1f1a] border border-[#e2463a]/50 text-[#ffb4a2] font-bold align-middle">
                        <Swords className="w-2.5 h-2.5" />{s.card.might}
                      </span>
                    )}
                    {o.inDeck} {tx('dans le deck ·')} {o.free} {tx('libre')}{o.free > 1 ? 's' : ''}
                    {o.missing > 0 && <span className="text-red-400"> · {o.missing} {tx('manquante')}{o.missing > 1 ? 's' : ''}</span>}
                  </p>
                )}
              </div>
              {movable && (
                <button onClick={() => toggleSide(s)} title={s.zone === 'side' ? tx('Remettre dans le deck') : tx('Mettre en réserve (sideboard)')}
                  className="h-9 px-2 bg-rift-800 border border-rift-600 flex items-center gap-1 text-[11px] text-rift-300">
                  {s.zone === 'side'
                    ? <><ArrowUpFromLine className="w-3.5 h-3.5" /> {tx('Deck')}</>
                    : <><ArrowDownToLine className="w-3.5 h-3.5" /> {tx('Réserve')}</>}
                </button>
              )}
              <div className="flex items-center gap-0.5">
                <button onClick={() => setQty(s.cardId, s.zone, s.quantity - 1)}
                  aria-label={last ? tx('Retirer la carte') : tx('Retirer un exemplaire')} title={last ? tx('Retirer la carte') : tx('Retirer un exemplaire')}
                  className={`w-9 h-9 bg-rift-800 border flex items-center justify-center ${last ? 'border-red-400/50 text-red-400' : 'border-rift-600 text-rift-200'}`}>
                  {last ? <Trash2 className="w-4 h-4" /> : <Minus className="w-3.5 h-3.5" />}
                </button>
                <span className="w-6 text-center text-sm font-mono text-rift-100">{s.quantity}</span>
                <button onClick={() => setQty(s.cardId, s.zone, s.quantity + 1)} aria-label={tx('Ajouter un exemplaire')}
                  className="w-9 h-9 bg-rift-800 border border-rift-600 flex items-center justify-center text-rift-200"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
        </div>
      </section>
    );
  };

  // Physical copies and other options: last on the phone, left column on the PC
  const copiesBlock = (
    <>
          <h3 className="font-display text-[14px] font-bold text-gold-400 pt-2">{tx('Mes exemplaires')}</h3>
          <div className="panel p-3 space-y-2">
            <p className="text-[13px] text-rift-200">
              <strong>{inThisDeck}</strong> {tx('exemplaire')}{inThisDeck > 1 ? 's' : ''} {tx('rangé')}{inThisDeck > 1 ? 's' : ''} {tx('dans ce deck')}
              {own.missing > 0
                ? <> · <span className="text-red-400">{tx('il manque')} {own.missing} {tx('carte')}{own.missing > 1 ? 's' : ''}</span> {tx('(ni dans le deck, ni libres)')}</>
                : <> · <span className="text-green-400">{tx('vous avez toutes les cartes')}</span></>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={assign} className="btn-primary text-xs py-1.5 px-3 rounded-xl">{tx('Mettre mes exemplaires libres dans ce deck')}</button>
              {inThisDeck > 0 && <button onClick={release} className="btn-ghost text-xs py-1.5 px-3 rounded-xl"><Undo2 className="w-3.5 h-3.5" /> {tx('Vider le deck')}</button>}
              {own.missing > 0 && <button onClick={wishMissing} className="btn-ghost text-xs py-1.5 px-3 rounded-xl"><Heart className="w-3.5 h-3.5" /> {tx('Manquantes → souhaits')}</button>}
              {own.missing > 0 && <CardmarketWantsButton items={ed.missingItems} label={tx('Manquantes → Cardmarket')} className="btn-ghost text-xs py-1.5 px-3 rounded-xl" />}
              {!activeLoan && lendable.length > 0 && (
                <button onClick={() => setDialog('lend')} className="btn-ghost text-xs py-1.5 px-3 rounded-xl"><UserCheck className="w-3.5 h-3.5" /> {tx('Prêter le deck')}</button>
              )}
            </div>
            {activeLoan && (
              <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 border border-sky-500/30 px-2.5 py-1.5 text-xs text-sky-200">
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <span className="mr-auto">{tx('Prêté à')} <strong>{people.byId.get(activeLoan.personId)?.name || '—'}</strong> {tx('depuis le')} {new Date(activeLoan.startedAt).toLocaleDateString(locale())}</span>
                <button onClick={giveBack} className="btn-ghost text-[11px] py-1 px-2 rounded-lg text-green-400"><Undo2 className="w-3 h-3" /> {tx('Rendu')}</button>
              </div>
            )}
            {money && (
              <p className="text-xs text-rift-300">
                {tx('Valeur du deck :')} <span className="font-semibold text-gold-400">{euro(money.value)}</span>
                {money.missingCost > 0 && <> {tx('· cartes manquantes :')} <span className="font-semibold text-red-300">{euro(money.missingCost)}</span></>}
                {money.unpriced > 0 && <span className="text-rift-500"> · {money.unpriced} {tx('sans prix')}</span>}
              </p>
            )}
            <p className="text-[11px] text-rift-500">{tx('« Libre » = exemplaire qui n’est dans aucun deck et n’est pas prêté (il peut être dans une boîte). Toutes impressions et langues d’une même carte comptent.')}</p>
          </div>
    </>
  );

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
      <div className="px-4 pt-4 pb-4 space-y-4 lg:px-8 lg:pt-6 lg:max-w-[1800px]">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg text-rift-300 hover:bg-rift-700" aria-label={tx('Retour')}><ArrowLeft className="w-5 h-5" /></button>
          <input
            value={deck.name}
            onChange={e => save({ name: e.target.value })}
            aria-label={tx('Nom du deck')}
            className="flex-1 min-w-0 h-11 px-2 bg-transparent border border-transparent hover:border-rift-600 font-display text-[19px] font-bold text-gold-400 focus:outline-none focus:border-gold-500/60"
          />
          <FormatChip value={check.format} onChange={(format) => save({ format })} />
          <DeckVersions deck={deck} matches={org.matches.items} onSave={(d) => save({ versions: d.versions })} />
        </div>
        <div className="seg" role="group" aria-label={tx('Vue du deck')}>
          <button aria-pressed={view === 'deck'} onClick={() => setView('deck')}>{tx('Deck')}</button>
          <button aria-pressed={view === 'opponents'} onClick={() => setView('opponents')}>{tx('Adversaires')}</button>
        </div>

        {view === 'opponents' ? (
          <OpponentNotes deck={deck} matches={org.matches.items} onSave={(d) => save({ opponents: d.opponents })} />
        ) : (<>

        {/* PC: two columns — legend, champion and rules on the left, cards on the right */}
        <div className="space-y-4 lg:space-y-0 lg:flex lg:gap-8 lg:items-start">
          <aside className="space-y-4 lg:w-[400px] xl:w-[440px] 2xl:w-[520px] lg:flex-shrink-0">
            {/* Legend + chosen champion, each rising out of its rift */}
            <div className="grid grid-cols-2 gap-3">
              <HeroStage
                label={tx('Légende')} icon={Crown} card={legend} legend
                sub={legend ? cardDomains(legend).map(domainLabel).join(' · ') : tx('Définit les 2 domaines du deck')}
                onPick={() => setPicker('legend')} onOpen={onOpen}
              />
              <HeroStage
                label={tx('Champion choisi')} icon={Star} card={champion}
                sub={legend ? tx('Unité « {legendChampion} »', { legendChampion: legendChampion(legend) }) : tx('Choisissez d’abord la Légende')}
                onPick={() => legend && setPicker('champion')} onOpen={onOpen} disabled={!legend}
              />
            </div>

            {/* Rules: counters + messages */}
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Deck', check.counts.main, RULES.mainMin, check.counts.main === RULES.mainMin ? 'ok' : check.counts.main > RULES.mainMin ? 'warn' : 'todo'],
                ['Runes', check.counts.rune, RULES.runes, check.counts.rune === RULES.runes ? 'ok' : 'todo'],
                ['Champs', check.counts.battlefield, RULES.battlefields, check.counts.battlefield === RULES.battlefields ? 'ok' : 'todo'],
              ].map(([label, n, max, st]) => (
                <div key={label} className="bg-rift-800 px-2.5 py-2 border-b-2" style={{ borderColor: st === 'ok' ? '#7fd6a4' : st === 'warn' ? '#f0c27a' : '#e8a33a' }}>
                  <p className="font-display text-lg font-bold text-rift-100 leading-tight">{n}<span className="text-[13px] text-rift-400">/{max}</span></p>
                  <p className="text-xs text-rift-400">{label}</p>
                </div>
              ))}
            </div>
            <DeckCheckBanner check={check} />

            <div className="hidden lg:block space-y-4">{copiesBlock}</div>
          </aside>
          <div className="flex-1 min-w-0 space-y-4">


            {/* Cards: choose where « Ajouter » puts them (deck or sideboard) */}
            <div className="space-y-2 lg:space-y-0 lg:flex lg:gap-3">
              <div className="seg lg:flex-1" role="group" aria-label={tx('Ajouter dans')}>
                <button aria-pressed={addTo === 'deck'} onClick={() => setAddTo('deck')}>{tx('Ajouter au deck')}</button>
                <button aria-pressed={addTo === 'side'} onClick={() => setAddTo('side')}>{tx('Ajouter en réserve')}</button>
              </div>
              <button onClick={() => setPicker('cards')} className="btn-primary w-full lg:w-auto lg:px-8 text-[15px] min-h-[48px]">
                <Plus className="w-4 h-4" /> {addTo === 'side' ? tx('Ajouter des cartes en réserve') : tx('Ajouter des cartes')}
              </button>
            </div>

            {ZONES.map(z => renderZone(z))}

            <DeckCurve deck={deck} />

            <textarea
              value={deck.note || ''}
              onChange={e => save({ note: e.target.value })}
              rows={2}
              placeholder={tx('Notes (stratégie, mulligan…)')}
              className="w-full bg-rift-800/50 border border-rift-600/30 rounded-xl text-xs text-rift-100 p-2 focus:outline-none focus:border-gold-500/60"
            />

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setDialog('export')} className="btn-ghost text-xs py-1.5 px-3 rounded-xl"><Share2 className="w-3.5 h-3.5" /> {tx('Partager')}</button>
              <button onClick={() => setDialog('hand')} className="btn-ghost text-xs py-1.5 px-3 rounded-xl"><HandIcon className="w-3.5 h-3.5" /> {tx('Main de départ')}</button>
              <button onClick={removeDeck} className="btn-ghost text-xs py-1.5 px-3 rounded-xl text-red-400"><Trash2 className="w-3.5 h-3.5" /> {tx('Supprimer le deck')}</button>
            </div>
            <div className="lg:hidden space-y-4">{copiesBlock}</div>
          </div>
        </div>
        </>)}
      </div>

      {dialog === 'export' && <ExportDeckDialog deck={deck} onClose={() => setDialog(null)} />}
      {dialog === 'hand' && <HandDialog deck={deck} onClose={() => setDialog(null)} />}
      {dialog === 'lend' && <LendDeckDialog deck={deck} count={lendable.length} people={people} onLend={lendDeck} onClose={() => setDialog(null)} />}
      {zoomId && (
        // above the « Ajouter » window (same z-index otherwise)
        <div className="relative z-[60]">
        <CardZoom cardId={zoomId} stacks={collection.stacks} wanted={wishlist.byCard.get(zoomId)?.quantity || 0}
          onSetWanted={wishlist.setWanted} onAddCopy={() => {}} onClose={() => setZoomId(null)}
          deckControls={deckZoomControls(ed, deck, ed.m.getCardData(zoomId), addTo === 'side' && picker === 'cards')} />
        </div>
      )}
      {picker === 'cards' && (
        <CardPicker title={tx('Ajouter à « {name} »', { name: deck.name })} legend={legend} ownedByCard={ownedByCard} countOf={countOf} onPick={addCard} onClose={() => setPicker(null)} onZoom={onOpen} />
      )}
      {picker === 'legend' && (
        <CardPicker title={tx('Choisir la Légende')} onlyType="legend" ownedByCard={ownedByCard} onPick={addCard} onClose={() => setPicker(null)} onZoom={onOpen} />
      )}
      {picker === 'champion' && (
        <ChampionPicker legend={legend} ownedByCard={ownedByCard} onPick={pickChampion} onClose={() => setPicker(null)} onZoom={onOpen} />
      )}
    </div>
  );
}

/** Legend / champion slot: the card alone, with its animation, big enough to read. */
function HeroStage({ label, icon: Icon, card, sub, onPick, onOpen, disabled, legend = false }) {
  const colors = (card ? cardDomains(card) : []).map(d => DOMAIN_COLORS[d]?.hex).filter(Boolean);
  if (!colors.length) colors.push(DOMAIN_COLORS.colorless.hex);
  return (
    <div className={`min-w-0 ${disabled ? 'opacity-50' : ''}`}>
      {card ? (
        <button onClick={() => onOpen(card.id)} className="block w-full px-1.5 pt-3 pb-3" aria-label={`Voir ${getLocalizedName(card, displayLanguage())}`}>
          <RiftCard key={card.id} colors={colors} legend={legend} plaque={legend ? tx('LÉGENDE') : null}>
            <HeroImage cardId={card.id} />
          </RiftCard>
        </button>
      ) : (
        <button onClick={onPick} disabled={disabled} style={{ aspectRatio: '744 / 1039' }}
          className="w-full flex flex-col items-center justify-center gap-2 bg-[#07060d] border border-dashed border-rift-600 text-rift-400">
          <Icon className="w-7 h-7" />
          <span className="text-xs">{tx('Choisir')}</span>
        </button>
      )}
      <div className="pt-1.5 text-center">
        <p className="text-[11px] text-rift-400 uppercase tracking-wider">{label}</p>
        <p className="text-[13px] font-semibold text-rift-100 truncate">{card ? getLocalizedName(card, displayLanguage()) : '—'}</p>
        <p className="text-[11px] text-rift-500 truncate">{sub}</p>
        {card && <button onClick={onPick} disabled={disabled} className="text-[11px] text-gold-400 hover:underline mt-0.5">{tx('Changer')}</button>}
      </div>
    </div>
  );
}

/** Full-size image (readable), thumbnail shown until it is loaded. */
function HeroImage({ cardId }) {
  const [src, setSrc] = useState(thumbSrc(cardId));
  useEffect(() => {
    const sources = [fullImageSrc(cardId), downloadedImageSrc(cardId)].filter(Boolean);
    const img = new Image();
    let i = 0;
    img.onload = () => setSrc(sources[i]);
    img.onerror = () => { if (++i < sources.length) img.src = sources[i]; };
    img.src = sources[0];
    return () => { img.onload = null; img.onerror = null; };
  }, [cardId]);
  return <img src={src} onError={e => handleImageError(e, cardId)} alt="" className="block w-full h-auto" />;
}

function ChampionPicker({ legend, ownedByCard, onPick, onClose, onZoom }) {
  const { inform } = useDialog();
  const options = getMatcher().cards
    .map(c => getMatcher().getCardData(c.id))
    .filter(c => c && isChampionFor(c, legend));
  return (
    <CardPicker
      title={tx('Choisir le champion « {legendChampion} »', { legendChampion: legendChampion(legend) })}
      onlyType="unit"
      initialQuery={legendChampion(legend) || ''}
      legend={legend}
      ownedByCard={ownedByCard}
      onPick={(c) => (options.some(o => o.id === c.id) ? onPick(c) : inform({ title: tx('Champion impossible'), message: tx('Le champion doit être une unité « {legendChampion} ».', { legendChampion: legendChampion(legend) }) }))}
      onZoom={onZoom}
      onClose={onClose}
    />
  );
}
