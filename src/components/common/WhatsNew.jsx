import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Sheet from './Sheet.jsx';
import notesFr from '../../../docs/NOUVEAUTES.md?raw';
import notesEn from '../../../docs/WHATS-NEW.md?raw';
import { APP_VERSION } from '../../lib/appVersion.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import { shouldShowWhatsNew, whatsNew } from '../../lib/versionCompat.js';
import { tx, getLang } from '../../lib/i18n.js';

/** The notes of this version in the app's language (docs/WHATS-NEW.md, docs/NOUVEAUTES.md: written for the users). */
export const currentNotes = () => whatsNew(getLang() === 'fr' ? notesFr : notesEn, APP_VERSION) || whatsNew(notesFr, APP_VERSION);

/** The « Nouveautés » list (B.6, tel-13): a title and a line per change. */
export function WhatsNewList({ notes }) {
  return (
    <ul className="space-y-3">
      {notes.items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <Sparkles size={18} className="text-gold-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {it.title && <span className="block text-[15px] font-semibold text-rift-100">{it.title}</span>}
            <span className="block text-[14px] text-rift-300">{it.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shown once, at the first start after an update (lot 4.6). A first install
 * only records the version. « Continuer » closes it.
 */
export default function WhatsNew() {
  const [prefs, setPrefs] = usePrefs();
  const [open, setOpen] = useState(false);
  const notes = useMemo(currentNotes, []);
  useEffect(() => {
    if (prefs.lastSeenVersion === APP_VERSION) return;
    if (shouldShowWhatsNew(prefs.lastSeenVersion, APP_VERSION) && notes) setOpen(true);
    else setPrefs({ lastSeenVersion: APP_VERSION });
  }, [prefs.lastSeenVersion, notes, setPrefs]);
  const close = () => { setOpen(false); setPrefs({ lastSeenVersion: APP_VERSION }); };
  if (!open || !notes) return null;
  return (
    <Sheet open title={tx('Nouveautés')} onClose={close}>
      <div className="space-y-4 pb-2">
        <p className="text-[13px] text-rift-400">{tx('Version')} {notes.title}</p>
        <WhatsNewList notes={notes} />
        <button onClick={close} className="btn-primary w-full text-[15px] py-2.5">{tx('Continuer')}</button>
      </div>
    </Sheet>
  );
}
