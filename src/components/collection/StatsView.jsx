import React, { useMemo } from 'react';
import { DOMAIN_COLORS, LANGUAGES, domainLabel, rarityLabel, typeLabel } from '../../data/sampleCards.js';
import { catalogSets } from '../../lib/catalog.js';
import { getScanStats, resetScanStats } from '../../lib/scanStats.js';
import { useDialog } from '../common/Dialog.jsx';
import { tx } from '../../lib/i18n.js';

function Bars({ title, rows, total, color }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.n));
  return (
    <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-4 space-y-2">
      <h3 className="text-xs font-semibold text-rift-300 uppercase tracking-wider">{title}</h3>
      {rows.map(r => (
        <div key={r.key} className="flex items-center gap-2 text-xs">
          <span className="w-28 truncate text-rift-300">{r.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-rift-900 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, backgroundColor: r.color || color || '#c8a84e' }} />
          </div>
          <span className="w-16 text-right font-mono text-rift-200">{r.n} <span className="text-rift-500">{Math.round((r.n / total) * 100)}%</span></span>
        </div>
      ))}
    </section>
  );
}

/** Scanner results on this device: how often the AI is right. */
function ScanStats() {
  const { ask } = useDialog();
  const [stats, setStats] = React.useState(getScanStats);
  const row = (label, t) => {
    const done = t.success + t.fail;
    const ok = done ? Math.round((100 * (t.success - t.corrected - t.undone > 0 ? t.success - t.corrected - t.undone : 0)) / done) : null;
    return (
      <div className="flex-1 bg-rift-900/60 p-2.5 space-y-0.5">
        <p className="text-[11px] uppercase tracking-wider text-rift-500">{label}</p>
        <p className="font-display text-lg font-bold text-gold-400">{ok == null ? '—' : `${ok} %`}</p>
        <p className="text-[11px] text-rift-400">{t.scans} {tx('scans ·')} {t.success} {tx('reconnues ·')} {t.fail} {tx('ratés')}</p>
        <p className="text-[11px] text-rift-400">{t.corrected} {tx('corrigées ·')} {t.undone} {tx('annulées ·')} {t.manual} {tx('ajoutées à la main')}</p>
      </div>
    );
  };
  return (
    <section className="panel p-4 space-y-2">
      <h3 className="font-display text-[15px] font-bold text-gold-400">{tx('Scanner')}</h3>
      <p className="text-[11px] text-rift-500">{tx('Pourcentage de scans justes du premier coup (reconnus, ni corrigés ni annulés).')}</p>
      <div className="flex gap-2">{row(tx('Cette session'), stats.session)}{row(tx('Au total'), stats.total)}</div>
      <button onClick={async () => { if (await ask({ title: tx('Remettre à zéro ?'), message: tx('Les statistiques du scan de cet appareil repartent de zéro.'), confirmLabel: tx('Remettre à zéro'), destructive: true })) { resetScanStats(); setStats(getScanStats()); } }} className="btn-ghost text-xs">{tx('Remettre à zéro')}</button>
    </section>
  );
}

/** Collection statistics: domains, rarities, types, languages, finish, set completion. */
export default function StatsView({ scannedCards }) {
  const data = useMemo(() => {
    const count = (keyOf) => {
      const m = new Map();
      for (const s of scannedCards) for (const k of [].concat(keyOf(s))) m.set(k, (m.get(k) || 0) + s.quantity);
      return [...m].sort((a, b) => b[1] - a[1]);
    };
    const total = scannedCards.reduce((n, s) => n + s.quantity, 0);
    const owned = new Set(scannedCards.map(s => s.cardData.id));
    const sets = catalogSets().map(st => {
      const have = st.base.filter(c => owned.has(c.id)).length;
      return { set: st.set, name: st.setName, have, total: st.base.length, missing: st.base.length - have, variants: st.variants.filter(c => owned.has(c.id)).length };
    });
    return {
      total,
      unique: owned.size,
      domains: count(s => (s.cardData.domains?.length ? s.cardData.domains : [s.cardData.domain || 'colorless'])),
      rarities: count(s => s.cardData.rarity || '?'),
      types: count(s => s.cardData.type || '?'),
      languages: count(s => s.language || 'English'),
      foil: scannedCards.filter(s => s.foil).reduce((n, s) => n + s.quantity, 0),
      sets,
    };
  }, [scannedCards]);

  if (!data.total) {
    return (
      <div className="flex-1 overflow-y-auto pb-20 lg:pb-8"><div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px] lg:space-y-0 lg:columns-2 lg:gap-5 [&>*]:break-inside-avoid lg:[&>*]:mb-5">
        <ScanStats />
        <p className="text-xs text-rift-400 text-center py-8">{tx('Scannez des cartes pour voir les statistiques de la collection.')}</p>
      </div></div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 pt-3 pb-4 space-y-3 lg:px-8 lg:max-w-[1800px] lg:space-y-0 lg:columns-2 lg:gap-5 [&>*]:break-inside-avoid lg:[&>*]:mb-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[data.total, 'exemplaires'], [data.unique, tx('cartes différentes')], [data.foil, 'foils']].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-rift-800/60 border border-rift-600/20 p-2">
              <p className="text-xl font-display font-bold text-gold-400">{v}</p>
              <p className="text-[11px] text-rift-400">{l}</p>
            </div>
          ))}
        </div>

        <ScanStats />

        <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-4 space-y-1.5">
          <h3 className="text-xs font-semibold text-rift-300 uppercase tracking-wider">{tx('Pour finir chaque extension')}</h3>
          {data.sets.map(s => (
            <p key={s.set} className="flex text-xs text-rift-300 gap-2">
              <span className="mr-auto truncate">{s.name} ({s.set})</span>
              <span className="font-mono">{s.have}/{s.total}</span>
              <span className={`w-28 text-right ${s.missing ? 'text-amber-300' : 'text-green-400'}`}>{s.missing ? `${s.missing} manquante${s.missing > 1 ? 's' : ''}` : tx('complète')}</span>
            </p>
          ))}
          <p className="text-[11px] text-rift-500">{tx('Cartes de base uniquement (hors illustrations alternatives, signées et promos). Détail dans « Progression ».')}</p>
        </section>

        <Bars title={tx('Domaines')} total={data.total} rows={data.domains.map(([k, n]) => ({ key: k, label: domainLabel(k), n, color: DOMAIN_COLORS[k]?.hex }))} />
        <Bars title={tx('Rareté')} total={data.total} rows={data.rarities.map(([k, n]) => ({ key: k, label: rarityLabel(k), n }))} />
        <Bars title={tx('Type')} total={data.total} rows={data.types.map(([k, n]) => ({ key: k, label: typeLabel(k), n }))} color="#38bdf8" />
        <Bars title={tx('Langue')} total={data.total} rows={data.languages.map(([k, n]) => ({ key: k, label: LANGUAGES.find(l => l.value === k)?.label || k, n }))} color="#a78bfa" />
      </div>
    </div>
  );
}

