import React, { useState } from 'react';
import { Euro, RefreshCw } from 'lucide-react';
import { SectionCard } from '../common/SectionCard.jsx';
import { usePrices, refreshPrices } from '../../lib/prices.js';
import { tx, locale } from '../../lib/i18n.js';

/**
 * Settings → Content → « Prix Cardmarket »: date and coverage of the prices,
 * and « Actualiser » to download them now (they update by themselves at most
 * once a day). PC: its main process; phone: Cardmarket directly.
 */
export default function PricesCard() {
  const { prices } = usePrices();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const refresh = async () => {
    setBusy(true); setMsg(null);
    try {
      const ok = await refreshPrices(true);
      setMsg(ok ? { ok: true, text: tx('Prix actualisés.') } : { ok: false, text: tx('Les prix n’ont pas pu être téléchargés. Vérifiez votre connexion.') });
    } finally {
      setBusy(false);
    }
  };
  const day = prices && !prices.demo ? new Date(prices.priceDate || prices.updatedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <SectionCard icon={Euro} title={tx('Prix Cardmarket')} status={day ? tx('au {day}', { day }) : null}>
      <p className="text-[14px] text-rift-200">
        {day ? tx('{matched} cartes sur {total} avec un prix', { matched: (prices.matched ?? 0).toLocaleString(locale()), total: (prices.total ?? 0).toLocaleString(locale()) }) : tx('Pas encore de prix.')}
      </p>
      <p className="text-[13px] text-rift-400 mt-0.5">{tx('Source : fichiers publics de Cardmarket, une fois par jour au plus.')}</p>
      {msg && <p className={`text-[13px] mt-2 ${msg.ok ? 'text-state-ok' : 'text-state-bad'}`}>{msg.text}</p>}
      <div className="flex flex-wrap justify-end gap-2 mt-3">
        <button onClick={refresh} disabled={busy} className="btn-secondary text-[13px] py-2 px-3">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? tx('Actualisation…') : tx('Actualiser')}
        </button>
      </div>
    </SectionCard>
  );
}
