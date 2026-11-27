import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Swords, Package, Users, Plus, CheckCircle, AlertTriangle, Trash2, Pencil, UserPlus, Undo2, ArrowLeft,
  FileInput, UserCheck, Heart,
} from 'lucide-react';
import DeckEditor from './DeckEditor.jsx';
import { getPrefs } from '../../lib/uiPrefs.js';
import CounterFab from '../matches/CounterFab.jsx';
import { ImportDeckDialog } from './DeckDialogs.jsx';
import MissingForDecks from './MissingForDecks.jsx';
import { useBackHandler } from '../../lib/backButton.js';
import CardTile from '../collection/CardTile.jsx';
import BinderPages from './BinderPages.jsx';
import { binderPages } from '../../lib/binder.js';
import CardZoom from '../collection/CardZoom.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';
import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';
import { validateDeck, deckOwnership } from '../../lib/deckRules.js';
import { compareCollector } from '../../lib/catalog.js';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';
import { takeRequest, onRequest } from '../../lib/navRequest.js';
import { offerUndo } from '../../lib/undo.js';
import { useDialog } from '../common/Dialog.jsx';
import { tx, locale } from '../../lib/i18n.js';

const VIEWS = [
  { id: 'decks', label: tx('Decks'), icon: Swords },
  { id: 'boxes', label: tx('Boîtes'), icon: Package },
  { id: 'loans', label: tx('Prêts'), icon: Users },
];

function dateFr(ts) {
  return ts ? new Date(ts).toLocaleDateString(locale()) : '';
}

/**
 * Organisation: decks, storage boxes, loans.
 * `fixedView` shows one of them only (Decks tab, or a section of « Plus »);
 * `hideHeader` when the parent draws its own title.
 */
