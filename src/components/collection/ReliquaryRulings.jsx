import React, { useEffect, useState } from 'react';
import { getMatcher } from '../../lib/cardMatcher.js';
import { rulingsFor, sanitizeRulingHtml } from '../../lib/rulings.js';
import { loadRulingsFr, rulingsEntryFr } from '../../lib/rulingsFr.js';
import { symbolsHtml } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';

/** Rulings of the « Reliquaire » (mock-up .rul): Q hexagon, accordion, FR / EN switch, source and licence at the foot. */
export default function ReliquaryRulings({ cardData }) {
  const m = getMatcher();
  const [showFr, setShowFr] = useState(true);
  const [, setVersion] = useState(0);
  useEffect(() => { loadRulingsFr().then(() => setVersion(v => v + 1)); }, []);
  const entry = rulingsFor(cardData, m.rulings, m.cards || []);
  const frEntry = entry ? rulingsEntryFr(entry, m.cards || []) : null;
  if (!entry?.rulings?.length) return <div className="text-rift-500 py-[30px] text-center">{tx('Aucun ruling pour cette carte.')}</div>;
  const fr = showFr && !!frEntry;
  const license = m.rulings.license || 'CC BY-SA 4.0';
  return (
    <div data-help="card.rulings">
      <div className="flex justify-between items-center mb-3.5 text-[11.5px] text-rift-500">
        <span>{fr
          ? (frEntry.rulings.every(r => r.curated) ? tx('Traduction française communautaire') : tx('Traduction automatique · terminologie officielle Riftbound'))
          : tx('Texte officiel (anglais)')}</span>
        <div className="flex border border-rift-600" role="group" aria-label={tx('Langue')}>
          {[['fr', tx('FR'), !!frEntry], ['en', tx('EN'), true]].map(([k, l, ok]) => (
            <button key={k} type="button" disabled={!ok} aria-pressed={(k === 'fr') === fr} onClick={() => setShowFr(k === 'fr')}
              className={`px-2.5 py-[3px] text-[11.5px] font-bold disabled:opacity-40 ${(k === 'fr') === fr ? 'bg-gold-500/20 text-gold-400' : 'text-rift-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      {entry.rulings.map((r, i) => {
        const f = fr ? frEntry.rulings[i] : null;
        return (
          <details key={r.id || r.question} open={i === 0} className="group border border-rift-600 bg-[#0a1220aa] mb-2">
            <summary className="cursor-pointer px-3.5 py-3 font-semibold text-rift-100 list-none flex gap-2.5 [&::-webkit-details-marker]:hidden">
              <span className="hexagon flex-shrink-0 w-[22px] h-[24px] bg-gold-500 text-rift-900 grid place-items-center text-[11px] font-extrabold" aria-hidden="true">Q</span>
              <span>{f?.questionFr || r.question}</span>
            </summary>
            <div lang={f ? 'fr' : 'en'} className="pl-[46px] pr-3.5 pb-3.5 text-[13.5px] leading-[1.55] text-rift-300 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-gold-400 [&_a]:underline [&_strong]:text-rift-100"
              dangerouslySetInnerHTML={{ __html: symbolsHtml(sanitizeRulingHtml(f?.htmlFr || r.html)) }} />
          </details>
        );
      })}
      <p className="text-[11px] text-rift-500 mt-2.5">
        <a href={entry.url} target="_blank" rel="noreferrer" className="underline hover:text-gold-400">Riftbound FAQ</a>
        {entry.authors?.length ? ` · ${entry.authors.join(', ')}` : ''}
        {' · '}<a href={m.rulings.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/'} target="_blank" rel="noreferrer" className="underline hover:text-gold-400">{license}</a>
      </p>
    </div>
  );
}
