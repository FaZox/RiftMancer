import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import CardImage from '../common/CardImage.jsx';
import CardPicker from '../organize/CardPicker.jsx';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { normalizeFreeCode } from '../../lib/bench/benchFormat.js';
import { useBackHandler } from '../../lib/backButton.js';
import { tx } from '../../lib/i18n.js';

const EMPTY = new Map();

/**
 * Choosing the right card (MODULE-BANC.md 2.1 « Corriger »): one of the
 * scanner's candidates, a search by name (FR / EN) or code, or a code typed
 * by hand for a card missing from the catalog (« SFD-T02 »).
 * `onChoose({ cardData } | { freeCode })`.
 */
export default function CardChooser({ title = tx('Quelle est la bonne carte ?'), candidates = [], initialQuery = '', onChoose, onCancel }) {
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  useBackHandler(!searching, onCancel);

  const applyCode = () => {
    const c = normalizeFreeCode(code);
    if (!c) { setCodeError(tx('Code attendu : extension, tiret, numéro (ex. SFD-T02).')); return; }
    onChoose({ freeCode: c });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-rift-900/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg bg-rift-800 border border-rift-600 p-4 space-y-3 max-h-full overflow-y-auto">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-rift-100 mr-auto">{title}</h3>
          <button onClick={onCancel} aria-label={tx('Fermer')} className="p-2 text-rift-400 hover:text-rift-100"><X className="w-5 h-5" /></button>
        </div>
        {candidates.length > 0 && (
          <div>
            <p className="text-xs text-rift-400 mb-1.5">{tx('Candidats du scanner :')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {candidates.map(c => (
                <button key={c.id} onClick={() => onChoose({ cardData: c })} title={getLocalizedName(c, displayLanguage())}
                  className="relative border border-rift-600 hover:border-gold-400">
                  <CardImage cardData={c} />
                  {c.similarity != null && (
                    <span className="absolute bottom-0 inset-x-0 bg-rift-900/80 text-[11px] text-rift-200 text-center leading-tight py-px">{Math.round(c.similarity * 100)} %</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setSearching(true)} className="btn-secondary w-full text-sm min-h-[44px]"><Search className="w-4 h-4" /> {tx('Chercher par nom ou code')}</button>
        <div className="space-y-1.5">
          <label className="text-xs text-rift-400 block" htmlFor="bench-free-code">{tx('Carte absente du catalogue : son code imprimé')}</label>
          <div className="flex gap-2">
            <input id="bench-free-code" value={code} onChange={e => { setCode(e.target.value); setCodeError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') applyCode(); }}
              placeholder="SFD-T02" autoCapitalize="characters" spellCheck={false}
              className="flex-1 h-11 px-3 bg-rift-900/60 border border-rift-600/50 text-sm text-rift-100 placeholder-rift-500 uppercase focus:outline-none focus:border-gold-500/60" />
            <button onClick={applyCode} disabled={!code.trim()} className="btn-secondary text-sm px-4 min-h-[44px] disabled:opacity-40">{tx('Utiliser')}</button>
          </div>
          {codeError && <p className="text-xs text-[#ff8a80]">{codeError}</p>}
        </div>
      </div>
      {searching && (
        <CardPicker title={title} initialQuery={initialQuery} ownedByCard={EMPTY}
          onPick={(c) => { setSearching(false); onChoose({ cardData: c }); }}
          onClose={() => setSearching(false)} />
      )}
    </div>
  );
}
