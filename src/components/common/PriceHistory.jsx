import React, { useState } from 'react';
import { cardHistory, priceChange, priceRef, hasFinishPrice, pct, euro } from '../../lib/prices.js';
import { tx, locale } from '../../lib/i18n.js';

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
 * Price of a card over the last month (line) + 7/30-day change, from the app's
 * own history only (B.6.5). `Normal | Foil` switch when both prices exist.
 */
export default function PriceHistory({ prices, cardId }) {
  const hasNormal = hasFinishPrice(prices, cardId, false);
  const hasFoil = hasFinishPrice(prices, cardId, true);
  const [foilPick, setFoil] = useState(false);
  if (!hasNormal && !hasFoil) return null;
  const foil = hasNormal ? (hasFoil && foilPick) : true;
  const ref = priceRef();
  const pts = cardHistory(prices, cardId, ref, foil, 31);
  const c7 = priceChange(prices, cardId, 7, ref, foil);
  const c30 = priceChange(prices, cardId, 30, ref, foil);

  const W = 300; const H = 60; const pad = 4;
  let chart = null;
  if (pts.length >= 2) {
    const vs = pts.map(p => p.v);
    const min = Math.min(...vs); const max = Math.max(...vs);
    const span = max - min || 1;
    const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
    const y = (v) => H - pad - ((v - min) * (H - 2 * pad)) / span;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" role="img" aria-label={tx('Prix {v0}sur le dernier mois', { v0: foil ? 'foil ' : '' })}>
        <path d={d} fill="none" stroke="#c8a84e" strokeWidth="2" />
      </svg>
    );
  }

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
      {chart}
      {(c7 == null || c30 == null || !chart) && <p className="text-[11px] text-rift-500">{tx('L’historique se remplit jour après jour.')}</p>}
      {pts.length >= 2 && (
        <p className="flex text-[11px] text-rift-500">
          <span className="mr-auto">{new Date(pts[0].d).toLocaleDateString(locale())} · {euro(pts[0].v)}</span>
          <span>{new Date(pts[pts.length - 1].d).toLocaleDateString(locale())} · {euro(pts[pts.length - 1].v)}</span>
        </p>
      )}
    </div>
  );
}
