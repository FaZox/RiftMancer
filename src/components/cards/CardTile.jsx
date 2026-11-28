import React from 'react';
import { Heart, Plus } from 'lucide-react';
import useTilt from '../common/useTilt.js';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import { tx } from '../../lib/i18n.js';

const SPECIAL = new Set(['showcase', 'epic']);

/**
 * PC card tile (Atelier, set page, shelves): the card in colour, quantity hexagon (owned), hover relief + holo,
 * ＋ (opens the sheet with the add panel) and ♥ (wish list) buttons, a ♥ mark when wished, full name + code under it.
 * `missing`: draws the « empty cell » of the set page instead (dark image, dotted border, big number).
 */
export default function CardTile({ card, name, owned = 0, wished = false, width = 170, label = true, caption = null, missing = false, foil = false,
  onOpen, onAdd = null, onWish = null, index = null, flash = false, className = '' }) {
  const tilt = useTilt(7);
  const holo = foil || SPECIAL.has(card.rarity);
  const landscape = card.type === 'battlefield';
  const open = () => onOpen?.(card.id);
  return (
    <div data-cardid={card.id} data-idx={index ?? undefined} className={`group relative flex-shrink-0 [content-visibility:auto] ${className}`} style={{ width, containIntrinsicSize: `${width}px ${Math.round(width * 1.55)}px` }}>
      <div {...(missing ? {} : tilt)} className={`${holo && !missing ? 'rf-holo rf-holo-on' : 'rf-holo'} relative ${flash ? 'rf-flashcard' : ''}`}>
        <button type="button" onClick={open} aria-label={name} title={name} className="block w-full text-left">
          {missing ? (
            <span className="relative block w-full border border-dashed border-gold-500/50 bg-rift-900/80 overflow-hidden" style={{ aspectRatio: landscape ? '7 / 5' : '5 / 7' }}>
              <img src={thumbSrc(card.id)} alt="" loading="lazy" onError={e => handleImageError(e, card.id)} draggable={false}
                className="absolute inset-0 w-full h-full object-cover grayscale brightness-[.18] group-hover:brightness-[.65] group-hover:grayscale-[.4] transition-[filter] duration-200" />
              <span className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center group-hover:opacity-0 transition-opacity">
                <span className="font-display text-[26px] font-bold text-gold-500/70 leading-none">{String(card.collectorNumber || '').replace(/\/.*/, '')}</span>
                <span className="mt-1 text-[11px] text-rift-400 line-clamp-2">{name}</span>
              </span>
            </span>
          ) : (
            <img src={thumbSrc(card.id)} alt="" loading="lazy" onError={e => handleImageError(e, card.id)} draggable={false}
              className="block w-full h-auto bg-rift-800" style={landscape ? { aspectRatio: '7 / 5', objectFit: 'cover' } : undefined} />
          )}
        </button>
        {owned > 0 && (
          <span className="hexagon absolute top-1 right-1 min-w-[28px] h-[31px] px-1 bg-gold-500 text-rift-900 text-[13px] font-bold flex items-center justify-center pointer-events-none" aria-label={tx('{n} exemplaire(s)', { n: owned })}>{owned}</span>
        )}
        {wished && <Heart className="absolute top-1.5 left-1.5 w-4 h-4 text-[#ff8ab8] fill-[#ff8ab8] drop-shadow pointer-events-none" aria-label={tx('Dans les souhaits')} />}
        {(onAdd || onWish) && (
          <span className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            {onAdd && (
              <button type="button" onClick={() => onAdd(card.id)} aria-label={tx('Ajouter à ma collection')} title={tx('Ajouter à ma collection')}
                className="hexagon w-[34px] h-[38px] bg-gold-500 text-rift-900 hover:bg-gold-400 flex items-center justify-center"><Plus className="w-4 h-4" strokeWidth={3} /></button>
            )}
            {onWish && (
              <button type="button" onClick={() => onWish(card.id)} aria-label={wished ? tx('Retirer des souhaits') : tx('Ajouter aux souhaits')} title={wished ? tx('Retirer des souhaits') : tx('Ajouter aux souhaits')} aria-pressed={wished}
                className="hexagon w-[34px] h-[38px] bg-rift-800 text-[#ff8ab8] hover:bg-rift-700 flex items-center justify-center"><Heart className={`w-4 h-4 ${wished ? 'fill-[#ff8ab8]' : ''}`} /></button>
            )}
          </span>
        )}
      </div>
      {label && (
        <p className="mt-1.5 leading-tight">
          <span className="block text-[13px] text-rift-100 truncate" title={name}>{name}</span>
          <span className="block text-[11px] text-rift-500 font-mono truncate">{caption ?? `${card.set} · ${String(card.collectorNumber || '').replace(/\/.*/, '')}`}</span>
        </p>
      )}
    </div>
  );
}
