// PC « Cartes » (« Atelier »): the always-visible filter panel, in icons. Every button writes into the line of text
// (src/lib/cardQuery.js), so the search syntax and the filters stay one thing.
import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { OPTIONS, VALUE_LABEL, selectionFor, toggleOption, setSelection } from '../../lib/cardQuery.js';
import { domainIcon, rarityIcon, typeIcon, MASK_ICON, symbolsReady } from '../../lib/symbols.js';
import { DOMAIN_COLORS } from '../../data/sampleCards.js';
import { setImage } from '../../lib/setImages.js';
import EnergyBadge from '../common/EnergyBadge.jsx';
import { tx, locale } from '../../lib/i18n.js';

const mask = (src) => ({ backgroundColor: 'currentColor', WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` });

function Block({ title, onClear, active, children, help }) {
  return (
    <section className="py-3.5 border-b border-gold-500/10" data-help={help}>
      <div className="flex items-center mb-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-rift-500 mr-auto">{title}</h3>
        {active && <button type="button" onClick={onClear} className="text-[11px] font-semibold text-gold-400 hover:underline">{tx('tout')}</button>}
      </div>
      {children}
    </section>
  );
}

/** Left panel (262 px) of the « Atelier ». `searchRef`: the field Ctrl F focuses; `onHelp`: the « ? » of the syntax. */
export default function AtelierFilters({ b, searchRef, onHelp }) {
  const clear = (key) => () => b.setQuery(q => setSelection(q, key, []));
  const sel = (key, options) => selectionFor(b.parsed, key, options);
  const setOptions = useMemo(() => [...b.sets.keys()].map(s => s.toLowerCase()), [b.sets]);
  const selSets = sel('s', setOptions); const selD = sel('d'); const selE = sel('e'); const selP = sel('p'); const selR = sel('r'); const selT = sel('t');
  const typeCounts = useMemo(() => {
    const m = {};
    for (const c of b.cards) { m[c.type] = (m[c.type] || 0) + 1; if ((c.superTypes || []).includes('champion')) m.champion = (m.champion || 0) + 1; }
    return m;
  }, [b.cards]);
  const tog = (key, v, options) => () => b.setQuery(q => toggleOption(q, key, v, options));
  const own = [['all', tx('Toutes')], ['owned', tx('Possédées')], ['missing', tx('Manquantes')]];

  return (
    <aside aria-label={tx('Filtres')} data-help="cards.facets" className="w-[262px] flex-shrink-0 h-full overflow-y-auto px-4 pb-8 bg-[#0b1322] border-r border-gold-500/30">
      <section className="pt-4 pb-3.5 border-b border-gold-500/10" data-help="cards.search">
        <label className="flex items-center gap-2 h-10 px-2.5 bg-rift-800 border border-gold-500/50 focus-within:border-gold-400">
          <Search className="w-4 h-4 text-gold-500 flex-shrink-0" aria-hidden="true" />
          <span className="sr-only">{tx('Rechercher une carte')}</span>
          <input ref={searchRef} type="text" value={b.input} onChange={e => b.setInput(e.target.value)} spellCheck={false} placeholder={tx('Nom, mot-clé, effet…')}
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-rift-100 placeholder:text-rift-500" />
          <button type="button" onClick={onHelp} aria-label={tx('Aide sur la syntaxe de recherche')} title={tx('Aide sur la syntaxe de recherche')}
            className="font-mono text-[11px] text-rift-400 border border-rift-600 px-1.5 py-0.5 hover:text-gold-400 hover:border-gold-500/50">?</button>
        </label>
        <p className="mt-1 text-[11px] text-rift-500">{tx('Ctrl F')}</p>
      </section>

      <Block title={tx('Possession')}>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={tx('Possession')}>
          {own.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={b.view.ownership === v} onClick={() => b.setView({ ownership: v, scroll: 0 })}
              className={`h-9 text-[12px] font-bold border ${b.view.ownership === v ? 'border-gold-400 bg-gold-500/15 text-gold-400' : 'border-rift-600 text-rift-300 hover:border-gold-500/50'}`}>{l}</button>
          ))}
        </div>
      </Block>

      <Block title={tx('Extensions')} active={selSets.size > 0} onClear={clear('s')}>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={tx('Extensions')}>
          {[...b.sets.values()].map(s => {
            const on = selSets.has(s.set.toLowerCase());
            const img = setImage(s.set);
            return (
              <button key={s.set} type="button" aria-pressed={on} onClick={tog('s', s.set.toLowerCase(), setOptions)} title={`${s.setName} ${s.own}/${s.total}`} aria-label={s.setName}
                className={`h-14 flex items-center justify-center border transition-opacity ${on ? 'border-gold-400 bg-gold-500/10 opacity-100' : 'border-rift-700 opacity-55 hover:opacity-100'}`}>
                {img ? <img src={img} alt="" className="h-12 w-auto object-contain" /> : (
                  <span className="relative w-9 h-10 flex items-center justify-center"><span className="hexagon absolute inset-0 bg-gold-500/70" /><span className="hexagon absolute inset-[2px] bg-[#0a1220]" /><span className="relative text-[11px] font-bold text-gold-400">{s.set}</span></span>
                )}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title={tx('Domaines')} active={selD.size > 0} onClear={clear('d')} help="cards.domains">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={tx('Domaines')}>
          {OPTIONS.d.map(d => {
            const on = selD.has(d); const ic = domainIcon(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={tog('d', d)} title={VALUE_LABEL.d[d]} aria-label={VALUE_LABEL.d[d]}
                className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-semibold transition-opacity ${on ? 'text-rift-100 opacity-100' : 'text-rift-400 opacity-40 hover:opacity-90'}`}>
                {ic ? <img src={ic} alt="" className="w-8 h-8 object-contain" /> : <span className="hexagon w-8 h-9" style={{ background: DOMAIN_COLORS[d].hex }} />}
                {VALUE_LABEL.d[d]}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title={tx('Énergie')} active={selE.size > 0} onClear={clear('e')}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx('Énergie')}>
          {OPTIONS.e.map(v => (
            <button key={v} type="button" aria-pressed={selE.has(v)} onClick={tog('e', v)} aria-label={`${tx('Énergie')} ${v}`} title={`${tx('Énergie')} ${v}`}
              className={`rounded-full transition-all ${selE.has(v) ? 'ring-2 ring-gold-400 shadow-[0_0_10px_rgba(244,241,234,.7)]' : 'opacity-60 hover:opacity-100'}`}>
              <span className="relative inline-flex">{selE.has(v) ? <EnergyBadge value={v} size="md" /> : (
                <span className="inline-flex items-center justify-center rounded-full border border-rift-500 text-rift-200 font-bold text-[15px]" style={{ width: 30, height: 30 }}>{v}</span>)}</span>
            </button>
          ))}
        </div>
      </Block>

      <Block title={<span className="inline-flex items-center gap-1.5">{tx('Puissance')}{symbolsReady() && <span className="block w-3.5 h-3.5" style={mask(MASK_ICON.might)} aria-hidden="true" />}</span>} active={selP.size > 0} onClear={clear('p')} help="cards.might">
        <div className="flex flex-wrap gap-1" role="group" aria-label={tx('Puissance')}>
          {OPTIONS.p.map(v => (
            <button key={v} type="button" aria-pressed={selP.has(v)} onClick={tog('p', v)} aria-label={`${tx('Puissance')} ${v}`} title={`${tx('Puissance')} ${v}`}
              className={`hexagon w-[30px] h-[34px] text-[13px] font-bold flex items-center justify-center ${selP.has(v) ? 'bg-gold-500 text-rift-900' : 'bg-rift-700 text-rift-300 hover:bg-rift-600'}`}>{v}</button>
          ))}
        </div>
      </Block>

      <Block title={tx('Rareté')} active={selR.size > 0} onClear={clear('r')}>
        <div className="flex gap-1.5" role="group" aria-label={tx('Rareté')}>
          {OPTIONS.r.map(v => (
            <button key={v} type="button" aria-pressed={selR.has(v)} onClick={tog('r', v)} title={VALUE_LABEL.r[v]} aria-label={VALUE_LABEL.r[v]}
              className={`w-9 h-9 flex items-center justify-center border ${selR.has(v) ? 'border-gold-400 bg-gold-500/15' : 'border-rift-700 opacity-60 hover:opacity-100'}`}>
              {rarityIcon(v) ? <img src={rarityIcon(v)} alt="" className="w-5 h-5 object-contain" /> : <span className="text-[11px] font-bold text-rift-200">{VALUE_LABEL.r[v].slice(0, 2)}</span>}
            </button>
          ))}
        </div>
      </Block>

      <Block title={tx('Type')} active={selT.size > 0} onClear={clear('t')}>
        <div className="flex flex-col" role="group" aria-label={tx('Type')}>
          {OPTIONS.t.map(v => {
            const on = selT.has(v); const ic = typeIcon(v);
            return (
              <button key={v} type="button" aria-pressed={on} onClick={tog('t', v)}
                className={`flex items-center gap-2.5 h-8 px-2 border-l-2 text-[13px] ${on ? 'border-gold-400 bg-gold-500/10 text-gold-400' : 'border-transparent text-rift-300 hover:bg-rift-800/60'}`}>
                <span className="w-4 h-4 flex-shrink-0">{ic && <span className="block w-4 h-4" style={mask(ic)} aria-hidden="true" />}</span>
                <span className="flex-1 text-left">{VALUE_LABEL.t[v]}</span>
                <span className="font-mono text-[11px] text-rift-500">{(typeCounts[v] || 0).toLocaleString(locale())}</span>
              </button>
            );
          })}
        </div>
      </Block>
    </aside>
  );
}
