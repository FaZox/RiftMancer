import React, { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { getLocalizedName, displayLanguage } from '../../lib/cardLocale.js';

import { useBackHandler } from '../../lib/backButton.js';import { tx } from '../../lib/i18n.js';

/**
 * Put copies of a stack somewhere: a box, a deck, lend them to someone, or
 * no location. A copy is in one place at a time.
 */
export default function MoveDialog({ stack, org, onMove, onClose }) {
  useBackHandler(true, onClose);
  const { boxes, decks, people } = org;
  const initial = stack.loanId ? 'loan' : stack.deckId ? 'deck' : stack.boxId ? 'box' : 'none';
  const [kind, setKind] = useState(initial === 'loan' ? 'none' : initial);
  const [qty, setQty] = useState(stack.quantity);
  const [boxId, setBoxId] = useState(stack.boxId || boxes.items[0]?.id || '');
  const [deckId, setDeckId] = useState(stack.deckId || decks.items[0]?.id || '');
  const [personId, setPersonId] = useState(people.items[0]?.id || '');
  const [newName, setNewName] = useState('');

  const name = getLocalizedName(stack.cardData, displayLanguage(stack.language));

  const confirm = () => {
    let place = { boxId: null, deckId: null, loanId: null };
    if (kind === 'box') {
      let id = boxId;
      if (id === '__new' || !id) {
        if (!newName.trim()) return;
        id = boxes.save({ name: newName.trim() }).id;
      }
      place.boxId = id;
    } else if (kind === 'deck') {
      if (!deckId) return;
      place.deckId = deckId;
    } else if (kind === 'loan') {
      let pid = personId;
      if (pid === '__new' || !pid) {
        if (!newName.trim()) return;
        pid = people.save({ name: newName.trim() }).id;
      }
      const loan = org.loans.save({
        personId: pid,
        startedAt: Date.now(),
        returnedAt: null,
        cardIds: Array(qty).fill(stack.cardData.id),
      });
      // A lent card keeps its deck (lending a deck), but leaves its box.
      place = { boxId: null, deckId: stack.deckId || null, loanId: loan.id };
    }
    onMove(stack, qty, place);
    onClose();
  };

  const tabs = [['none', tx('Aucun')], ['box', tx('Boîte')], ['deck', tx('Deck')], ['loan', tx('Prêter')]];
  const selectClass = 'w-full h-9 bg-rift-800 border border-rift-600/40 rounded-lg text-sm text-rift-100 px-2 focus:outline-none focus:border-gold-500/60';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-rift-800 border border-rift-600/40 rounded-2xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-rift-100 mr-auto truncate">{tx('Ranger «')} {name} »</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-rift-400 hover:bg-rift-700" aria-label={tx('Fermer')}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1.5">
          {tabs.map(([v, l]) => (
            <button key={v} onClick={() => { setKind(v); setNewName(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${kind === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>
              {l}
            </button>
          ))}
        </div>

        {kind === 'none' && <p className="text-xs text-rift-400">{tx('Les exemplaires n’auront plus d’emplacement (ni boîte, ni deck, ni prêt).')}</p>}

        {kind === 'box' && (
          <div className="space-y-2">
            <select value={boxes.items.length ? boxId : '__new'} onChange={e => setBoxId(e.target.value)} className={selectClass}>
              {boxes.items.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="__new">{tx('+ Nouvelle boîte…')}</option>
            </select>
            {(boxId === '__new' || !boxes.items.length) && (
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nom de la boîte (ex. Boîte 1, Classeur rouge)')} className={selectClass} />
            )}
          </div>
        )}

        {kind === 'deck' && (
          decks.items.length ? (
            <select value={deckId} onChange={e => setDeckId(e.target.value)} className={selectClass}>
              {decks.items.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : <p className="text-xs text-rift-400">{tx('Aucun deck. Créez-en un dans l’onglet Organiser.')}</p>
        )}

        {kind === 'loan' && (
          <div className="space-y-2">
            <select value={people.items.length ? personId : '__new'} onChange={e => setPersonId(e.target.value)} className={selectClass}>
              {people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new">{tx('+ Nouvelle personne…')}</option>
            </select>
            {(personId === '__new' || !people.items.length) && (
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nom de la personne')} className={selectClass} />
            )}
          </div>
        )}

        {stack.quantity > 1 && (
          <div className="flex items-center gap-2 text-xs text-rift-300">
            <span className="mr-auto">{tx('Nombre d’exemplaires')}</span>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-rift-700 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
            <span className="w-8 text-center font-mono text-rift-100">{qty}</span>
            <button onClick={() => setQty(q => Math.min(stack.quantity, q + 1))} className="w-8 h-8 rounded-lg bg-rift-700 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
            <span className="text-rift-500">/ {stack.quantity}</span>
          </div>
        )}

        <button onClick={confirm} className="btn-primary w-full text-sm py-2.5 rounded-xl">{tx('Valider')}</button>
      </div>
    </div>
  );
}
