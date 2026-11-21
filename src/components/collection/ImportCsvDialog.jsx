import React, { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { Sheet } from '../organize/DeckDialogs.jsx';
import { parseCollectionCsv } from '../../lib/csvImport.js';
import { LANGUAGES } from '../../data/sampleCards.js';
import { tx } from '../../lib/i18n.js';

/** Import a collection from a CSV file (CardNexus, Riftmana or similar). */
export default function ImportCsvDialog({ defaultLanguage, onImport, onClose }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [language, setLanguage] = useState(defaultLanguage || 'English');
  const parsed = useMemo(() => (text ? parseCollectionCsv(text, { language }) : null), [text, language]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    f.text().then(setText);
  };

  return (
    <Sheet title={tx('Importer une collection (CSV)')} onClose={onClose}>
      <p className="text-[11px] text-rift-400">
        {tx('Fichier CSV exporté par cette app, CardNexus, Riftmana ou un tableur (colonnes quantité, nom ou extension + numéro, langue, état, foil…). Les cartes sont')} <strong>{tx('ajoutées')}</strong> {tx('à la collection actuelle.')}
      </p>
      <label className="btn-secondary text-sm py-2.5 rounded-xl w-full cursor-pointer">
        <Upload className="w-4 h-4" /> {fileName || tx('Choisir un fichier .csv')}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={pick} className="hidden" />
      </label>
      <label className="flex items-center gap-2 text-xs text-rift-300">
        {tx('Langue si le fichier ne l’indique pas')}
        <select value={language} onChange={e => setLanguage(e.target.value)} className="h-8 bg-rift-800 border border-rift-600/40 rounded-lg text-xs text-rift-200 px-2">
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      {parsed && (
        <div className="text-xs space-y-1">
          <p className="text-rift-200">{parsed.copies} {tx('exemplaire')}{parsed.copies > 1 ? 's' : ''} {tx('reconnu')}{parsed.copies > 1 ? 's' : ''} ({parsed.entries.length} {tx('ligne')}{parsed.entries.length > 1 ? 's' : ''})</p>
          {parsed.unknown.length > 0 && (
            <div className="text-amber-300">
              <p>{parsed.unknown.length} {tx('ligne')}{parsed.unknown.length > 1 ? 's' : ''} {tx('non reconnue')}{parsed.unknown.length > 1 ? 's' : ''} {tx('(ignorée')}{parsed.unknown.length > 1 ? 's' : ''}) :</p>
              <ul className="list-disc pl-5 text-rift-400">{parsed.unknown.slice(0, 6).map((l, i) => <li key={i} className="truncate">{l}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      <button disabled={!parsed?.copies} onClick={() => onImport(parsed.entries)} className="btn-primary w-full text-sm py-2.5 rounded-xl">
        {tx('Ajouter')} {parsed?.copies || ''} {tx('exemplaire')}{parsed?.copies > 1 ? 's' : ''}
      </button>
    </Sheet>
  );
}
