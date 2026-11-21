import React, { useMemo, useRef, useState } from 'react';
import { X, Copy, Check, Download, Upload, Printer, Link2 } from 'lucide-react';
import { formatDeckList, parseDeckList } from '../../lib/deckList.js';
import { isNative } from '../../lib/nativeAssets.js';
import { encodeDeck } from '../../lib/deckShare.js';
import { deckToCommunityCode, registrationText } from '../../lib/deckCodes.js';
import { validateDeck } from '../../lib/deckRules.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { buildDeckSheetHtml, printHtml } from '../../lib/deckSheet.js';
import { saveTextFile } from '../../lib/saveText.js';

import { useBackHandler } from '../../lib/backButton.js';
import { tx } from '../../lib/i18n.js';
export function Sheet({ title, onClose, children }) {
  useBackHandler(true, onClose);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-rift-800 border border-rift-600/40 rounded-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-rift-100 mr-auto truncate">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-rift-400 hover:bg-rift-700" aria-label={tx('Fermer')}><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const areaClass = 'w-full h-64 bg-rift-900/70 border border-rift-600/40 rounded-xl text-xs font-mono text-rift-100 p-2 focus:outline-none focus:border-gold-500/60';
const selectClass = 'w-full h-9 bg-rift-800 border border-rift-600/40 rounded-lg text-sm text-rift-100 px-2 focus:outline-none focus:border-gold-500/60';

export async function copyText(text, area) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback (no clipboard permission): select the text and use execCommand.
    if (!area) return false;
    area.select();
    return document.execCommand('copy');
  }
}

/**
 * « Partager » (B.6.3, lot 7.1 / 7.2): the community deck code, the list as
 * text (English / French), « Copier pour l'inscription », the tournament sheet.
 */
