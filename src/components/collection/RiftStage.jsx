import React, { useId } from 'react';

/**
 * Card zoom hero: the card rises out of a rift in the ground.
 *
 *   variant "floor"  (design B) every card — beam + cracks in the domain colour
 *   variant "legend" (design C) legends and cards worth more than 20 € —
 *                    lightning bolts in the second colour, running electric border,
 *                    gem and a plaque (LÉGENDE or the price)
 *
 * The scene is drawn in a 390×560 box (the size of the designs) that keeps
 * its proportions; on wide screens the ground line carries on to the edges.
 * Animations live in index.css (rf-*), all off with « réduire les animations ».
 */
const W = 390, H = 560, GROUND = 440;
const pct = (v, of) => `${(v / of) * 100}%`;

const WALL_CRACKS = [
  'M95 180 L70 172 L52 186 L30 176 L8 190', 'M52 186 L44 210', 'M95 300 L66 310 L58 336 L30 344',
  'M58 336 L64 360', 'M95 400 L72 412 L64 436', 'M295 200 L322 190 L340 204 L366 196 L390 206',
  'M340 204 L346 228', 'M295 320 L326 312 L338 290 L364 282', 'M295 404 L320 414 L330 436',
  'M150 136 L140 110 L152 86 L140 60', 'M240 136 L252 104 L246 80 L262 52', 'M252 104 L274 96',
];
const WALL_CRACKS_B = [...WALL_CRACKS, 'M200 136 L204 116'];
const WALL_CRACKS_C = [...WALL_CRACKS, 'M95 240 L60 236 L40 254 L14 246', 'M295 256 L330 262 L352 246 L384 254',
  'M120 136 L100 116 L104 90', 'M270 136 L294 118 L292 92'];
const FLOOR_CRACKS = ['M28 440 L0 430', 'M60 452 L30 486 L10 520', 'M120 456 L100 500 L110 548',
  'M270 456 L292 506 L280 552', 'M330 452 L356 490 L388 510', 'M362 440 L390 446'];
const FLOOR_CRACKS_THIN = [...FLOOR_CRACKS, 'M30 486 L4 490', 'M292 506 L320 520'];
const SHARDS = ['70,430 84,424 80,440', '300,432 316,426 310,442', '150,436 160,428 162,442', '250,434 262,428 258,444'];
const SPARKS = [[90, 1.4], [140, 1.8], [200, 1.2], [250, 1.6], [300, 1.3], [175, 1.1]];
const BOLTS = [
  { d: ['M70 440 L84 392 L66 372 L92 312 L72 292 L100 226 L86 210 L104 170', 'M66 372 L42 356 L34 330', 'M72 292 L50 280'], delay: 2.4 },
  { d: ['M322 440 L308 380 L328 356 L298 300 L320 276 L290 214 L304 196 L286 150', 'M328 356 L352 340 L358 314', 'M320 276 L344 262'], delay: 3.5 },
  { d: ['M110 0 L126 36 L110 58 L136 100 L122 116 L140 134', 'M110 58 L86 70 L80 96'], delay: 4.4 },
  { d: ['M300 0 L286 42 L304 62 L276 104 L290 120 L262 136', 'M304 62 L328 78 L330 104'], delay: 5.3 },
];

const svgBox = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' };

