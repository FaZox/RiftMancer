import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { hasDemoData, loadDemoData, removeDemoData } from '../../lib/demoData.js';
import { tx } from '../../lib/i18n.js';

/** Settings: load / remove demo data to try every screen without scanning. */
export default function DemoSection() {
  const [present, setPresent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { hasDemoData().then(setPresent).catch(() => {}); }, []);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      const n = await fn();
      setMsg(done(n));
      setPresent(await hasDemoData());
    } catch (err) {
      setMsg(tx('Erreur : {message}', { message: err.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4 space-y-3">
      <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-gold-400" />
        {tx('Données de démonstration')}
      </h2>
      <p className="text-xs text-rift-400">
        {tx('Ajoute une petite collection d’essai (24 cartes Jinx), une boîte, un deck, un prêt, une carte souhaitée avec alerte de prix et un échange — pour tester tous les écrans. Sur le téléphone, des prix de démonstration sont ajoutés s’il n’y a pas encore de vrais prix. Vos vraies cartes ne sont pas touchées.')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || present} onClick={() => run(loadDemoData, n => tx('{n} exemplaires de démonstration ajoutés.', { n }))} className="btn-primary text-sm">
          {tx('Charger la démo')}
        </button>
        <button disabled={busy || !present} onClick={() => run(removeDemoData, n => tx('{n} éléments de démonstration retirés.', { n }))} className="btn-secondary text-sm">
          {tx('Retirer la démo')}
        </button>
      </div>
      {present && <p className="text-[11px] text-[#f0c27a]">{tx('La démo est chargée. Si vous synchronisez, elle sera aussi envoyée sur l’autre appareil (et retirée des deux si vous la retirez).')}</p>}
      {msg && <p className="text-xs text-[#7fd6a4]">{msg}</p>}
    </section>
  );
}
