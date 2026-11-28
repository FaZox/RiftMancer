import React, { useMemo, useRef, useState } from 'react';

import CardTileMobile from '../cards/CardTileMobile.jsx';

import { allCards } from '../../lib/catalog.js';

import { recentAdds, activity, localDay } from '../../lib/collectionStats.js';

import { unitPrice, priceRef } from '../../lib/prices.js';

import { displayName } from '../../lib/cardLocale.js';

import { motionOk } from '../../lib/motion.js';

import { tx, locale } from '../../lib/i18n.js';

const PERIODS = [[7, tx('7 jours')], [30, tx('30 jours')], [90, tx('3 mois')], [null, tx('Tout')]];

const PAGE_DAYS = 30;

const SOURCE = { scan: `⌖ ${tx('Scanner')}`, manual: `＋ ${tx('Ajout manuel')}`, import: `⇪ ${tx('Import')}`, trade: `⇄ ${tx('Échange')}` };

function dayTitle(day, now = Date.now()) {
  if (day === localDay(now)) return [tx('Aujourd’hui'), new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })];
  if (day === localDay(now - 86400000)) return [tx('Hier'), new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })];
  return [new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()), ''];
}

/**
 * Chronique « Derniers ajouts » téléphone (maquette écran 3) : périodes, 4 compteurs
 * qui défilent au doigt, histogramme d'activité 14 j (toucher une barre = aller au
 * jour), frise verticale avec un hexagone par jour et 4 cartes par ligne (la plus
 * chère du jour a un contour or, sans texte). 30 jours puis « Afficher plus ».
 */
export default function JournalMobile({ copies, prices, onOpen, onBack }) {
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
    if (!rootRef.current?.querySelector(`[data-day="${day}"]`)) setPeriod((p) => (p && p < 30 ? 30 : p));
    setTimeout(() => rootRef.current?.querySelector(`[data-day="${day}"]`)?.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' }), 30);
  };

  const shown = days.slice(0, shownDays);
  const nf = (v) => v.toFixed(2).replace('.', ',');
  const todayKey = localDay(Date.now());

  return (
    <div ref={rootRef} className="flex-1 min-h-0 overflow-y-auto pb-4">
      <div className="mh" style={{ paddingTop: 8 }}>
        <button type="button" className="back" onClick={onBack}>‹ {tx('Ma collection')}</button>
      </div>
      <div className="px-[18px] pb-2.5">
        <div className="m-eb ok">✦ {tx('Chronique de la collection')}</div>
        <h2 className="font-display text-[28px] font-bold text-rift-100 leading-tight">{tx('Derniers ajouts')}</h2>
      </div>

      <div className="perm" role="tablist" aria-label={tx('Période')}>
        {PERIODS.map(([d, l]) => (
          <button key={l} type="button" role="tab" aria-selected={period === d} className={period === d ? 'on' : ''}
            onClick={() => { setPeriod(d); setShownDays(PAGE_DAYS); }}>{l}</button>
        ))}
      </div>

      <div className="jstm">
        <div><b>+{totals.cards}</b><small>{tx('cartes')}</small></div>
        <div><b>{totals.fresh}</b><small>{tx('nouvelles')}</small></div>
        <div><b className="ok">{prices ? `+${nf(totals.value)} €` : '—'}</b><small>{tx('de valeur')}</small></div>
        <div><b>{totals.active}</b><small>{tx('jours actifs')}</small></div>
      </div>

      <div className="actm">
        <div className="m-cap mb-1.5">{tx('Activité')} · {tx('14 jours')}</div>
        <div className="bars">
          {act.map(a => (
            <i key={a.day} role="button" tabIndex={-1} aria-label={`${a.day} : ${a.n}`} className={!a.n ? 'z' : ''}
              style={{ height: a.n ? `${Math.max((a.n / maxAct) * 100, 8)}%` : '3%' }}
              onClick={() => a.n && scrollToDay(a.day)} />
          ))}
        </div>
      </div>

      <div className="tlm" data-help="journal.timeline">
        {shown.length === 0 && <p className="py-16 text-center text-rift-500">{tx('Aucun ajout sur cette période')}</p>}
        {shown.map(d => {
          const ids = d.cards.map(c => c.cardId);
          const best = prices ? d.cards.reduce((b, c) => { const p = unitPrice(prices, c.cardId, false) || 0; return p > (b?.p || 0) ? { id: c.cardId, p } : b; }, null) : null;
          const sources = [...new Set(d.cards.map(c => c.source).filter(Boolean))];
          const [t1, t2] = dayTitle(d.day);
          return (
            <section key={d.day} data-day={d.day} className="daym scroll-mt-4">
              <div className={`node ${d.day === todayKey ? 'rf-glow' : ''}`} aria-hidden="true">{d.count}</div>
              <h4>{t1}{t2 && <small>{t2}</small>}</h4>
              <div className="ch">
                <span>+{d.count} {d.count > 1 ? tx('cartes') : tx('carte')}</span>
                {prices && <span className="ok">+{nf(d.value)} €</span>}
                {sources.map(s => <span key={s} className="src">{SOURCE[s] || s}</span>)}
              </div>
              <div className="cards">
                {d.cards.map(c => {
                  const card = catalogById.get(c.cardId);
                  if (!card) return null;
                  const pep = best && best.id === c.cardId && best.p > 3;
                  return (
                    <div key={c.cardId} className={pep ? 'pep' : ''}>
                      <CardTileMobile card={card} name={displayName(card)} label={false} onOpen={(id) => onOpen(id, { list: ids })} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {days.length > shownDays && (
          <button type="button" className="vtall !margin-0 mb-5" onClick={() => setShownDays(n => n + PAGE_DAYS)}>{tx('Afficher plus')}</button>
        )}
      </div>
    </div>
  );
}
