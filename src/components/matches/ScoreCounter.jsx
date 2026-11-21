import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, Dice5, RotateCcw, Save, StickyNote, Undo2 } from 'lucide-react';
import { GAME } from '../../lib/probability.js';
import { keepAwake } from '../../lib/keepAwake.js';
import { useBackHandler } from '../../lib/backButton.js';
import { getCardThumbUrl } from '../../lib/cardMatcher.js';
import { LegendSelect, legendName } from './MatchesView.jsx';
import { OpponentPlanSheet } from '../organize/OpponentNotes.jsx';
import Dialog from '../common/Dialog.jsx';
import Sheet from '../common/Sheet.jsx';
import {
  MODES, sidesOf, scoreOf, addPoint, removePoint, undoLast, leader, scoreText, packLog,
  loadRunning, saveRunning, clearRunning, resumable,
} from '../../lib/scoreGame.js';
import { tx, locale } from '../../lib/i18n.js';

// Objectif de points in 1v1, also set in Réglages → Jeu
export const COUNTER_TARGET_KEY = 'rb.counter.target';
const TARGET_KEY = COUNTER_TARGET_KEY;
const readTarget = () => {
  try { return Number(localStorage.getItem(TARGET_KEY)) || GAME.victoryScore; } catch { return GAME.victoryScore; }
};
const targetFor = (mode) => (mode === '1v1' ? readTarget() : MODES[mode].target);

// One colour per player: the history's diamonds and the tint of each zone (tel-06)
const SIDE_COLORS = ['#9b5de5', '#3a8fd9', '#e2463a', '#3fb68b'];
const Diamond = ({ side, size = 8 }) => (
  <i aria-hidden="true" className="inline-block flex-shrink-0" style={{ width: size, height: size, transform: 'rotate(45deg)', background: SIDE_COLORS[side] }} />
);

/**
 * Score counter for a game (full screen, made for the phone placed between
 * the players: the others' zones are upside down). Modes 1v1 / 2v2 /
 * chacun pour soi (lot 7.5, B.6.4), point by point history in the middle
 * (a long press opens the list and « Annuler le dernier point »), random
 * first player, Bo1 / Bo3, screen kept on, a game in progress kept and
 * offered again (« Reprendre la partie en cours (5 – 3) ? »).
 * At the end: « Enregistrer le match » creates the match (MatchesView).
 */
