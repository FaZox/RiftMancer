import React, { useMemo, useRef, useState } from 'react';
import CardTile from '../../components/cards/CardTile.jsx';
import { BackButton, BigButton } from '../../components/collection/CollectionParts.jsx';
import { allCards } from '../../lib/catalog.js';
import { recentAdds, activity, localDay } from '../../lib/collectionStats.js';
import { unitPrice, priceRef } from '../../lib/prices.js';
import { displayName } from '../../lib/cardLocale.js';
import { rarityIcon, domainIcon } from '../../lib/symbols.js';
import { motionOk } from '../../lib/motion.js';
import { tx, locale } from '../../lib/i18n.js';

const PERIODS = [[7, tx('7 jours')], [30, tx('30 jours')], [90, tx('3 mois')], [null, tx('Tout')]];
const PAGE_DAYS = 30;
const SOURCE = { scan: `⌖ ${tx('Scanner')}`, manual: `＋ ${tx('Ajout manuel')}`, import: `⇪ ${tx('Import')}`, trade: `⇄ ${tx('Échange')}` };

function dayTitle(day, now = Date.now()) {
  if (day === localDay(now)) return [tx('Aujourd’hui'), new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })];
  if (day === localDay(now - 86400000)) return [tx('Hier'), new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })];
  return [new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase()), ''];
}

