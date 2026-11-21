import React, { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { useBackHandler } from '../../lib/backButton.js';
import { useNeedsAttention } from '../../lib/attention.js';
import { SECTIONS, DEV_SECTION, SectionContent, useSectionStatus } from './settingsSections.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * Phone settings (lot 6 d, B.4): a list of the same sections as the PC — icon,
 * title, a status line — and each section on its own page with the back arrow
 * (same pattern as « Plus »).
 */
export default function SettingsTab({ batchDefaults, onUpdateDefaults, hideTitle, onClose, initialOpen = null }) {
  const [prefs] = usePrefs();
  const [open, setOpen] = useState(initialOpen);
  useBackHandler(!!open, () => setOpen(null));
  const status = useSectionStatus();
  const attention = useNeedsAttention();
  const sections = prefs.devMode ? [...SECTIONS, DEV_SECTION] : SECTIONS;
  const current = sections.find(s => s.id === open);

  if (current) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-2 pt-2 pb-1 flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setOpen(null)} aria-label={tx('Retour aux réglages')} className="w-11 h-11 flex items-center justify-center text-rift-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="h-title text-[20px]">{current.label}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
          <SectionContent id={current.id} batchDefaults={batchDefaults} onUpdateDefaults={onUpdateDefaults} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className={`px-4 ${hideTitle ? 'pt-1' : onClose ? 'pt-2' : 'pt-5'}`}>
        {!hideTitle && (
          <div className="flex items-center gap-1 mb-2">
            {onClose && (
              <button onClick={onClose} aria-label={tx('Retour')} className="w-11 h-11 -ml-3 flex items-center justify-center text-rift-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="h-title text-[22px]">{tx('Réglages')}</h1>
          </div>
        )}
        <nav aria-label={tx('Sections des réglages')} className="flex flex-col">
          {sections.map(s => (
            <button key={s.id} onClick={() => setOpen(s.id)}
              className="flex items-center gap-3 min-h-[64px] px-1 border-b border-rift-600/60 text-left active:bg-rift-800">
              <span className="hex-cut-sm w-10 h-10 flex items-center justify-center bg-rift-800 border border-gold-500/30 flex-shrink-0">
                <s.icon className="w-5 h-5 text-gold-400" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-rift-100">{s.label}</span>
                {status[s.id] && <span className="block text-[13px] text-rift-400 truncate">{status[s.id]}</span>}
              </span>
              {s.id === 'sync' && attention && <span className="w-2 h-2 rotate-45 bg-gold-400" aria-label={tx('À voir')} />}
              <ChevronRight className="w-5 h-5 text-rift-500" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
