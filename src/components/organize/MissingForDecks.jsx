import React, { useMemo } from 'react';
import { ArrowLeft, Heart, ExternalLink } from 'lucide-react';
import CardmarketWantsButton from '../common/CardmarketWantsButton.jsx';
import { cardmarketUrl } from '../../lib/cardmarket.js';
import CardImage from '../common/CardImage.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { cardKey, deckOwnership } from '../../lib/deckRules.js';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';
import { useBackHandler } from '../../lib/backButton.js';
import { useDialog } from '../common/Dialog.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * Cards missing to build every deck at once. A free copy (not in a deck, not
 * lent) is counted once for all decks, so the total is what you really need
 * to get.
 */
export default function MissingForDecks({ decks, copies, wishlist, onOpen, onBack }) {
  const { inform } = useDialog();
  useBackHandler(true, onBack);
  const { prices } = usePrices();

  const rows = useMemo(() => {
    const m = getMatcher();
    const by = new Map(); // card name → { cardId, need, inDecks, free, decks: [] }
    for (const d of decks.items) {
      const own = deckOwnership(d, copies);
      const firstId = new Map();
      for (const s of [...(d.cards || []), ...(d.legendId ? [{ cardId: d.legendId }] : [])]) {
        const k = cardKey(m.getCardData(s.cardId));
        if (k && !firstId.has(k)) firstId.set(k, s.cardId);
      }
      for (const [name, o] of own.byName) {
        const cur = by.get(name) || { cardId: firstId.get(name), need: 0, inDecks: 0, free: o.free, decks: [] };
        cur.need += o.need;
        cur.inDecks += o.inDeck;
        cur.free = o.free;
        if (o.missing > 0 || o.need > o.inDeck) cur.decks.push(d.name);
        by.set(name, cur);
      }
    }
    return [...by.values()]
      .map(r => ({ ...r, missing: Math.max(0, r.need - r.inDecks - r.free), cardData: m.getCardData(r.cardId) }))
      .filter(r => r.missing > 0 && r.cardData)
      .map(r => ({ ...r, price: unitPrice(prices, r.cardId) }))
      .sort((a, b) => (b.price || 0) * b.missing - (a.price || 0) * a.missing);
  }, [decks.items, copies, prices]);

  const total = rows.reduce((n, r) => n + r.missing, 0);
  const cost = rows.reduce((v, r) => v + (r.price || 0) * r.missing, 0);
  const addAll = () => {
    for (const r of rows) {
      const cur = wishlist.byCard.get(r.cardId)?.quantity || 0;
      wishlist.setWanted(r.cardId, Math.max(cur, r.missing));
    }
    inform({ title: tx('Souhaits'), message: tx('{length} carte{v1} ajoutée{v2} à la liste de souhaits.', { length: rows.length, v1: rows.length > 1 ? 's' : '', v2: rows.length > 1 ? 's' : '' }) });
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label={tx('Retour')} className="w-10 h-10 flex items-center justify-center text-rift-100"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="h-title text-[18px] flex-1">{tx('Ce qui me manque')}</h2>
        </div>
        <div className="panel p-3 space-y-2">
          <p className="text-sm text-rift-200">
            {total === 0
              ? tx('Vous avez toutes les cartes de tous vos decks.')
              : <>{tx('Il manque')} <strong className="text-rift-100">{total} {tx('carte')}{total > 1 ? 's' : ''}</strong> {tx('pour monter tous vos decks')}{prices && <> · ≈ <strong className="text-gold-400">{euro(cost)}</strong></>}</>}
          </p>
          {total > 0 && (
            <div className="flex flex-wrap gap-2 items-start">
              <button onClick={addAll} className="btn-primary text-sm"><Heart className="w-4 h-4" /> {tx('Tout ajouter aux souhaits')}</button>
              <CardmarketWantsButton items={rows.map(r => ({ cardData: r.cardData, quantity: r.missing }))} label={tx('Tout envoyer vers Cardmarket')} />
            </div>
          )}
          <p className="text-[11px] text-rift-500">{tx('Une carte libre (ni dans un deck, ni prêtée) compte une seule fois pour tous les decks.')}</p>
        </div>
        {rows.map(r => (
          <div key={r.cardId} className="flex items-stretch gap-2">
          <button onClick={() => onOpen(r.cardId)} className="flex-1 min-w-0 flex items-center gap-3 p-2 bg-rift-800 border border-rift-600 text-left">
            <span className={`flex-shrink-0 border border-rift-600/60 ${r.cardData.type === 'battlefield' ? 'w-14' : 'w-10'}`}><CardImage cardData={r.cardData} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-rift-100 truncate">{getLocalizedName(r.cardData, displayLanguage())}</span>
              <span className="block text-xs text-rift-400 truncate">{r.decks.join(', ')}</span>
            </span>
            <span className="text-right">
              <span className="block font-display font-bold text-[#ff8a80]">×{r.missing}</span>
              {r.price != null && <span className="block text-xs text-gold-400">{euro(r.price * r.missing)}</span>}
            </span>
          </button>
          {/* The card on Cardmarket, with the filters of Réglages (country, language, condition) */}
          <a href={cardmarketUrl(r.cardData)} target="_blank" rel="noreferrer" title={tx('Acheter sur Cardmarket')}
            className="w-14 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 bg-rift-800 border border-rift-600 text-gold-400 hover:border-gold-500/60 text-[11px]">
            <ExternalLink className="w-4 h-4" /> {tx('Acheter')}
          </a>
          </div>
        ))}
      </div>
    </div>
  );
}
