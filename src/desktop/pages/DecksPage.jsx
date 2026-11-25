import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileInput, Heart, CheckCircle, Crown, Swords } from 'lucide-react';
import { getPrefs } from '../../lib/uiPrefs.js';
import CardZoom from '../../components/collection/CardZoom.jsx';
import MissingForDecks from '../../components/organize/MissingForDecks.jsx';
import { ImportDeckDialog } from '../../components/organize/DeckDialogs.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import { validateDeck, deckOwnership, cardDomains } from '../../lib/deckRules.js';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';
import { DOMAIN_COLORS } from '../../data/sampleCards.js';
import { DeckWorkspace } from './DeckWorkspace.jsx';
import { takeRequest, onRequest } from '../../lib/navRequest.js';
import { tx } from '../../lib/i18n.js';

/**
 * PC decks. Home: every deck as a tile. Editor: the deck on the left (legend,
 * champion, rules, cards as pictures), the card catalog always open on the
 * right — click a card to add it.
 */
export default function DecksPage({ collection, org, wishlist, onAddCopy }) {
  const { decks } = org;
  const copies = collection.copies;
  const [openId, setOpenId] = useState(() => takeRequest('deck')?.id || null);
  // Global search: « open this deck » while this page is shown
  useEffect(() => onRequest((q) => { if (q.kind === 'deck') { takeRequest('deck'); setOpenId(q.id); } }), []);
  const [importing, setImporting] = useState(false);
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState(null);
  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const c of copies) m.set(c.cardId, (m.get(c.cardId) || 0) + 1);
    return m;
  }, [copies]);
  const open = openId && decks.byId.get(openId);

  const zoomView = zoom && (
    <CardZoom cardId={zoom} stacks={collection.stacks} byCard={wishlist.byCard}
      onSetWanted={wishlist.setWanted} onAddCopy={onAddCopy} onClose={() => setZoom(null)} />
  );

  if (missing) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <MissingForDecks decks={decks} copies={copies} wishlist={wishlist} onOpen={setZoom} onBack={() => setMissing(false)} />
        {zoomView}
      </div>
    );
  }
  if (open) {
    return (
      <>
        <DeckWorkspace deck={open} decks={decks} org={org} copies={copies} collection={collection} wishlist={wishlist}
          ownedByCard={ownedByCard} onBack={() => setOpenId(null)} />
        {zoomView}
      </>
    );
  }

  const create = () => {
    const d = decks.save({ name: `Deck ${decks.items.length + 1}`, legendId: null, championId: null, cards: [], note: '', format: getPrefs().gameFormat || 'standard' });
    setOpenId(d.id);
  };
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-7 pb-4 flex items-end gap-4 border-b border-gold-500/15">
        <div>
          <h1 className="h-title text-[28px] leading-none">{tx('Decks')}</h1>
          <p className="text-sm text-rift-400 mt-2">{decks.items.length} {tx('deck')}{decks.items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {decks.items.length > 0 && (
            <button onClick={() => setMissing(true)} className="btn-ghost h-10 px-4 text-sm"><Heart className="w-4 h-4" /> {tx('Ce qui me manque')}</button>
          )}
          <button onClick={() => setImporting(true)} className="btn-secondary h-10 px-4 text-sm"><FileInput className="w-4 h-4" /> {tx('Importer une liste')}</button>
          <button data-help="decks.new" onClick={create} className="btn-primary h-10 px-5 text-sm"><Plus className="w-4 h-4" /> {tx('Nouveau deck')}</button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        {decks.items.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <Swords className="w-12 h-12 text-rift-500 mx-auto" />
            <p className="font-display text-xl text-gold-400">{tx('Aucun deck')}</p>
            <p className="text-sm text-rift-400">{tx('Créez un deck, choisissez sa Légende puis ajoutez des cartes depuis le catalogue.')}</p>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {decks.items.map(d => <DeckTile key={d.id} deck={d} copies={copies} org={org} onOpen={() => setOpenId(d.id)} />)}
          </div>
        )}
      </div>
      {importing && (
        <ImportDeckDialog onClose={() => setImporting(false)}
          onImport={(d) => {
            const saved = decks.save({ note: '', ...d, name: d.name || `Deck ${decks.items.length + 1}` });
            setImporting(false);
            setOpenId(saved.id);
          }} />
      )}
    </div>
  );
}

function DeckTile({ deck, copies, org, onOpen }) {
  const check = validateDeck(deck);
  const own = deckOwnership(deck, copies);
  const { prices } = usePrices();
  let value = null;
  if (prices) {
    value = deck.legendId ? (unitPrice(prices, deck.legendId) || 0) : 0;
    for (const s of deck.cards || []) value += (unitPrice(prices, s.cardId) || 0) * s.quantity;
  }
  const color = check.legend ? DOMAIN_COLORS[cardDomains(check.legend)[0]]?.hex : null;
  const lent = org.loans.items.some(l => l.deckId === deck.id && !l.returnedAt);
  return (
    <button onClick={onOpen} className="text-left bg-rift-800/60 border border-rift-600/50 hover:border-gold-500/60 transition-colors flex flex-col">
      <div className="relative h-[190px] overflow-hidden flex items-end justify-center gap-3 pb-4"
        style={{ background: `radial-gradient(circle at 50% 100%, ${color || '#3a4258'}55, transparent 70%), #0b0f19` }}>
        {deck.legendId ? (
          <>
            <img src={thumbSrc(deck.legendId)} onError={e => handleImageError(e, deck.legendId)} alt="" loading="lazy" className="h-[150px] shadow-[0_8px_24px_rgba(0,0,0,.6)] -rotate-3" />
            {deck.championId && <img src={thumbSrc(deck.championId)} onError={e => handleImageError(e, deck.championId)} alt="" loading="lazy" className="h-[150px] shadow-[0_8px_24px_rgba(0,0,0,.6)] rotate-3" />}
          </>
        ) : <Crown className="w-12 h-12 text-rift-500 mb-12" />}
      </div>
      <div className="p-4 space-y-1.5">
        <p className="font-display text-lg font-bold text-gold-400 truncate">{deck.name}</p>
        <p className="text-sm text-rift-300 truncate">{check.legend ? getLocalizedName(check.legend, displayLanguage()) : tx('Pas de Légende')}</p>
        <p className="text-sm flex flex-wrap gap-x-2">
          {check.ok
            ? <span className="text-[#7fd6a4] flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {tx('Valide')}</span>
            : <span className="text-[#f0c27a]">{check.counts.main}/40 · {check.counts.rune}/12 · {check.counts.battlefield}/3</span>}
          {own.missing > 0 ? <span className="text-[#ff8a80]">{own.missing} {tx('manquante')}{own.missing > 1 ? 's' : ''}</span>
            : (deck.cards || []).length > 0 && <span className="text-[#7fd6a4]">{tx('montable')}</span>}
          {value != null && <span className="text-gold-400 font-semibold">{euro(value)}</span>}
          {lent && <span className="text-sky-300">{tx('prêté')}</span>}
        </p>
      </div>
    </button>
  );
}
