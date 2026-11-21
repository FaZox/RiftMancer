/**
 * Start-up of the app (part of useAppController, split in lot 11.5): the
 * detector, the card catalogue, the collection, then the background services
 * (sync, weekly checks, automatic backups, prices). Each step is named for the
 * loading screen; a failed step is shown by StartupError (lot 5.2).
 */
import { useState, useEffect } from 'react';
import { logError } from '../../lib/errorLog.js';
import { getDetector, DetectorState } from '../../lib/yoloDetector.js';
import { runWeeklyChecks } from '../../lib/contentNotices.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { loadBanlist } from '../../lib/banlist.js';
import { reloadAllViews } from '../../lib/collectionDB.js';
import { initLearning } from '../../lib/learning.js';
import { startRecognition } from '../../lib/recognition.js';
import { initSync } from '../../lib/syncClient.js';
import { initPrices } from '../../lib/prices.js';
import { initAutoBackup } from '../../lib/localBackup.js';
import { initNativeAssets, removeDownloadedModels } from '../../lib/nativeAssets.js';
import { tx } from '../../lib/i18n.js';
import { initSymbols } from '../../lib/symbols.js';

export function useStartup({ initDetector, loadCollection }) {
  const [isLoading, setIsLoading] = useState(true);
  // Lot 5.2: the start-up step that failed ({ stage: 'detector' | 'catalog' | 'db', error }), shown instead of the app
  const [startupError, setStartupError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState('db');

  useEffect(() => {
    async function init() {
      let stage = 'detector';
      let detectorFailed = null;
      try {
        // Stage 1: Initialize YOLO detector (warmup)
        setLoadStage('model');
        setLoadProgress(0.2);
        await initDetector();
        if (getDetector().state === DetectorState.ERROR) detectorFailed = new Error(getDetector().error || tx('Détecteur indisponible'));
        setLoadProgress(0.5);
        stage = 'catalog';

        // Stage 2: Initialize card matcher (loads card-hashes.json)
        setLoadStage('matcher');
        await initNativeAssets();
        await initSymbols(); // Riftbound's symbols (rarity gems, Might) when the app has them
        // Preferences v4: models downloaded from the PC by older versions
        removeDownloadedModels().then(gone => { if (gone) console.log('[App] Old downloaded detection models removed'); });
        const matcher = getMatcher();
        await matcher.initialize();
        loadBanlist();
        // PC: content updated (Réglages → Contenu, lot 4) → new catalog and banned list at once
        window.riftboundDesktop?.content?.onChanged(async () => {
          await matcher.initialize();
          await loadBanlist();
          startRecognition();
          reloadAllViews();
        });
        initLearning(); // examples learned from the user's corrections
        startRecognition(); // AI engine, loaded in the background (scans wait for it)
        setLoadProgress(0.85);

        // Stage 3: Load the collection (needs the card catalog for names)
        stage = 'db';
        setLoadStage('collection');
        await loadCollection();
        setLoadProgress(0.95);

        // Phone ↔ PC sync state (manual sync; no-op on the PC app, which is the hub)
        initSync();
        if (window.riftboundDesktop) runWeeklyChecks(); // lot 4.3: at most once a week, nothing installed without a click
        initAutoBackup(); // phone: daily backup when something changed (lot 3.1)
        initPrices();

        // Done
        setLoadStage('ready');
        setLoadProgress(1);
        // B.6.13 rule 5: start-up time, to compare before / after on a phone (diagnostic report)
        try { localStorage.setItem('rb.startupMs', JSON.stringify({ ms: Math.round(performance.now()), at: Date.now() })); } catch { /* ignore */ }
        if (detectorFailed) {
          logError(detectorFailed, tx('démarrage : détecteur'));
          setStartupError({ stage: 'detector', error: detectorFailed });
        }
        setIsLoading(false); // no wait added: the loading screen handles its own durations (ForgeSplash)
      } catch (error) {
        console.error('[App] Initialization error:', error);
        logError(error, tx('démarrage : {stage}', { stage }));
        setStartupError({ stage, error });
        setIsLoading(false);
      }
    }
    init();
  }, [initDetector, loadCollection]);

  return { isLoading, setIsLoading, startupError, setStartupError, loadProgress, setLoadProgress, loadStage, setLoadStage };
}
