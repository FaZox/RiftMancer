import React, { memo } from 'react';
import { Minus, Plus, Trash2, Sparkles } from 'lucide-react';
import CardImage from '../common/CardImage.jsx';
import { CONDITIONS, LANGUAGES, isFoilOnly } from '../../data/sampleCards.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';
import { printingsOf, rememberPrinting } from '../../lib/printingChoice.js';
import { printingLabel } from '../../lib/variants.js';


/**
 * A scanned card waiting in « À ajouter »: only what matters before adding
 * it — quantity, condition, foil, delete. No description. An artwork printed
 * in several sets shows them (« Même illustration »): one tap changes the
 * printing, remembered for the next scans (printingChoice.js).
 */
const PendingRow = memo(function PendingRow({ card, index, onUpdate, onRemove }) {
  const { cardData, quantity, condition, foil, language } = card;
  const foilOnly = isFoilOnly(cardData);
  const lang = LANGUAGES.find(l => l.value === language)?.short || 'EN';
  const set = (patch) => onUpdate(index, patch);
  const printings = printingsOf(cardData.id);
  const choose = (p) => { if (p.id === cardData.id) return; rememberPrinting(printings, p.id); set({ cardData: p }); };

  return (
    <div className="flex items-center gap-2.5 p-2 bg-rift-800 border border-rift-600">
      <span className="w-11 flex-shrink-0 border border-rift-600/60"><CardImage cardData={cardData} /></span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[14px] font-semibold text-rift-100 truncate">{getLocalizedName(cardData, displayLanguage(language))}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-rift-400">#{cardData.collectorNumber}</span>
          <button
            onClick={() => set({ language: language === 'French' ? 'English' : 'French' })}
            aria-label={tx('Langue : {lang} (toucher pour changer)', { lang })}
            className="h-8 w-10 bg-rift-900 border border-rift-600 text-xs font-bold text-gold-400"
          >
            {lang}
          </button>
          <select
            value={condition}
            onChange={(e) => set({ condition: e.target.value })}
            aria-label={tx('État')}
            className="h-8 px-1.5 bg-rift-900 border border-rift-600 text-xs text-rift-100 focus:outline-none focus:border-gold-500/60"
          >
            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.short}</option>)}
          </select>
          <button
            onClick={() => !foilOnly && set({ foil: !foil })}
            disabled={foilOnly}
            aria-pressed={foil || foilOnly}
            title={foilOnly ? tx('Toujours foil') : tx('Foil')}
            className={`h-8 px-2 flex items-center gap-1 border text-xs font-semibold ${foil || foilOnly ? 'bg-purple-500/20 border-purple-400/60 text-purple-300' : 'bg-rift-900 border-rift-600 text-rift-400'}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> {tx('Foil')}
          </button>
        </div>
        {printings.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={tx('Même illustration :')}>
            <span className="text-[11px] text-rift-400">{tx('Même illustration :')}</span>
            {printings.map(p => (
              <button key={p.id} onClick={() => choose(p)} aria-pressed={p.id === cardData.id}
                className={`h-7 px-2 text-[11px] font-semibold border ${p.id === cardData.id ? 'bg-gold-500/20 border-gold-400 text-gold-400' : 'bg-rift-900 border-rift-600 text-rift-200'}`}>
                {printingLabel(p)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center">
        <button onClick={() => (quantity > 1 ? set({ quantity: quantity - 1 }) : onRemove(index))} aria-label={tx('Retirer un exemplaire')}
          className="w-9 h-9 bg-rift-900 border border-rift-600 flex items-center justify-center text-rift-200"><Minus className="w-4 h-4" /></button>
        <span className="w-8 text-center font-display font-bold text-rift-100">{quantity}</span>
        <button onClick={() => set({ quantity: quantity + 1 })} aria-label={tx('Ajouter un exemplaire')}
          className="w-9 h-9 bg-rift-900 border border-rift-600 flex items-center justify-center text-rift-200"><Plus className="w-4 h-4" /></button>
      </div>
      <button onClick={() => onRemove(index)} aria-label={tx('Supprimer')} className="w-9 h-9 flex items-center justify-center text-[#ff8a80]"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
});

export default PendingRow;
