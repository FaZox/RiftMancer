import React, { useMemo, useState } from 'react';
import { Package, Plus, Trash2, Undo2, UserPlus, Users, History, Inbox } from 'lucide-react';
import CardTile from '../../components/collection/CardTile.jsx';
import CardZoom from '../../components/collection/CardZoom.jsx';
import { groupTiles } from '../../components/organize/OrganizeTab.jsx';
import BinderPages from '../../components/organize/BinderPages.jsx';
import { binderPages } from '../../lib/binder.js';
import FriendsView from '../../components/friends/FriendsView.jsx';
import { usePrices, unitPrice, euro } from '../../lib/prices.js';
import { offerUndo } from '../../lib/undo.js';
import { useDialog } from '../../components/common/Dialog.jsx';
import { tx, locale } from '../../lib/i18n.js';

const dateFr = (ts) => new Date(ts).toLocaleDateString(locale());
const GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' };

/** Page frame shared by the « Organiser » pages: title, columns, card zoom. */
function Page({ title, sub, children, zoom, setZoom, c }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-7 pb-4 border-b border-gold-500/15">
        <h1 className="h-title text-[28px] leading-none">{title}</h1>
        {sub && <p className="text-sm text-rift-400 mt-2">{sub}</p>}
      </header>
      <div className="flex-1 min-h-0 flex">{children}</div>
      {zoom && (
        <CardZoom cardId={zoom} stacks={c.collection.stacks} byCard={c.wishlist.byCard}
          onSetWanted={c.wishlist.setWanted} onAddCopy={c.handleAddCopy} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

// ─── Boxes: the list on the left, the open box on the right ────────────────
export function BoxesPage({ c }) {
  const { ask } = useDialog();
  const { boxes } = c.org;
  const copies = c.collection.copies;
  const [zoom, setZoom] = useState(null);
  const [newName, setNewName] = useState('');
  const [openId, setOpenId] = useState(null);
  const { prices } = usePrices();
  const counts = useMemo(() => {
    const m = new Map(); let none = 0;
    for (const x of copies) {
      if (x.boxId) m.set(x.boxId, (m.get(x.boxId) || 0) + 1);
      else if (!x.deckId && !x.loanId) none++;
    }
    return { m, none };
  }, [copies]);
  const open = (openId && boxes.byId.get(openId)) || boxes.items[0] || null;
  const tiles = open ? groupTiles(copies.filter(x => x.boxId === open.id)) : [];
  // A binder: its pages pocket by pocket, then the cards without a page
  const binder = open ? binderPages(copies.filter(x => x.boxId === open.id)) : { pages: [], loose: [] };
  const looseTiles = binder.pages.length ? groupTiles(binder.loose) : tiles;
  const value = prices ? tiles.reduce((v, t) => v + (unitPrice(prices, t.cardData.id) || 0) * t.n, 0) : null;
  const create = () => {
    const b = boxes.save({ name: newName.trim(), note: '' });
    setNewName(''); setOpenId(b.id);
  };

  return (
    <Page title={tx('Boîtes')} sub={tx('{length} boîte{v1} · {none} exemplaire{v3} sans emplacement', { length: boxes.items.length, v1: boxes.items.length > 1 ? 's' : '', none: counts.none, v3: counts.none > 1 ? 's' : '' })} zoom={zoom} setZoom={setZoom} c={c}>
      <aside className="w-[340px] flex-shrink-0 border-r border-rift-600/40 flex flex-col">
        <form className="p-4 flex gap-2 border-b border-rift-600/40" onSubmit={e => { e.preventDefault(); if (newName.trim()) create(); }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nouvelle boîte (ex. Classeur rouge)')} className="input-field h-10 flex-1" />
          <button aria-label={tx('Créer')} disabled={!newName.trim()} className="btn-primary h-10 px-3" title={tx('Créer')}><Plus className="w-4 h-4" /></button>
        </form>
        <div className="flex-1 overflow-y-auto py-2">
          {boxes.items.length === 0 && <p className="px-5 py-8 text-sm text-rift-500 text-center">{tx('Aucune boîte. Créez-en une pour ranger vos cartes.')}</p>}
          {boxes.items.map(b => (
            <button key={b.id} onClick={() => setOpenId(b.id)}
              className={`w-full flex items-center gap-3 px-5 h-12 text-left ${open?.id === b.id ? 'bg-gold-500/10 text-gold-400' : 'text-rift-200 hover:bg-rift-800'}`}>
              <Package className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 truncate">{b.name}</span>
              <span className="text-sm font-mono text-rift-400">{counts.m.get(b.id) || 0}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="flex-1 min-w-0 overflow-y-auto px-8 py-6 space-y-4">
        {!open ? (
          <div className="py-24 text-center text-rift-400"><Inbox className="w-12 h-12 mx-auto mb-3 text-rift-500" />{tx('Choisissez ou créez une boîte.')}</div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <input value={open.name} onChange={e => boxes.save({ ...open, name: e.target.value })} aria-label={tx('Nom de la boîte')}
                className="flex-1 min-w-0 h-12 px-2 bg-transparent border border-transparent hover:border-rift-600 focus:border-gold-500/60 focus:outline-none font-display text-2xl font-bold text-gold-400" />
              <button onClick={async () => {
                if (!(await ask({ title: tx('Supprimer « {name} » ?', { name: open.name }), message: tx('Ses cartes redeviennent « sans emplacement ».'), confirmLabel: tx('Supprimer'), destructive: true }))) return;
                c.collection.clearLocation('boxId', open.id); boxes.remove(open.id); setOpenId(null);
              }} className="btn-ghost h-10 px-3 text-sm text-[#ff8a80]"><Trash2 className="w-4 h-4" /> {tx('Supprimer la boîte')}</button>
            </div>
            <p className="text-sm text-rift-300">
              {counts.m.get(open.id) || 0} {tx('exemplaire')}{(counts.m.get(open.id) || 0) > 1 ? 's' : ''}
              {value != null && value > 0 && <> · <span className="font-semibold text-gold-400">{euro(value)}</span></>}
              <span className="text-rift-500"> {tx('· pour ranger ici : Collection → Tableau → colonne « Emplacement », ou « Ranger dans » au Scanner.')}</span>
            </p>
            {tiles.length === 0 ? <p className="py-12 text-center text-rift-500">{tx('Cette boîte est vide.')}</p> : (
              <>
                <BinderPages pages={binder.pages} onOpen={setZoom} />
                {binder.pages.length > 0 && looseTiles.length > 0 && <h3 className="font-display text-[15px] font-bold text-gold-400 pt-2">{tx('Sans page')}</h3>}
                <div className="grid gap-3" style={GRID}>
                  {looseTiles.map(t => <CardTile key={t.cardData.id} cardData={t.cardData} badge={t.n} onOpen={setZoom} />)}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </Page>
  );
}

// ─── Loans: who has what on the left, people and history on the right ──────
export function LoansPage({ c }) {
  const { people, loans, decks } = c.org;
  const copies = c.collection.copies;
  const [zoom, setZoom] = useState(null);
  const [newName, setNewName] = useState('');
  const active = loans.items.filter(l => !l.returnedAt).sort((a, b) => b.startedAt - a.startedAt);
  const history = loans.items.filter(l => l.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt).slice(0, 40);
  const lentByLoan = useMemo(() => {
    const m = new Map();
    for (const x of copies) if (x.loanId) m.set(x.loanId, [...(m.get(x.loanId) || []), x]);
    return m;
  }, [copies]);
  const byPerson = new Map();
  for (const l of active) byPerson.set(l.personId, [...(byPerson.get(l.personId) || []), l]);
  const giveBack = (loan) => { c.collection.clearLocation('loanId', loan.id); loans.save({ ...loan, returnedAt: Date.now() }); };
  const lentTotal = active.reduce((n, l) => n + (lentByLoan.get(l.id)?.length || 0), 0);

  return (
    <Page title={tx('Prêts')} sub={tx('{lentTotal} carte{v1} prêtée{v2} en ce moment', { lentTotal, v1: lentTotal > 1 ? 's' : '', v2: lentTotal > 1 ? 's' : '' })} zoom={zoom} setZoom={setZoom} c={c}>
      <section className="flex-1 min-w-0 overflow-y-auto px-8 py-6 space-y-5">
        <p className="text-sm text-rift-400">{tx('Pour prêter des cartes : Collection → Tableau → colonne « Emplacement » → « Prêter ». Pour prêter un deck entier : ouvrez le deck → « Prêter le deck ».')}</p>
        {byPerson.size === 0 && <p className="py-16 text-center text-rift-500">{tx('Aucun prêt en cours.')}</p>}
        {[...byPerson].map(([pid, list]) => {
          const person = people.byId.get(pid);
          const total = list.reduce((n, l) => n + (lentByLoan.get(l.id)?.length || 0), 0);
          return (
            <div key={pid} className="panel p-5 space-y-4">
              <h2 className="font-display text-lg font-bold text-gold-400">{person?.name || tx('Personne supprimée')} <span className="font-body text-sm font-normal text-rift-400">· {total} {tx('carte')}{total > 1 ? 's' : ''}</span></h2>
              {list.map(l => (
                <div key={l.id} className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-rift-300">
                    <span className="mr-auto">{l.deckId && <strong className="text-sky-300">{tx('Deck «')} {decks.byId.get(l.deckId)?.name || tx('supprimé')} » · </strong>}{tx('prêté le')} {dateFr(l.startedAt)}</span>
                    <button onClick={() => giveBack(l)} className="btn-secondary h-9 px-4 text-sm !text-[#7fd6a4]"><Undo2 className="w-4 h-4" /> {tx('Rendu')}</button>
                  </div>
                  <div className="grid gap-3" style={GRID}>
                    {groupTiles(lentByLoan.get(l.id) || []).map(t => <CardTile key={t.cardData.id} cardData={t.cardData} badge={t.n} onOpen={setZoom} />)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
      <aside className="w-[380px] flex-shrink-0 border-l border-rift-600/40 overflow-y-auto p-5 space-y-6">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-gold-400 flex items-center gap-2"><Users className="w-5 h-5" /> {tx('Personnes')}</h2>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (newName.trim()) { people.save({ name: newName.trim(), note: '' }); setNewName(''); } }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Ajouter une personne')} className="input-field h-10 flex-1" />
            <button aria-label={tx('Ajouter')} disabled={!newName.trim()} className="btn-secondary h-10 px-3" title={tx('Ajouter')}><UserPlus className="w-4 h-4" /></button>
          </form>
          {people.items.map(p => {
            const busy = active.some(l => l.personId === p.id);
            return (
              <div key={p.id} className="flex items-center gap-2 h-10 px-3 bg-rift-800/50 border border-rift-600/40">
                <input value={p.name} onChange={e => people.save({ ...p, name: e.target.value })} aria-label={tx('Nom')} className="flex-1 bg-transparent text-rift-100 focus:outline-none" />
                <button disabled={busy} title={busy ? tx('A encore des cartes prêtées') : tx('Supprimer')} aria-label={`Supprimer ${p.name}`}
                  onClick={() => { people.remove(p.id); offerUndo({ message: tx('{name} retiré(e) de la liste', { name: p.name }), run: () => people.save(p) }); }}
                  className="text-rift-500 hover:text-[#ff8a80] disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </section>
        {history.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-gold-400 flex items-center gap-2"><History className="w-5 h-5" /> {tx('Historique')}</h2>
            {history.map(l => (
              <p key={l.id} className="text-sm text-rift-300 border-b border-rift-700/60 pb-2">
                <strong className="text-rift-100">{people.byId.get(l.personId)?.name || '—'}</strong>
                {l.deckId ? tx(' · deck « {v0} »', { v0: decks.byId.get(l.deckId)?.name || tx('supprimé') }) : ''} · {l.cardIds?.length || 0} {tx('carte')}{(l.cardIds?.length || 0) > 1 ? 's' : ''}
                <span className="block text-xs text-rift-500">{tx('du')} {dateFr(l.startedAt)} {tx('au')} {dateFr(l.returnedAt)}</span>
              </p>
            ))}
          </section>
        )}
      </aside>
    </Page>
  );
}

// ─── Trades: doubles on the left, recorded trades on the right ─────────────
export function TradesPage({ c }) {
  const [zoom, setZoom] = useState(null);
  return (
    <Page title={tx('Échanges et amis')} sub={tx('Les listes de vos amis, les échanges possibles et l’historique')} zoom={zoom} setZoom={setZoom} c={c}>
      <div className="flex-1 min-w-0 flex flex-col pt-4">
        <FriendsView scannedCards={c.scannedCards} collection={c.collection} org={c.org} wishlist={c.wishlist}
          defaultLanguage={c.batchDefaults.language} onOpen={setZoom} notify={c.showNotification} wide />
      </div>
    </Page>
  );
}
