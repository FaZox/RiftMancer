import React, { useEffect } from 'react';

import { X } from 'lucide-react';

import { useBackHandler } from '../../lib/backButton.js';

import { usePcInterface } from '../../lib/pcInterface.js';

import { tx } from '../../lib/i18n.js';

/**
 * Action panel. Phone (maquette .sheet): slides up from the bottom — rounded 22 px,
 * gold top edge, gold handle, opaque gradient background (no backdrop-filter on
 * Android), footer with a big gold button, safe-area at the bottom. `action`:
 * optional link in the header (e.g. « Tout effacer »).
 * PC: right-hand side panel, 420 px wide.
 */
export default function Sheet({ open, title, onClose, action, children, footer }) {
  useBackHandler(open, () => { onClose?.(); return true; });
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const head = (
    <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
      <h2 className="font-display text-[17px] font-bold text-gold-400">{title}</h2>
      <button type="button" aria-label={tx('Fermer')} className="btn-ghost min-h-[44px] min-w-[44px]" onClick={onClose}><X size={20} strokeWidth={1.8} /></button>
    </div>
  );
  return (
    <>
      {usePcInterface ? (
        <div className="fixed inset-0 z-[60] bg-rift-900/70 fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
          <aside role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            className="absolute right-0 top-0 bottom-0 w-[420px] max-w-full bg-rift-800 border-l border-gold-500/30 flex flex-col">
            {head}
            <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
            {footer && <div className="px-4 py-3 border-t border-rift-700 flex justify-end gap-2">{footer}</div>}
          </aside>
        </div>
      ) : (
        <>
          <div className="mdim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />
          <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="sheet">
            <div className="grab" aria-hidden="true" />
            <h5>
              {title}
              {action && <span className="act">{action}</span>}
            </h5>
            <div className="sb">{children}</div>
            {footer && <div className="sf">{footer}</div>}
          </div>
        </>
      )}
    </>
  );
}
