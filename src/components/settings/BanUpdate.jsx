import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Pencil, RefreshCw, Search, X } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import Banner from '../common/Banner.jsx';
import DiffList from '../common/DiffList.jsx';
import { Stepper, ProgressRow } from '../common/Progress.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { getBanlist } from '../../lib/banlist.js';
import {
  RULES_URL, ANNOUNCEMENT_URL, parseRulesPage, parseBanAnnouncement, buildBanList, diffBans,
  banListProblem, banLayer, editBanList, catalogMatches, normName,
} from '../../lib/banUpdate.js';
import { RIFTHUNT_BAN_URLS, rifthuntBanRules } from '../../lib/rifthunt.js';
import { tx, locale } from '../../lib/i18n.js';

/**
 * « Mettre à jour les cartes bannies » (lot 4.4) in the B.6.2 flow:
 * Recherche → Résumé → Installation → Terminé. Nothing changes before « Installer ».
 */
const STEPS = ['Recherche', tx('Résumé'), 'Installation', tx('Terminé')];
const FORMAT_LABEL = { standard: tx('Standard'), '2v2': '2v2' };
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

function Done({ text, onClose }) {
  return (
    <div className="text-center py-4 space-y-3">
      <span className="hex-cut inline-flex w-14 h-14 items-center justify-center bg-gold-400/15 text-gold-400"><CheckCircle2 size={28} /></span>
      <p className="text-[15px] text-rift-100">{text}</p>
      <p className="text-[13px] text-rift-400">{tx('Le téléphone recevra ces changements à la prochaine synchro.')}</p>
      <button onClick={onClose} className="btn-primary text-[14px] py-2 px-4">{tx('Fermer')}</button>
    </div>
  );
}

/** The three rifthunt searches, read as a rules page; null when rifthunt does not answer. */
async function rifthuntRules(api) {
  try {
    const texts = {};
    for (const [key, url] of Object.entries(RIFTHUNT_BAN_URLS)) {
      const r = await api.content.fetch(url);
      if (r.ok) texts[key] = r.text;
      else if (r.status === 404) texts[key] = '{"object":"error"}'; // no card: rifthunt answers 404
      else return null;
    }
    return rifthuntBanRules(texts);
  } catch (err) {
    console.warn('[bans] rifthunt unreadable, Riot rules page used:', err);
    return null;
  }
}

