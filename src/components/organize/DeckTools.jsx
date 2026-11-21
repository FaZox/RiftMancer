import React, { useMemo, useState } from 'react';
import { Shuffle, Hand, RotateCcw, Plus } from 'lucide-react';
import { Sheet } from './DeckDialogs.jsx';
import CardImage from '../common/CardImage.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { newHand, mulligan, drawCard, expandLibrary, championInZone } from '../../lib/handSim.js';
import { GAME, probabilityByTurn, cardsSeenByTurn } from '../../lib/probability.js';import { tx } from '../../lib/i18n.js';


/**
 * « Main de départ » (draw a hand, mulligan, draw the next turns) and
 * « Probabilités » (exact odds of having a card by turn N). Phone and PC.
 * Rules used (configurable in probability.js GAME): 4-card hand, mulligan of
 * up to 2 cards (to the bottom of the deck), one draw per turn.
 */
export function HandDialog({ deck, onClose }) {
  const [tab, setTab] = useState('hand');
  const size = expandLibrary(deck).length;
  return (
    <Sheet title={tx('{name} — main de départ & probabilités', { name: deck.name })} onClose={onClose}>
      <div role="tablist" className="flex">
        {[['hand', tx('Main de départ')], ['odds', tx('Probabilités')]].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="chip flex-1 h-9 text-sm">{l}</button>
        ))}
      </div>
      {!championInZone(deck) && (
        <p className="text-[11px] text-amber-300">{tx('⚠ Aucun champion choisi dans le deck principal : toutes les cartes sont mélangées. En partie, le champion choisi commence en Champion Zone, hors de la pioche.')}</p>
      )}
      {size < GAME.handSize
        ? <p className="text-sm text-rift-400">{tx('Ajoutez au moins')} {GAME.handSize} {tx('cartes au deck principal.')}</p>
        : tab === 'hand' ? <HandSim deck={deck} /> : <Odds deck={deck} />}
    </Sheet>
  );
}

