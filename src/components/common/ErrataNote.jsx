import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import { rulesTextHtml } from '../../lib/cardLocale.js';
import { erratumFor, errataLabel } from '../../lib/errata.js';
import { tx } from '../../lib/i18n.js';

/**
 * « TEXTE MODIFIÉ » next to the rules text (lot 7.6, B.6.5, tel-05): a tap
 * unfolds the former text, struck through in rift-400, under the new one.
 * `children`: the current text.
 */
export default function ErrataNote({ cardData, text, language, children }) {
  const [open, setOpen] = useState(false);
  const e = erratumFor(cardData, text, language);
  if (!e) return children;
  return (
    <>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex items-center gap-2 mb-1.5 min-h-[32px] text-left">
        <StatusPill kind="texte-modifie" />
        <span className="text-[12px] text-rift-400">{errataLabel(e.at).replace('Texte modifié ', '')}</span>
        <ChevronDown size={14} className={`text-rift-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {children}
      {open && (
        <div className="mt-2 pt-2 border-t border-rift-600/50">
          <p className="text-[12px] text-rift-400 mb-1">{tx('Ancien texte')}</p>
          <div className="text-[14px] text-rift-400 line-through leading-relaxed" dangerouslySetInnerHTML={{ __html: rulesTextHtml({ text: e.old, isHtml: e.isHtml }) }} />
        </div>
      )}
    </>
  );
}
