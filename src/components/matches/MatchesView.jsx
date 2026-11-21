import React, { useMemo, useState } from 'react';
import { Trophy, Timer, Download, Pencil, Trash2, X, Plus } from 'lucide-react';
import { allCards } from '../../lib/catalog.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { computeStats, matchesToCsv, matchResult, RESULT_LABEL, SMALL_SAMPLE } from '../../lib/matchStats.js';
import { saveTextFile } from '../../lib/saveText.js';
import { legendReferences, canonicalLegendId } from '../../lib/legends.js';
import ScoreCounter from './ScoreCounter.jsx';
import { offerUndo } from '../../lib/undo.js';
import { withDeckVersion } from '../../lib/deckVersions.js';
import { MODES } from '../../lib/scoreGame.js';
import { tx, locale } from '../../lib/i18n.js';

const PREF_KEY = 'rb.match.quick';
function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

/** Reference card of every Legend (alternate arts merged, legends.js). */
let refsCache = { cards: null, refs: null };
function legendRefs() {
  const cards = allCards();
  if (refsCache.cards !== cards) refsCache = { cards, refs: legendReferences(cards.filter(c => c.type === 'legend')) };
  return refsCache.refs;
}

/** Any print of a Legend → the reference print (the one in the menus and the stats). */
export function canonicalLegend(id) {
  return canonicalLegendId(id, (x) => getMatcher().getCardData(x), legendRefs());
}

/** Legends of the catalog, one per Legend (alternate arts merged), sorted by French name. */
export function useLegends() {
  return useMemo(() => [...legendRefs().values()]
    .sort((a, b) => getLocalizedName(a, displayLanguage()).localeCompare(getLocalizedName(b, displayLanguage()), 'fr')), []);
}

export const legendName = (id) => {
  const c = id ? getMatcher().getCardData(id) : null;
  return c ? getLocalizedName(c, displayLanguage()) : '—';
};

const RESULT_STYLE = {
  win: 'bg-[#7fd6a4]/15 text-[#7fd6a4] border-[#7fd6a4]/50',
  loss: 'bg-[#ff8a80]/15 text-[#ff8a80] border-[#ff8a80]/50',
  draw: 'bg-rift-700 text-rift-200 border-rift-500',
};
const pct = (r) => (r?.winrate == null ? '—' : `${Math.round(r.winrate * 100)} %`);

export function LegendSelect({ value, onChange, legends, placeholder = tx('Légende…'), className = '' }) {
  // An alternate art (e.g. the deck's Legend) shows as its Legend.
  return (
    <select value={value ? canonicalLegend(value) : ''} onChange={(e) => onChange(e.target.value || null)}
      className={`bg-rift-800 border border-rift-600 text-rift-100 text-sm px-2 h-10 min-w-0 focus:outline-none focus:border-gold-400 ${className}`}>
      <option value="">{placeholder}</option>
      {legends.map(l => <option key={l.id} value={l.id}>{getLocalizedName(l, displayLanguage())}</option>)}
    </select>
  );
}

/**
 * « Matchs »: quick entry after a game (≤ 3 taps), history, statistics
 * (win rate per deck / Legend, matchups, first / second, events), CSV,
 * and the score counter. Same component on the phone and the PC.
 */