function HandSim({ deck }) {
  const [state, setState] = useState(() => newHand(deck));
  const [picked, setPicked] = useState([]);
  const m = getMatcher();
  const toggle = (i) => {
    if (state.mulliganDone) return;
    setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : p.length < GAME.mulliganMax ? [...p, i] : p));
  };
  const champ = championInZone(deck) ? m.getCardData(deck.championId) : null;
  return (
    <div className="space-y-2">
      {champ && (
        <div className="flex items-center gap-2 text-xs text-rift-300">
          <span className="w-10 border border-gold-500/40"><CardImage cardData={champ} /></span>
          <span>{tx('En Champion Zone :')} <b className="text-rift-100">{getLocalizedName(champ, displayLanguage())}</b> {tx('(hors de la pioche, toujours disponible)')}</span>
        </div>
      )}
      <p className="text-xs text-rift-400">
        {state.mulliganDone
          ? tx('Tour {turn} · {length} cartes dans le deck', { turn: state.turn, length: state.library.length })
          : tx('Touchez jusqu’à {mulliganMax} cartes à remplacer, puis « Mulligan » (ou gardez la main).', { mulliganMax: GAME.mulliganMax })}
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
        {state.hand.map((id, i) => (
          <button key={`${id}-${i}`} onClick={() => toggle(i)} title={getLocalizedName(m.getCardData(id), displayLanguage())}
            className={`relative border-2 ${picked.includes(i) ? 'border-[#ff8a80] opacity-60' : i >= GAME.handSize ? 'border-gold-400/60' : 'border-transparent'}`}>
            <CardImage cardData={m.getCardData(id)} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {!state.mulliganDone && (
          <button onClick={() => { setState(s => mulligan(s, picked)); setPicked([]); }} disabled={!picked.length} className="btn-secondary text-sm h-10 px-3">
            <Shuffle className="w-4 h-4" /> {tx('Mulligan (')}{picked.length})
          </button>
        )}
        <button onClick={() => { setState(s => drawCard(s)); setPicked([]); }} disabled={!state.library.length} className="btn-secondary text-sm h-10 px-3">
          <Plus className="w-4 h-4" /> {tx('Piocher')}
        </button>
        <button onClick={() => { setState(newHand(deck)); setPicked([]); }} className="btn-primary text-sm h-10 px-3">
          <RotateCcw className="w-4 h-4" /> {tx('Nouvelle main')}
        </button>
      </div>
    </div>
  );
}

function Odds({ deck }) {
  const m = getMatcher();
  const main = useMemo(() => (deck.cards || []).filter(s => s.zone === 'main' && s.quantity > 0)
    .map(s => ({ ...s, card: m.getCardData(s.cardId) }))
    .filter(s => s.card)
    .sort((a, b) => getLocalizedName(a.card, displayLanguage()).localeCompare(getLocalizedName(b.card, displayLanguage()))), [deck, m]);
  // The deck that is drawn from: one copy of the Chosen Champion starts in the Champion Zone.
  const inZone = championInZone(deck) ? deck.championId : null;
  const inLibrary = (s) => s.quantity - (s.cardId === inZone ? 1 : 0);
  const deckSize = main.reduce((n, s) => n + inLibrary(s), 0);
  const [sel, setSel] = useState(() => new Set(main[0] ? [main[0].cardId] : []));
  const [need, setNeed] = useState(1);
  const [onThePlay, setOnThePlay] = useState(true);
  const copies = main.filter(s => sel.has(s.cardId)).reduce((n, s) => n + inLibrary(s), 0);
  const turns = [1, 2, 3, 4, 5, 6, 8, 10];
  const fmt = (p) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)} %`;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-rift-400">{tx('Cochez une carte ou un groupe de cartes (ex. tous vos sorts à 2 énergie). Calcul exact (loi hypergéométrique), main de')} {GAME.handSize} {tx('+ une pioche par tour.')}</p>
      <div className="max-h-48 overflow-y-auto border border-rift-600/40 divide-y divide-rift-700/50">
        {main.map(s => (
          <label key={s.cardId} className="flex items-center gap-2 px-2 py-1.5 text-rift-200">
            <input type="checkbox" checked={sel.has(s.cardId)} onChange={() => setSel(x => { const n = new Set(x); if (n.has(s.cardId)) n.delete(s.cardId); else n.add(s.cardId); return n; })} />
            <span className="flex-1 truncate">{getLocalizedName(s.card, displayLanguage())}</span>
            <span className="text-rift-400">×{s.quantity}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-rift-300">{tx('Au moins')}</span>
        {[1, 2, 3].map(n => <button key={n} onClick={() => setNeed(n)} aria-pressed={need === n} className="chip h-8 px-2">{n}</button>)}
        <span className="text-rift-300">{tx('exemplaire')}{need > 1 ? 's' : ''} ·</span>
        {[[true, tx('En premier')], [false, tx('En second')]].map(([v, l]) => <button key={l} onClick={() => setOnThePlay(v)} aria-pressed={onThePlay === v} className="chip h-8 px-2">{l}</button>)}
      </div>
      <p className="text-xs text-rift-400">
        {copies} {tx('carte')}{copies > 1 ? 's' : ''} {tx('sur')} {deckSize} {tx('dans la pioche')}{inZone ? ' (le champion choisi commence en Champion Zone)' : ''}.
        {inZone && sel.has(inZone) && <span className="text-gold-400"> + 1 {getLocalizedName(m.getCardData(inZone), displayLanguage())} {tx('en Champion Zone, toujours disponible.')}</span>}
      </p>
      <table className="w-full text-sm">
        <thead><tr className="text-rift-400 text-xs"><th className="text-left font-normal">{tx('Tour')}</th><th className="text-left font-normal">{tx('Cartes vues')}</th><th className="text-right font-normal">{tx('Probabilité')}</th></tr></thead>
        <tbody>
          {turns.map(t => {
            const p = probabilityByTurn({ deckSize, copies, atLeastCopies: need, turn: t, onThePlay });
            return (
              <tr key={t} className="border-t border-rift-700/60">
                <td className="py-1 text-rift-200">{t}</td>
                <td className="py-1 text-rift-400">{Math.min(deckSize, cardsSeenByTurn(t, onThePlay))}</td>
                <td className="py-1 text-right">
                  <span className="inline-block w-24 h-1.5 bg-rift-700 mr-2 align-middle"><span className="block h-full bg-gold-400" style={{ width: `${p * 100}%` }} /></span>
                  <span className="text-rift-100 font-semibold">{fmt(p)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-rift-500">{tx('Sans compter le mulligan (qui augmente un peu les chances).')}</p>
    </div>
  );
}

export const HandIcon = Hand;
