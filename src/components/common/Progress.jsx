import React from 'react';
import { tx } from '../../lib/i18n.js';

/**
 * Operation in steps (B.2): diamonds joined by a line — done (solid gold), current
 * (gold outline, pulsing), to come (rift-600) — with the label under each diamond.
 */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-start" aria-label={tx('Étapes')}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={label} className="flex-1 flex flex-col items-center relative" aria-current={state === 'current' ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`absolute top-[9px] right-1/2 w-full h-[2px] ${i <= current ? 'bg-gold-500' : 'bg-rift-600'}`} />}
            <span aria-hidden="true"
              className={`relative w-[14px] h-[14px] rotate-45 mt-[3px] ${state === 'done' ? 'bg-gold-500' : state === 'current' ? 'border-2 border-gold-400 bg-rift-800 motion-safe:animate-pulse' : 'border-2 border-rift-600 bg-rift-800'}`} />
            <span className={`mt-2 text-[12px] text-center ${state === 'current' ? 'text-gold-400 font-semibold' : 'text-rift-400'}`}>
              {label}{state === 'done' && <span className="sr-only"> {tx('(fait)')}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Download progress (B.2): 4 px gold bar on rift-700, « 34 / 120 images », « Annuler » button.
 * `total` null: length unknown (a page being read) — moving bar, the text alone.
 */
export function ProgressRow({ done, total, unit = '', onCancel, cancelLabel = tx('Annuler') }) {
  const unknown = total == null;
  const pct = !unknown && total > 0 ? Math.min(100, (100 * done) / total) : 0;
  return (
    <div>
      <div className="h-1 bg-rift-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={unknown ? undefined : total} aria-valuenow={unknown ? undefined : done}>
        {unknown
          ? <div className="h-1 w-1/3 bg-gold-500 animate-pulse" />
          : <div className="h-1 bg-gold-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[13px] text-rift-400">
        <span>{unknown ? unit : `${done} / ${total}${unit ? ` ${unit}` : ''}`}</span>
        {onCancel && <button type="button" onClick={onCancel} className="font-semibold text-gold-400 hover:text-gold-300 min-h-[36px] px-1">{cancelLabel}</button>}
      </div>
    </div>
  );
}

export default Stepper;