export default function MatchesView({ org, showNotification = () => {}, counterButton = true }) {
  const { matches, decks } = org;
  const legends = useLegends();
  const [tab, setTab] = useState('play');
  const [editing, setEditing] = useState(null);
  const [counter, setCounter] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const setPref = (patch) => { const p = { ...prefs, ...patch }; setPrefs(p); writePrefs(p); };

  const deckList = decks.items;
  const deckOf = (id) => decks.byId.get(id);
  const deck = deckOf(prefs.deckId) || null;
  const myLegendId = deck?.legendId || prefs.myLegendId || null;
  const sorted = useMemo(() => [...matches.items].sort((a, b) => (b.date || b.createdAt) - (a.date || a.createdAt)), [matches.items]);
  const recentOpp = useMemo(() => [...new Set(sorted.map(m => m.oppLegendId).filter(Boolean).map(canonicalLegend))].slice(0, 6), [sorted]);
  const stats = useMemo(() => computeStats(matches.items, { legendOf: canonicalLegend }), [matches.items]);

  const quickSave = (result) => {
    matches.save(withDeckVersion({
      date: Date.now(), deckId: deck?.id || null, myLegendId, oppLegendId: prefs.oppLegendId || null,
      wentFirst: prefs.wentFirst ?? null, result, format: 'bo1', games: [],
      eventName: prefs.eventName || null, eventId: prefs.eventName ? `ev:${prefs.eventName}:${new Date().toISOString().slice(0, 10)}` : null,
    }, decks));
    showNotification(tx('{v0} enregistrée', { v0: RESULT_LABEL[result] }), 'success');
  };

  const exportCsv = async () => {
    const csv = matchesToCsv(matches.items, { cardName: legendName, deckName: (id) => deckOf(id)?.name || '' });
    try {
      const where = await saveTextFile(`riftbound-matchs-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
      showNotification(tx('Exporté : {where}', { where }), 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex">
          {[['play', tx('Saisie')], ['history', tx('Historique ({length})', { length: matches.items.length })], ['stats', tx('Statistiques')]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="chip px-3 h-10 text-sm">{label}</button>
          ))}
        </div>
        <span className="flex-1" />
        {counterButton && <button onClick={() => setCounter(true)} className="btn-primary text-sm h-10 px-3"><Timer className="w-4 h-4" /> {tx('Compteur de points')}</button>}
        <button onClick={exportCsv} disabled={!matches.items.length} className="btn-ghost text-sm h-10 px-3"><Download className="w-4 h-4" /> {tx('CSV')}</button>
      </div>

      {tab === 'play' && (
        <section className="panel p-4 space-y-3 lg:max-w-[760px]">
          <h2 className="font-display text-base font-bold text-gold-400 flex items-center gap-2"><Trophy className="w-4 h-4" /> {tx('Partie terminée ?')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-rift-400 space-y-1">
              <span>{tx('Mon deck')}</span>
              <select value={deck?.id || ''} onChange={(e) => setPref({ deckId: e.target.value || null })}
                className="w-full bg-rift-800 border border-rift-600 text-rift-100 text-sm px-2 h-10 focus:outline-none focus:border-gold-400">
                <option value="">{tx('— Sans deck —')}</option>
                {deckList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            {!deck && (
              <label className="text-xs text-rift-400 space-y-1">
                <span>{tx('Ma Légende')}</span>
                <LegendSelect value={prefs.myLegendId} onChange={(v) => setPref({ myLegendId: v })} legends={legends} className="w-full" />
              </label>
            )}
            <label className="text-xs text-rift-400 space-y-1">
              <span>{tx('Légende adverse')}</span>
              <LegendSelect value={prefs.oppLegendId} onChange={(v) => setPref({ oppLegendId: v })} legends={legends} className="w-full" />
            </label>
            <label className="text-xs text-rift-400 space-y-1">
              <span>{tx('Événement (facultatif)')}</span>
              <input value={prefs.eventName || ''} onChange={(e) => setPref({ eventName: e.target.value })} placeholder={tx('Tournoi, soirée en boutique…')}
                className="w-full bg-rift-800 border border-rift-600 text-rift-100 text-sm px-2 h-10 focus:outline-none focus:border-gold-400" />
            </label>
          </div>
          {recentOpp.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recentOpp.map(id => (
                <button key={id} onClick={() => setPref({ oppLegendId: id })} aria-pressed={prefs.oppLegendId === id} className="chip px-2 h-8 text-xs">
                  {legendName(id)}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-rift-200">
            <span>{tx('J’ai commencé :')}</span>
            {[[true, tx('Oui')], [false, tx('Non')], [null, '?']].map(([v, l]) => (
              <button key={String(v)} onClick={() => setPref({ wentFirst: v })} aria-pressed={(prefs.wentFirst ?? null) === v} className="chip px-3 h-9 text-sm">{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['win', 'loss', 'draw'].map(r => (
              <button key={r} onClick={() => quickSave(r)} className={`h-14 border-2 text-base font-bold ${RESULT_STYLE[r]}`}>
                {RESULT_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-rift-500">{tx('Un appui sur le résultat enregistre le match (Bo1). Pour un Bo3, un événement ou des notes : « Historique » → crayon, ou le compteur de points.')}</p>
        </section>
      )}

      {tab === 'history' && (
        <section className="space-y-1.5">
          <button onClick={() => setEditing({ date: Date.now(), format: 'bo1', games: [], deckId: deck?.id || null, myLegendId })} className="btn-secondary text-sm h-10 px-3"><Plus className="w-4 h-4" /> {tx('Ajouter un match')}</button>
          {sorted.length === 0 && <p className="text-sm text-rift-400">{tx('Aucun match enregistré.')}</p>}
          {sorted.map(m => {
            const r = matchResult(m);
            return (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-rift-800/50 border border-rift-600/40">
                <span className={`w-20 text-center text-xs font-bold border py-1 ${RESULT_STYLE[r]}`}>{RESULT_LABEL[r]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-rift-100 truncate">
                    {m.mode === 'ffa'
                      ? <>{legendName(m.myLegendId)} <span className="text-rift-500">{tx('· chacun pour soi à')} {m.players || '?'}</span></>
                      : <>{legendName(m.myLegendId)} <span className="text-rift-500">{tx('contre')}</span> {legendName(m.oppLegendId)}{m.mode === '2v2' && <span className="text-rift-400"> · 2v2</span>}</>}
                    {m.format === 'bo3' && <span className="text-rift-400"> {tx('· Bo3')} {(m.games || []).filter(g => g.result === 'win').length}-{(m.games || []).filter(g => g.result === 'loss').length}</span>}
                  </span>
                  <span className="block text-[11px] text-rift-400 truncate">
                    {new Date(m.date || m.createdAt).toLocaleDateString(locale())}
                    {m.deckId && deckOf(m.deckId) ? ` · ${deckOf(m.deckId).name}` : ''}
                    {m.eventName ? ` · ${m.eventName}${m.round ? ` (ronde ${m.round})` : ''}` : ''}
                    {m.wentFirst === true ? ' · premier' : m.wentFirst === false ? ' · second' : ''}
                  </span>
                </span>
                <button onClick={() => setEditing(m)} aria-label={tx('Modifier')} className="p-2 text-rift-300 hover:text-gold-400"><Pencil className="w-4 h-4" /></button>
              </div>
            );
          })}
        </section>
      )}

      {tab === 'stats' && <MatchStats stats={stats} deckOf={deckOf} />}

      {editing && (
        <MatchForm match={editing} legends={legends} decks={deckList}
          onSave={(m) => { matches.save(withDeckVersion(m, decks)); setEditing(null); }}
          onDelete={editing.id ? () => { const m = editing; matches.remove(m.id); setEditing(null); offerUndo({ message: tx('Match supprimé'), run: () => matches.save(m) }); } : null}
          onClose={() => setEditing(null)} />
      )}
      {counter && (
        <ScoreCounter decks={deckList} matches={matches.items} legends={legends} defaultDeckId={deck?.id || null} defaultMyLegendId={myLegendId}
          defaultOppLegendId={prefs.oppLegendId || null}
          onSave={(m) => { matches.save(withDeckVersion({ ...m, eventName: prefs.eventName || null }, decks)); showNotification(tx('Match enregistré'), 'success'); }}
          onClose={() => setCounter(false)} />
      )}
    </div>
  );
}

function RecordCell({ r }) {
  if (!r || !r.n) return <span className="text-rift-600">—</span>;
  return (
    <span className={r.small ? 'text-rift-500' : 'text-rift-100'} title={r.small ? tx('Moins de {SMALL_SAMPLE} parties : peu fiable', { SMALL_SAMPLE }) : undefined}>
      {pct(r)} <span className="text-[11px] text-rift-500">({r.win}-{r.loss}{r.draw ? `-${r.draw}` : ''})</span>
    </span>
  );
}

function MatchStats({ stats, deckOf }) {
  const { overall, first, second, byDeck, byDeckVersion = [], byMode = [], byLegend, byOpponent, matrix, events } = stats;
  if (!overall.n) return <p className="text-sm text-rift-400">{tx('Enregistrez des matchs pour voir vos statistiques.')}</p>;
  const Kpi = ({ label, r }) => (
    <div className="panel p-3">
      <p className="text-[11px] uppercase tracking-wider text-rift-400">{label}</p>
      <p className={`text-2xl font-bold ${r.small ? 'text-rift-400' : 'text-gold-400'}`}>{pct(r)}</p>
      <p className="text-[11px] text-rift-400">{r.n} {tx('partie')}{r.n > 1 ? 's' : ''} · {r.win} V / {r.loss} D{r.draw ? ` / ${r.draw} N` : ''}</p>
    </div>
  );
  const Table = ({ title, rows, label }) => (!rows.length ? null : (
    <div className="panel p-3 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gold-400 mb-2">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-t border-rift-700/60">
              <td className="py-1.5 pr-2 text-rift-200">{label(r.key)}</td>
              <td className="py-1.5 text-right whitespace-nowrap"><RecordCell r={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 lg:max-w-[760px]">
        <Kpi label={tx('Victoires')} r={overall} />
        <Kpi label={tx('En premier')} r={first} />
        <Kpi label={tx('En second')} r={second} />
      </div>
      <p className="text-[11px] text-rift-500">{tx('Grisé : moins de')} {SMALL_SAMPLE} {tx('parties, chiffre peu fiable. « En premier / second » compte chaque manche des Bo3.')}</p>
      <div className="grid gap-3 lg:grid-cols-3">
        <Table title={tx('Par deck')} rows={byDeck} label={(id) => deckOf(id)?.name || tx('Deck supprimé')} />
        {byDeckVersion.length > 0 && <Table title={tx('Par version de deck')} rows={byDeckVersion} label={(k) => { const [id, v] = String(k).split('|'); return `${deckOf(id)?.name || tx('Deck supprimé')} v${v}`; }} />}
        {byMode.length > 0 && <Table title={tx('Par mode')} rows={byMode} label={(k) => MODES[k]?.label || k} />}
        <Table title={tx('Par Légende jouée')} rows={byLegend} label={legendName} />
        <Table title={tx('Contre chaque Légende')} rows={byOpponent} label={legendName} />
      </div>
      {matrix.rows.length > 0 && matrix.cols.length > 0 && (
        <div className="panel p-3 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gold-400 mb-2">{tx('Matchups (ma Légende × Légende adverse)')}</h3>
          <table className="text-xs">
            <thead>
              <tr>
                <th />
                {matrix.cols.map(c => <th key={c} className="px-2 py-1 text-rift-300 font-medium text-left max-w-[120px] truncate">{legendName(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map(r => (
                <tr key={r} className="border-t border-rift-700/60">
                  <th className="pr-3 py-1 text-left text-rift-200 font-medium whitespace-nowrap">{legendName(r)}</th>
                  {matrix.cols.map(c => <td key={c} className="px-2 py-1 whitespace-nowrap"><RecordCell r={matrix.cell(r, c)} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {events.length > 0 && (
        <div className="panel p-3 space-y-2">
          <h3 className="text-sm font-semibold text-gold-400">{tx('Événements')}</h3>
          {events.map(e => (
            <div key={e.key} className="text-sm">
              <p className="text-rift-100">{e.name} <span className="text-rift-400">· {new Date(e.date).toLocaleDateString(locale())} · {e.win}-{e.loss}{e.draw ? `-${e.draw}` : ''}</span></p>
              <p className="text-[11px] text-rift-400">
                {e.matches.map((m, i) => `${m.round ? `R${m.round}` : `#${i + 1}`} ${RESULT_LABEL[matchResult(m)]} contre ${legendName(m.oppLegendId)}`).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full form: Bo1 / Bo3 with games, event, round, opponent, notes. */
function MatchForm({ match, legends, decks, onSave, onDelete, onClose }) {
  const [m, setM] = useState({ games: [], format: 'bo1', ...match });
  const set = (patch) => setM(x => ({ ...x, ...patch }));
  const games = m.games || [];
  const setGame = (i, patch) => set({ games: games.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  const field = 'w-full bg-rift-800 border border-rift-600 text-rift-100 text-sm px-2 h-10 focus:outline-none focus:border-gold-400';
  const save = () => {
    const out = { ...m };
    if (out.format === 'bo3' && games.length) delete out.result;
    if (out.format === 'bo3' && games.length) out.result = matchResult({ games });
    if (!out.result) out.result = 'win';
    const deck = decks.find(d => d.id === out.deckId);
    if (deck?.legendId && !out.myLegendId) out.myLegendId = deck.legendId;
    onSave(out);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-[560px] max-h-[92vh] overflow-y-auto bg-rift-900 border border-gold-500/30 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h2 className="font-display text-lg font-bold text-gold-400 flex-1">{match.id ? tx('Modifier le match') : tx('Nouveau match')}</h2>
          <button onClick={onClose} aria-label={tx('Fermer')} className="p-2 text-rift-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-rift-400">
          <label className="space-y-1"><span>{tx('Date')}</span>
            <input type="date" className={field} value={new Date(m.date || Date.now()).toISOString().slice(0, 10)}
              onChange={(e) => set({ date: new Date(`${e.target.value}T12:00:00`).getTime() })} /></label>
          <label className="space-y-1"><span>{tx('Deck')}</span>
            <select className={field} value={m.deckId || ''} onChange={(e) => {
              const d = decks.find(x => x.id === e.target.value);
              set({ deckId: d?.id || null, myLegendId: d?.legendId || m.myLegendId });
            }}>
              <option value="">{tx('— Sans deck —')}</option>
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <label className="space-y-1"><span>{tx('Ma Légende')}</span><LegendSelect value={m.myLegendId} onChange={(v) => set({ myLegendId: v })} legends={legends} className="w-full" /></label>
          <label className="space-y-1"><span>{tx('Légende adverse')}</span><LegendSelect value={m.oppLegendId} onChange={(v) => set({ oppLegendId: v })} legends={legends} className="w-full" /></label>
          <label className="space-y-1"><span>{tx('Adversaire')}</span><input className={field} value={m.oppName || ''} onChange={(e) => set({ oppName: e.target.value })} /></label>
          <label className="space-y-1"><span>{tx('Événement')}</span><input className={field} value={m.eventName || ''} onChange={(e) => set({ eventName: e.target.value, eventId: e.target.value ? (m.eventId || `ev:${e.target.value}:${new Date(m.date || Date.now()).toISOString().slice(0, 10)}`) : null })} /></label>
          <label className="space-y-1"><span>{tx('Ronde')}</span><input type="number" min="1" className={field} value={m.round || ''} onChange={(e) => set({ round: Number(e.target.value) || null })} /></label>
          <label className="space-y-1"><span>{tx('Format')}</span>
            <select className={field} value={m.format || 'bo1'} onChange={(e) => set({ format: e.target.value })}>
              <option value="bo1">{tx('Bo1 (une manche)')}</option>
              <option value="bo3">{tx('Bo3 (deux manches gagnantes)')}</option>
            </select></label>
        </div>
        {m.format === 'bo3' ? (
          <div className="space-y-1.5">
            <p className="text-xs text-rift-400">{tx('Manches')}</p>
            {games.map((g, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="w-16 text-rift-300">{tx('Manche')} {i + 1}</span>
                {['win', 'loss', 'draw'].map(r => <button key={r} onClick={() => setGame(i, { result: r })} aria-pressed={g.result === r} className="chip px-2 h-8">{RESULT_LABEL[r]}</button>)}
                <button onClick={() => setGame(i, { wentFirst: !g.wentFirst })} aria-pressed={!!g.wentFirst} className="chip px-2 h-8">{tx('Premier')}</button>
                <input type="number" min="0" placeholder="moi" value={g.myScore ?? ''} onChange={(e) => setGame(i, { myScore: Number(e.target.value) })} className="w-14 bg-rift-800 border border-rift-600 h-8 px-1 text-rift-100" />
                <input type="number" min="0" placeholder="adv." value={g.oppScore ?? ''} onChange={(e) => setGame(i, { oppScore: Number(e.target.value) })} className="w-14 bg-rift-800 border border-rift-600 h-8 px-1 text-rift-100" />
                <button onClick={() => set({ games: games.filter((_, k) => k !== i) })} aria-label={tx('Retirer la manche')} className="p-1 text-rift-400"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {games.length < 3 && <button onClick={() => set({ games: [...games, { result: 'win', wentFirst: false }] })} className="btn-ghost text-xs h-8 px-2"><Plus className="w-3.5 h-3.5" /> {tx('Manche')}</button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {['win', 'loss', 'draw'].map(r => <button key={r} onClick={() => set({ result: r })} aria-pressed={m.result === r} className="chip px-3 h-9">{RESULT_LABEL[r]}</button>)}
            <span className="w-3" />
            <span className="text-rift-300 text-xs">{tx('J’ai commencé :')}</span>
            {[[true, tx('Oui')], [false, tx('Non')]].map(([v, l]) => <button key={l} onClick={() => set({ wentFirst: v })} aria-pressed={m.wentFirst === v} className="chip px-2 h-9 text-xs">{l}</button>)}
          </div>
        )}
        <label className="block text-xs text-rift-400 space-y-1"><span>{tx('Notes')}</span>
          <textarea rows={2} value={m.notes || ''} onChange={(e) => set({ notes: e.target.value })} className="w-full bg-rift-800 border border-rift-600 text-rift-100 text-sm p-2 focus:outline-none focus:border-gold-400" /></label>
        <div className="flex gap-2">
          {onDelete && <button onClick={onDelete} className="btn-ghost text-sm h-10 px-3 text-state-bad"><Trash2 className="w-4 h-4" /> {tx('Supprimer')}</button>}
          <span className="flex-1" />
          <button onClick={onClose} className="btn-secondary text-sm h-10 px-4">{tx('Annuler')}</button>
          <button onClick={save} className="btn-primary text-sm h-10 px-4">{tx('Enregistrer')}</button>
        </div>
      </div>
    </div>
  );
}
