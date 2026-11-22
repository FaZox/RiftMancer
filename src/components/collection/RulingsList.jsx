import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { rulingsFor, sanitizeRulingHtml } from '../../lib/rulings.js';
import { tx } from '../../lib/i18n.js';
import { symbolsHtml } from '../../lib/cardLocale.js';

/**
 * « Rulings » (card sheet → Infos): the questions of Riftbound FAQ about this
 * card (or another printing of it), each one opening to show the whole answer,
 * with its links to the Core Rules. Unofficial, in English; source, author and
 * licence (CC BY-SA 4.0) under the list. Installed from Settings → Content.
 */
export default function RulingsList({ cardData }) {
  const m = getMatcher();
  const entry = rulingsFor(cardData, m.rulings, m.cards || []);
  if (!entry) return null;
  const license = m.rulings.license || 'CC BY-SA 4.0';
  return (
    <section className="space-y-1.5" aria-label={tx('Rulings')} data-help="card.rulings">
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-rift-400">{tx('Rulings')} · {entry.rulings.length}</h3>
      <div className="border border-rift-700/70 divide-y divide-rift-700/70">
        {entry.rulings.map(r => (
          <details key={r.id || r.question} className="group">
            <summary className="list-none flex items-start gap-2 px-3 py-2.5 cursor-pointer text-[14px] text-rift-100 hover:bg-rift-800 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold-400 transition-transform group-open:rotate-90" aria-hidden="true" />
              <span>{r.question}</span>
            </summary>
            <div lang="en"
              className="px-3 pb-3 pl-9 text-[14px] leading-relaxed text-rift-200 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_a]:text-gold-400 [&_a]:underline [&_sup]:text-[11px] [&_sup]:ml-0.5 [&_strong]:text-rift-100"
              // sanitized again here: the catalog can come from another PC (packs) or the phone's sync
              dangerouslySetInnerHTML={{ __html: symbolsHtml(sanitizeRulingHtml(r.html)) }} />
          </details>
        ))}
      </div>
      <p className="text-[12px] text-rift-500">
        {tx('Non officiel, en anglais ·')}{' '}
        <a href={entry.url} target="_blank" rel="noreferrer" className="underline hover:text-gold-400">Riftbound FAQ</a>
        {entry.authors?.length ? ` · ${entry.authors.join(', ')}` : ''}
        {' · '}<a href={m.rulings.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/'} target="_blank" rel="noreferrer" className="underline hover:text-gold-400">{license}</a>
      </p>
    </section>
  );
}
