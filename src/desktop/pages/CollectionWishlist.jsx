// PC collection: wish list table with alerts and Cardmarket links.
import React from 'react';
import { Trash2, Minus, Plus } from 'lucide-react';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { euro, priceChange, unitPrice, usePrices, priceAlerts } from '../../lib/prices.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { compareCollector } from '../../lib/catalog.js';
import { cardmarketUrl } from '../../lib/cardmarket.js';
import CardmarketWantsButton from '../../components/common/CardmarketWantsButton.jsx';
import { ChangeBadge } from '../../components/common/PriceHistory.jsx';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import { AlertInput } from '../../components/collection/CollectionTab.jsx';
import { tx } from '../../lib/i18n.js';


// ─── Wish list (PC): same layout as the collection table ───────────────────
export function WishlistPanel({ ownedByCard, wishlist, onOpen }) {
  const { prices } = usePrices();
  const matcher = getMatcher();
  const alerts = priceAlerts(prices, wishlist.items);
  const items = wishlist.items
    .map(i => ({ ...i, cardData: matcher.getCardData(i.cardId) }))
    .filter(i => i.cardData)
    .sort((a, b) => compareCollector(a.cardData, b.cardData));
  const rows = items.map(i => {
    const owned = ownedByCard.get(i.cardId) || 0;
    const unit = prices ? unitPrice(prices, i.cardId) : null;
    const missing = Math.max(0, i.quantity - owned);
    return { ...i, owned, unit, missing, cost: unit != null ? unit * missing : null, totalCost: unit != null ? unit * i.quantity : null };
  });
  const toGet = rows.filter(r => r.missing > 0);
  const cost = toGet.reduce((v, r) => v + (r.cost || 0), 0);
  const totalWishlistCost = rows.reduce((v, r) => v + (r.totalCost || 0), 0);
  const th = 'sticky top-0 z-10 bg-rift-900 text-left text-xs font-semibold uppercase tracking-wider text-rift-400 py-2.5 px-2 border-b border-gold-500/30';
  const td = 'py-2 px-2 border-b border-rift-700/70 align-middle';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 px-8 h-14 flex items-center gap-3 border-b border-rift-600/30">
        <p className="text-sm text-rift-300" data-help="wish.summary">
          {items.length} {tx('carte')}{items.length > 1 ? 's' : ''} {tx('souhaitée')}{items.length > 1 ? 's' : ''} · <span className="text-rift-100 font-semibold">{toGet.length}</span> {tx('encore à obtenir')}
          {cost > 0 && <> {tx('· coût estimé à obtenir')} <span className="font-semibold text-gold-400">{euro(cost)}</span></>}
          {totalWishlistCost > 0 && <> {tx('· total wishlist')} <span className="font-semibold text-gold-400">{euro(totalWishlistCost)}</span></>}
        </p>
        <span className="ml-auto" />
        <span data-help="wish.cardmarket"><CardmarketWantsButton label={tx('Envoyer vers mes souhaits Cardmarket')} className="btn-secondary h-9 px-3 text-sm"
          items={toGet.map(r => ({ cardData: r.cardData, quantity: r.missing }))} /></span>
      </div>
      {alerts.length > 0 && (
        <p className="mx-8 mt-4 px-4 py-2.5 text-sm text-[#7fd6a4] border border-[#7fd6a4]/40 bg-[#7fd6a4]/5">
          {alerts.length} {tx('carte')}{alerts.length > 1 ? 's' : ''} {tx('sous votre prix d’alerte :')} {alerts.map(a => getLocalizedName(matcher.getCardData(a.cardId), displayLanguage())).join(', ')}.
        </p>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-5">
        {items.length === 0 ? (
          <div className="py-24 text-center space-y-2" data-help="wish.empty">
            <p className="font-display text-xl text-gold-400">{tx('Votre liste de souhaits est vide')}</p>
            <p className="text-sm text-rift-400">{tx('Ouvrez une carte (Mes cartes, Progression ou un deck) et cliquez sur ♡ pour l’ajouter.')}</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-14`} />
                <th className={th}>{tx('Carte')}</th>
                <th className={th}>{tx('Extension')}</th>
                <th className={`${th} text-center`}>{tx('Voulues')}</th>
                <th className={`${th} text-center`}>{tx('Possédées')}</th>
                <th className={`${th} text-right`}>{tx('Prix')}</th>
                <th className={`${th} text-right`}>{tx('7 jours')}</th>
                <th className={`${th} text-right`}>{tx('À acheter')}</th>
                <th className={th}>{tx('Alerte prix')}</th>
                <th className={`${th} w-28`} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const d = r.cardData;
                const done = r.missing === 0;
                return (
                  <tr key={r.id} className={`hover:bg-rift-800/60 ${done ? 'opacity-70' : ''}`}>
                    <td className={td}>
                      <button onClick={() => onOpen(d.id)} className="block w-10 h-14 overflow-hidden bg-rift-800" title={tx('Voir en grand')}>
                        <img src={thumbSrc(d.id)} onError={e => handleImageError(e, d.id)} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    </td>
                    <td className={td}>
                      <button onClick={() => onOpen(d.id)} className="text-left hover:text-gold-400">
                        <span className="block font-semibold text-rift-100">{getLocalizedName(d, displayLanguage())}</span>
                        {done && <span className="block text-xs text-[#7fd6a4]">{tx('Obtenue')}</span>}
                      </button>
                    </td>
                    <td className={`${td} text-rift-300 whitespace-nowrap`}>{d.setName || d.set} <span className="text-rift-500 font-mono">#{d.collectorNumber}</span></td>
                    <td className={td}>
                      <div className="flex items-center justify-center" data-help={ri === 0 ? 'wish.wanted' : undefined}>
                        <button onClick={() => wishlist.setWanted(r.cardId, r.quantity - 1)} aria-label={tx('Un de moins')}
                          className="w-8 h-8 bg-rift-800 border border-rift-600 flex items-center justify-center text-rift-200 hover:border-gold-500/50"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-9 text-center font-mono text-rift-100">{r.quantity}</span>
                        <button onClick={() => wishlist.setWanted(r.cardId, r.quantity + 1)} aria-label={tx('Un de plus')}
                          className="w-8 h-8 bg-rift-800 border border-rift-600 flex items-center justify-center text-rift-200 hover:border-gold-500/50"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className={`${td} text-center ${done ? 'text-[#7fd6a4]' : 'text-rift-200'}`}>{r.owned}</td>
                    <td className={`${td} text-right font-mono text-rift-200`}>{r.unit != null ? euro(r.unit) : '—'}</td>
                    <td className={`${td} text-right`}>{prices && <ChangeBadge value={priceChange(prices, r.cardId, 7)} />}</td>
                    <td className={`${td} text-right font-semibold ${r.missing ? 'text-gold-400' : 'text-rift-500'}`}>
                      {r.missing ? <>{r.missing} {tx('exemplaire')}{r.missing > 1 ? 's' : ''}{r.cost != null && <> · {euro(r.cost)}</>}</> : '—'}
                    </td>
                    <td className={td} data-help={ri === 0 && !done ? 'wish.alert' : undefined}>{!done && <AlertInput item={r} hit={alerts.some(a => a.cardId === r.cardId)} onChange={(v) => wishlist.setMaxPrice(r.cardId, v)} />}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <a href={cardmarketUrl(d)} target="_blank" rel="noreferrer" className="text-sm text-gold-400 hover:underline mr-3">{tx('Acheter')}</a>
                      <button onClick={() => wishlist.setWanted(r.cardId, 0)} aria-label={tx('Retirer {getLocalizedName} des souhaits', { getLocalizedName: getLocalizedName(d, displayLanguage()) })} title={tx('Retirer des souhaits')}
                        className="w-8 h-8 inline-flex items-center justify-center text-rift-500 hover:text-[#ff8a80]"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
