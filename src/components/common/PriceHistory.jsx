import React, { useState } from 'react';
import { cardHistory, priceChange, priceRef, hasFinishPrice, pct } from '../../lib/prices.js';
import { tx } from '../../lib/i18n.js';
import PriceChart from './PriceChart.jsx';

/** Change in %, coloured; « — » when unknown (unless unknown={null}: nothing). */
export function ChangeBadge({ value, label, unknown = '—' }) {
  if (value == null) {
    if (unknown == null) return null;
    return <span className="text-rift-500" title={tx('L’historique se remplit jour après jour')}>{label && `${label} `}{unknown}</span>;
  }
  const up = value > 0.5;
  const down = value < -0.5;
  return (
    <span className={up ? 'text-state-ok' : down ? 'text-state-bad' : 'text-rift-400'}>
      {label && <span className="text-rift-500">{label} </span>}{pct(value)}
    </span>
  );
}

/**
 * Price of a card over 1, 3, 6 months or all its history (PriceChart) +
 * 7/30-day change, from the app's own history only (B.6.5). `Normal | Foil`
 * switch when both prices exist.
 */
export default function PriceHistory({ prices, cardId }) {
  const hasNormal = hasFinishPrice(prices, cardId, false);
  const hasFoil = hasFinishPrice(prices, cardId, true);
  const [foilPick, setFoil] = useState(false);
  if (!hasNormal && !hasFoil) return null;
  const foil = hasNormal ? (hasFoil && foilPick) : true;
  const ref = priceRef();
  const pts = cardHistory(prices, cardId, ref, foil);
  const c7 = priceChange(prices, cardId, 7, ref, foil);
  const c30 = priceChange(prices, cardId, 30, ref, foil);

  return (
    <div className="panel px-3 py-2 space-y-1.5">
      {hasNormal && hasFoil && (
        <div className="seg w-full max-w-[220px]" role="tablist" aria-label={tx('Finition de la courbe')}>
          <button role="tab" aria-selected={!foil} onClick={() => setFoil(false)}>{tx('Normal')}</button>
          <button role="tab" aria-selected={foil} onClick={() => setFoil(true)}>{tx('Foil')}</button>
        </div>
      )}
      <p className="flex gap-3 text-[12px]">
        <span className="text-rift-400 mr-auto">{tx('Évolution du prix')}{!hasNormal ? ' foil' : ''}</span>
        <ChangeBadge value={c7} label="7 j" />
        <ChangeBadge value={c30} label="30 j" />
      </p>
      <PriceChart key={foil ? 'foil' : 'normal'} points={pts} height="h-24" label={foil ? tx('Prix foil') : tx('Prix')} />
    </div>
  );
}