export default function RiftStage({ colors, landscape, legend = false, plaque, compact = false, still = false, heightClass = 'h-[min(66vh,560px)] lg:h-[min(80vh,820px)]', children, onTop }) {
  // Unique gradient ids: several stages can be on the same page (deck editor)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // « Animations des cartes » off: no scene at all, the card simply shown, still
  if (still) {
    return (
      <section className={`relative bg-rift-900 ${heightClass}`}>
        {/* The whole card always fits: a box with a fixed size, the card inside at its own ratio */}
        <div className="absolute inset-6 flex items-center justify-center">
          <div className={`rounded-[10px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,.5)] max-w-full max-h-full ${landscape ? 'w-full aspect-[7/5]' : 'h-full aspect-[744/1039]'}`}>
            {children}
          </div>
        </div>
        {onTop}
      </section>
    );
  }
  const domain = colors[0];
  // No gold: both variants use the card's colours (two domains: ground in the
  // first, lightning in the second; one domain: everything in that colour).
  const accent = domain;
  const bolt = colors[1] || domain;
  const groundFill = '#1b0f3a';
  const cracks = legend ? WALL_CRACKS_C : WALL_CRACKS_B;

  // Card box, in scene coordinates: battlefields wide; portrait cards 250 / 390 of the scene (bigger than
  // the designs' 200, to read the card; still under the Retour and FR / EN buttons)
  const card = landscape ? { left: 34, width: 322 } : null;
  const cardBox = card
    ? { left: pct(card.left, W), width: pct(card.width, W) }
    : { left: 'var(--rf-cl)', width: 'var(--rf-cw)' };

  return (
    <section className={`rf-on relative overflow-hidden bg-[#07060d] [--rf-cl:17.95%] [--rf-cw:64.1%] ${compact ? '' : heightClass}`}
      style={compact ? { width: '100%', aspectRatio: `${W} / ${H}` } : undefined}>
      {/* the ground line continues beyond the scene on wide screens */}
      <div aria-hidden="true" className="absolute left-0 right-0 h-[3px] blur-[2px]" style={{ top: pct(GROUND, H), background: accent, opacity: 0.6 }} />
      <div aria-hidden="true" className="absolute left-0 right-0 bottom-0" style={{ top: pct(GROUND, H), background: `linear-gradient(${accent}22, transparent 60%)` }} />

      <div className="relative h-full mx-auto max-w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        {/* back: sky, beam, floor cracks, ground slab */}
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={svgBox}>
          <defs>
            <linearGradient id={`rfBeam${uid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity=".75" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
            <radialGradient id={`rfHalo${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity={legend ? '.55' : '.5'} />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`rfSky${uid}`} cx="50%" cy="0%" r="70%">
              <stop offset="0%" stopColor={bolt} stopOpacity=".22" />
              <stop offset="100%" stopColor={bolt} stopOpacity="0" />
            </radialGradient>
          </defs>
          {legend && <rect width={W} height="300" fill={`url(#rfSky${uid})`} className="rf-pulse" />}
          <g fill="#fff" opacity=".35">
            <circle cx="30" cy="40" r="1" /><circle cx="352" cy="70" r="1.2" /><circle cx="60" cy="180" r=".8" />
            <circle cx="340" cy="190" r="1" /><circle cx="310" cy="20" r=".8" /><circle cx="120" cy="60" r=".9" />
          </g>
          <ellipse cx="195" cy="440" rx={legend ? 270 : 260} ry={legend ? 160 : 140} fill={`url(#rfHalo${uid})`} className="rf-pulse" />
          <polygon className="rf-pulse" points={legend ? '30,440 360,440 310,20 80,20' : '40,440 350,440 300,40 90,40'} fill={`url(#rfBeam${uid})`} opacity={legend ? 0.6 : 0.55} />
          <polygon points={legend ? '110,440 280,440 240,100 150,100' : '110,440 280,440 240,120 150,120'} fill={`url(#rfBeam${uid})`} opacity={legend ? 0.55 : 0.5} />
          <g fill="none" stroke={accent} strokeWidth="4" opacity={legend ? 0.55 : 0.5} style={{ filter: 'blur(4px)' }}>
            {FLOOR_CRACKS.map(d => <path key={d} d={d} />)}
          </g>
          <g fill="none" stroke={accent} strokeWidth="1.4" opacity={legend ? 0.9 : 0.85}>
            {FLOOR_CRACKS_THIN.map(d => <path key={d} d={d} />)}
          </g>
          <path d="M24 440 L60 432 L96 436 L130 426 L170 430 L210 422 L250 430 L290 426 L330 434 L366 440 Z" fill={groundFill} stroke={accent} strokeWidth="1.2" />
        </svg>

        {/* cracks opening in the wall around the card */}
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={svgBox}>
          <g className="rf-crack rf-pulse" fill="none" stroke={accent} strokeWidth={legend ? 6 : 5} style={{ filter: 'blur(4px)' }}>
            {cracks.map(d => <path key={d} pathLength="1" d={d} />)}
          </g>
          <g className="rf-crack" fill="none" stroke="#fff" strokeWidth={legend ? 1.5 : 1.3}>
            {cracks.map(d => <path key={d} pathLength="1" d={d} />)}
          </g>
        </svg>

        {/* the card: hidden below the ground line, so it rises out of it */}
        <div className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: pct(GROUND, H) }}>
          <div className="rf-rise absolute" style={{ ...cardBox, bottom: pct(16, GROUND) }}>
            <div className="rf-card relative">
              {legend ? (
                <LegendFrame accent={accent} bolt={bolt} plaque={plaque}>{children}</LegendFrame>
              ) : (
                <div className="rounded-[10px] overflow-hidden" style={{ boxShadow: `0 0 24px ${accent}aa, 0 0 70px ${accent}55` }}>
                  {children}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* front: lip of the rift, glow, bolts, shards and sparks */}
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={svgBox}>
          <path d="M24 440 L60 446 L96 456 L130 450 L170 460 L210 454 L250 462 L290 452 L330 450 L366 440 Z" fill="#050309" stroke={accent} strokeWidth="1.2" />
          <ellipse cx="195" cy="440" rx={legend ? 175 : 170} ry={legend ? 10 : 9} fill={accent} className="rf-pulse" style={{ filter: 'blur(8px)' }} />
          <path d="M30 440 L366 440" stroke="#fff" strokeWidth="2.5" style={{ filter: 'blur(1.5px)' }} />
          {legend && BOLTS.map((b, i) => (
            <g key={i} className="rf-bolt" fill="none" style={{ animationDelay: `${b.delay}s` }}>
              <g stroke={bolt} strokeWidth="9" style={{ filter: 'blur(6px)' }}>{b.d.map(d => <path key={d} d={d} />)}</g>
              <g stroke="#fff" strokeWidth="2.2">{b.d.map(d => <path key={d} d={d} />)}</g>
            </g>
          ))}
          <g fill="#1a1530" stroke={accent} strokeWidth="1">
            {SHARDS.map((p, i) => <polygon key={p} className="rf-shard" points={p} style={{ animationDelay: `${[0, 1.2, 2.4, 3.3][i]}s` }} />)}
          </g>
          <g fill="#fff">
            {SPARKS.map(([cx, r], i) => (
              <circle key={i} className="rf-spark" cx={cx} cy={436 + (i % 2) * 2} r={r}
                style={{ animationDelay: `${[0, 0.5, 1.1, 1.7, 2.3, legend ? 2.7 : 2.9][i]}s`, animationDuration: legend ? '3s' : '3.4s' }} />
            ))}
          </g>
        </svg>

        {legend && <div aria-hidden="true" className="rf-flash absolute inset-0 pointer-events-none" style={{ background: bolt }} />}
      </div>

      {onTop}
    </section>
  );
}

