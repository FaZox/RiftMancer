import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { SHORTCUTS } from '../../lib/shortcuts.js';
import { tx } from '../../lib/i18n.js';

/** « ? » on the PC (lot 6 i): the keyboard shortcuts. */
export default function ShortcutsDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-rift-900/70 flex items-start justify-center pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={tx('Raccourcis clavier')} className="w-[520px] max-w-[92vw] bg-rift-800 border border-gold-500/40 p-5">
        <div className="flex items-center mb-3">
          <h2 className="flex-1 font-display text-[18px] font-bold text-gold-400">{tx('Raccourcis clavier')}</h2>
          <button onClick={onClose} aria-label={tx('Fermer')} className="btn-ghost min-h-[36px] min-w-[36px]"><X size={18} /></button>
        </div>
        <ul className="divide-y divide-rift-700">
          {SHORTCUTS.map(s => (
            <li key={s.keys} className="flex items-center gap-4 py-2">
              <kbd className="font-mono text-[12px] text-gold-400 border border-rift-600 px-2 py-0.5 min-w-[92px] text-center">{s.keys}</kbd>
              <span className="text-[14px] text-rift-100">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
