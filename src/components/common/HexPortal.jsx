import React from 'react';
import { thumbSrc } from '../../lib/nativeAssets.js';

/**
 * Hexagonal portal filled with « liquid gold » up to `pct` (0…1), like the mock-up (.mp / .bigportal):
 * gold gradient shell, night inner, scalloped wave on the gold (animated), the art of a flagship card of the
 * set (28 %, luminosity) and the percentage / count in front. Sizes: 84 px (Salle du trésor) or 150 px (set page).
 * Waves stop with rf-calm / reduced motion (src/index.css).
 */
export default function HexPortal({ pct = 0, art = null, size = 84, children = null, title, className = '', onClick = null, complete = false }) {
  const big = size >= 120;
  const w = size; const h = Math.round(size * 1.143);
  const level = Math.max(Math.min(1, Math.max(0, pct)) * 100, big ? 4 : 5);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick || undefined} aria-label={title}
      className={`hp ${big ? 'hp-big' : ''} ${complete ? 'hp-done' : ''} ${className}`} style={{ width: w, height: h }}>
      <span className="hp-shell" aria-hidden="true" />
      <span className="hp-inner" aria-hidden="true"><span className="hp-fill" style={{ height: `${level}%` }} /></span>
      {art && <span className="hp-art" aria-hidden="true" style={{ backgroundImage: `url(${thumbSrc(art)})` }} />}
      <span className="hp-pct">{children}</span>
    </Tag>
  );
}