/** Rules page (+ announcement) → summary → install. */
export function BanUpdateSheet({ open, onClose, onManual }) {
  const api = window.riftboundDesktop;
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null); // { text, reason }
  const [result, setResult] = useState(null); // { list, unknown, diff, date }
  const [annUrl, setAnnUrl] = useState('');

  const search = useCallback(async (announcementUrl = '') => {
    setStep(0); setError(null); setResult(null);
    try {
      // rifthunt first (each ban with its date, the ones announced too), Riot's rules page when it does not answer
      let rules = await rifthuntRules(api);
      if (!rules) {
        const page = await api.content.fetch(RULES_URL);
        if (!page.ok) { setError({ text: page.message, reason: page.reason }); return; }
        rules = parseRulesPage(page.text);
      }
      let announcement = null;
      if (announcementUrl) {
        const a = await api.content.fetch(announcementUrl);
        if (!a.ok) { setError({ text: a.message, reason: a.reason }); return; }
        announcement = { ...parseBanAnnouncement(a.text), url: announcementUrl };
      }
      const current = getBanlist();
      const built = buildBanList(current, rules, announcement, getMatcher().cards);
      const problem = banListProblem(current, built.list);
      if (problem) { setError({ text: problem, reason: 'unreadable' }); return; }
      setResult({ ...built, rulesDate: rules.updatedAt, source: rules.source ? { label: 'rifthunt.com', url: rules.source.url } : null, diff: diffBans(current, built.list) });
      setStep(1);
    } catch (err) {
      setError({ text: err.message || tx('La page a changé et n’a pas pu être lue. Rien n’a été modifié.'), reason: 'unreadable' });
    }
  }, [api]);

  useEffect(() => { if (open) { setAnnUrl(''); search(); } }, [open, search]);

  const install = async () => {
    setStep(2);
    try {
      await api.content.install('bannies', banLayer(result.list, result.source || { label: tx('règlement officiel des tournois'), url: RULES_URL }));
      setStep(3);
    } catch (err) {
      setStep(1);
      setError({ text: err.message, reason: 'install' });
    }
  };

  const items = useMemo(() => {
    if (!result) return [];
    const out = [];
    for (const [fmt, d] of Object.entries(result.diff.formats)) {
      for (const n of d.added) out.push({ op: '+', label: n, detail: FORMAT_LABEL[fmt] || fmt });
      for (const n of d.removed) out.push({ op: '-', label: n, detail: `${FORMAT_LABEL[fmt] || fmt} · plus bannie` });
    }
    return out;
  }, [result]);

  const annOk = !annUrl || ANNOUNCEMENT_URL.test(annUrl.trim());
  return (
    <Sheet open={open} onClose={onClose} title={tx('Cartes bannies')}>
      <div className="space-y-4">
        <Stepper steps={STEPS} current={step} />
        {step === 0 && !error && <ProgressRow done={0} total={null} unit={tx('Lecture du règlement officiel…')} />}
        {error && (
          <Banner tone="bad">
            {error.text}
            <span className="flex flex-wrap gap-2 mt-2">
              {error.reason === 'offline' && <button onClick={() => search(annUrl.trim())} className="btn-secondary text-[13px] py-1.5 px-3"><RefreshCw className="w-4 h-4" /> {tx('Réessayer')}</button>}
              {(error.reason === 'refused' || error.reason === 'http') && <a href={RULES_URL} target="_blank" rel="noreferrer" className="btn-secondary text-[13px] py-1.5 px-3"><ExternalLink className="w-4 h-4" /> {tx('Ouvrir dans mon navigateur')}</a>}
              <button onClick={onManual} className="btn-ghost text-[13px] py-1.5 px-3"><Pencil className="w-4 h-4" /> {tx('Modifier à la main')}</button>
            </span>
          </Banner>
        )}
        {step === 1 && result && (
          <>
            <p className="text-[15px] text-rift-100">
              {result.diff.changed
                ? tx('{length} changement{v1} d’après le règlement officiel du {day}{v3}.', { length: items.length, v1: items.length > 1 ? 's' : '', day: day(result.rulesDate), v3: result.date !== result.rulesDate ? tx(' et l’annonce du {day}', { day: day(result.date) }) : '' })
                : tx('Votre liste est à jour (règlement officiel du {day}).', { day: day(result.rulesDate) })}
            </p>
            <p className="text-[13px] text-rift-400">{result.source ? tx('Source : rifthunt.com (listes officielles de Riot)') : tx('Source : règlement officiel des tournois (Riot)')}</p>
            {result.diff.changed && <DiffList items={items} />}
            {result.unknown.length > 0 && (
              <Banner tone="warn">
                {tx('Absentes du catalogue (extension pas encore installée ?) :')} {result.unknown.join(', ')}{tx('. Elles sont gardées par leur nom ; « Rechercher de nouvelles cartes » les ajoutera.')}
              </Banner>
            )}
            <p className="text-[13px] text-rift-400">
              {tx('Le règlement est mis à jour après les annonces : les bannissements annoncés depuis sont gardés. Une annonce plus récente ? Collez son adresse :')}
            </p>
            <div className="flex gap-2">
              <input value={annUrl} onChange={e => setAnnUrl(e.target.value)} placeholder="https://playriftbound.com/fr-fr/news/…"
                aria-label={tx('Adresse d’une annonce de bannissement')}
                className="flex-1 min-w-0 h-9 bg-rift-800 border border-rift-600/40 text-[13px] text-rift-100 px-2" />
              <button onClick={() => search(annUrl.trim())} disabled={!annUrl || !annOk} className="btn-ghost text-[13px] py-1.5 px-3">{tx('Lire')}</button>
            </div>
            {!annOk && <p className="text-[12px] text-state-warn">{tx('Seules les annonces de playriftbound.com sont lues.')}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-ghost text-[14px] py-2 px-4">{result.diff.changed ? tx('Annuler') : tx('Fermer')}</button>
              {result.diff.changed && <button onClick={install} className="btn-primary text-[14px] py-2 px-4">{tx('Installer')}</button>}
            </div>
          </>
        )}
        {step === 2 && <ProgressRow done={0} total={null} unit={tx('Installation… Ne fermez pas l’appli.')} />}
        {step === 3 && <Done text={tx('Liste des cartes bannies mise à jour.')} onClose={onClose} />}
      </div>
    </Sheet>
  );
}

