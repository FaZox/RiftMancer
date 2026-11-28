/**
 * Everything the app does, without any screen: collection, scan flow,
 * organisation, notifications, undo, export… Shared by the Android
 * interface (src/App.jsx) and the PC interface (src/desktop/).
 */
import { printingsOf, rememberedPrinting, rememberPrinting } from '../lib/printingChoice.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_BATCH } from '../lib/batchDefaults.js';
import { useCamera } from '../hooks/useCamera.js';
import { useCardDetection } from '../hooks/useCardDetection.js';
import { useAutoScan } from '../hooks/useAutoScan.js';
import { useHandsFree } from '../hooks/useHandsFree.js';
import { playScanSound } from '../lib/scanSounds.js';
import { downloadCSV, validateForExport, getFormat, DEFAULT_FORMAT } from '../lib/exporters/index.js';
import { getMatcher, isAccepted } from '../lib/cardMatcher.js';
import { learnFromChoice } from '../lib/learning.js';
import { isFoilOnly } from '../data/sampleCards.js';
import { isSameStack, getLocalizedName, displayLanguage } from '../lib/cardLocale.js';
import useCollection from '../hooks/useCollection.js';
import useWishlist from '../hooks/useWishlist.js';
import useRecords from '../hooks/useRecords.js';
import { countScan } from '../lib/scanStats.js';
import { installBackButton, setBackFallback } from '../lib/backButton.js';
import { toCardmarket } from '../lib/conditions.js';
import { onUndo } from '../lib/undo.js';
import { requestOpen } from '../lib/navRequest.js';
import { useDialog } from '../components/common/Dialog.jsx';
import { STORAGE_KEYS, loadFromStorage, usePersistedScanState } from './app/appStorage.js';
import { useNotifications, usePriceSummary } from './app/useNotifications.js';
import { useStartup } from './app/useStartup.js';
import { tx } from '../lib/i18n.js';

