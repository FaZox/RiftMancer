import React from 'react';
import { tx } from '../../lib/i18n.js';

/** The state badges of B.7: label and colour per kind (the colour is never the only signal: the word is there). */
export const PILLS = {
  bannie: { label: tx('Bannie'), cls: 'text-state-bad bg-state-bad/15 border-state-bad/50' },
  foil: { label: tx('Foil'), cls: 'text-gold-400 bg-gold-400/15 border-gold-400/50' },
  estime: { label: tx('≈ Estimé'), cls: 'text-state-warn bg-state-warn/15 border-state-warn/50' },
  nouveau: { label: tx('Nouveau'), cls: 'text-state-info bg-state-info/15 border-state-info/50' },
  'texte-modifie': { label: tx('Texte modifié'), cls: 'text-state-info bg-state-info/15 border-state-info/50' },
  signe: { label: tx('Signé ✓'), cls: 'text-state-ok bg-state-ok/15 border-state-ok/50' },
  auto: { label: tx('Auto'), cls: 'text-rift-400 bg-rift-400/10 border-rift-400/40' },
};

/** Small state badge (B.2, B.7): 20 px high, 11 px capitals, background at 15 %, border at 50 %. */
export default function StatusPill({ kind, children, className = '', title }) {
  const p = PILLS[kind] || PILLS.auto;
  return (
    <span title={title}
      className={`inline-flex items-center h-5 px-1.5 text-[11px] leading-none font-bold uppercase tracking-wider border ${p.cls} ${className}`}>
      {children || p.label}
    </span>
  );
}
