import React, { useState } from 'react';
import { Minus, Plus, Sparkles } from 'lucide-react';
import { LANGUAGES, isFoilOnly } from '../../data/sampleCards.js';
import { CONDITIONS } from '../../lib/conditions.js';
import { displayName } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';

const Row = ({ label, children }) => (
  <div className="flex items-center gap-4 min-h-[48px]">
    <span className="w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500">{label}</span>
    <div className="flex flex-wrap items-center gap-2 min-w-0">{children}</div>
  </div>
);

/**
 * « ＋ Ajouter à ma collection » (PC card sheet): language, quantity, finish, condition and place,
 * then ONE call to onAdd({ quantity, language, foil, condition, boxId, deckId }).
 */
export default function AddCopiesPanel({ cardData, defaultLanguage = 'English', org, onAdd, onCancel }) {
  const foilOnly = isFoilOnly(cardData);
  const [language, setLanguage] = useState(LANGUAGES.some(l => l.value === defaultLanguage) ? defaultLanguage : 'English');
  const [qty, setQty] = useState(1);
  const [foil, setFoil] = useState(foilOnly);
  const [condition, setCondition] = useState('Near Mint');
  const [place, setPlace] = useState('none');
  const lang = LANGUAGES.find(l => l.value === language);
  const isFoil = foilOnly || foil;
  const places = [
    ['none', tx('Sans emplacement')],
    ...(org?.boxes?.items || []).map(b => [`box:${b.id}`, tx('Boîte : {name}', { name: b.name })]),
    ...(org?.decks?.items || []).map(d => [`deck:${d.id}`, tx('Deck : {name}', { name: d.name })]),
  ];
  const submit = () => onAdd({
    quantity: qty, language, foil: isFoil, condition,
    boxId: place.startsWith('box:') ? place.slice(4) : null,
    deckId: place.startsWith('deck:') ? place.slice(5) : null,
    label: `${qty} × ${lang?.label || language}${isFoil ? ' · foil' : ''}`,
  });
  const hexBtn = (on) => `hexagon h-[46px] w-[52px] flex flex-col items-center justify-center text-[11px] font-bold ${on ? 'bg-gold-500 text-rift-900' : 'bg-rift-700 text-rift-300 hover:bg-rift-600'}`;

  return (
    <section aria-label={tx('Ajouter à ma collection')} data-help="card.forge" className="rf-dossier">
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="font-display text-[20px] font-bold text-gold-400">＋ {tx('Ajouter à ma collection')}</h3>
        <span className="ml-auto text-[13px] text-rift-400 truncate">{displayName(cardData)} · {cardData.code?.split('/')[0]}</span>
      </div>
      <div className="space-y-1 border border-gold-500/25 bg-rift-800/50 p-4">
        <Row label={tx('Langue')}>
          {LANGUAGES.map(l => (
            <button key={l.value} type="button" onClick={() => setLanguage(l.value)} aria-pressed={language === l.value} title={l.label} className={hexBtn(language === l.value)}>
              <span>{l.short}</span><span className="text-[11px] font-semibold opacity-80">{l.label.slice(0, 7)}</span>
            </button>
          ))}
        </Row>
        <Row label={tx('Quantité')}>
          <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={tx('Un de moins')} className="w-9 h-9 rounded-full border border-rift-600 text-rift-100 flex items-center justify-center hover:border-gold-500/60"><Minus className="w-4 h-4" /></button>
          <span className="hexagon w-[54px] h-[60px] bg-gold-500 text-rift-900 font-display text-[22px] font-bold flex items-center justify-center" aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty(q => Math.min(12, q + 1))} aria-label={tx('Un de plus')} className="w-9 h-9 rounded-full border border-rift-600 text-rift-100 flex items-center justify-center hover:border-gold-500/60"><Plus className="w-4 h-4" /></button>
          <span className="flex gap-1 ml-2">
            {[1, 2, 3, 4].map(n => (
              <button key={n} type="button" onClick={() => setQty(n)} aria-pressed={qty === n}
                className={`h-8 min-w-[34px] px-2 text-[13px] font-bold border ${qty === n ? 'border-gold-400 text-gold-400 bg-gold-500/15' : 'border-rift-600 text-rift-300 hover:border-gold-500/50'}`}>×{n}</button>
            ))}
          </span>
        </Row>
        <Row label={tx('Finition')}>
          <div className="seg w-[260px]" role="group" aria-label={tx('Finition')}>
            <button type="button" aria-pressed={!isFoil} disabled={foilOnly} onClick={() => setFoil(false)}>{tx('Normale')}</button>
            <button type="button" aria-pressed={isFoil} onClick={() => setFoil(true)}><Sparkles className="inline w-3.5 h-3.5 mr-1" aria-hidden="true" />{tx('Foil')}</button>
          </div>
        </Row>
        <Row label={tx('État')}>
          {CONDITIONS.map(c => (
            <button key={c.value} type="button" onClick={() => setCondition(c.value)} aria-pressed={condition === c.value} title={c.label}
              className={`h-9 min-w-[42px] px-2 text-[13px] font-bold border ${condition === c.value ? 'border-gold-400 text-gold-400 bg-gold-500/15' : 'border-rift-600 text-rift-300 hover:border-gold-500/50'}`}>{c.short}</button>
          ))}
        </Row>
        <Row label={tx('Ranger dans')}>
          <select value={place} onChange={e => setPlace(e.target.value)} aria-label={tx('Ranger dans')}
            className="h-10 px-3 bg-rift-900 border border-rift-600 text-[14px] text-rift-100 focus:outline-none focus:border-gold-500/60 min-w-[220px]">
            {places.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
      </div>
      <div className="mt-4 flex items-center gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">{tx('Annuler')}</button>
        <button type="button" onClick={submit} className="btn-primary text-[15px] min-h-[46px] px-6">
          {tx('Ajouter')} <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f4f1ea] text-rift-900 text-[13px] font-bold">{qty}</span> × {lang?.label}{isFoil ? ' · foil' : ''}
        </button>
      </div>
    </section>
  );
}
