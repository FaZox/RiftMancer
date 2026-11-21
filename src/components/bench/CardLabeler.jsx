import React, { useState } from 'react';
import { Check, Pencil, Ban } from 'lucide-react';
import CardImage from '../common/CardImage.jsx';
import CardChooser from './CardChooser.jsx';
import { LEVEL_LABEL } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';

const LEVEL_STYLE = {
  sure: 'text-[#7fd6a4] border-[#7fd6a4]/60',
  probable: 'text-[#f0c27a] border-[#f0c27a]/60',
  uncertain: 'text-[#ff8a80] border-[#ff8a80]/60',
};

/**
 * The scanner's proposal for one card and the user's decision (golden rule:
 * nothing is saved without it): « ✓ Confirmer » or « Corriger » (candidates,
 * search, or a code missing from the catalog). `onDecide(choice)` with
 * choice = { cardData } | { freeCode }. `onReject`: « Ce n'est pas une
 * carte » (grids only).
 */
export default function CardLabeler({ det, number, onDecide, onReject, busy = false }) {
  const [correcting, setCorrecting] = useState(false);
  const s = det.scanner;
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {det.crop && <img src={det.crop} alt={tx('Carte vue par le scanner')} className="w-24 sm:w-28 flex-shrink-0 border border-rift-600 object-contain bg-rift-900" />}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-rift-400">{number ? tx('Carte {number} · ', { number }) : ''}{tx('Proposition du scanner')}</p>
          {s ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-12 flex-shrink-0 border border-rift-600"><CardImage cardData={s.cardData} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-rift-100 leading-tight">{getLocalizedName(s.cardData, displayLanguage())}</span>
                  <span className="block text-xs text-rift-400">{s.key}{det.similarity != null ? ` · ${Math.round(det.similarity * 100)} %` : ''}</span>
                </span>
              </div>
              {det.level && (
                <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold border ${LEVEL_STYLE[det.level] || ''}`}>{LEVEL_LABEL[det.level] || det.level}</span>
              )}
            </>
          ) : (
            <p className="text-sm text-[#ff8a80]">{tx('Carte non reconnue : choisissez-la.')}</p>
          )}
          {det.level && det.level !== 'sure' && (
            <p className="text-[11px] text-rift-400">{tx('Le scanner hésite : cette photo est précieuse pour le banc, gardez-la.')}</p>
          )}
        </div>
      </div>
      <div className={`grid ${onReject ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <button onClick={() => onDecide({ cardData: s.cardData })} disabled={!s || busy}
          className="btn-primary text-sm min-h-[48px] disabled:opacity-40"><Check className="w-4 h-4" /> {tx('Confirmer')}</button>
        <button onClick={() => setCorrecting(true)} disabled={busy}
          className="btn-secondary text-sm min-h-[48px] !text-[#f0c27a] !border-[#f0c27a]/50"><Pencil className="w-4 h-4" /> {tx('Corriger')}</button>
        {onReject && (
          <button onClick={onReject} disabled={busy} className="btn-ghost text-xs min-h-[48px] border border-rift-600"><Ban className="w-4 h-4" /> {tx('Pas une carte')}</button>
        )}
      </div>
      {correcting && (
        <CardChooser
          candidates={det.candidates || []}
          initialQuery={s?.cardData?.name || ''}
          onChoose={(choice) => { setCorrecting(false); onDecide(choice); }}
          onCancel={() => setCorrecting(false)}
        />
      )}
    </div>
  );
}