export default function useAppController() {
  // ─── App State ─────────────────────────────────────────────

  // Scanning
  const [pendingCards, setPendingCards] = useState(() =>
    loadFromStorage(STORAGE_KEYS.PENDING_CARDS, [])
  );
  // Collection: one IndexedDB record per physical copy, shown as stacks
  const collection = useCollection();
  const {
    load: loadCollection, addEntries, updateStack, restoreCopies, removeStack, deleteCopies, clearAll,
  } = collection;
  const scannedCards = collection.stacks;
  const wishlist = useWishlist();
  // Organisation (phase 4): storage boxes, decks, people, loans
  const boxes = useRecords('boxes');
  const decks = useRecords('decks');
  const people = useRecords('people');
  const loans = useRecords('loans');
  const trades = useRecords('trades');
  const matches = useRecords('matches');
  const org = { boxes, decks, people, loans, trades, matches };
  const orgRef = useRef(org);
  orgRef.current = org;

  // UI
  const [activeTab, setActiveTab] = useState('scan');
  // Android back button: open layers close first (useBackHandler), then
  // any tab goes back to Collection, and from Collection the app leaves.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(() => {
    installBackButton();
    setBackFallback(() => {
      if (activeTabRef.current === 'collection') return false;
      setActiveTab('collection');
      return true;
    });
  }, []);
  const { notification, setNotification, showNotification, showNotificationRef, notificationTimeoutRef } = useNotifications();

  // Scan settings

  // Batch defaults
  const [batchDefaults, setBatchDefaults] = useState(() =>
    (({ condition, ...d }) => ({ ...d, condition: toCardmarket(condition) }))(loadFromStorage(STORAGE_KEYS.BATCH_DEFAULTS, { ...DEFAULT_BATCH }))
  );

  // ─── Hooks ─────────────────────────────────────────────────
  const camera = useCamera();
  const detection = useCardDetection();
  // Stable functions of the hooks (memoized there), used by the callbacks below.
  const { isActive: cameraActive, startCamera } = camera;
  const { initDetector } = detection;
  const { isLoading, setIsLoading, startupError, setStartupError, loadProgress, setLoadProgress, loadStage, setLoadStage } = useStartup({ initDetector, loadCollection });

  // Restart camera when switching back to scan tab (video element was destroyed on unmount)
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab === 'scan' && prevTabRef.current !== 'scan' && cameraActive) {
      startCamera();
    }
    prevTabRef.current = activeTab;
  }, [activeTab, cameraActive, startCamera]);

  // ─── Notifications ─────────────────────────────────────────
  const currentPrices = usePriceSummary({ ready: collection.ready, scannedCards, wishItems: wishlist.items, showNotificationRef });

  // ─── Initialization ────────────────────────────────────────
  const hasShownRestoreNotification = useRef(false);

  // Show notification if state was restored from previous session
  useEffect(() => {
    if (!isLoading && !hasShownRestoreNotification.current) {
      // Lot 6 b: only when a « À ajouter » list was waiting (not at every start with a collection)
      const restoredCount = pendingCards.length;
      if (restoredCount > 0) {
        setTimeout(() => {
          showNotification(tx('Liste « À ajouter » retrouvée — {restoredCount} carte{v1} en attente', { restoredCount, v1: restoredCount !== 1 ? 's' : '' }), 'success');
        }, 500);
      }
      hasShownRestoreNotification.current = true;
    }
  }, [isLoading, pendingCards.length, showNotification]);

  // ─── State persistence ───────────────────────────────────
  usePersistedScanState(pendingCards, batchDefaults);

  // ─── Refs for use in callbacks without stale closures ──
  const batchDefaultsRef = useRef(batchDefaults);
  useEffect(() => { batchDefaultsRef.current = batchDefaults; }, [batchDefaults]);

  // ─── Card Detection Handler ────────────────────────────────
  // exact: the card the user chose (no remembered printing instead)
  const handleCardDetected = useCallback((result, { silent = false, exact = false } = {}) => {
    const { confidence, similarity, timestamp } = result;
    // Same artwork in several sets (every scan mode): the set chosen last time for it, on this device
    const cardData = (!exact && rememberedPrinting(printingsOf(result.cardData?.id))) || result.cardData;

    // Only trustworthy matches are added without asking (score + margin, see matchIndex.js).
    if (!isAccepted(result)) return null;

    const defaults = batchDefaultsRef.current;
    const candidate = {
      cardData,
      quantity: 1,
      condition: defaults.condition,
      language: defaults.language,
      foil: isFoilOnly(cardData) || defaults.foil,
      confidence,
      similarity,
      scanTimestamp: timestamp,
    };

    setPendingCards(prev => {
      const existingIndex = prev.findIndex(c => isSameStack(c, candidate));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        if (!silent) showNotification(tx('{getLocalizedName} — qté +1', { getLocalizedName: getLocalizedName(cardData, candidate.language) }), 'success');
        return updated;
      } else {
        if (!silent) showNotification(`+ ${getLocalizedName(cardData, candidate.language)}`, 'success');
        return [...prev, candidate];
      }
    });

    if (!silent && navigator.vibrate) {
      navigator.vibrate(50);
    }
    return candidate;
  }, [showNotification]);

  /** Remove one copy of a scanned candidate from the list (undo / correction). */
  const removeOneScanned = useCallback((candidate) => {
    setPendingCards(prev => {
      const i = prev.findIndex(c => isSameStack(c, candidate));
      if (i < 0) return prev;
      if (prev[i].quantity > 1) {
        const updated = [...prev];
        updated[i] = { ...updated[i], quantity: updated[i].quantity - 1 };
        return updated;
      }
      return prev.filter((_, k) => k !== i);
    });
  }, []);

  // ─── Auto-Scan ────────────────────────────────────────────
  const autoScan = useAutoScan({
    cameraIsActive: camera.isActive,
    isProcessing: detection.isProcessing,
    detectSingleFrame: detection.detectSingleFrame,
    captureFrame: camera.captureFrame,
    onCardDetected: handleCardDetected,
  });

  // ─── Snap Scan (tap to capture single frame) ──────────────
  // Feedback shown on the camera: 'scanning' → 'success' | 'fail' | 'duplicate'.
  //   result     detection result (card, confidence, alternatives)
  //   candidate  what was added to the list (for « Annuler » / correction)
  const [scanFeedback, setScanFeedback] = useState(null);
  const scanLockRef = useRef(false);       // a scan is running or just finished
  const lastAddedRef = useRef(null);       // { cardId, at } — same card twice in a row?
  const DUPLICATE_WINDOW = 3000;           // ms
  const COOLDOWN = 1000;                   // ms after a result before the next tap counts
  const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch { /* not supported */ } };

  // opts.handsFree (lot 8.1): started by the hands-free watcher — an empty
  // table ends silently. Returns the phase of the result.
  // « Trouver une carte » (onglet Cartes, téléphone): the next card scanned opens
  // its sheet in « Cartes » instead of being added.
  const [findMode, setFindModeState] = useState(false);
  const findModeRef = useRef(false);
  const setFindMode = useCallback((on) => { findModeRef.current = on; setFindModeState(on); }, []);

  const handleSnapScan = useCallback(async (opts) => {
    const handsFree = !!opts?.handsFree;
    if (!camera.isActive || scanLockRef.current) return null;
    scanLockRef.current = true;
    countScan('scans');
    setScanFeedback({ phase: 'scanning', at: Date.now() });
    vibrate(15);
    // Let the loading animation appear before the AI work starts.
    await new Promise(r => setTimeout(r, 60));
    let result = null;
    try {
      result = await detection.detectSingleFrame(camera.captureFrame, { explain: handsFree });
    } finally {
      // Short pause after each result: a reflex double tap does not scan again.
      setTimeout(() => { scanLockRef.current = false; }, COOLDOWN);
    }
    if (handsFree && result?.empty) {
      setScanFeedback(null);
      return 'empty';
    }
    if (findModeRef.current && result?.matched && result.cardData) {
      setScanFeedback(null);
      vibrate([40, 50, 40]);
      setFindMode(false);
      requestOpen({ kind: 'cardsFind', cardId: result.cardData.id });
      setActiveTab('cards');
      return 'found';
    }
    if (result && result.matched && isAccepted(result)) {
      // Same artwork in several sets: use the set chosen last time for it (printingChoice.js).
      const pick = rememberedPrinting(result.printings);
      if (pick && pick.id !== result.cardData.id) result = { ...result, cardData: pick };
      autoScan.setLastCardId(result.cardData.id);
      const last = lastAddedRef.current;
      if (last && last.cardId === result.cardData.id && Date.now() - last.at < DUPLICATE_WINDOW) {
        // Probably the same physical card scanned again: ask before adding.
        countScan('duplicate');
        setScanFeedback({ phase: 'duplicate', result, at: Date.now() });
        vibrate([30, 60, 30]);
        playScanSound('duplicate');
        return 'duplicate';
      }
      const candidate = handleCardDetected(result, { silent: true });
      lastAddedRef.current = { cardId: result.cardData.id, at: Date.now() };
      countScan('success');
      setScanFeedback({ phase: 'success', result, candidate, at: Date.now() });
      vibrate([40, 50, 40]);
      playScanSound('success');
      return 'success';
    } else if (result && result.matched) {
      // Doubtful: nothing is added, the user picks among the best candidates.
      countScan('uncertain');
      setScanFeedback({ phase: 'uncertain', result, at: Date.now() });
      vibrate([60, 40, 60]);
      playScanSound('uncertain');
      return 'uncertain';
    }
    countScan('fail');
    setScanFeedback({ phase: 'fail', at: Date.now() });
    vibrate(220);
    return 'fail';
  }, [camera.isActive, camera.captureFrame, detection, handleCardDetected, autoScan, setFindMode]);

  // ─── Hands-free (lot 8.1): a new card put down and still is scanned ──
  const snapRef = useRef(handleSnapScan);
  useEffect(() => { snapRef.current = handleSnapScan; }, [handleSnapScan]);
  const hf = useHandsFree({ videoRef: camera.videoRef, cameraActive: camera.isActive, onFire: () => snapRef.current({ handsFree: true }) });
  // Hands-free and the timed auto scan exclude each other
  const toggleHandsFree = useCallback(() => {
    if (!hf.enabled && autoScan.autoScanEnabled) autoScan.toggleAutoScan();
    hf.toggle();
  }, [hf, autoScan]);
  const toggleAutoScan = useCallback(() => {
    if (!autoScan.autoScanEnabled && hf.enabled) hf.setEnabled(false);
    autoScan.toggleAutoScan();
  }, [hf, autoScan]);
  const handsFree = { ...hf, toggle: toggleHandsFree };

  // Current feedback, read by the handlers below (no side effects inside state updaters).
  const feedbackRef = useRef(null);
  const lastSuccessRef = useRef(null);
  useEffect(() => { feedbackRef.current = scanFeedback; }, [scanFeedback]);

  // « Annuler »: remove what the last scan added.
  const handleUndoScan = useCallback(() => {
    const f = feedbackRef.current;
    if (f?.candidate) removeOneScanned(f.candidate);
    countScan('undone');
    lastAddedRef.current = null;
    lastSuccessRef.current = null;
    setScanFeedback(null);
  }, [removeOneScanned]);

  // « Pas la bonne carte » / doubtful scan / other set: add the chosen card
  // (replacing the one the scan added, if any).
  const handleCorrectScan = useCallback((cardData) => {
    const f = feedbackRef.current;
    if (f?.candidate) removeOneScanned(f.candidate);
    // Remember the set chosen for an artwork printed in several sets.
    const printings = f?.result?.printings || [];
    rememberPrinting(printings, cardData.id);
    // The AI learns from the choice (not for another set of the same artwork: same picture).
    if (f?.result?.match && !printings.some(p => p.id === cardData.id)) {
      learnFromChoice(f.result.match, cardData.id).then(ok => { if (ok) countScan('learned'); });
    }
    const result = { ...(f?.result || {}), cardData, similarity: 1, accepted: true, matched: true, timestamp: Date.now() };
    countScan(f?.phase === 'uncertain' ? 'confirmed' : 'corrected');
    const candidate = handleCardDetected(result, { silent: true, exact: true });
    lastAddedRef.current = { cardId: cardData.id, at: Date.now() };
    setScanFeedback({ phase: 'success', result, candidate, corrected: true, at: Date.now() });
  }, [removeOneScanned, handleCardDetected]);

  // Same card again: the user confirms it is another copy.
  const handleConfirmDuplicate = useCallback(() => {
    const f = feedbackRef.current;
    if (!f?.result) { setScanFeedback(null); return; }
    const candidate = handleCardDetected(f.result, { silent: true });
    lastAddedRef.current = { cardId: f.result.cardData.id, at: Date.now() };
    setScanFeedback({ phase: 'success', result: f.result, candidate, at: Date.now() });
  }, [handleCardDetected]);

  // The result card stays on screen: after « non reconnue » / « même carte ? » it goes back to the last added card.
  useEffect(() => { if (scanFeedback?.phase === 'success') lastSuccessRef.current = scanFeedback; }, [scanFeedback]);
  // « Chercher » on the scanner: add a card the AI cannot read (damaged, promo…).
  const handleManualAdd = useCallback((cardData) => {
    const result = { cardData, similarity: 1, confidence: 1, matched: true, timestamp: Date.now() };
    countScan('manual');
    const candidate = handleCardDetected(result, { silent: true, exact: true });
    lastAddedRef.current = { cardId: cardData.id, at: Date.now() };
    setScanFeedback({ phase: 'success', result, candidate, corrected: true, at: Date.now() });
  }, [handleCardDetected]);

  // PC photos: the recognised cards go to the « À ajouter » list first
  // (same as the webcam), not straight into the collection.
  const handleAddToPending = useCallback((cardDataArray) => {
    const at = Date.now();
    cardDataArray.forEach((cardData, i) => {
      handleCardDetected({ cardData, similarity: 1, confidence: 1, matched: true, timestamp: at + i }, { silent: true });
    });
    const n = cardDataArray.length;
    if (n) showNotification(tx('{n} carte{v1} dans la liste « À ajouter »', { n, v1: n > 1 ? 's' : '' }), 'success');
  }, [handleCardDetected, showNotification]);

  // Opening the manual search: the previous card's result disappears.
  const handleClearScan = useCallback(() => {
    lastSuccessRef.current = null;
    setScanFeedback(null);
  }, []);

  const handleDismissScan = useCallback(() => {
    setScanFeedback(f => (f?.phase === 'success' ? f : lastSuccessRef.current));
  }, []);

  // « À ajouter » list: quantity / condition / foil edited in place.
  const handleUpdatePending = useCallback((index, patch) => {
    setPendingCards(prev => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }, []);

  // ─── Pending → Export list handlers ──────────────────────────
  // Pending card → collection entry (only the card id + copy attributes are stored)
  // Destination chosen before scanning ("box:<id>" / "deck:<id>"), if it still exists.
  const targetPlace = useCallback(() => {
    const t = batchDefaultsRef.current.target || '';
    // orgRef: callbacks are memoized, the boxes/decks lists must be current.
    if (t.startsWith('box:') && orgRef.current.boxes.byId.has(t.slice(4))) return { boxId: t.slice(4) };
    if (t.startsWith('deck:') && orgRef.current.decks.byId.has(t.slice(5))) return { deckId: t.slice(5) };
    return {};
  }, []);

  const toEntry = useCallback((card) => ({
    cardId: card.cardData.id,
    quantity: card.quantity || 1,
    language: card.language,
    foil: card.foil,
    promo: card.promo,
    condition: card.condition,
    source: 'scan',
    ...targetPlace(),
  }), [targetPlace]);

  const pendingRef = useRef(pendingCards);
  useEffect(() => { pendingRef.current = pendingCards; }, [pendingCards]);

  const handleConfirmPending = useCallback((indexOrPayload) => {
    const isPayload = typeof indexOrPayload === 'object' && indexOrPayload.index !== undefined;
    const index = isPayload ? indexOrPayload.index : indexOrPayload;
    const payloadData = isPayload ? indexOrPayload : null;

    const card = pendingRef.current[index];
    if (!card) return;

    // Use payload data if provided (manually selected card), otherwise use original
    const cardToAdd = payloadData ? {
      ...card,
      cardData: payloadData.cardData,
      quantity: payloadData.quantity,
      foil: payloadData.foil,
      promo: payloadData.promo,
      language: payloadData.language || card.language,
    } : card;

    addEntries([toEntry(cardToAdd)]);
    setPendingCards(prev => prev.filter((_, i) => i !== index));
    showNotification(tx('{getLocalizedName} ajoutée à la collection', { getLocalizedName: getLocalizedName(cardToAdd.cardData, cardToAdd.language) }), 'success');
  }, [showNotification, addEntries, toEntry]);

  const handleConfirmAllPending = useCallback(() => {
    const prev = pendingRef.current;
    if (prev.length === 0) return;
    addEntries(prev.map(toEntry));
    setPendingCards([]);
    showNotification(tx('{length} carte{v1} ajoutée{v2} à la collection', { length: prev.length, v1: prev.length !== 1 ? 's' : '', v2: prev.length !== 1 ? 's' : '' }), 'success');
  }, [showNotification, addEntries, toEntry]);

  const handleRemovePending = useCallback((index) => {
    setPendingCards(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearPending = useCallback(() => {
    setPendingCards([]);
  }, []);

  // ─── Card Management ───────────────────────────────────────
  // Rows pass the stack itself; handlers stay stable so memoized rows don't re-render.
  const handleUpdateCard = useCallback((stack, updatedCard) => {
    updateStack(stack, updatedCard);
  }, [updateStack]);

  // Deletions can be undone for a few seconds (« Annuler »).
  const [undo, setUndo] = useState(null); // { message, run, at }
  useEffect(() => onUndo(setUndo), []); // deletions elsewhere (a match, a person…) offer « Annuler » too
  const { ask } = useDialog();
  const offerUndo = useCallback((removed) => {
    if (!removed?.length) return;
    setUndo({
      message: tx('{length} carte{v1} supprimée{v2}', { length: removed.length, v1: removed.length > 1 ? 's' : '', v2: removed.length > 1 ? 's' : '' }),
      run: () => restoreCopies(removed),
      at: Date.now(),
    });
  }, [restoreCopies]);

  const handleRemoveCard = useCallback((stack) => {
    offerUndo(removeStack(stack));
  }, [removeStack, offerUndo]);

  // Card sheet (CardZoom): one copy of a stack less, « Annuler » for a few seconds
  const handleRemoveCopy = useCallback((stack) => {
    if (!stack?.copyIds?.length) return;
    offerUndo(deleteCopies(stack.copyIds.slice(-1)));
  }, [deleteCopies, offerUndo]);

  const handleDeleteStacks = useCallback((stacks) => {
    offerUndo(deleteCopies(stacks.flatMap(s => s.copyIds)));
  }, [deleteCopies, offerUndo]);

  const handleClearAll = useCallback(() => {
    if (scannedCards.length === 0) return;
    ask({ title: tx('Supprimer toutes les cartes ?'), message: tx('Toute la collection est vidée. Vous pourrez annuler juste après.'), confirmLabel: tx('Tout supprimer'), destructive: true })
      .then(ok => { if (ok) offerUndo(clearAll()); });
  }, [scannedCards.length, clearAll, offerUndo, ask]);

  // Add a single card to export list (from individual add button)
  const handleAddCardToExport = useCallback((payload) => {
    const cardData = payload.cardData || payload;
    const defaults = batchDefaultsRef.current;
    addEntries([{
      cardId: cardData.id,
      quantity: payload.quantity || 1,
      condition: defaults.condition,
      language: payload.language || defaults.language,
      foil: payload.foil !== undefined ? payload.foil : (isFoilOnly(cardData) || defaults.foil),
      promo: payload.promo || false,
      ...targetPlace(),
    }]);
    showNotification(`+ ${getLocalizedName(cardData, payload.language || defaults.language)}`, 'success');
  }, [showNotification, addEntries, targetPlace]);

  // Quick add of one copy from the card zoom view
  const handleAddCopy = useCallback((cardId, language, { promo = false } = {}) => {
    const cardData = getMatcher().getCardData(cardId);
    if (!cardData) return;
    const defaults = batchDefaultsRef.current;
    addEntries([{
      cardId, quantity: 1, language, condition: defaults.condition,
      foil: isFoilOnly(cardData) || defaults.foil, promo: !!promo, source: 'manual',
    }]);
    showNotification(`+ ${getLocalizedName(cardData, language)}${promo ? ` (${tx('Promo')})` : ''}`, 'success');
  }, [showNotification, addEntries]);

  // « ＋ Ma collection » panel of the PC card sheet: N copies with language, finish, condition and place,
  // one message and « Annuler » for a few seconds. → the copies added
  const handleAddCopies = useCallback(({ cardId, quantity = 1, language, foil, condition, boxId = null, deckId = null, source = 'manual' }) => {
    const cardData = getMatcher().getCardData(cardId);
    if (!cardData) return [];
    const defaults = batchDefaultsRef.current;
    const lang = language || defaults.language;
    const qty = Math.max(1, Math.min(99, quantity | 0));
    const added = addEntries([{
      cardId, quantity: qty, language: lang, condition: condition || defaults.condition,
      foil: isFoilOnly(cardData) || !!foil, promo: false, boxId, deckId, source,
    }]) || [];
    if (!added.length) return [];
    setUndo({
      message: tx('+ {name} ×{n} ajoutée(s)', { name: getLocalizedName(cardData, displayLanguage(lang)), n: added.length }),
      run: () => deleteCopies(added.map(c => c.id)),
      at: Date.now(),
    });
    return added;
  }, [addEntries, deleteCopies]);

  // « Cartes » tab: one copy in the default language, « Annuler » for a few seconds.
  // quiet: several at once (the tab shows one message for all of them).
  const handleQuickAdd = useCallback((cardData, { quiet = false } = {}) => {
    const defaults = batchDefaultsRef.current;
    const added = addEntries([{
      cardId: cardData.id, quantity: 1, language: defaults.language, condition: defaults.condition,
      foil: isFoilOnly(cardData) || defaults.foil, promo: false,
    }]) || [];
    if (quiet || !added.length) return;
    setUndo({
      message: tx('+ {name} ajoutée', { name: getLocalizedName(cardData, displayLanguage(defaults.language)) }),
      run: () => deleteCopies(added.map(c => c.id)),
      at: Date.now(),
    });
  }, [addEntries, deleteCopies]);

  // Add multiple cards to export list at once
  // extras[i] (optional): more fields for that card, e.g. its binder page and pocket (scanner « Grille »)
  const handleAddCardsToExport = useCallback((cardDataArray, extras = null) => {
    const defaults = batchDefaultsRef.current;
    addEntries(cardDataArray.map((cardData, i) => ({
      cardId: cardData.id,
      quantity: 1,
      condition: defaults.condition,
      language: defaults.language,
      foil: isFoilOnly(cardData) || defaults.foil,
      promo: false,
      ...targetPlace(),
      ...(extras?.[i] || {}),
    })));
    showNotification(tx('{length} carte{v1} ajoutée{v2} à la collection', { length: cardDataArray.length, v1: cardDataArray.length !== 1 ? 's' : '', v2: cardDataArray.length !== 1 ? 's' : '' }), 'success');
  }, [showNotification, addEntries, targetPlace]);

  // ─── CSV Export ────────────────────────────────────────────
  const handleExport = useCallback((format = DEFAULT_FORMAT) => {
    // Export one line per card/language/finish/condition: copies stored in
    // different places (boxes, decks…) are merged.
    const merged = new Map();
    for (const s of scannedCards) {
      const k = `${s.cardData.id}|${s.language}|${s.foil ? 1 : 0}|${s.promo ? 1 : 0}|${s.condition}`;
      const cur = merged.get(k);
      if (cur) cur.quantity += s.quantity;
      else merged.set(k, { ...s, quantity: s.quantity });
    }
    const rows = [...merged.values()];
    const { valid, errors } = validateForExport(rows);
    if (!valid) {
      showNotification(tx('Erreur : {v0}', { v0: errors[0] }), 'error');
      return;
    }

    const success = downloadCSV(rows, format);
    if (success) {
      showNotification(tx('{label} exporté — {length} ligne{v2}', { label: getFormat(format).label, length: rows.length, v2: rows.length !== 1 ? 's' : '' }), 'success');
    }
  }, [scannedCards, showNotification]);

  return {
    isLoading,
    startupError,
    continueWithoutScanner: () => setStartupError(null),
    setIsLoading,
    loadProgress,
    setLoadProgress,
    loadStage,
    setLoadStage,
    pendingCards,
    setPendingCards,
    collection,
    scannedCards,
    wishlist,
    boxes,
    decks,
    people,
    loans,
    trades,
    matches,
    org,
    orgRef,
    activeTab,
    setActiveTab,
    findMode,
    setFindMode,
    activeTabRef,
    notification,
    setNotification,
    batchDefaults,
    setBatchDefaults,
    camera,
    detection,
    prevTabRef,
    notificationTimeoutRef,
    currentPrices,
    showNotificationRef,
    showNotification,
    hasShownRestoreNotification,
    batchDefaultsRef,
    handleCardDetected,
    removeOneScanned,
    autoScan: { ...autoScan, toggleAutoScan },
    handsFree,
    scanFeedback,
    setScanFeedback,
    scanLockRef,
    lastAddedRef,
    DUPLICATE_WINDOW,
    COOLDOWN,
    vibrate,
    handleSnapScan,
    feedbackRef,
    lastSuccessRef,
    handleUndoScan,
    handleCorrectScan,
    handleConfirmDuplicate,
    handleManualAdd,
    handleAddToPending,
    handleClearScan,
    handleDismissScan,
    handleUpdatePending,
    targetPlace,
    toEntry,
    pendingRef,
    handleConfirmPending,
    handleConfirmAllPending,
    handleRemovePending,
    handleClearPending,
    handleUpdateCard,
    undo,
    setUndo,
    offerUndo,
    handleRemoveCard,
    handleDeleteStacks,
    handleClearAll,
    handleAddCardToExport,
    handleAddCopy,
    handleAddCopies,
    handleQuickAdd,
    handleRemoveCopy,
    handleAddCardsToExport,
    handleExport,
  };
}
