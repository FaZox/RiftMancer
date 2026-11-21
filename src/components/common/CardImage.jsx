import React from 'react';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';

/**
 * Card picture that fills its box without cropping.
 *
 * Battlefields are landscape cards, but their image files are stored turned
 * 90° counter-clockwise (portrait, see cards_scraper.py). They are drawn
 * turned back (90° clockwise) in a landscape box, so they are neither
 * sideways nor cut at the top and bottom.
 *
 * `fit` = 'box': the picture keeps the card's own shape and is centred in a
 * portrait box (collection grid). 'auto': the box takes the card's shape.
 */
export default function CardImage({ cardData, src, className = '', imgClassName = '', fit = 'auto', dim = false }) {
  const landscape = cardData?.type === 'battlefield';
  const url = src || thumbSrc(cardData.id);
  const img = (extra, style) => (
    <img
      src={url}
      onError={(e) => handleImageError(e, cardData.id)}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${extra} ${dim ? 'opacity-30 grayscale' : ''} ${imgClassName}`}
      style={style}
    />
  );

  if (!landscape) {
    return <span className={`block overflow-hidden ${fit === 'box' ? 'aspect-[5/7]' : 'aspect-[5/7]'} ${className}`}>{img('w-full h-full object-cover')}</span>;
  }

  // Landscape box (7:5); the portrait file is 5:7, so turned 90° it fills it exactly:
  // before rotation its width = box height (71.43 % of box width) and its height = box width (140 % of box height).
  const landscapeBox = (
    <span className="relative block w-full aspect-[7/5] overflow-hidden">
      {img('absolute top-1/2 left-1/2 max-w-none object-cover', {
        width: '71.43%', height: '140%', transform: 'translate(-50%, -50%) rotate(90deg)',
      })}
    </span>
  );
  if (fit === 'box') {
    return <span className={`flex items-center aspect-[5/7] overflow-hidden ${className}`}>{landscapeBox}</span>;
  }
  return <span className={`block overflow-hidden ${className}`}>{landscapeBox}</span>;
}
