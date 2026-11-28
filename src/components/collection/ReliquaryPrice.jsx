import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import PriceText from '../common/PriceText.jsx';
import { cardHistory, priceChange, priceRef, hasFinishPrice, euro, pct, cardmarketUrl, priceVolatile, PRICE_REF_LABEL, ESTIMATE_LABEL, priceInfo, unitPrice } from '../../lib/prices.js';
import { tx } from '../../lib/i18n.js';

const Fact = ({ k, children, ok }) => (
  <div className="border border-rift-600 bg-[#0a1220aa] px-3 py-2.5">
    <small className="block text-[11px] tracking-[.14em] uppercase text-rift-500 mb-1">{k}</small>
    <b className={`text-[14px] flex items-center gap-1.5 ${ok ? 'text-state-ok' : 'text-rift-100'}`}>{children}</b>
  </div>
);

/** 30-day curve of the mock-up (.chart): gold area, last point, max / min / « aujourd'hui » labels. */
function Chart({ points }) {
  if (points.length < 2) {
    return <div className="h-[150px] border border-rift-600 bg-[#0a1220aa] my-2.5 mb-3.5 grid place-items-center text-[12px] text-rift-500">{tx('L’historique se remplit jour après jour.')}</div>;
  }
  const vs = points.map(p => p.v); const mx = Math.max(...vs); const mn = Math.min(...vs);
  const y = (v) => (130 - ((v - mn) / (mx - mn || 1)) * 110).toFixed(1);
  const path = points.map((p, k) => `${((k / (points.length - 1)) * 400).toFixed(1)},${y(p.v)}`).join(' L');
  return (
    <div className="relative h-[150px] border border-rift-600 bg-[#0a1220aa] my-2.5 mb-3.5" role="img" aria-label={tx('Courbe de prix sur 30 jours')}>
      <svg viewBox="0 0 400 150" preserveAspectRatio="none" className="w-full h-full">
        <defs><linearGradient id="rfZg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e8c973" stopOpacity=".35" /><stop offset="1" stopColor="#e8c973" stopOpacity="0" /></linearGradient></defs>
        <path d={`M${path} L400,150 L0,150Z`} fill="url(#rfZg)" />
        <path d={`M${path}`} fill="none" stroke="#e8c973" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx="400" cy={y(vs.at(-1))} r="4" fill="#e8c973" />
      </svg>
      <span className="absolute left-2 top-1.5 text-[11px] text-rift-500">{euro(mx)}</span>
      <span className="absolute left-2 bottom-1.5 text-[11px] text-rift-500">{euro(mn)}</span>
      <span className="absolute right-2 bottom-1.5 text-[11px] text-rift-500">{tx('aujourd’hui')}</span>
    </div>
  );
}

/** « Prix » tab, like the mock-up: big price + 30-day trend, curve, Foil / Mon achat / Plus-value, actions. */
export default function ReliquaryPrice({ prices, cardId, cardData, paidAvg, hasOwned, onEditPaid }) {
  const hasNormal = hasFinishPrice(prices, cardId, false);
  const hasFoil = hasFinishPrice(prices, cardId, true);
  const [foilPick, setFoil] = useState(false);
  if (!prices) return <p className="text-sm text-rift-400">{tx('Prix disponibles dans l’app PC (et sur le téléphone après une synchro).')}</p>;
  const foil = hasNormal ? (hasFoil && foilPick) : hasFoil;
  const ref = priceRef();
  const info = priceInfo(prices, cardId, foil);
  const price = info.value;
  const foilPrice = hasFoil ? unitPrice(prices, cardId, true) : null;
  const ch = priceChange(prices, cardId, 30, ref, foil);
  const pts = cardHistory(prices, cardId, ref, foil, 30);
  const gain = paidAvg != null && price != null ? price - paidAvg : null;
  const promoInfo = prices?.promo?.[cardId] ? priceInfo(prices, cardId, false, ref, true) : null;
  return (
    <div data-help="card.price">
      <div className="flex items-end gap-[18px] mb-2 flex-wrap">
        <PriceText value={price} estimated={info.estimated} className="font-display text-[40px] font-bold text-rift-100 leading-none" />
        {ch != null && <span className={`font-bold ${ch >= 0 ? 'text-state-ok' : 'text-state-bad'}`}>{ch >= 0 ? '▲' : '▼'} {pct(ch)} · 30 {tx('j')}</span>}
        <small className="text-[12px] text-rift-500">Cardmarket · {PRICE_REF_LABEL[ref]}{foil ? ', foil' : `, ${tx('non foil')}`}</small>
        {hasNormal && hasFoil && (
          <div className="ml-auto flex border border-rift-600" role="group" aria-label={tx('Finition de la courbe')}>
            {[[false, tx('Normal')], [true, tx('Foil')]].map(([f, l]) => (
              <button key={l} type="button" aria-pressed={foil === f} onClick={() => setFoil(f)} className={`px-2.5 py-[3px] text-[11.5px] font-bold ${foil === f ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>
      {info.estimated && <p className="text-[13px] text-state-warn mb-1">{ESTIMATE_LABEL[info.estimated]} {tx(': pas de prix non foil sur Cardmarket.')}</p>}
      {promoInfo?.value != null && <p className="text-[13px] text-rift-300">{tx('Promo :')} <PriceText value={promoInfo.value} estimated={promoInfo.estimated} className="font-semibold text-gold-400" /></p>}
      {priceVolatile(prices, cardId) && <p className="text-xs text-state-warn">{tx('⚠ Prix instable : la tendance (')}{euro(prices.cards[cardId][0])}{tx(') s’écarte de plus de 30 % de la moyenne des ventes sur 7 jours (')}{euro(prices.cards[cardId][3])}{tx('). Carte peu échangée.')}</p>}
      <Chart points={pts} />
      <div className="grid grid-cols-3 gap-2.5">
        <Fact k={tx('Foil')}>{foilPrice != null ? euro(foilPrice) : '—'}</Fact>
        <Fact k={tx('Mon achat')}>{paidAvg != null ? euro(paidAvg) : '—'}</Fact>
        <Fact k={tx('Plus-value')} ok={gain != null}>{gain != null ? `${gain >= 0 ? '+' : '−'}${euro(Math.abs(gain))}` : '—'}</Fact>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        <a href={cardmarketUrl(cardData)} target="_blank" rel="noreferrer" className="h-[38px] px-4 inline-flex items-center gap-1.5 border border-rift-600 text-rift-300 font-bold text-[12.5px] hex-cut-sm hover:border-gold-500/60">{tx('Voir sur Cardmarket')} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a>
        {prices.links?.[cardId]?.[1] && <a href={cardmarketUrl(cardData, { promo: true })} target="_blank" rel="noreferrer" className="h-[38px] px-4 inline-flex items-center gap-1.5 border border-rift-600 text-rift-300 font-bold text-[12.5px] hex-cut-sm hover:border-gold-500/60">{tx('Voir la promo sur Cardmarket')} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a>}
        {hasOwned && <button type="button" onClick={onEditPaid} className="h-[38px] px-4 border border-rift-600 text-rift-300 font-bold text-[12.5px] hex-cut-sm hover:border-gold-500/60">{tx('Modifier mon prix payé')}</button>}
      </div>
    </div>
  );
}