/** Fallback: add or remove cards by hand, with the date typed by the user. */
export function BanEditSheet({ open, onClose }) {
  const api = window.riftboundDesktop;
  const [format, setFormat] = useState('standard');
  const [list, setList] = useState(null);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(today());
  const [step, setStep] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setList(getBanlist()); setQuery(''); setDate(today()); setStep(null); setError(null); } }, [open]);

  const results = useMemo(() => {
    const q = normName(query);
    if (q.length < 2) return [];
    const seen = new Set();
    return getMatcher().cards.filter(c => {
      const k = normName(c.nameEn || c.name);
      if (!k.includes(q) && !normName(c.nameFr).includes(q)) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 8);
  }, [query]);

  if (!list) return null;
  const banned = list.formats?.[format]?.banned || [];
  const addCard = (c) => {
    const name = c.nameEn || c.name;
    const prints = catalogMatches(name, getMatcher().cards);
    setList(l => editBanList(l, { format, date, add: [{ name, ids: prints.some(p => p.name !== name) ? prints.map(p => p.id) : undefined, battlefield: c.type === 'battlefield', legend: c.type === 'legend' }] }));
    setQuery('');
  };
  const remove = (name) => setList(l => editBanList(l, { format, date, remove: [name] }));
  const diff = diffBans(getBanlist(), list);
  const install = async () => {
    setStep('install'); setError(null);
    try {
      await api.content.install('bannies', banLayer(list, { label: tx('modification à la main') }));
      setStep('done');
    } catch (err) { setStep(null); setError(err.message); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={tx('Modifier la liste à la main')}>
      {step === 'done' ? <Done text={tx('Liste des cartes bannies modifiée.')} onClose={onClose} /> : (
        <div className="space-y-4">
          <div className="seg" role="tablist" aria-label={tx('Format')}>
            {Object.keys(list.formats || { standard: 1 }).map(f => (
              <button key={f} role="tab" aria-selected={format === f} onClick={() => setFormat(f)}>{FORMAT_LABEL[f] || f}</button>
            ))}
          </div>
          <ul className="max-h-56 overflow-y-auto divide-y divide-rift-700/60">
            {banned.map(e => {
              const name = typeof e === 'string' ? e : e.name;
              return (
                <li key={name} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-[14px] text-rift-100">{name}{e.battlefield ? <span className="text-rift-400"> {tx('· champ de bataille')}</span> : ''}</span>
                  <button onClick={() => remove(name)} aria-label={`Retirer ${name}`} className="btn-ghost min-h-[32px] px-1"><X size={16} /></button>
                </li>
              );
            })}
          </ul>
          <label className="block">
            <span className="text-[13px] text-rift-300">{tx('Ajouter une carte')}</span>
            <span className="relative block mt-1">
              <Search size={16} className="absolute left-2 top-2.5 text-rift-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('Nom de la carte')}
                className="w-full h-9 bg-rift-800 border border-rift-600/40 text-[14px] text-rift-100 pl-8 pr-2" />
            </span>
          </label>
          {results.length > 0 && (
            <ul className="border border-rift-700">
              {results.map(c => (
                <li key={c.id}><button onClick={() => addCard(c)} className="w-full text-left px-3 py-1.5 text-[14px] text-rift-100 hover:bg-rift-800">
                  {c.nameEn || c.name}{c.nameFr ? <span className="text-rift-400"> · {c.nameFr}</span> : ''}
                </button></li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-[13px] text-rift-300">
            {tx('Date d’effet')}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 bg-rift-800 border border-rift-600/40 text-[14px] text-rift-100 px-2" />
          </label>
          {diff.changed && <DiffList items={Object.entries(diff.formats).flatMap(([f, d]) => [
            ...d.added.map(n => ({ op: '+', label: n, detail: FORMAT_LABEL[f] || f })),
            ...d.removed.map(n => ({ op: '-', label: n, detail: FORMAT_LABEL[f] || f })),
          ])} />}
          {error && <Banner tone="bad">{error}</Banner>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost text-[14px] py-2 px-4">{tx('Annuler')}</button>
            <button onClick={install} disabled={!diff.changed || step === 'install'} className="btn-primary text-[14px] py-2 px-4">{tx('Installer')}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
