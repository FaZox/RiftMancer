import React from 'react';
import { tx } from '../../lib/i18n.js';

const SIZE = { inline: 19, md: 30, lg: 36 };

/** Energy cost: a white disc with the number, as printed on the card (3 sizes: inline 19 px, md 30 px, lg 36 px). */
export default function EnergyBadge({ value, size = 'md', className = '' }) {
  const px = SIZE[size] || SIZE.md;
  return (
    <span role="img" aria-label={tx('Énergie {n}', { n: value })} title={tx('Énergie')}
      className={`inline-flex items-center justify-center rounded-full font-bold flex-shrink-0 ${className}`}
      style={{ width: px, height: px, background: '#f4f1ea', color: '#0a1220', fontSize: Math.round(px * 0.55), lineHeight: 1 }}>
      {value}
    </span>
  );
}
