import React from 'react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { typeLabel } from '../../data/sampleCards.js';import { tx } from '../../lib/i18n.js';


/** Energy curve (main deck, 0…7+) and card types of a deck. */
export default function DeckCurve({ deck }) {
  const m = getMatcher();
  const curve = Array(8).fill(0);
  const types = new Map();
  for (const s of deck.cards || []) {
    if (s.zone !== 'main') continue;
    const c = m.getCardData(s.cardId);
    if (!c) continue;
    curve[Math.min(7, Math.max(0, c.energy ?? 0))] += s.quantity;
    types.set(c.type, (types.get(c.type) || 0) + s.quantity);
  }
  const total = curve.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const max = Math.max(...curve);
  const avg = (deck.cards || []).filter(s => s.zone === 'main')
    .reduce((v, s) => v + (m.getCardData(s.cardId)?.energy ?? 0) * s.quantity, 0) / total;

  return (
    <div className="panel p-3 space-y-2">
      <p className="text-xs text-rift-300 flex">
        <span className="mr-auto font-display font-bold text-gold-400">{tx('Courbe d’énergie')}</span>
        <span className="text-rift-400">{tx('moyenne')} {avg.toFixed(1).replace('.', ',')}</span>
      </p>
      <div className="flex items-end gap-1.5 h-20">
        {curve.map((n, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-mono text-rift-300">{n || ''}</span>
            <div className="w-full bg-gold-500/80" style={{ height: `${max ? (n / max) * 52 : 0}px` }} />
            <span className="text-[11px] font-mono text-rift-500">{i === 7 ? '7+' : i}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-rift-400 flex flex-wrap gap-x-3">
        {[...types].sort((a, b) => b[1] - a[1]).map(([t, n]) => <span key={t}>{typeLabel(t)} <strong className="text-rift-200">{n}</strong></span>)}
      </p>
    </div>
  );
}
