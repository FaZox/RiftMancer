import React, { useState } from 'react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { useContentNotices } from '../../lib/contentNotices.js';
import { SECTIONS, DEV_SECTION, SectionContent, useSectionStatus } from '../../components/settings/settingsSections.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * PC settings (B.4): the same nine sections as the phone — the list on the
 * left with each one's status line, the chosen section on the right.
 */
export default function SettingsPage({ batchDefaults, onUpdateDefaults, initialSection = 'sync' }) {
  const notices = useContentNotices();
  const status = useSectionStatus();
  const [section, setSection] = useState(initialSection || 'sync');
  const [prefs] = usePrefs();
  const sections = prefs.devMode ? [...SECTIONS, DEV_SECTION] : SECTIONS;
  const current = sections.find(s => s.id === section) || SECTIONS[0];
  const waiting = !!(notices.cartes || notices.traductions);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="flex-shrink-0 px-8 pt-7 pb-4 border-b border-gold-500/15">
        <h1 className="h-title text-[28px] leading-none">{tx('Réglages')}</h1>
      </header>
      <div className="flex-1 min-h-0 flex">
        <nav aria-label={tx('Sections des réglages')} className="w-[300px] flex-shrink-0 border-r border-rift-600/40 py-3 overflow-y-auto">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} aria-current={current.id === s.id ? 'page' : undefined}
              className={`relative w-full flex items-center gap-3 px-6 py-3 text-left ${current.id === s.id ? 'bg-gold-500/10' : 'hover:bg-rift-800'}`}>
              {current.id === s.id && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gold-400" />}
              <s.icon className={`w-5 h-5 flex-shrink-0 ${current.id === s.id ? 'text-gold-400' : 'text-rift-400'}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block text-[15px] ${current.id === s.id ? 'text-gold-400 font-bold' : 'text-rift-100'}`}>{s.label}</span>
                <span className={`block text-[12px] truncate ${s.id === 'content' && waiting ? 'text-gold-400' : 'text-rift-500'}`}>{status[s.id]}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 overflow-y-auto px-10 py-8">
          <div className="max-w-[760px] space-y-5">
            <h2 className="font-display text-2xl font-bold text-gold-400">{current.label}</h2>
            <SectionContent id={current.id} batchDefaults={batchDefaults} onUpdateDefaults={onUpdateDefaults} />
          </div>
        </div>
      </div>
    </div>
  );
}
