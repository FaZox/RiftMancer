import React, { useMemo, useRef, useState } from 'react';
import { CHART_RANGES, rangePoints, rangeFull, chartGeometry, nearestPoint, rangeChange } from '../../lib/priceChart.js';
import { euro, pct } from '../../lib/prices.js';
import { tx, locale } from '../../lib/i18n.js';

const rangeLabel = () => ({ '1m': tx('1 mois'), '3m': tx('3 mois'), '6m': tx('6 mois'), all: tx('Tout') });
const date = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale());

/**
 * Price curve over 1, 3, 6 months or all of the history, on a time scale
 * (src/lib/priceChart.js): prices at the left, dates below, change over the
 * period, and the price of a day under the finger or the mouse. Used by the
 * card sheet (PriceHistory) and by Value (phone and PC).
 *   points  [{ d: 'YYYY-MM-DD', v }]
 *   height  Tailwind height of the drawing ('h-28')
 *   showChange  change over the period (not for the collection value: it grows with the cards added)
 */
export default function PriceChart({ points, label, height = 'h-28', empty = tx('L’historique se remplit jour après jour.'), defaultRange = '1m', showChange = true }) {
  const [range, setRange] = useState(defaultRange);
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const all = useMemo(() => (points || []).filter(p => p?.v != null), [points]);
  const pts = useMemo(() => rangePoints(all, range), [all, range]);
  const g = useMemo(() => chartGeometry(pts), [pts]);
  const change = showChange ? rangeChange(pts) : null;
  const labels = rangeLabel();

  const move = (e) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setHover(nearestPoint(pts, (e.clientX - r.left) / r.width));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="seg flex-1 min-w-[200px] max-w-[320px]" role="tablist" aria-label={tx('Période de la courbe')}>
          {CHART_RANGES.map(([k]) => (
            <button key={k} role="tab" aria-selected={range === k} onClick={() => { setRange(k); setHover(null); }}>{labels[k]}</button>
          ))}
        </div>
        {change != null && (
          <span className={`text-[12px] ml-auto ${change > 0.5 ? 'text-state-ok' : change < -0.5 ? 'text-state-bad' : 'text-rift-400'}`}>
            <span className="text-rift-500">{tx('Sur la période')} </span>{pct(change)}
          </span>
        )}
      </div>
      {!g ? (
        <div className={`${height} flex items-center justify-center text-[12px] text-rift-500 border border-dashed border-rift-600 px-3 text-center`}>
          {all.length >= 2 ? tx('Pas assez de prix sur cette période.') : empty}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className={`${height} flex flex-col justify-between text-[11px] text-rift-400 text-right w-14 shrink-0`}>
            <span>{euro(g.max)}</span><span>{euro(g.min)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              ref={box}
              className={`relative ${height} border-l border-b border-rift-600 touch-none`}
              onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}
            >
              {[25, 50, 75].map(t => <div key={t} className="absolute inset-x-0 border-t border-rift-700/70" style={{ top: `${t}%` }} />)}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" role="img"
                aria-label={tx('{label} du {from} au {to} : de {a} à {b}', { label, from: date(pts[0].d), to: date(pts[pts.length - 1].d), a: euro(pts[0].v), b: euro(pts[pts.length - 1].v) })}>
                <path d={g.area} fill="rgba(200,168,78,0.14)" />
                <path d={g.line} fill="none" stroke="#c8a84e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              {hover && (
                <>
                  <div className="absolute inset-y-0 border-l border-gold-300/70 pointer-events-none" style={{ left: `${g.x(hover)}%` }} />
                  <div className="absolute w-2 h-2 -ml-1 -mt-1 bg-gold-300 pointer-events-none" style={{ left: `${g.x(hover)}%`, top: `${g.y(hover)}%` }} />
                  <div className={`absolute top-0 px-1.5 py-0.5 text-[11px] bg-rift-900/90 border border-rift-600 text-rift-100 pointer-events-none whitespace-nowrap ${g.x(hover) > 60 ? '-translate-x-full -ml-1' : 'ml-1'}`}
                    style={{ left: `${g.x(hover)}%` }}>
                    {date(hover.d)} · <span className="text-gold-300">{euro(hover.v)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between text-[11px] text-rift-400 pt-1">
              <span>{date(pts[0].d)}</span><span>{date(pts[pts.length - 1].d)}</span>
            </div>
          </div>
        </div>
      )}
      {all.length > 0 && !rangeFull(all, range) && (
        <p className="text-[11px] text-rift-500">{tx('Prix gardés depuis le {d} : la courbe s’allonge jour après jour.', { d: date(all[0].d) })}</p>
      )}
    </div>
  );
}
