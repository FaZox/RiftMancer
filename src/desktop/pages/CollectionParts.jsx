// Small pieces shared by the PC Collection screens (Salle du trésor, set page, Chronique).
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { setImage } from '../../lib/setImages.js';
import { tx } from '../../lib/i18n.js';

/** Booster picture of a set; without a file (Proving Grounds, promos, public build): hexagonal emblem with the code. */
export function BoosterImage({ code, width = 46, tilt = true, className = '', shine = false }) {
  const src = setImage(code);
  if (!src) {
    const h = Math.round(width * 1.14);
    return (
      <span className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`} style={{ width, height: h }} aria-hidden="true">
        <span className="hexagon absolute inset-0 bg-gold-500/80" />
        <span className="hexagon absolute inset-[2px] bg-[#0a1220]" />
        <span className="relative font-display font-bold text-gold-400" style={{ fontSize: Math.max(11, Math.round(width * 0.24)) }}>{String(code).toUpperCase()}</span>
      </span>
    );
  }
  return (
    <span className={`relative inline-block flex-shrink-0 overflow-hidden ${tilt ? 'rf-booster' : ''} ${className}`} style={{ width, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.6)) drop-shadow(0 0 10px rgba(200,170,110,.35))' }} aria-hidden="true">
      <img src={src} alt="" className="block w-full h-auto" draggable={false} />
      {shine && <span className="rf-shine absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%)', WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` }} />}
    </span>
  );
}

/** Mini booster of a shelf header: 60 px high, tilted -8° (no file: nothing, like the mock-up). */
export function ShelfPack({ code }) {
  const src = setImage(code);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" draggable={false} className="h-[60px] w-auto flex-shrink-0 -mr-1" style={{ filter: 'drop-shadow(0 4px 6px #000a)', transform: 'rotate(-8deg)' }} />;
}

/** Progress ring (SVG) with the percentage in bold. */
export function ProgressRing({ pct = 0, size = 60 }) {
  const r = size / 2 - 5; const c = 2 * Math.PI * r;
  const p = Math.round(pct * 100);
  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${p} %`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18263c" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct >= 1 ? '#7fd6a4' : '#e8c973'} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} />
      </svg>
      <span className="absolute font-bold text-rift-100" style={{ fontSize: size >= 60 ? 14.5 : 12 }}>{p}%</span>
    </span>
  );
}

/** Green sparkline of points [{ v }] (value over 30 days). */
export function Sparkline({ points, width = 340, height = 44 }) {
  if (!points || points.length < 2) return null;
  const vs = points.map(p => p.v); const min = Math.min(...vs); const max = Math.max(...vs);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * width, height - 4 - ((p.v - min) / span) * (height - 8)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full" aria-hidden="true">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill="rgba(127,214,164,.12)" />
      <path d={d} fill="none" stroke="#7fd6a4" strokeWidth="2" />
    </svg>
  );
}

/** « Voir tout » style button (40 px, gold edge, bevelled, full gold on hover). */
export function BigButton({ children, onClick, className = '', ...rest }) {
  return <button type="button" onClick={onClick} className={`rf-bigbtn ${className}`} {...rest}>{children}</button>;
}

/** « ‹ Ma collection » (back button of the set page and the Chronique). */
export function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 h-[38px] pl-2.5 pr-4 border border-gold-500/70 bg-rift-900 text-gold-400 text-[14px] font-bold hex-cut-sm hover:bg-gold-500 hover:text-rift-900 transition-colors">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {tx('Ma collection')}
    </button>
  );
}

/** Horizontal shelf: title, optional left extras, « Voir tout » on the right, the cards scrolling. */
export function Shelf({ title, lead = null, meta = null, onSeeAll = null, children, helpId }) {
  return (
    <section className="mt-[18px] pt-[18px]" aria-label={title} data-help={helpId}>
      <div className="flex items-center gap-4 mb-3 px-8">
        {lead}
        <div className="min-w-0 mr-auto">
          <h2 className="font-display text-[19px] font-bold text-rift-100 leading-tight truncate">{title}</h2>
          {meta && <p className="text-[13px] text-rift-400">{meta}</p>}
        </div>
        {onSeeAll && <BigButton onClick={onSeeAll}>{tx('Voir tout')} →</BigButton>}
      </div>
      <div className="flex gap-4 overflow-x-auto px-8 pb-3 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}
