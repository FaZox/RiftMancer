// « Souhaits »: wish list with price alerts.
import React, { useState } from 'react';
import { Heart, Bell } from 'lucide-react';
import { usePrices, unitPrice, euro, priceChange, priceAlerts } from '../../lib/prices.js';
import { ChangeBadge } from '../common/PriceHistory.jsx';
import CardImage from '../common/CardImage.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { compareCollector } from '../../lib/catalog.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import CardmarketWantsButton from '../common/CardmarketWantsButton.jsx';
import { tx } from '../../lib/i18n.js';


// ─── Wish list ───────────────────────────────────────────────────────────
export function WishlistView({ ownedByCard, wishlist, onOpen }) {
  const matcher = getMatcher();
  const { prices } = usePrices();
  const alerts = priceAlerts(prices, wishlist.items);
  const items = wishlist.items
    .map(i => ({ ...i, cardData: matcher.getCardData(i.cardId) }))
    .filter(i => i.cardData)
    .sort((a, b) => compareCollector(a.cardData, b.cardData));
  const missing = items.filter(i => (ownedByCard.get(i.cardId) || 0) < i.quantity);
  const toBuy = prices
    ? missing.reduce((v, i) => v + (unitPrice(prices, i.cardId) || 0) * (i.quantity - (ownedByCard.get(i.cardId) || 0)), 0)
    : null;

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-help="wish.empty">
            <Heart className="w-10 h-10 text-rift-600 mb-3" />
            <p className="text-sm text-rift-400">{tx('Votre liste de souhaits est vide')}</p>
            <p className="text-xs text-rift-500 mt-1">{tx('Ouvrez une carte (Cartes ou Progression) et appuyez sur « Ajouter » dans Liste de souhaits')}</p>
          </div>
        ) : (
          <>
            {alerts.length > 0 && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-xs text-green-300 flex items-start gap-2">
                <Bell className="w-4 h-4 flex-shrink-0" />
                <span>{alerts.length} {tx('carte')}{alerts.length > 1 ? 's' : ''} {tx('sous votre prix d’alerte :')} {alerts.map(a => getLocalizedName(matcher.getCardData(a.cardId), displayLanguage())).join(', ')}.</span>
              </div>
            )}
            <p className="text-xs text-rift-400" data-help="wish.summary">
              {items.length} {tx('carte')}{items.length > 1 ? 's' : ''} {tx('souhaitée')}{items.length > 1 ? 's' : ''} · {missing.length} {tx('encore à obtenir')}
              {toBuy > 0 && <> {tx('· coût estimé')} <span className="font-semibold text-gold-400">{euro(toBuy)}</span></>}
            </p>
            <div data-help="wish.cardmarket"><CardmarketWantsButton label={tx('Envoyer vers mes souhaits Cardmarket')}
              items={missing.map(i => ({ cardData: i.cardData, quantity: i.quantity - (ownedByCard.get(i.cardId) || 0) }))} /></div>
            <div className="space-y-2">
              {items.map((i, ii) => {
                const owned = ownedByCard.get(i.cardId) || 0;
                const done = owned >= i.quantity;
                return (
                  <div key={i.id} className={`flex items-center gap-3 rounded-xl p-2 border ${done ? 'bg-green-500/5 border-green-500/20' : 'bg-rift-700/40 border-rift-600/20'}`}>
                    <button onClick={() => onOpen(i.cardData.id)} aria-label={tx('Voir la carte')} className="w-14 flex-shrink-0 self-start border border-rift-600/50 bg-rift-800">
                      <CardImage cardData={i.cardData} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-rift-100 truncate">{getLocalizedName(i.cardData, displayLanguage())}</p>
                      <p className="text-[11px] text-rift-400">{i.cardData.setName} · #{i.cardData.collectorNumber}</p>
                      <p className={`text-[11px] ${done ? 'text-green-400' : 'text-rift-300'}`}>
                        {done ? tx('Obtenue') : tx('Possédées {owned} / {quantity} voulues', { owned, quantity: i.quantity })}
                        {prices && unitPrice(prices, i.cardId) != null && <span className="text-gold-400"> · {euro(unitPrice(prices, i.cardId))} {tx('l’unité')}</span>}
                        {prices && <> <ChangeBadge value={priceChange(prices, i.cardId, 7)} label="· 7 j" unknown={null} /></>}
                      </p>
                      {!done && <span data-help={ii === 0 ? 'wish.alert' : undefined} className="inline-block"><AlertInput item={i} hit={alerts.includes(i)} onChange={(v) => wishlist.setMaxPrice(i.cardId, v)} /></span>}
                    </div>
                    <div className="flex items-center gap-1" data-help={ii === 0 ? 'wish.wanted' : undefined}>
                      <button onClick={() => wishlist.setWanted(i.cardId, i.quantity - 1)} className="w-7 h-7 rounded-lg bg-rift-800 text-rift-300">−</button>
                      <span className="w-6 text-center text-sm font-mono text-rift-100">{i.quantity}</span>
                      <button onClick={() => wishlist.setWanted(i.cardId, i.quantity + 1)} className="w-7 h-7 rounded-lg bg-rift-800 text-rift-300">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** "Alerte sous X €" field of a wish list item. */
export function AlertInput({ item, hit, onChange }) {
  const [text, setText] = useState(item.maxPrice ? String(item.maxPrice).replace('.', ',') : '');
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    const next = Number.isFinite(v) && v > 0 ? v : null;
    if ((next || null) !== (item.maxPrice || null)) onChange(next);
  };
  return (
    <label className={`mt-1 inline-flex items-center gap-1 text-[11px] rounded-lg border px-1.5 h-6 ${hit ? 'border-green-500/50 text-green-300 bg-green-500/10' : 'border-rift-600/40 text-rift-500'}`}
      title={tx('Être prévenu quand le prix Cardmarket passe sous ce montant')}>
      <Bell className="w-3 h-3" /> {tx('Alerte sous')}
      <input type="text" inputMode="decimal" value={text} placeholder="—" onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-10 bg-transparent text-right text-rift-100 focus:outline-none" />
      €{hit && ' · atteint !'}
    </label>
  );
}