export function ExportDeckDialog({ deck, onClose }) {
  const [lang, setLang] = useState('English');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [player, setPlayer] = useState(() => { try { return localStorage.getItem('rb.playerName') || ''; } catch { return ''; } });
  const [sheetMsg, setSheetMsg] = useState(null);
  const area = useRef(null);
  const text = useMemo(() => formatDeckList(deck, lang), [deck, lang]);
  // Community code (Piltover Archive format); a card it cannot hold → the app's own code
  const shared = useMemo(() => {
    try { return { code: deckToCommunityCode(deck, (id) => getMatcher().getCard(id)) }; } catch (err) { return { code: encodeDeck(deck), problem: err.message }; }
  }, [deck]);
  const code = shared.code;
  const reg = useMemo(() => registrationText(validateDeck(deck), formatDeckList(deck, 'English')), [deck]);
  const [regCopied, setRegCopied] = useState(false);
  const copyReg = async () => {
    if (reg.ok && await copyText(reg.text, null)) { setRegCopied(true); setTimeout(() => setRegCopied(false), 1500); }
  };

  const copyCode = async () => {
    if (await copyText(code, null)) { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); }
  };
  const printSheet = async () => {
    try { localStorage.setItem('rb.playerName', player); } catch { /* ignore */ }
    const html = buildDeckSheetHtml(deck, { playerName: player, language: lang });
    if (isNative) {
      // Android: no printing from the app — save the sheet, open it to print or share.
      try {
        const where = await saveTextFile(`${deck.name.replace(/[\\/:*?"<>|]+/g, '_') || 'deck'}-feuille.html`, html, 'text/html');
        setSheetMsg(tx('Feuille enregistrée : {where}', { where }));
      } catch (err) {
        setSheetMsg(err.message);
      }
    } else printHtml(html);
  };

  const copy = async () => {
    if (await copyText(text, area.current)) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name.replace(/[\\/:*?"<>|]+/g, '_') || 'deck'}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Sheet title={tx('Partager « {name} »', { name: deck.name })} onClose={onClose}>
      <div className="space-y-2">
        <p className="text-xs text-rift-300">{tx('Code de deck')} {shared.problem ? tx('(code de l’appli)') : '(format commun, comme Piltover Archive)'} :</p>
        <div className="flex gap-2">
          <input readOnly value={code} aria-label={tx('Code de deck')} onFocus={e => e.target.select()} className="flex-1 min-w-0 bg-rift-900/70 border border-rift-600/40 text-[11px] font-mono text-rift-100 px-2 h-9" />
          <button onClick={copyCode} className="btn-secondary text-xs h-9 px-3">{codeCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />} {codeCopied ? tx('Copié') : tx('Copier')}</button>
        </div>
        {shared.problem && <p className="text-[11px] text-state-warn">{tx('Format commun impossible :')} {shared.problem}{tx('. Ce code ne s’ouvre que dans l’appli.')}</p>}
      </div>
      <div className="border-t border-rift-600/40 pt-3 space-y-2">
        <p className="text-xs text-rift-300">{tx('Liste en texte :')}</p>
      <div className="flex gap-1.5">
        {[['English', tx('Anglais (sites de decks)')], ['French', tx('Français')]].map(([v, l]) => (
          <button key={v} onClick={() => setLang(v)}
            className={`flex-1 py-1.5 rounded-lg text-xs border ${lang === v ? 'bg-gold-400/20 text-gold-400 border-gold-400/30' : 'text-rift-400 border-rift-600/30'}`}>{l}</button>
        ))}
      </div>
      <textarea ref={area} readOnly value={text} className={areaClass} onFocus={e => e.target.select()} />
      <div className="flex gap-2">
        <button onClick={copy} className="btn-primary flex-1 text-sm py-2 rounded-xl">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? tx('Copié') : tx('Copier')}
        </button>
        {!isNative && (
          <button onClick={save} className="btn-secondary text-sm py-2 px-4 rounded-xl"><Download className="w-4 h-4" /> .txt</button>
        )}
      </div>
      </div>
      <div className="border-t border-rift-600/40 pt-3 space-y-2">
        <p className="text-xs text-rift-300">{tx('Inscription à un tournoi : la liste en anglais, par sections (Legend, Champion, MainDeck, Battlefields, Runes, Sideboard).')}</p>
        <button onClick={copyReg} disabled={!reg.ok} className="btn-secondary w-full text-sm h-10">
          {regCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {regCopied ? tx('Copié') : tx('Copier pour l’inscription')}
        </button>
        {!reg.ok && <p className="text-[12px] text-state-bad">{tx('Pas encore :')} {reg.reason}</p>}
      </div>
      <div className="border-t border-rift-600/40 pt-3 space-y-2">
        <p className="text-xs text-rift-300">{tx('Feuille de deck pour un tournoi :')}</p>
        <div className="flex gap-2">
          <input value={player} onChange={e => setPlayer(e.target.value)} placeholder={tx('Nom du joueur')} className="flex-1 min-w-0 bg-rift-900/70 border border-rift-600/40 text-sm text-rift-100 px-2 h-9" />
          <button onClick={printSheet} className="btn-secondary text-xs h-9 px-3"><Printer className="w-4 h-4" /> {isNative ? tx('Enregistrer') : tx('Imprimer / PDF')}</button>
        </div>
        {sheetMsg && <p className="text-[11px] text-rift-400">{sheetMsg}</p>}
      </div>
    </Sheet>
  );
}

/** Import a deck list (pasted text or .txt file) as a new deck. */
export function ImportDeckDialog({ onImport, onClose }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseDeckList(text) : null), [text]);
  const total = parsed ? parsed.deck.cards.reduce((n, s) => n + s.quantity, 0) + (parsed.deck.legendId ? 1 : 0) : 0;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    f.text().then(setText);
  };

  return (
    <Sheet title={tx('Importer une liste de deck')} onClose={onClose}>
      <p className="text-[11px] text-rift-400">
        {tx('Collez un code de deck (format commun, comme Piltover Archive, ou code de l’appli) ou une liste copiée d’un site de decks : « 3 Nom de la carte » par ligne, en anglais ou en français, avec ou sans titres (Legend, Champion, MainDeck, Battlefields, Runes, Sideboard).')}
      </p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={tx('Nom du deck')} className={selectClass} />
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={tx('Legend:\n1 Jinx - Loose Cannon\nChampion:\n1 Jinx - Demolitionist\nMainDeck:\n3 …')} className={areaClass} />
      <label className="btn-ghost text-xs py-1.5 px-3 rounded-xl inline-flex cursor-pointer">
        <Upload className="w-3.5 h-3.5" /> {tx('Ouvrir un fichier .txt')}
        <input type="file" accept=".txt,text/plain" onChange={pickFile} className="hidden" />
      </label>
      {parsed && (
        <div className="text-xs space-y-1">
          <p className="text-rift-200">{total} {tx('carte')}{total > 1 ? 's' : ''} {tx('reconnue')}{total > 1 ? 's' : ''}{parsed.deck.legendId ? '' : tx(' · pas de Légende trouvée')}</p>
          {parsed.unknown.length > 0 && (
            <div className="text-amber-300">
              <p>{parsed.unknown.length} {tx('ligne')}{parsed.unknown.length > 1 ? 's' : ''} {tx('non reconnue')}{parsed.unknown.length > 1 ? 's' : ''} {tx('(ignorée')}{parsed.unknown.length > 1 ? 's' : ''}) :</p>
              <ul className="list-disc pl-5 text-rift-400">{parsed.unknown.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}</ul>
              {parsed.unknown.length > 8 && <p className="text-rift-500">…</p>}
            </div>
          )}
        </div>
      )}
      <button disabled={!parsed || total === 0} onClick={() => onImport({ name: name.trim(), ...parsed.deck })} className="btn-primary w-full text-sm py-2.5 rounded-xl">
        {tx('Créer le deck')}
      </button>
    </Sheet>
  );
}

/** Lend every copy stored in a deck to someone, in one go. */
export function LendDeckDialog({ deck, count, people, onLend, onClose }) {
  const [personId, setPersonId] = useState(people.items[0]?.id || '__new');
  const [newName, setNewName] = useState('');
  const isNew = personId === '__new' || !people.items.length;
  const ok = isNew ? newName.trim() : personId;

  const lend = () => {
    let pid = personId;
    if (isNew) pid = people.save({ name: newName.trim(), note: '' }).id;
    onLend(pid);
    onClose();
  };

  return (
    <Sheet title={tx('Prêter « {name} »', { name: deck.name })} onClose={onClose}>
      <p className="text-xs text-rift-300">{tx('Les')} {count} {tx('exemplaires rangés dans ce deck seront marqués comme prêtés. Ils restent dans le deck ; « Rendu » les remet en place.')}</p>
      <select value={isNew ? '__new' : personId} onChange={e => setPersonId(e.target.value)} className={selectClass}>
        {people.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="__new">{tx('+ Nouvelle personne…')}</option>
      </select>
      {isNew && <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder={tx('Nom de la personne')} className={selectClass} />}
      <button disabled={!ok} onClick={lend} className="btn-primary w-full text-sm py-2.5 rounded-xl">{tx('Prêter le deck')}</button>
    </Sheet>
  );
}
