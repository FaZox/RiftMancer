import React, { memo } from 'react';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import CardImage from '../common/CardImage.jsx';
import { zoomGesture } from '../../lib/zoomGesture.js';
import { fullImageSrc, isNative } from '../../lib/nativeAssets.js';
import { isBanned } from '../../lib/deckRules.js';
import StatusPill from '../common/StatusPill.jsx';import { tx } from '../../lib/i18n.js';


// PC (wide screen, not the phone app): full-size pictures, sharp at any size
const WIDE = !isNative && typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;

/**
 * Card thumbnail for grids (progress, wish list, trades). Missing cards are
 * dimmed; `badge` shows a count in the corner; `pills` ([{ kind, label? }]) are
 * state badges at the bottom of the picture (FOIL, PROMO…).
 */
// hd: full-size picture instead of the thumbnail (big tiles on a PC: readable text)
const CardTile = memo(function CardTile({ cardData, owned = true, badge, badgeClass, pills, onOpen, onZoom, hd = WIDE }) {
  const name = getLocalizedName(cardData, displayLanguage());
  return (
    <button
      // onZoom (optional): right / wheel click or long press shows the card in big
      {...zoomGesture(() => onOpen(cardData.id), onZoom && (() => onZoom(cardData.id)))}
      className="group text-left select-none [-webkit-touch-callout:none]"
      title={name}
    >
      <div className="relative overflow-hidden bg-rift-800 border border-rift-600/50">
        <CardImage cardData={cardData} src={hd ? fullImageSrc(cardData.id) : undefined} dim={!owned} imgClassName={`transition group-hover:opacity-100 group-hover:grayscale-0 ${isBanned(cardData) ? 'brightness-[.4]' : ''}`} />
        {isBanned(cardData) && <StatusPill kind="bannie" className="absolute top-1 left-1" title={tx('Bannie en Standard')} />}
        {badge != null && (
          <span className={`absolute top-1 right-1 min-w-[20px] h-5 px-1 text-[11px] font-bold flex items-center justify-center ${badgeClass || 'bg-gold-500 text-rift-900'}`}>
            {badge}
          </span>
        )}
        {pills?.length > 0 && (
          <span className="absolute bottom-1 left-1 flex gap-1">
            {pills.map(p => <StatusPill key={p.kind + (p.label || '')} kind={p.kind} className="bg-rift-900/90">{p.label}</StatusPill>)}
          </span>
        )}
      </div>
      {/* Name in the app's style (same frame as the collection grid) */}
      <p className="mt-1 px-1 py-1 border border-[#e8a33a]/55 bg-[#e8a33a]/10 text-center text-[11px] lg:text-[12px] font-semibold leading-tight text-rift-100 line-clamp-2 min-h-[2.8em] flex items-center justify-center">
        {name}
      </p>
      <p className="text-center text-[11px] font-mono text-rift-500 mt-0.5">#{cardData.collectorNumber}</p>
    </button>
  );
});

export default CardTile;
