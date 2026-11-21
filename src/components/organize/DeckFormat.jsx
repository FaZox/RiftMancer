import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Banner from '../common/Banner.jsx';
import { deckFormats, frenchDate } from '../../lib/deckRules.js';
import { tx } from '../../lib/i18n.js';

/** Deck format chip next to the deck's name (B.6.3): « Standard ▾ », opens Standard / 2v2. */
export function FormatChip({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const formats = deckFormats();
  const label = formats.find(f => f.id === value)?.label || 'Standard';
  return (
    <span className="relative inline-flex">
      <button type="button" className="chip h-9 min-h-[36px]" aria-haspopup="listbox" aria-expanded={open}
        aria-label={tx('Format du deck : {label}', { label })} onClick={() => setOpen(o => !o)}>
        {label} <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-label={tx('Format')} className="absolute z-30 top-full left-0 mt-1 min-w-[140px] panel py-1 shadow-xl">
          {formats.map(f => (
            <li key={f.id}>
              <button type="button" role="option" aria-selected={f.id === value}
                onClick={() => { onChange(f.id); setOpen(false); }}
                className={`w-full text-left px-3 min-h-[40px] text-[14px] ${f.id === value ? 'text-gold-400 font-semibold' : 'text-rift-200 hover:bg-rift-700'}`}>
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/**
 * Validity banner under the deck's counters (B.6.3): ok « Deck valide en Standard ·
 * bannissements au 18 sept. 2026 », or bad « N problèmes » unfolding the list.
 */
export function DeckCheckBanner({ check, className = '' }) {
  const [open, setOpen] = useState(false);
  const label = deckFormats().find(f => f.id === check.format)?.label || 'Standard';
  const when = check.banDate ? ` · bannissements au ${frenchDate(check.banDate)}` : '';
  if (check.ok && !check.warnings.length) {
    return <Banner tone="ok" className={className}>{tx('Deck valide en')} {label}{when}</Banner>;
  }
  const n = check.errors.length;
  const tone = n ? 'bad' : 'warn';
  const head = n
    ? <><strong>{n} {tx('problème')}{n > 1 ? 's' : ''}</strong>{n === 1 ? ` · ${check.errors[0]}` : ''}</>
    : <>{tx('Deck valide en')} {label}{when} · <strong>{check.warnings.length} {tx('remarque')}{check.warnings.length > 1 ? 's' : ''}</strong></>;
  const all = [...check.errors, ...check.warnings];
  return (
    <div className={className}>
      <Banner tone={tone} action={all.length > (n === 1 ? 1 : 0) ? { label: open ? 'Masquer' : tx('Détails'), onClick: () => setOpen(o => !o) } : undefined}>{head}</Banner>
      {open && (
        <ul className="px-4 py-2 text-[13px] space-y-0.5 bg-rift-800 border border-t-0 border-rift-700 text-rift-200">
          {all.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}
    </div>
  );
}