/** « Chronique »: the copies added, day by day (mock-up .journal: glows, stat boxes, 14-day bars, golden timeline). */
export default function CollectionJournal({ copies, prices, onOpen, onBack }) {
  const [period, setPeriod] = useState(7);
  const [shownDays, setShownDays] = useState(PAGE_DAYS);
  const rootRef = useRef(null);
  const catalogById = useMemo(() => new Map(allCards().map(c => [c.id, c])), []);
  const priceOf = (c) => (prices && catalogById.get(c.cardId) ? unitPrice(prices, c.cardId, !!c.foil, priceRef(), !!c.promo) || 0 : 0);
  const days = useMemo(() => recentAdds(copies, { days: period, priceOf }), [copies, period, prices]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useMemo(() => activity(copies, { days: 14 }), [copies]);
  const maxAct = Math.max(1, ...act.map(a => a.n));
  const totals = useMemo(() => ({
    cards: days.reduce((n, d) => n + d.count, 0),
    fresh: days.reduce((n, d) => n + d.cards.filter(c => c.first).length, 0),
    value: days.reduce((v, d) => v + d.value, 0),
    active: days.length,
  }), [days]);
  const scrollToDay = (day) => {
    if (!rootRef.current?.querySelector(`[data-day="${day}"]`)) setPeriod(p => (p && p < 30 ? 30 : p));
    setTimeout(() => rootRef.current?.querySelector(`[data-day="${day}"]`)?.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' }), 30);
  };
  const shown = days.slice(0, shownDays);
  const nf = (v) => v.toFixed(2).replace('.', ',');
  const todayKey = localDay(Date.now());

  return (
    <div ref={rootRef} className="flex-1 min-h-0 overflow-y-auto pb-16 [scrollbar-width:thin]">
      <header className="relative overflow-hidden pt-[66px] pr-[34px] pb-5 pl-[34px] grid grid-cols-[minmax(0,1fr)_420px] gap-[30px] items-end border-b border-gold-500/15">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(500px 220px at 15% 0, #7fd6a41f, transparent 70%), radial-gradient(600px 260px at 90% 100%, #e8c97314, transparent 70%)' }} />
        <div className="absolute top-3.5 left-7 z-10"><BackButton onClick={onBack} /></div>
        <div className="relative">
          <div className="text-[11px] tracking-[.2em] uppercase text-state-ok">✦ {tx('Chronique de la collection')}</div>
          <h1 className="font-display text-[40px] font-bold text-rift-100 mt-1 mb-1.5">{tx('Derniers ajouts')}</h1>
          <p className="text-rift-400">{tx('Tout ce qui est entré dans ta collection, jour après jour.')}</p>
          <div className="flex gap-1.5 mt-3.5" role="tablist" aria-label={tx('Période')}>
            {PERIODS.map(([d, l]) => (
              <button key={l} role="tab" aria-selected={period === d} onClick={() => { setPeriod(d); setShownDays(PAGE_DAYS); }}
                className={`h-[30px] px-[13px] border font-bold text-[12.5px] hex-cut-sm ${period === d ? 'bg-gold-400 text-rift-900 border-gold-400' : 'border-rift-600 text-rift-400 hover:border-gold-500/60'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            {[[`+${totals.cards}`, tx('cartes'), false], [totals.fresh, tx('nouvelles'), false], [prices ? `+${nf(totals.value)} €` : '—', tx('de valeur'), true], [totals.active, tx('jours actifs'), false]].map(([v, l, ok]) => (
              <div key={l} className="border border-gold-500/25 bg-[#0a1220aa] px-3.5 py-2 min-w-[110px]">
                <b className={`block font-display text-[22px] font-bold ${ok ? 'text-state-ok' : 'text-rift-100'}`}>{v}</b>
                <small className="text-[11px] tracking-[.12em] uppercase text-rift-500">{l}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-col gap-1.5">
          <h6 className="text-[11px] tracking-[.16em] uppercase text-rift-500 font-semibold flex justify-between">{tx('Activité')} · {tx('14 jours')} <span className="tracking-normal normal-case text-gold-400">{act.reduce((n, a) => n + a.n, 0)} {tx('cartes')}</span></h6>
          <div className="flex items-end gap-[5px] h-[110px] border-b border-gold-500/35 pb-px" role="list">
            {act.map(a => (
              <button key={a.day} role="listitem" type="button" onClick={() => a.n && scrollToDay(a.day)} disabled={!a.n} aria-label={`${a.day} : ${a.n}`}
                className="group relative flex-1 rounded-t-sm min-h-[2px] hover:brightness-125 disabled:cursor-default"
                style={{ height: a.n ? `${Math.max((a.n / maxAct) * 100, 8)}%` : '2px', background: a.n ? 'linear-gradient(180deg,#e8c973,#a8893a55)' : '#18263c' }}>
                <span className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 whitespace-nowrap bg-rift-700 border border-gold-500/40 px-[7px] py-0.5 text-[11px] text-rift-100 opacity-0 group-hover:opacity-100 pointer-events-none z-10">{a.n} {a.n > 1 ? tx('cartes') : tx('carte')}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-[5px]">{act.map(a => <span key={a.day} className="flex-1 text-center text-[11px] text-rift-500">{a.day === todayKey ? tx('auj.') : Number(a.day.slice(8))}</span>)}</div>
        </div>
      </header>

      <div className="relative pt-5 pr-[34px] pb-[50px] pl-[88px]" data-help="journal.timeline">
        <div className="absolute left-[54px] top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(180deg, #e8c973, #c8a84e44 70%, transparent)' }} aria-hidden="true" />
        {shown.length === 0 && <p className="py-16 text-center text-rift-500">{tx('Aucun ajout sur cette période')}</p>}
        {shown.map(d => {
          const ids = d.cards.map(c => c.cardId);
          const best = prices ? d.cards.reduce((b, c) => { const p = unitPrice(prices, c.cardId, false) || 0; return p > (b?.p || 0) ? { id: c.cardId, p } : b; }, null) : null;
          const sources = [...new Set(d.cards.map(c => c.source).filter(Boolean))];
          const [t1, t2] = dayTitle(d.day);
          const today = d.day === todayKey;
          const chip = 'h-6 inline-flex items-center gap-[5px] px-[9px] border border-rift-600 text-[12px] text-rift-300 bg-[#0a1220aa]';
          return (
            <section key={d.day} data-day={d.day} className="relative mb-[30px] scroll-mt-4">
              <div className={`hexagon absolute -left-[46px] top-0.5 w-7 h-8 grid place-items-center font-extrabold text-[11px] text-rift-900 ${today ? 'rf-glow' : ''}`}
                style={{ background: today ? 'linear-gradient(160deg,#fff,#e8c973)' : 'linear-gradient(160deg,#e8c973,#a8893a)' }} aria-hidden="true">{d.count}</div>
              <header className="flex items-baseline gap-3 flex-wrap mb-3">
                <h2 className="font-display text-[18px] font-bold text-rift-100">{t1}{t2 && <small className="font-sans font-normal text-[13px] text-rift-500 ml-2">{t2}</small>}</h2>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={chip}>+{d.count} {d.count > 1 ? tx('cartes') : tx('carte')}</span>
                  {prices && <span className={`${chip} !text-state-ok !border-state-ok/35`}>+{nf(d.value)} €</span>}
                  {sources.map(s => <span key={s} className={`${chip} !text-gold-400 !border-gold-500/35`}>{SOURCE[s] || s}</span>)}
                </div>
              </header>
              <div className="flex gap-3.5 flex-wrap">
                {d.cards.map(c => {
                  const card = catalogById.get(c.cardId);
                  if (!card) return null;
                  const star = best && best.id === c.cardId && best.p > 3;
                  return (
                    <div key={c.cardId} className="relative w-[112px]" style={star ? { filter: 'drop-shadow(0 0 12px #e8c97366)' } : undefined}>
                      <div className={star ? 'rounded-[7px] outline outline-2 outline-gold-400 outline-offset-[3px]' : ''}>
                        <CardTile card={card} name={displayName(card)} width={112} label={false} onOpen={(id) => onOpen(id, { list: ids })} />
                      </div>
                      {c.quantity > 1 && <span className="hexagon absolute -top-[7px] -right-[7px] min-w-[24px] h-[26px] px-[3px] bg-gold-500 text-rift-900 text-[11px] font-extrabold grid place-items-center z-[3] pointer-events-none">+{c.quantity}</span>}
                      <p className="flex items-center justify-center gap-1 mt-[5px] text-[11px] text-rift-500">
                        {rarityIcon(card.rarity) && <img src={rarityIcon(card.rarity)} alt="" className="w-3.5 h-3.5 object-contain" />}
                        {(card.domains?.length ? card.domains : [card.domain]).filter(Boolean).map(dm => domainIcon(dm) && <img key={dm} src={domainIcon(dm)} alt="" className="w-3.5 h-3.5" />)}
                        {String(card.code || card.collectorNumber || '').split('/')[0].replace(/^[A-Z]+-/, '')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {days.length > shownDays && <BigButton onClick={() => setShownDays(n => n + PAGE_DAYS)}>{tx('Afficher plus')}</BigButton>}
      </div>
    </div>
  );
}