export default function ScoreCounter({ decks, matches = [], legends, defaultDeckId, defaultMyLegendId, defaultOppLegendId, onSave, onClose }) {
  const initialDeck = decks.find(d => d.id === defaultDeckId);
  const [g, setG] = useState(() => ({
    mode: '1v1', players: 4, target: readTarget(), format: 'bo1',
    deckId: defaultDeckId || null, myLegendId: initialDeck?.legendId || defaultMyLegendId || null,
    partnerLegendId: null, oppLegendId: defaultOppLegendId || null, opp2LegendId: null,
    log: [], first: null, games: [], saved: false,
  }));
  const set = (patch) => setG(x => ({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }));
  const [resume, setResume] = useState(() => { const r = loadRunning(); return resumable(r) ? r : null; });
  const [notes, setNotes] = useState(false);
  const [history, setHistory] = useState(false);
  useBackHandler(true, onClose);

  useEffect(() => {
    keepAwake(true);
    return () => { keepAwake(false); };
  }, []);
  useEffect(() => { if (g.mode === '1v1') { try { localStorage.setItem(TARGET_KEY, String(g.target)); } catch { /* ignore */ } } }, [g.mode, g.target]);
  // The game in progress, kept at every point (not while the resume question is open)
  useEffect(() => { if (!resume) saveRunning({ ...g, at: Date.now() }); }, [g, resume]);

  const { mode, target, format, log, games } = g;
  const sides = sidesOf(mode, g.players);
  const score = scoreOf(log, sides);
  const deck = decks.find(d => d.id === g.deckId);
  const started = log.length > 0 || games.length > 0;
  const wins = games.filter(x => x.result === 'win').length;
  const losses = games.filter(x => x.result === 'loss').length;
  const needed = format === 'bo3' ? 2 : 1;
  const over = wins >= needed || losses >= needed || (format === 'bo1' && games.length >= 1);
  const winner = leader(log, sides, target);

  const add = (side, d) => {
    if (over) return;
    set(x => ({ log: d > 0 ? addPoint(x.log, side, sides, x.target) : removePoint(x.log, side) }));
  };
  const endGame = (result) => {
    const others = score.slice(1);
    const game = {
      result, wentFirst: g.first == null ? null : g.first === 0,
      myScore: score[0], oppScore: Math.max(0, ...others), points: packLog(log),
      ...(sides > 2 ? { scores: score } : {}),
    };
    // Next game of a Bo3: the loser usually chooses — toss again by default.
    set(x => ({ games: [...x.games, game], log: [], first: null }));
  };
  const toss = () => set({ first: Math.floor(Math.random() * sides) });
  const setMode = (m) => !started && set({ mode: m, target: targetFor(m), first: null });
  const save = () => {
    const result = wins > losses ? 'win' : losses > wins ? 'loss' : 'draw';
    onSave({
      date: Date.now(), mode, ...(mode === 'ffa' ? { players: sides } : {}),
      deckId: deck?.id || null, myLegendId: g.myLegendId || deck?.legendId || null,
      oppLegendId: mode === 'ffa' ? null : g.oppLegendId,
      ...(mode === '2v2' ? { partnerLegendId: g.partnerLegendId, oppLegendIds: [g.oppLegendId, g.opp2LegendId].filter(Boolean) } : {}),
      wentFirst: games[0]?.wentFirst ?? null, result, format, games,
    });
    set({ saved: true });
    clearRunning();
  };

  const names = mode === '1v1' ? ['Moi', 'Adversaire'] : mode === '2v2' ? [tx('Mon équipe'), tx('Équipe adverse')] : ['Moi', tx('Joueur 2'), tx('Joueur 3'), tx('Joueur 4')];
  const legendsOf = (side) => (mode === '1v1' ? [side ? g.oppLegendId : g.myLegendId]
    : mode === '2v2' ? (side ? [g.oppLegendId, g.opp2LegendId] : [g.myLegendId, g.partnerLegendId]) : side ? [] : [g.myLegendId]);
  const compact = sides > 2;

  const zone = (side, flipped = false) => (
    <div key={side} className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-2 ${compact ? 'p-2' : 'p-3'} ${flipped ? 'rotate-180 lg:rotate-0' : ''}`}
      style={{ background: `linear-gradient(${flipped ? '0deg' : '180deg'}, ${SIDE_COLORS[side]}33, transparent 70%), #0b1120` }}>
      <p className="flex items-center gap-1.5 text-[13px] text-rift-300">
        {legendsOf(side).filter(Boolean).map(id => <img key={id} src={getCardThumbUrl(id)} alt="" className="w-7 h-7 object-cover object-top" />)}
        <span>{names[side]}{mode === '1v1' ? ` · ${legendName(legendsOf(side)[0])}` : ''}</span>
        {g.first === side && <span className="text-gold-400">{tx('● commence')}</span>}
      </p>
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-6'}`}>
        <button onClick={() => add(side, -1)} aria-label={`${names[side]} : un point de moins`}
          className={`${compact ? 'w-12 h-12' : 'w-20 h-20'} flex items-center justify-center border-2 border-rift-500 text-rift-100 active:bg-rift-700`}><Minus className={compact ? 'w-6 h-6' : 'w-10 h-10'} /></button>
        <span className={`${compact ? 'w-12 text-[48px]' : 'w-28 text-[84px]'} text-center font-display leading-none font-bold ${winner === side ? 'text-gold-400' : 'text-rift-100'}`}>{score[side]}</span>
        <button onClick={() => add(side, 1)} aria-label={`${names[side]} : un point de plus`}
          className={`${compact ? 'w-12 h-12' : 'w-20 h-20'} flex items-center justify-center border-2 border-gold-400 text-gold-400 active:bg-gold-500/20`}><Plus className={compact ? 'w-6 h-6' : 'w-10 h-10'} /></button>
      </div>
      <p className="flex flex-wrap justify-center gap-2 min-h-[10px] max-w-[260px]" aria-hidden="true">
        {Array.from({ length: score[side] }, (_, i) => <Diamond key={i} side={side} size={10} />)}
      </p>
    </div>
  );

  // Long press on the history: the list, and « Annuler le dernier point »
  const press = useRef(null);
  const holdStart = () => { press.current = setTimeout(() => setHistory(true), 450); };
  const holdEnd = () => clearTimeout(press.current);
  const frise = (
    <button type="button" aria-label={tx('Historique des points : {length} point{v1} (appui long pour la liste)', { length: log.length, v1: log.length > 1 ? 's' : '' })}
      onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onContextMenu={(e) => { e.preventDefault(); setHistory(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHistory(true); } }}
      className="w-full flex items-center justify-center gap-1.5 min-h-[28px] px-2 select-none touch-none">
      {log.length ? log.map((s, i) => <Diamond key={i} side={s} />) : <span className="text-[11px] text-rift-500">{tx('Aucun point pour l’instant')}</span>}
      <span className="ml-2 text-[11px] text-rift-500">{tx('objectif')} {target}</span>
    </button>
  );

  const controls = (
    <div className="flex-shrink-0 bg-rift-800/90 border-y lg:border-y-0 lg:border-x border-gold-500/30 p-2 lg:w-[340px] lg:p-4 lg:overflow-y-auto">
      {frise}
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs mt-1">
        <button onClick={onClose} aria-label={tx('Fermer')} className="btn-ghost h-9 px-2"><X className="w-4 h-4" /></button>
        <button onClick={toss} className="btn-secondary h-9 px-2"><Dice5 className="w-4 h-4" /> {tx('Qui commence ?')}</button>
        <button onClick={() => set({ log: [] })} className="btn-ghost h-9 px-2"><RotateCcw className="w-4 h-4" /> {tx('Remettre à 0')}</button>
        {mode !== 'ffa' && <button onClick={() => setNotes(true)} className="btn-ghost h-9 px-2"><StickyNote className="w-4 h-4" /> {tx('Notes')}</button>}
        <label className="flex items-center gap-1 text-rift-300">{tx('Objectif')}
          <input type="number" min="1" max="30" value={target} onChange={(e) => set({ target: Math.max(1, Math.min(30, Number(e.target.value) || MODES[mode].target)) })}
            className="w-12 h-9 bg-rift-900 border border-rift-600 text-center text-rift-100" />
        </label>
        {[['bo1', tx('Bo1')], ['bo3', tx('Bo3')]].map(([v, l]) => (
          <button key={v} onClick={() => !games.length && set({ format: v })} aria-pressed={format === v} disabled={!!games.length} className="chip h-9 px-2">{l}</button>
        ))}
      </div>
      {!started ? (
        <div className="mt-2 space-y-1.5">
          <div className="seg" role="group" aria-label={tx('Mode de jeu')}>
            {Object.entries(MODES).map(([k, m]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{m.label}</button>)}
          </div>
          {mode === 'ffa' && (
            <div className="seg" role="group" aria-label={tx('Nombre de joueurs')}>
              {[3, 4].map(n => <button key={n} aria-pressed={sides === n} onClick={() => set({ players: n })}>{n} {tx('joueurs')}</button>)}
            </div>
          )}
        </div>
      ) : mode !== '1v1' && <p className="mt-1 text-center text-[12px] text-rift-400">{MODES[mode].label}{mode === 'ffa' ? ` · ${sides} joueurs` : ''}</p>}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
        <select value={g.deckId || ''} aria-label={tx('Mon deck')} onChange={(e) => { const d = decks.find(x => x.id === e.target.value); set({ deckId: d?.id || null, ...(d?.legendId ? { myLegendId: d.legendId } : {}) }); }}
          className="bg-rift-900 border border-rift-600 text-rift-100 text-xs px-2 h-9">
          <option value="">{tx('— Mon deck —')}</option>
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <LegendSelect value={g.myLegendId} onChange={(v) => set({ myLegendId: v })} legends={legends} placeholder={tx('Ma Légende…')} className="h-9 text-xs" />
        {mode === '2v2' && <LegendSelect value={g.partnerLegendId} onChange={(v) => set({ partnerLegendId: v })} legends={legends} placeholder={tx('Légende partenaire…')} className="h-9 text-xs" />}
        {mode !== 'ffa' && <LegendSelect value={g.oppLegendId} onChange={(v) => set({ oppLegendId: v })} legends={legends} placeholder={tx('Légende adverse…')} className="h-9 text-xs" />}
        {mode === '2v2' && <LegendSelect value={g.opp2LegendId} onChange={(v) => set({ opp2LegendId: v })} legends={legends} placeholder={tx('2e Légende adverse…')} className="h-9 text-xs" />}
      </div>
      <div className="mt-2 text-center text-xs text-rift-300">
        {format === 'bo3' && <p>{tx('Manches :')} {wins} – {losses}</p>}
        {g.first != null && <p className="text-gold-400">{g.first === 0 ? tx('Vous commencez') : `${names[g.first]} commence`}</p>}
      </div>
      {!over && winner != null && (
        <button onClick={() => endGame(winner === 0 ? 'win' : 'loss')} className="btn-primary w-full h-11 mt-2">
          {winner === 0 ? tx('Manche gagnée') : tx('Manche perdue')} {tx('— valider')}
        </button>
      )}
      {!over && winner == null && log.length > 0 && (
        <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
          <button onClick={() => endGame('win')} className="btn-ghost h-8">{tx('Gagnée')}</button>
          <button onClick={() => endGame('loss')} className="btn-ghost h-8">{tx('Perdue')}</button>
          <button onClick={() => endGame('draw')} className="btn-ghost h-8">{tx('Nulle')}</button>
        </div>
      )}
      {over && !g.saved && (
        <button onClick={save} className="btn-primary w-full h-11 mt-2"><Save className="w-4 h-4" /> {tx('Enregistrer le match (')}{wins > losses ? 'victoire' : losses > wins ? tx('défaite') : 'nul'})</button>
      )}
      {g.saved && <p className="mt-2 text-center text-sm text-state-ok">{tx('Match enregistré ✓')}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-rift-900 flex flex-col lg:flex-row">
      {sides === 2 ? (
        <>
          {zone(1, true)}
          {controls}
          {zone(0)}
        </>
      ) : (
        <>
          {/* Chacun pour soi: the others across the table, upside down; me (and the 4th player) on my side */}
          <div className="flex-1 flex min-h-0 lg:flex-col">{zone(1, true)}{zone(2, true)}</div>
          {controls}
          <div className="flex-1 flex min-h-0 lg:flex-col">{zone(0)}{sides === 4 && zone(3)}</div>
        </>
      )}

      {/* above the counter (z-80) */}
      <div className="relative z-[90]">
        <Sheet open={history} onClose={() => setHistory(false)} title={tx('Historique des points')}>
          {log.length ? (
            <ol className="panel divide-y divide-rift-700/60 max-h-[50vh] overflow-y-auto">
              {log.map((s, i) => {
                const after = scoreOf(log.slice(0, i + 1), sides);
                return (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-[14px]">
                    <span className="w-6 text-right text-rift-400">{i + 1}</span>
                    <Diamond side={s} size={10} />
                    <span className="flex-1 text-rift-100">{names[s]} +1</span>
                    <span className="text-rift-400">{after.join(' – ')}</span>
                  </li>
                );
              }).reverse()}
            </ol>
          ) : <p className="text-[14px] text-rift-400">{tx('Aucun point marqué dans cette manche.')}</p>}
          <button onClick={() => set(x => ({ log: undoLast(x.log) }))} disabled={!log.length} className="btn-secondary w-full min-h-[44px] mt-3">
            <Undo2 className="w-4 h-4" /> {tx('Annuler le dernier point')}
          </button>
        </Sheet>
        <Dialog open={!!resume} title={resume ? tx('Reprendre la partie en cours ({replace}) ?', { replace: scoreText(resume.log || [], sidesOf(resume.mode, resume.players)).replace(/ /g, ' ') }) : ''}
          confirmLabel={tx('Reprendre')} cancelLabel={tx('Nouvelle partie')}
          onConfirm={() => { setG({ ...resume, saved: false }); setResume(null); }}
          onCancel={() => { clearRunning(); setResume(null); }}>
          {resume && (
            <p className="text-[14px] text-rift-300">
              {MODES[resume.mode]?.label || '1v1'}{resume.games?.length ? tx(' · {length} manche{v1} jouée{v2}', { length: resume.games.length, v1: resume.games.length > 1 ? 's' : '', v2: resume.games.length > 1 ? 's' : '' }) : ''}
              {' · '}{tx('interrompue le')} {new Date(resume.at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </Dialog>
      </div>
      <OpponentPlanSheet open={notes} deck={deck} legendId={g.oppLegendId} matches={matches} onClose={() => setNotes(false)} />
    </div>
  );
}
