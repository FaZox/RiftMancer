import React, { useEffect } from 'react';
import { Undo2 } from 'lucide-react';
import { tx } from '../lib/i18n.js';

/** « 3 cartes supprimées — Annuler », for 7 seconds after a deletion. */
export default function UndoBar({ undo, onClose }) {
  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [undo, onClose]);
  if (!undo) return null;
  return (
    <div role="status" className="scan-pop fixed bottom-24 left-4 right-4 sm:left-auto sm:max-w-sm z-[90] flex items-center gap-3 pl-4 pr-2 py-2 bg-rift-800 border border-gold-500/50 shadow-2xl">
      <span className="flex-1 text-sm font-semibold text-rift-100">{undo.message}</span>
      <button onClick={() => { undo.run(); onClose(); }} className="btn-primary text-sm min-h-[40px] px-3">
        <Undo2 className="w-4 h-4" /> {tx('Annuler')}
      </button>
    </div>
  );
}
