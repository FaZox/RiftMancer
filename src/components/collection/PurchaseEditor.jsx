import React, { useState } from 'react';

import { tx } from '../../lib/i18n.js';

/** « Mon achat » (onglet Prix de la fiche carte): the price paid for one copy and the purchase date, for every copy of the card. */
export function PurchaseEditor({ owned, paid, paidAt, onSave }) {
  const fmt = (v) => (v ? String(Math.round(v * 100) / 100).replace('.', ',') : '');
  const [price, setPrice] = useState(fmt(paid));
  const [date, setDate] = useState(paidAt || '');
  const n = owned.reduce((k, s) => k + s.quantity, 0);
  const save = () => {
    const v = parseFloat(price.replace(',', '.'));
    onSave(Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
  };
  return (
    <div className="panel p-3 space-y-2">
      <p className="text-sm font-semibold text-rift-100">{tx('Mon achat')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-rift-400">
          {tx('Prix payé (un exemplaire)')}
          <span className="inline-flex items-center gap-1 h-11 px-2 bg-rift-900 border border-rift-600 focus-within:border-gold-500/60">
            <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="—"
              className="w-20 bg-transparent text-right text-[15px] text-rift-100 focus:outline-none" />
            <span className="text-rift-500">€</span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-rift-400">
          {tx('Date d’achat')}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-11 px-2 bg-rift-900 border border-rift-600 text-[15px] text-rift-100 focus:outline-none focus:border-gold-500/60 [color-scheme:dark]" />
        </label>
        <button type="button" onClick={save} className="btn-primary min-h-[44px] text-sm">{tx('Enregistrer')}</button>
      </div>
      <p className="text-[12px] text-rift-500">{n > 1 ? tx('Pour vos {n} exemplaires de cette carte.', { n }) : tx('Pour votre exemplaire de cette carte.')}</p>
    </div>
  );
}

export default PurchaseEditor;