/**
 * Just the card and its own animation (no scene): appears, sways once, then stands still (sharp); legends
 * get the electric frame. Used for the legend and champion of a deck.
 */
export function RiftCard({ colors, legend = false, plaque, children }) {
  const accent = colors[0];
  const bolt = colors[1] || accent;
  return (
    <div className="rf-on">
      <div className="rf-appear">
        <div className="rf-card relative" style={{ animationDelay: '0.9s' }}>
          {legend ? (
            <LegendFrame accent={accent} bolt={bolt} plaque={plaque}>{children}</LegendFrame>
          ) : (
            <div className="rounded-[10px] overflow-hidden" style={{ boxShadow: `0 0 18px ${accent}aa, 0 0 40px ${accent}44` }}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Design C: gold frame, electric border running round, gem and plaque. */
function LegendFrame({ accent, bolt, plaque, children }) {
  return (
    <>
      <div className="rounded-[14px] p-[3%]"
        style={{ background: `linear-gradient(150deg, #ffffff, ${accent} 22%, #0b0816 45%, ${bolt} 68%, #0b0816)`, boxShadow: `0 0 26px ${accent}bb, 0 0 70px ${bolt}66` }}>
        <div className="rounded-[9px] overflow-hidden border-2 border-[#0b0816]">{children}</div>
      </div>
      <svg aria-hidden="true" viewBox="0 0 216 306" preserveAspectRatio="none" className="absolute pointer-events-none"
        style={{ left: -8, top: -8, width: 'calc(100% + 16px)', height: 'calc(100% + 16px)', overflow: 'visible' }}>
        <rect className="rf-run" x="3" y="3" width="210" height="300" rx="16" pathLength="100" fill="none" stroke={bolt}
          strokeWidth="6" strokeDasharray="6 19" vectorEffect="non-scaling-stroke" style={{ filter: 'blur(3px)' }} />
        <rect className="rf-run" x="3" y="3" width="210" height="300" rx="16" pathLength="100" fill="none" stroke="#fff"
          strokeWidth="1.6" strokeDasharray="6 19" vectorEffect="non-scaling-stroke" />
        <rect className="rf-run2" x="3" y="3" width="210" height="300" rx="16" pathLength="100" fill="none" stroke={bolt}
          strokeWidth="1.4" strokeDasharray="3 30" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* gem: sized on the card (stays small on small cards) */}
      <span aria-hidden="true" className="absolute left-1/2 top-0 border-2 border-white"
        style={{ width: '9%', aspectRatio: '1', transform: 'translate(-50%, -50%) rotate(45deg)', background: `radial-gradient(circle at 35% 30%, #fff, ${bolt} 40%, #0b2a3a)`, boxShadow: `0 0 10px ${bolt}` }} />
      {plaque && (
        <span className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 px-3 h-[18px] flex items-center rounded-[9px] border bg-[#0b0816] font-display font-bold text-[11px] tracking-[0.2em] text-white whitespace-nowrap"
          style={{ borderColor: accent, boxShadow: `0 0 10px ${bolt}88` }}>
          {plaque}
        </span>
      )}
    </>
  );
}
