import React, { useMemo, useState } from 'react';
import { Minus, Plus, Pencil, Check } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import DiffList from '../common/DiffList.jsx';
import { getMatcher, getCardThumbUrl } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { canonicalLegend, useLegends, LegendSelect } from '../matches/MatchesView.jsx';
import { opponentRows, planFor, setPlan, planChoices, adjust, planIssues, hasPlan } from '../../lib/opponentNotes.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Adversaires » (lot 7.4, B.6.3, tel-16): one line per Legend met with this
 * deck (portrait, win rate, games); a tap opens the notes and the sideboard
 * plan in two columns « Sortir » / « Rentrer ». The same view, read only,
 * opens from the points counter (OpponentPlanSheet).
 */
const cardName = (id) => { const c = getMatcher().getCardData(id); return c ? getLocalizedName(c, displayLanguage()) : id; };
const rateClass = (r) => (r == null ? 'text-rift-400' : r >= 50 ? 'text-state-ok' : 'text-state-bad');
const record = (r) => (r.games ? `${r.rate} % · ${r.games} partie${r.games > 1 ? 's' : ''}` : tx('pas encore jouée'));

function Portrait({ legendId, size = 40 }) {
  return legendId
    ? <img src={getCardThumbUrl(legendId)} alt="" className="object-cover object-top flex-shrink-0 bg-rift-700" style={{ width: size, height: size }} loading="lazy" />
    : <span className="bg-rift-700 flex-shrink-0" style={{ width: size, height: size }} aria-hidden="true" />;
}

export default function OpponentNotes({ deck, matches, onSave }) {
  const legends = useLegends();
  const [open, setOpen] = useState(null); // legendId
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => opponentRows(deck, matches, canonicalLegend), [deck, matches]);
  const row = open ? (rows.find(r => r.legendId === open) || { legendId: open, games: 0, rate: null }) : null;

  return (
    <div className="space-y-3">
      {!rows.length && (
        <p className="text-[14px] text-rift-400">{tx('Aucun adversaire pour l’instant. Les Légendes adverses de vos matchs avec ce deck apparaîtront ici ; vous pouvez aussi préparer un plan à l’avance.')}</p>
      )}
      <ul className="panel divide-y divide-rift-700/60">
        {rows.map(r => (
          <li key={r.legendId}>
            <button type="button" onClick={() => setOpen(r.legendId)} className="w-full flex items-center gap-3 px-3 py-2 min-h-[56px] text-left hover:bg-rift-700/40">
              <Portrait legendId={r.legendId} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-rift-100 truncate">{cardName(r.legendId)}</span>
                <span className="block text-[13px] text-rift-400">{r.games ? `${r.games} partie${r.games > 1 ? 's' : ''}` : tx('Pas encore jouée')}{hasPlan(r.plan) ? tx(' · plan prêt') : ''}</span>
              </span>
              <span className={`text-[15px] font-semibold ${rateClass(r.rate)}`}>{r.rate == null ? '—' : `${r.rate} %`}</span>
            </button>
          </li>
        ))}
      </ul>
      {adding
        ? <LegendSelect value={null} legends={legends} placeholder={tx('Choisir la Légende adverse…')} className="w-full"
            onChange={(id) => { setAdding(false); if (id) setOpen(id); }} />
        : <button type="button" onClick={() => setAdding(true)} className="btn-secondary min-h-[44px] px-4 text-[14px]"><Plus className="w-4 h-4" /> {tx('Préparer un plan contre une Légende')}</button>}

      <Sheet open={!!row} onClose={() => setOpen(null)} title={row ? `Contre ${cardName(row.legendId)}` : ''}>
        {row && <PlanEditor deck={deck} legendId={row.legendId} row={row} onSave={onSave} />}
      </Sheet>
    </div>
  );
}

/** The plan, read only, then « Modifier ». */
function PlanEditor({ deck, legendId, row, onSave }) {
  const [editing, setEditing] = useState(false);
  const plan = planFor(deck, legendId);
  const choices = planChoices(deck);
  const change = (patch) => onSave(setPlan(deck, legendId, patch));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Portrait legendId={legendId} size={44} />
        <span className="flex-1 text-[15px] text-rift-100">{cardName(legendId)}</span>
        <span className={`text-[14px] font-semibold ${rateClass(row.rate)}`}>{record(row)}</span>
      </div>
      {editing ? (
        <>
          <label className="block space-y-1">
            <span className="block text-[13px] text-rift-300">{tx('Notes')}</span>
            <textarea value={plan.note} onChange={e => change({ note: e.target.value })} rows={4} maxLength={2000}
              placeholder={tx('Ce qu’il faut savoir contre cette Légende…')}
              className="w-full bg-rift-900 border border-rift-600/40 text-[14px] text-rift-100 p-2 focus:outline-none focus:border-gold-500/60" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PlanColumn title={tx('Sortir')} sign="−" list={plan.out} pool={choices.out} empty={tx('Aucune carte dans le deck.')}
              onChange={(out) => change({ out })} />
            <PlanColumn title={tx('Rentrer')} sign="+" list={plan.in} pool={choices.in} empty={tx('La réserve est vide : ajoutez-y des cartes dans l’onglet Deck.')}
              onChange={(inn) => change({ in: inn })} />
          </div>
          <button type="button" onClick={() => setEditing(false)} className="btn-primary w-full min-h-[44px]"><Check className="w-4 h-4" /> {tx('Terminé')}</button>
        </>
      ) : (
        <>
          <PlanView deck={deck} plan={plan} />
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary w-full min-h-[44px]"><Pencil className="w-4 h-4" /> {tx('Modifier')}</button>
        </>
      )}
    </div>
  );
}