export default function OrganizeTab({ collection, org, wishlist, onAddCopy, fixedView, hideHeader, onDeckOpen, showNotification }) {
  const [chosenView, setView] = useState('decks');
  const view = fixedView || chosenView;
  const [zoom, setZoom] = useState(null);
  const copies = collection.copies;

  const ownedByCard = useMemo(() => {
    const m = new Map();
    for (const c of copies) m.set(c.cardId, (m.get(c.cardId) || 0) + 1);
    return m;
  }, [copies]);
  const openCard = useCallback((cardId) => setZoom(cardId), []);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {!hideHeader && (
        <div className="px-4 pt-5 lg:px-8 lg:pt-7 flex-shrink-0">
          <h1 className="h-title text-[22px]">{fixedView ? VIEWS.find(v => v.id === fixedView)?.label : tx('Organiser')}</h1>
          {!fixedView && (
            <div className="seg mt-3 lg:max-w-xl" role="tablist">
              {VIEWS.map(v => (
                <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'decks' && <DecksView org={org} copies={copies} ownedByCard={ownedByCard} collection={collection} wishlist={wishlist} onOpen={openCard} onDeckOpen={onDeckOpen} showNotification={showNotification} />}
      {view === 'boxes' && <BoxesView org={org} copies={copies} collection={collection} onOpen={openCard} />}
      {view === 'loans' && <LoansView org={org} copies={copies} collection={collection} onOpen={openCard} />}

      {zoom && (
        <CardZoom
          cardId={zoom}
          stacks={collection.stacks}
          wanted={wishlist.byCard.get(zoom)?.quantity || 0}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}

// ─── Decks ───────────────────────────────────────────────────────────────
function DecksView({ org, copies, ownedByCard, collection, wishlist, onOpen, onDeckOpen, showNotification }) {
  const { decks } = org;
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [missingView, setMissingView] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'buildable'
  const { prices } = usePrices();
  const deckValue = (d) => {
    if (!prices) return null;
    let v = d.legendId ? (unitPrice(prices, d.legendId) || 0) : 0;
    for (const s of d.cards || []) v += (unitPrice(prices, s.cardId) || 0) * s.quantity;
    return v;
  };
  const open = openId && decks.byId.get(openId);
  useEffect(() => { onDeckOpen?.(!!open); }, [open, onDeckOpen]);
  // Global search: « open this deck »
  useEffect(() => {
    const r = takeRequest('deck');
    if (r) setOpenId(r.id);
    return onRequest((q) => { if (q.kind === 'deck') { takeRequest('deck'); setOpenId(q.id); } });
  }, []);

  if (missingView) {
    return <MissingForDecks decks={decks} copies={copies} wishlist={wishlist} onOpen={onOpen} onBack={() => setMissingView(false)} />;
  }
  if (open) {
    return (
      <>
        <DeckEditor deck={open} decks={decks} org={org} copies={copies} ownedByCard={ownedByCard}
          collection={collection} wishlist={wishlist} onBack={() => setOpenId(null)} />
        {/* B.3: the points counter in one gesture from an open deck (phone; Decks tab only) */}
        {onDeckOpen && <CounterFab org={org} deck={open} showNotification={showNotification} />}
      </>
    );
  }
  const create = () => {
    const d = decks.save({ name: `Deck ${decks.items.length + 1}`, legendId: null, championId: null, cards: [], note: '', format: getPrefs().gameFormat || 'standard' });
    setOpenId(d.id);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        <div className="flex gap-2">
          <button data-help="decks.new" onClick={create} className="btn-primary flex-1 lg:flex-none lg:px-6 text-sm py-2.5 rounded-xl"><Plus className="w-4 h-4" /> {tx('Nouveau deck')}</button>
          <button onClick={() => setImporting(true)} className="btn-secondary text-sm py-2.5 px-4 rounded-xl"><FileInput className="w-4 h-4" /> {tx('Importer')}</button>
        </div>
        {importing && (
          <ImportDeckDialog
            onClose={() => setImporting(false)}
            onImport={(d) => {
              const saved = decks.save({ note: '', ...d, name: d.name || `Deck ${decks.items.length + 1}` });
              setImporting(false);
              setOpenId(saved.id);
            }}
          />
        )}
        {decks.items.length === 0 && (
          <p className="text-xs text-rift-400 text-center py-8">{tx('Aucun deck. Créez-en un, choisissez la Légende puis ajoutez des cartes.')}</p>
        )}
        {decks.items.length > 0 && (
          <button onClick={() => setMissingView(true)} className="btn-secondary w-full lg:w-auto lg:px-6 text-sm">
            <Heart className="w-4 h-4" /> {tx('Ce qui me manque pour tous mes decks')}
          </button>
        )}
        {decks.items.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-rift-400">
            <span>{tx('Trier :')}</span>
            {[['recent', tx('Création')], ['buildable', tx('Le plus facile à monter')]].map(([v, l]) => (
              <button key={v} onClick={() => setSortBy(v)}
                className={`px-2 py-1 rounded-lg border ${sortBy === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'border-rift-600/30'}`}>{l}</button>
            ))}
          </div>
        )}
        {/* PC: decks side by side */}
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:gap-3">
        {decks.items
          .map(d => ({ d, own: deckOwnership(d, copies) }))
          .sort((a, b) => (sortBy === 'buildable' ? a.own.missing - b.own.missing : 0))
          .map(({ d, own }) => {
          const check = validateDeck(d);
          const inDeck = copies.filter(c => c.deckId === d.id).length;
          return (
            <button key={d.id} onClick={() => setOpenId(d.id)} className="w-full text-left flex items-center gap-3 rounded-xl bg-rift-800/60 border border-rift-600/20 p-2.5 hover:border-gold-400/40">
              <div className="w-12 h-16 lg:w-[72px] lg:h-[100px] rounded-md overflow-hidden bg-rift-900 flex-shrink-0 flex items-center justify-center">
                {d.legendId
                  ? <img src={thumbSrc(d.legendId)} onError={e => handleImageError(e, d.legendId)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <Swords className="w-5 h-5 text-rift-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm lg:text-base font-semibold text-rift-100 truncate">{d.name}</p>
                <p className="text-[11px] text-rift-400 truncate">{check.legend ? getLocalizedName(check.legend, displayLanguage()) : tx('Pas de Légende')}</p>
                <p className="text-[11px] flex items-center gap-1">
                  {check.ok
                    ? <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {tx('Valide')}</span>
                    : <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {check.counts.main}/40 · {check.counts.rune}/12 · {check.counts.battlefield}/3</span>}
                  <span className="text-rift-500">· {inDeck} {tx('rangées')}</span>
                  {own.missing > 0
                    ? <span className="text-red-400">· {own.missing} {tx('manquantes')}</span>
                    : (d.cards || []).length > 0 && <span className="text-green-400">{tx('· montable avec votre collection')}</span>}
                  {prices && <span className="text-gold-400">· {euro(deckValue(d))}</span>}
                  {org.loans.items.some(l => l.deckId === d.id && !l.returnedAt) && <span className="text-sky-300 flex items-center gap-0.5">· <UserCheck className="w-3 h-3" /> {tx('prêté')}</span>}
                </p>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ─── Boxes ───────────────────────────────────────────────────────────────
function BoxesView({ org, copies, collection, onOpen }) {
  const { ask } = useDialog();
  const { boxes } = org;
  const [openId, setOpenId] = useState(null);
  useBackHandler(!!openId, () => setOpenId(null));
  const [newName, setNewName] = useState('');
  const counts = useMemo(() => {
    const m = new Map();
    let none = 0;
    for (const c of copies) {
      if (c.boxId) m.set(c.boxId, (m.get(c.boxId) || 0) + 1);
      else if (!c.deckId && !c.loanId) none++;
    }
    return { m, none };
  }, [copies]);

  const open = openId && boxes.byId.get(openId);
  if (open) {
    // A binder: its pages pocket by pocket, then the cards without a page
    const binder = binderPages(copies.filter(c => c.boxId === open.id));
    const tiles = groupTiles(binder.loose);
    return (
      <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
        <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpenId(null)} className="p-2 rounded-lg text-rift-300 hover:bg-rift-700" aria-label={tx('Retour')}><ArrowLeft className="w-5 h-5" /></button>
            <input value={open.name} onChange={e => boxes.save({ ...open, name: e.target.value })}
              className="flex-1 h-10 px-3 bg-rift-800/60 border border-rift-600/30 rounded-xl text-base font-semibold text-rift-100 focus:outline-none focus:border-gold-500/60" />
            <button
              onClick={async () => {
                if (!(await ask({ title: tx('Supprimer « {name} » ?', { name: open.name }), message: tx('Ses cartes redeviennent « sans emplacement ».'), confirmLabel: tx('Supprimer'), destructive: true }))) return;
                collection.clearLocation('boxId', open.id); boxes.remove(open.id); setOpenId(null);
              }}
              className="p-2 rounded-lg text-state-bad hover:bg-state-bad/10" title={tx('Supprimer la boîte')} aria-label={tx('Supprimer la boîte')}><Trash2 className="w-5 h-5" /></button>
          </div>
          <p className="text-xs text-rift-400">{counts.m.get(open.id) || 0} {tx('exemplaires. Pour ranger des cartes ici : Collection → bouton « Ranger » d’une carte, ou choisir cette boîte comme destination avant de scanner.')}</p>
          <BinderPages pages={binder.pages} onOpen={onOpen} />
          {binder.pages.length > 0 && tiles.length > 0 && <h3 className="font-display text-[15px] font-bold text-gold-400 pt-2">{tx('Sans page')}</h3>}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {tiles.map(t => <CardTile key={t.cardData.id} cardData={t.cardData} badge={t.n} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px]">
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nouvelle boîte (ex. Boîte 1, Classeur rouge)')}
            className="flex-1 h-10 px-3 bg-rift-800/60 border border-rift-600/30 rounded-xl text-sm text-rift-100 placeholder-rift-500 focus:outline-none focus:border-gold-500/60" />
          <button disabled={!newName.trim()} onClick={() => { boxes.save({ name: newName.trim(), note: '' }); setNewName(''); }} className="btn-primary text-xs px-4 rounded-xl"><Plus className="w-4 h-4" /> {tx('Créer')}</button>
        </div>
        <p className="text-[11px] text-rift-500">{counts.none} {tx('exemplaire')}{counts.none > 1 ? 's' : ''} {tx('sans emplacement.')}</p>
        {boxes.items.map(b => (
          <button key={b.id} onClick={() => setOpenId(b.id)} className="w-full flex items-center gap-3 rounded-xl bg-rift-800/60 border border-rift-600/20 p-3 hover:border-gold-400/40 text-left">
            <Package className="w-5 h-5 text-gold-400" />
            <span className="flex-1 text-sm text-rift-100">{b.name}</span>
            <span className="text-xs font-mono text-rift-300">{counts.m.get(b.id) || 0}</span>
            <Pencil className="w-3.5 h-3.5 text-rift-500" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Group copies by card for tile grids. */
export function groupTiles(list) {
  const m = getMatcher();
  const by = new Map();
  for (const c of list) {
    const cur = by.get(c.cardId) || { cardData: m.getCardData(c.cardId), n: 0 };
    cur.n++;
    by.set(c.cardId, cur);
  }
  return [...by.values()].filter(t => t.cardData).sort((a, b) => compareCollector(a.cardData, b.cardData));
}

// ─── Loans ───────────────────────────────────────────────────────────────
function LoansView({ org, copies, collection, onOpen }) {
  const { people, loans } = org;
  const [newName, setNewName] = useState('');
  const active = loans.items.filter(l => !l.returnedAt).sort((a, b) => b.startedAt - a.startedAt);
  const history = loans.items.filter(l => l.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt).slice(0, 20);
  const lentByLoan = useMemo(() => {
    const m = new Map();
    for (const c of copies) if (c.loanId) m.set(c.loanId, [...(m.get(c.loanId) || []), c]);
    return m;
  }, [copies]);

  const giveBack = (loan) => {
    collection.clearLocation('loanId', loan.id);
    loans.save({ ...loan, returnedAt: Date.now() });
  };

  // Active loans grouped by person ("qui a quoi")
  const byPerson = new Map();
  for (const l of active) byPerson.set(l.personId, [...(byPerson.get(l.personId) || []), l]);

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
      <div className="px-4 pt-3 pb-4 space-y-4 lg:px-8 lg:max-w-[1800px]">
        <p className="text-xs text-rift-400">{tx('Pour prêter des cartes : Collection → bouton « Ranger » d’une carte → « Prêter ». Pour prêter un deck entier : ouvrez le deck → « Prêter le deck ».')}</p>

        {byPerson.size === 0 && <p className="text-xs text-rift-500 text-center py-4">{tx('Aucun prêt en cours.')}</p>}
        {[...byPerson].map(([pid, list]) => {
          const person = people.byId.get(pid);
          const total = list.reduce((n, l) => n + (lentByLoan.get(l.id)?.length || 0), 0);
          return (
            <section key={pid} className="rounded-xl bg-rift-800/60 border border-rift-600/20 p-3 space-y-2">
              <p className="text-sm font-semibold text-rift-100">{person?.name || tx('Personne supprimée')} <span className="text-xs font-normal text-rift-400">· {total} {tx('carte')}{total > 1 ? 's' : ''}</span></p>
              {list.map(l => {
                const tiles = groupTiles(lentByLoan.get(l.id) || []);
                return (
                  <div key={l.id} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-rift-400">
                      <span className="mr-auto">{l.deckId && <strong className="text-sky-300">{tx('Deck «')} {org.decks.byId.get(l.deckId)?.name || tx('supprimé')} » · </strong>}{tx('Prêté le')} {dateFr(l.startedAt)}</span>
                      <button onClick={() => giveBack(l)} className="btn-ghost text-[11px] py-1 px-2 rounded-lg text-green-400"><Undo2 className="w-3 h-3" /> {tx('Rendu')}</button>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-8 xl:grid-cols-12 gap-2">
                      {tiles.map(t => <CardTile key={t.cardData.id} cardData={t.cardData} badge={t.n} onOpen={onOpen} />)}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-rift-300 uppercase tracking-wider">{tx('Personnes')}</h3>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Ajouter une personne')}
              className="flex-1 h-9 px-3 bg-rift-800/60 border border-rift-600/30 rounded-xl text-sm text-rift-100 placeholder-rift-500 focus:outline-none focus:border-gold-500/60" />
            <button disabled={!newName.trim()} onClick={() => { people.save({ name: newName.trim(), note: '' }); setNewName(''); }} className="btn-secondary text-xs px-3 rounded-xl"><UserPlus className="w-4 h-4" /></button>
          </div>
          {people.items.map(p => {
            const busy = active.some(l => l.personId === p.id);
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-lg bg-rift-800/40 px-3 py-2">
                <input value={p.name} onChange={e => people.save({ ...p, name: e.target.value })} className="flex-1 bg-transparent text-sm text-rift-100 focus:outline-none" />
                <button
                  disabled={busy}
                  title={busy ? tx('A encore des cartes prêtées') : tx('Supprimer')} aria-label={`Supprimer ${p.name}`}
                  onClick={() => { people.remove(p.id); offerUndo({ message: tx('{name} retiré(e) de la liste', { name: p.name }), run: () => people.save(p) }); }}
                  className="p-1 text-rift-500 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </section>

        {history.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold text-rift-300 uppercase tracking-wider">{tx('Historique')}</h3>
            {history.map(l => (
              <p key={l.id} className="text-[11px] text-rift-400">
                {people.byId.get(l.personId)?.name || '—'} · {l.deckId ? tx('deck « {v0} » · ', { v0: org.decks.byId.get(l.deckId)?.name || tx('supprimé') }) : ''}{l.cardIds?.length || 0} {tx('carte')}{(l.cardIds?.length || 0) > 1 ? 's' : ''} {tx('· du')} {dateFr(l.startedAt)} {tx('au')} {dateFr(l.returnedAt)}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
