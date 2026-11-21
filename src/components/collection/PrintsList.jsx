import React from 'react';
import { Check } from 'lucide-react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import { unitPrice, hasFinishPrice, euro, priceRef } from '../../lib/prices.js';
import { tx } from '../../lib/i18n.js';
import { printsOf, printKindLabel } from '../../lib/prints.js';

/**
 * « Impressions et variantes » (card sheet): every printing of the card —
 * normal, alternate art, overnumbered, signature, showcase, promos — linked by
 * rifthunt's oracle id (catalog field `oracle`, src/lib/rifthunt.js), with the
 * set, number, kind, copies owned and price. A tap opens that printing.
 */
export default function PrintsList({ cardData, stacks, prices, onOpen }) {
  const prints = printsOf(cardData, getMatcher().cards || []);
  if (prints.length < 2) return null;
  return (
    <section className="space-y-1.5" aria-label={tx('Impressions et variantes')}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-rift-400">{tx('Impressions et variantes')} · {prints.length}</h3>
      <ul className="divide-y divide-rift-700/70 border border-rift-700/70">
        {prints.map(p => {
          const owned = stacks.filter(s => s.cardData.id === p.id).reduce((n, s) => n + s.quantity, 0);
          const price = prices ? (unitPrice(prices, p.id, false, priceRef()) ?? (hasFinishPrice(prices, p.id, true) ? unitPrice(prices, p.id, true, priceRef()) : null)) : null;
          const current = p.id === cardData.id;
          return (
            <li key={p.id}>
              <button onClick={() => !current && onOpen(p.id)} aria-current={current || undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 text-left ${current ? 'bg-gold-500/10' : 'hover:bg-rift-800'}`}>
                <img src={thumbSrc(p.id)} onError={e => handleImageError(e, p.id)} alt="" loading="lazy" className="w-9 h-[50px] object-cover bg-rift-800 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-rift-100 truncate">{p.setName || p.set} <span className="font-mono text-rift-500">#{String(p.code || p.number || '').split('/')[0].replace(/^[A-Z]+-/, '')}</span></span>
                  <span className={`block text-[12px] ${p.variant === 'promo' ? 'text-[#d7a8ff]' : 'text-rift-400'}`}>{printKindLabel(p)}</span>
                </span>
                {owned > 0 && <span className="text-[12px] font-bold text-gold-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> ×{owned}</span>}
                {price != null && <span className="w-16 text-right text-[13px] font-semibold text-gold-400">{euro(price)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