/** Notes, then « Sortir » / « Rentrer » side by side (tel-16). */
export function PlanView({ deck, plan }) {
  const line = (s, op) => ({ op, label: `${s.quantity} ${cardName(s.cardId)}`, cardId: s.cardId });
  const issues = planIssues(deck, plan);
  if (!hasPlan(plan)) return <p className="text-[14px] text-rift-400">{tx('Pas encore de notes ni de plan de réserve contre cette Légende.')}</p>;
  return (
    <div className="space-y-3">
      {plan.note?.trim() && (
        <div>
          <p className="text-[12px] uppercase tracking-wider text-rift-400 mb-1">{tx('Notes')}</p>
          <p className="panel p-3 text-[14px] text-rift-200 whitespace-pre-wrap">{plan.note}</p>
        </div>
      )}
      {(plan.out.length > 0 || plan.in.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-[12px] uppercase tracking-wider text-rift-400 mb-1">{tx('Sortir')}</p>{plan.out.length ? <DiffList items={plan.out.map(s => line(s, '-'))} /> : <p className="text-[13px] text-rift-400">{tx('Rien')}</p>}</div>
          <div><p className="text-[12px] uppercase tracking-wider text-rift-400 mb-1">{tx('Rentrer')}</p>{plan.in.length ? <DiffList items={plan.in.map(s => line(s, '+'))} /> : <p className="text-[13px] text-rift-400">{tx('Rien')}</p>}</div>
        </div>
      )}
      {issues.map(t => <p key={t} className="text-[13px] text-state-warn">{t}</p>)}
    </div>
  );
}

function PlanColumn({ title, sign, list, pool, empty, onChange }) {
  const rest = [...pool.keys()].filter(id => !list.some(s => s.cardId === id))
    .sort((a, b) => cardName(a).localeCompare(cardName(b), 'fr'));
  return (
    <div className="space-y-2">
      <p className="text-[12px] uppercase tracking-wider text-rift-400">{title}</p>
      {list.map(s => (
        <div key={s.cardId} className="flex items-center gap-2">
          <span className={`w-3 font-bold ${sign === '+' ? 'text-state-ok' : 'text-state-bad'}`} aria-hidden="true">{sign}</span>
          <span className="flex-1 min-w-0 text-[14px] text-rift-100 truncate">{cardName(s.cardId)}</span>
          <button type="button" onClick={() => onChange(adjust(list, s.cardId, -1))} aria-label={tx('Une {cardName} de moins', { cardName: cardName(s.cardId) })} className="btn-ghost min-h-[36px] min-w-[36px]"><Minus className="w-4 h-4" /></button>
          <span className="w-5 text-center text-[14px] text-rift-100">{s.quantity}</span>
          <button type="button" onClick={() => onChange(adjust(list, s.cardId, 1, pool.get(s.cardId) || 0))} disabled={s.quantity >= (pool.get(s.cardId) || 0)}
            aria-label={tx('Une {cardName} de plus', { cardName: cardName(s.cardId) })} className="btn-ghost min-h-[36px] min-w-[36px]"><Plus className="w-4 h-4" /></button>
        </div>
      ))}
      {pool.size === 0
        ? <p className="text-[13px] text-rift-400">{empty}</p>
        : rest.length > 0 && (
          <select value="" aria-label={tx('Ajouter une carte à « {title} »', { title })} onChange={e => e.target.value && onChange(adjust(list, e.target.value, 1, pool.get(e.target.value)))}
            className="w-full h-10 bg-rift-900 border border-rift-600/40 text-[14px] text-rift-100 px-2">
            <option value="">{tx('+ Ajouter une carte…')}</option>
            {rest.map(id => <option key={id} value={id}>{cardName(id)} (×{pool.get(id)})</option>)}
          </select>
        )}
    </div>
  );
}

/** From the points counter: the plan against the opposing Legend, read only. */
export function OpponentPlanSheet({ open, deck, legendId, matches, onClose }) {
  const rows = useMemo(() => (deck ? opponentRows(deck, matches, canonicalLegend) : []), [deck, matches]);
  const id = legendId ? canonicalLegend(legendId) : null;
  const row = rows.find(r => r.legendId === id) || { games: 0, rate: null };
  return (
    // above the counter (z-80)
    <div className="relative z-[90]">
      <Sheet open={open} onClose={onClose} title={id ? `Contre ${cardName(id)}` : tx('Notes')}>
        {!deck && <p className="text-[14px] text-rift-400">{tx('Choisissez votre deck pour voir vos notes.')}</p>}
        {deck && !id && <p className="text-[14px] text-rift-400">{tx('Choisissez la Légende adverse pour voir vos notes et votre plan de réserve.')}</p>}
        {deck && id && (
          <div className="space-y-3">
            <p className={`text-[14px] font-semibold ${rateClass(row.rate)}`}>{deck.name} · {record(row)}</p>
            <PlanView deck={deck} plan={planFor(deck, id)} />
            <p className="text-[13px] text-rift-400">{tx('Pour modifier : Decks →')} {deck.name} {tx('→ Adversaires.')}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
