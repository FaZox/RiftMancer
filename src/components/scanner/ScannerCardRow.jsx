import React, { memo, useEffect, useState } from 'react';
import { Trash2, Plus, Minus, Sparkles, MapPin } from 'lucide-react';
import { CONDITIONS, LANGUAGES, DOMAIN_COLORS, RARITY_STYLES, isFoilOnly } from '../../data/sampleCards.js';
import { getLocalizedName, displayLanguage, useDisplayFrench } from '../../lib/cardLocale.js';
import { getCardThumbUrl } from '../../lib/cardMatcher.js';
import { handleImageError } from '../../lib/nativeAssets.js';
import { tx, locale } from '../../lib/i18n.js';

const ScannerCardRow = memo(function ScannerCardRow({ card, onUpdate, onRemove, onOpen, onMove, locationLabel, price }) {
  const { cardData, quantity, condition, language, foil, promo } = card;
  const domainStyle = DOMAIN_COLORS[cardData.domain] || DOMAIN_COLORS.colorless;
  const rarityStyle = RARITY_STYLES[cardData.rarity] || RARITY_STYLES.common;
  const foilOnly = isFoilOnly(cardData);
  useDisplayFrench(); // re-render when the display preference changes
  const displayName = getLocalizedName(cardData, displayLanguage(language));

  const handleFieldChange = (field, value) => {
    onUpdate(card, { ...card, [field]: value });
  };

  return (
    <div className="bg-rift-800 border border-rift-600 p-3">
      <div className="flex gap-3">
        {/* Card thumbnail */}
        <button
          type="button"
          onClick={() => onOpen?.(cardData.id, displayLanguage(language))}
          className="w-12 h-16 rounded-lg overflow-hidden bg-rift-800 border border-rift-600/30 flex-shrink-0"
          title={tx('Voir en grand')}
        >
          <img
            src={getCardThumbUrl(cardData.id)}
            alt={displayName}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => handleImageError(e, cardData.id)}
          />
        </button>

        <div className="flex-1 min-w-0">
          {/* Top row: name + delete */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: domainStyle.hex }}
                title={cardData.domain}
              />
              <span className={`text-[11px] font-mono font-bold ${rarityStyle.color}`} title={cardData.rarity}>
                {rarityStyle.label}
              </span>
              <span className="text-[11px] font-mono text-rift-500">
                #{cardData.collectorNumber}
              </span>
            </div>
            <h4
              onClick={() => onOpen?.(cardData.id, language)}
              className={`flex-1 text-sm font-semibold text-rift-100 truncate pt-0.5 ${onOpen ? 'cursor-pointer hover:text-gold-400' : ''}`}
              title={displayName !== cardData.name ? cardData.name : undefined}
            >
              {displayName}
            </h4>
            {price != null && (
              <span className="text-[11px] font-mono text-gold-400/90 pt-0.5 flex-shrink-0" title={tx('Valeur Cardmarket (tendance) × quantité')}>
                {price.toLocaleString(locale(), { style: 'currency', currency: 'EUR' })}
              </span>
            )}
            <button
              onClick={() => onRemove(card)}
              className="p-1 rounded-lg text-rift-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom row: qty, condition, language, foil, variant */}
          <div className="flex items-center gap-2 flex-wrap">
        {/* Quantity */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleFieldChange('quantity', Math.max(1, quantity - 1))}
            className="w-6 h-6 rounded-lg bg-rift-800 border border-rift-600/40 flex items-center justify-center text-rift-300 hover:bg-rift-600 transition-colors"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) handleFieldChange('quantity', Math.min(99, Math.max(1, v)));
            }}
            className="h-6 text-center text-xs font-mono bg-rift-800 border border-rift-600/40 rounded-lg text-rift-100 focus:outline-none focus:border-gold-500/60"
            style={{ width: `${Math.max(2, String(quantity).length + 1)}ch` }}
          />
          <button
            onClick={() => handleFieldChange('quantity', Math.min(99, quantity + 1))}
            className="w-6 h-6 rounded-lg bg-rift-800 border border-rift-600/40 flex items-center justify-center text-rift-300 hover:bg-rift-600 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Condition */}
        <select
          value={condition}
          onChange={(e) => handleFieldChange('condition', e.target.value)}
          title={CONDITIONS.find(c => c.value === condition)?.label || condition}
          className="h-6 text-[11px] bg-rift-800 border border-rift-600/40 rounded-lg text-rift-200 px-1.5 focus:outline-none focus:border-gold-500/60 appearance-none cursor-pointer"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.short}</option>
          ))}
        </select>

        {/* Language */}
        <select
          value={language}
          onChange={(e) => handleFieldChange('language', e.target.value)}
          title={LANGUAGES.find(l => l.value === language)?.label || language}
          className="h-6 text-[11px] bg-rift-800 border border-rift-600/40 rounded-lg text-rift-200 px-1.5 focus:outline-none focus:border-gold-500/60 appearance-none cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.short}</option>
          ))}
        </select>

        {/* Foil toggle — forced on + disabled for Rare/Epic (always foil) */}
        <button
          onClick={() => !foilOnly && handleFieldChange('foil', !foil)}
          disabled={foilOnly}
          title={foilOnly ? tx('Toujours foil (Rare/Épique)') : foil ? tx('Foil') : tx('Standard')}
          className={`h-6 rounded-lg border flex items-center justify-center gap-0.5 transition-all flex-shrink-0 px-1.5 ${
            foil || foilOnly
              ? 'bg-purple-500/20 border-purple-400/50 text-purple-400'
              : 'bg-rift-800 border-rift-600/40 text-rift-500'
          } ${foilOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <Sparkles className="w-3 h-3" />
          {foilOnly && <span className="text-[11px] font-mono">F</span>}
        </button>

        {/* Location (box / deck / loan) */}
        {onMove && (
          <button
            onClick={() => onMove(card)}
            title={tx('Ranger dans une boîte, un deck, ou prêter')}
            className={`h-6 rounded-lg border flex items-center gap-1 px-1.5 text-[11px] max-w-[9rem] ${
              locationLabel ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-rift-800 border-rift-600/40 text-rift-500 hover:text-rift-300'
            }`}
          >
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{locationLabel || tx('Ranger')}</span>
          </button>
        )}

        {/* Purchase price (collection only) */}
        {onMove && <PaidInput value={card.paid} onChange={(v) => handleFieldChange('paid', v)} />}

        {/* Promo toggle */}
        <button
          onClick={() => handleFieldChange('promo', !promo)}
          className={`h-6 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 px-1.5 text-[11px] font-medium cursor-pointer ${
            promo
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-400 hover:bg-amber-500/30'
              : 'bg-rift-800 border-rift-600/40 text-rift-500 hover:bg-rift-600 hover:text-rift-300'
          }`}
        >
          {promo ? tx('Promo') : tx('Standard')}
        </button>
      </div>
        </div>
      </div>
    </div>
  );
});

/** Price paid for one copy (€). Saved when the field loses focus. */
function PaidInput({ value, onChange }) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => { setText(value ? String(value).replace('.', ',') : ''); }, [value]);
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    const next = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
    if (next !== (value || null)) onChange(next);
  };
  return (
    <label className="h-6 flex items-center gap-0.5 rounded-lg border bg-rift-800 border-rift-600/40 px-1.5 text-[11px] text-rift-500" title={tx('Prix payé pour un exemplaire (pour calculer la plus-value)')}>
      {tx('Payé')}
      <input
        type="text" inputMode="decimal" value={text} placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-10 bg-transparent text-right text-rift-200 focus:outline-none"
      />
      €
    </label>
  );
}

export default ScannerCardRow;
