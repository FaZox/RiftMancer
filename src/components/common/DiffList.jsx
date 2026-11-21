import React, { useState } from 'react';
import { getCardThumbUrl } from '../../lib/cardMatcher.js';
import { tx } from '../../lib/i18n.js';

const OPS = {
  '+': { cls: 'text-state-ok', word: tx('ajouté') },
  '-': { cls: 'text-state-bad', word: tx('retiré') },
  '~': { cls: 'text-state-warn', word: tx('modifié') },
};

/**
 * What changes, before validating (B.2): « + » lines in state.ok, « − » in state.bad,
 * « ~ » in state.warn, 28 px card thumbnail, 8 lines visible then « et N autres ».
 * items: [{ op: '+' | '-' | '~', label, detail?, cardId? }]
 */
export default function DiffList({ items, max = 8 }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, max);
  return (
    <div className="panel">
      <ul>
        {shown.map((it, i) => {
          const o = OPS[it.op] || OPS['~'];
          return (
            <li key={`${it.op}${it.label}${i}`} className="flex items-center gap-3 px-3 py-2 border-b border-rift-700/60 last:border-b-0">
              <span className={`w-3 text-center font-bold ${o.cls}`} aria-label={o.word}>{it.op === '-' ? '−' : it.op}</span>
              {it.cardId !== undefined && (
                it.cardId
                  ? <img src={getCardThumbUrl(it.cardId)} alt="" className="w-[28px] h-[39px] object-cover flex-shrink-0" loading="lazy" />
                  : <span className="w-[28px] h-[39px] bg-rift-700 flex-shrink-0" aria-hidden="true" />
              )}
              <span className="flex-1 text-[14px] text-rift-100">{it.label}</span>
              {it.detail && <span className="text-[13px] text-rift-400">{it.detail}</span>}
            </li>
          );
        })}
      </ul>
      {items.length > max && !all && (
        <button type="button" onClick={() => setAll(true)} className="w-full min-h-[40px] text-[13px] font-semibold text-gold-400 hover:text-gold-300 border-t border-rift-700/60">
          {tx('et')} {items.length - max} {tx('autre')}{items.length - max > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
