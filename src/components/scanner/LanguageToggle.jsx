import React from 'react';import { tx } from '../../lib/i18n.js';


// Languages offered as one-tap buttons before scanning. Other languages
// (e.g. Chinese) stay available in Settings and on each collection row.
const QUICK_LANGUAGES = [
  { value: 'English', short: tx('EN') },
  { value: 'French', short: tx('FR') },
];

/**
 * Segmented EN / FR switch for the language assigned to newly scanned cards.
 */
export default function LanguageToggle({ value, onChange }) {
  return (
    <div className="seg flex-shrink-0" role="group" aria-label={tx('Langue des cartes que vous allez scanner')} title={tx('Langue des cartes que vous allez scanner')}>
      {QUICK_LANGUAGES.map((l) => (
        <button
          key={l.value}
          onClick={() => onChange(l.value)}
          aria-pressed={value === l.value}
          aria-selected={value === l.value}
          className="!w-10 !px-0"
        >
          {l.short}
        </button>
      ))}
      {!QUICK_LANGUAGES.some(l => l.value === value) && (
        <span className="px-2 self-center text-[11px] text-rift-300">{value}</span>
      )}
    </div>
  );
}
