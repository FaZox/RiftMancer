import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useBackHandler } from '../../lib/backButton.js';

/**
 * Drop-down in the app's style (the system <select> list does not follow the
 * theme). options: [{ value, label, group? }] — `group` draws a small title.
 */
export default function ThemedSelect({ value, options, onChange, label, className = '', buttonClassName = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useBackHandler(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const current = options.find(o => o.value === value) || options[0];
  let lastGroup = null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`w-full flex items-center gap-1.5 text-left ${buttonClassName}`}
      >
        <span className="flex-1 min-w-0 truncate">{current?.label}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gold-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="scan-pop absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto bg-rift-800 border border-gold-500/50 shadow-2xl min-w-[220px]">
          {options.map(o => {
            const title = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group || null;
            const selected = o.value === value;
            return (
              <React.Fragment key={o.value}>
                {title && <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-rift-500">{title}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full min-h-[44px] px-3 flex items-center gap-2 text-left text-sm border-l-2 ${selected ? 'bg-gold-500/15 text-gold-400 border-gold-400' : 'text-rift-100 border-transparent hover:bg-rift-700'}`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {selected && <Check className="w-4 h-4" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
