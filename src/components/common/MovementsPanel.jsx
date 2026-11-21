import React, { useMemo } from 'react';
import { usePrices, priceRef } from '../../lib/prices.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import { movements, moveLine, wishLine } from '../../lib/priceMoves.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import StatusPill from './StatusPill.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * « Mouvements » (B.6.6, lot 9): the cards you own that moved past your
 * threshold over 7 days, and the wish list alerts. Shown only when there is
 * something; each line opens the card.
 */
export default function MovementsPanel({ scannedCards, wishItems = [], onOpen, className = '' }) {
  const { prices } = usePrices();
  const [prefs] = usePrefs();
  const mv = useMemo(
    () => movements(prices, scannedCards, wishItems, prefs, priceRef()),
    [prices, scannedCards, wishItems, prefs],
  );
  const count = mv.up.length + mv.down.length + mv.wish.length;
  if (!prices || !count) return null;
  const matcher = getMatcher();
  const name = (cardData) => getLocalizedName(cardData, displayLanguage());
  const Line = ({ sign, tone, text, cardId, foil }) => (
    <li>
      <button onClick={() => onOpen(cardId)} className="w-full flex items-center gap-2 py-1.5 text-left text-[13px] text-rift-200 hover:text-rift-100">
        <span className={`w-4 flex-shrink-0 text-center ${tone}`} aria-hidden="true">{sign}</span>
        <span className="truncate">{text}</span>
        {foil && <StatusPill kind="foil" />}
      </button>
    </li>
  );
  return (
    <section className={`panel p-4 space-y-1 ${className}`} aria-label={tx('Mouvements de prix')}>
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Mouvements')}</h3>
        <span className="ml-auto text-[11px] text-rift-400">
          {prefs.priceAlertPct > 0 ? `± ${prefs.priceAlertPct} % en 7 jours, cartes de plus de ${String(prefs.priceAlertMin).replace('.', ',')} €` : tx('alertes sur vos cartes coupées')}
        </span>
      </div>
      <ul className="divide-y divide-rift-600/30">
        {mv.up.map(m => <Line key={m.key} sign="▲" tone="text-state-ok" text={moveLine(m, name(m.cardData))} cardId={m.cardData.id} foil={m.foil} />)}
        {mv.down.map(m => <Line key={m.key} sign="▼" tone="text-state-bad" text={moveLine(m, name(m.cardData))} cardId={m.cardData.id} foil={m.foil} />)}
        {mv.wish.map(w => {
          const cardData = matcher.getCardData(w.cardId);
          if (!cardData) return null;
          return <Line key={`wish-${w.cardId}`} sign="◆" tone="text-gold-400" text={wishLine(w, name(cardData))} cardId={w.cardId} />;
        })}
      </ul>
    </section>
  );
}
