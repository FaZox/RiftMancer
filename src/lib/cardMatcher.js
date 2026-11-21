/**
 * Card Matcher — identifies a detected card.
 * Used by the camera (useCardDetection) and by photos (photoScan.js).
 *
 * Two engines (Réglages → Scanner → « Moteur de reconnaissance ») :
 *   - « IA » (default): DINOv2-small int8 combined with the colour fingerprint
 *     (aiRecognizer.js) — loaded in the background at startup;
 *   - « Empreinte couleurs »: the colour-grid fingerprint alone.
 * If the AI cannot start, the colours are used and `ai.state` = 'error' (the
 * scanner shows it, with « Réessayer »).
 *
 * The fingerprint (fingerprint.js) and the decision (matchIndex.js) are pure
 * modules shared with the test bench `npm run eval:matcher`.
 */

import { catalogUrl, fullImageSrc, thumbSrc } from './nativeAssets.js';
import { chooseCatalog } from './catalogChoice.js';
import { queryViews } from './fingerprint.js';
import { MatchIndex, decodeFeatures, encodeFeatures, DECISION, DECISION_PRUDENT } from './matchIndex.js';
import { aiKey, buildAIIndex, loadAIEngine, readCatalogEmbeddings, topOfScores } from './aiRecognizer.js';
import { encodeEmbedding } from './engines/index.js';
import { scanSizeKey, sameDetector } from './scanRules.js';
import { tx } from './i18n.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const HASHES_URL = `/card-hashes.json?v=${__BUILD_TIME__}`;
// App built without the card content: the catalog header only (no card); the
// cards come on first launch (gallery download, « Importer un dossier », the PC).
const BASE_URL = `/catalog-base.json?v=${__BUILD_TIME__}`;

const ART_BOTTOM_DEFAULT = 0.55;
// Below this centred score the photo looks like no card at all: « non reconnue »
// instead of « incertaine, laquelle ? ».
const MIN_CANDIDATE_SCORE = 0.2;
// Size of the straightened crop the matcher works on (as scripts/lib/simulate.mjs).
const CROP_W = 480;
const CROP_H = 670;

/**
 * Is this scan result trustworthy enough to be added without asking?
 * Results from the matcher carry `accepted` (decision by score + margin, see
 * matchIndex.js); results built by hand (card chosen by the user) have
 * similarity 1.
 */
export function isAccepted(result) {
  if (!result) return false;
  if (typeof result.accepted === 'boolean') return result.accepted;
  return (result.similarity || 0) >= 0.99;
}

/** « Sûr » / « Probable » / « Incertain » for the UI. */
export const LEVEL_LABEL = { sure: tx('Sûr'), probable: tx('Probable'), uncertain: tx('Incertain') };

/**
 * Get the local image URL for a card by its ID.
 * @param {string} cardId - The card ID (e.g., "ogn-001-298")
 * @returns {string} - Local image path (e.g., "/cards/ogn-001-298.webp")
 */
export function getCardImageUrl(cardId) {
  return fullImageSrc(cardId);
}

/**
 * Small preview (300 px wide) for lists — see scripts/make-thumbs.mjs.
 * The full-size image (getCardImageUrl) stays untouched for zoom/detail views.
 */
export function getCardThumbUrl(cardId) {
  return thumbSrc(cardId);
}

/** Matcher DB entry → UI `cardData` (collector number parsed from the code). */
export function toCardData(c) {
  // "OGN-089a/298" → "089a", "OGN-309*/298" → "309*"
  const codePart = (c.code || '').split('/')[0];
  const collectorNumber = codePart.includes('-')
    ? codePart.split('-').slice(1).join('-')
    : String(c.number).padStart(3, '0');
  return {
    id: c.id,
    name: c.name,
    nameEn: c.nameEn || null,
    collectorNumber,
    code: c.code,
    set: c.set,
    setName: c.setName,
    domain: c.domain,
    domains: c.domains,
    rarity: c.rarity,
    type: c.type,
    superTypes: c.superTypes,
    signature: !!c.signature,
    energy: c.energy,
    might: c.might,
    tags: c.tags,
    illustrator: c.illustrator,
    text: c.text,
    errata: c.errata || null,
    // prints of one card (rifthunt, « Impressions et variantes »)
    oracle: c.oracle || null,
    variant: c.variant || null,
    printLabel: c.printLabel || null,
    power: c.power || null, // recycle cost (runes of the card's domain)
  };
}

class CardMatcher {
  constructor() {
    this.cards = [];
    this.gridSize = 16;
    this.ready = false;
    this.index = null;
    /** AI engine: state 'off' | 'loading' | 'ready' | 'error' (see onAIChange). */
    this.ai = { state: 'off', error: null, engine: null, index: null, header: null };
    this._aiSubs = new Set();
    this._extra = [];
    this.lastTiming = null;
  }

  /**
   * Loads the card catalog. On the Android app, the catalog received from the
   * PC (new sets) is used when it is at least as recent as the bundled one and
   * made for the same AI model (catalogChoice.js); otherwise the bundled one,
   * and `catalogInfo.ignored` says why (Réglages → Moteur de reconnaissance).
   * Can be called again to reload after such an update.
   */
  async initialize() {
    const load = async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(tx('Failed to load card DB: {status}', { status: resp.status }));
      return resp.json();
    };
    let data;
    try { data = await load(HASHES_URL); } catch { data = await load(BASE_URL); }
    this.catalogInfo = { source: 'bundled', ignored: null };
    const downloadedUrl = await catalogUrl();
    if (downloadedUrl) {
      try {
        const downloaded = await load(downloadedUrl);
        const choice = chooseCatalog(data, downloaded);
        if (choice.use === 'downloaded') {
          data = downloaded;
          this.catalogInfo = { source: 'downloaded', ignored: null };
        } else {
          this.catalogInfo = { source: 'bundled', ignored: choice.reason };
          console.warn(`[CardMatcher] Catalog from the PC ignored (${choice.reason}): bundled catalog used`);
        }
      } catch (err) {
        this.catalogInfo = { source: 'bundled', ignored: 'illisible' };
        console.warn('[CardMatcher] Catalog from the PC unreadable, bundled catalog used:', err);
      }
    }
    this.gridSize = data.gridSize;
    // Réglages → Contenu: date of the catalog and the PC's content layers (lot 4.1)
    this.contentInfo = { generatedAt: data.generatedAt || null, content: data.content || null, cards: data.cards.length };
    this.cards = data.cards.map(c => {
      const f = decodeFeatures(c.f);
      const artBottom = typeof c.artBottom === 'number' ? c.artBottom : ART_BOTTOM_DEFAULT;
      return { ...c, f, artBottom };
    });
    this.byId = new Map(this.cards.map(c => [c.id, c]));
    this._cardDataCache = null;
    // Centred fingerprints in one contiguous array + reprint groups (matchIndex.js).
    this.index = new MatchIndex(this.cards);
    this.baseMean = this.index.mean;
    this.entries = this.cards; // index → card (catalog first, then learned examples)
    // AI signatures of the catalog (checked here; the engine loads in startAI)
    this._aiHeader = data.embeddings || null;
    // Rulings of Riftbound FAQ (content layer « rulings », src/lib/rulings.js)
    this.rulings = data.rulings || null;
    this._aiVecs = null;
    this._aiCatalogError = null;
    try {
      this._aiVecs = readCatalogEmbeddings(this._aiHeader, this.cards);
    } catch (err) {
      this._aiCatalogError = err.message;
    }
    this._aiBaseMean = null;
    if (this.ai.engine && this.ai.header?.modelSha256 !== this._aiHeader?.modelSha256) {
      // New catalog made by another model: the engine must be loaded again.
      this._setAI({ state: 'off', engine: null, index: null, header: null });
    }
    this._extra = [];
    if (this._learned) this.setLearned(this._learned);
    else this._rebuildAIIndex();
    // Unique crop bottoms across the DB (e.g. [0.55, 0.85, 0.95]).
    this.uniqueArtBottoms = this.index.bottoms;
    this.ready = true;
    console.log(`[CardMatcher] Loaded ${this.cards.length} cards (${this.gridSize}x${this.gridSize} grid, ${this.uniqueArtBottoms.length} crop regions)`);
    // NoCards.jsx: the « no card yet » panel follows the catalog
    if (typeof window !== 'undefined' && typeof Event === 'function') window.dispatchEvent?.(new Event('rb:catalog'));
  }

  /**
   * Examples learned from the user's corrections (synced collection
   * « learned »: { cardId, f }): each one is one more reference picture of
   * that card, compared like the catalog's own. The catalog mean stays the
   * centre, so learning never shifts the scores of the other cards.
   */
  setLearned(records) {
    this._learned = records || [];
    if (!this.cards.length) return;
    this._extra = [];
    const extra = [];
    const extraCards = [];
    for (const r of this._learned) {
      const card = r && !r.deleted && this.byId.get(r.cardId);
      if (!card || typeof r.f !== 'string') continue;
      const f = decodeFeatures(r.f);
      if (f.length !== card.f.length) continue;
      extra.push({ id: card.id, f, artBottom: card.artBottom, artGroup: card.artGroup, learned: true });
      extraCards.push(card);
      this._extra.push({ card, cardIndex: this.cards.indexOf(card), record: r });
    }
    this.index = new MatchIndex([...this.cards, ...extra], { mean: this.baseMean });
    this.entries = [...this.cards, ...extraCards];
    this.learnedCount = extra.length;
    this._rebuildAIIndex();
  }

  // ─── AI engine ──────────────────────────────────────────────────────────
  _rebuildAIIndex() {
    if (!this.ai.engine || !this._aiVecs) return;
    if (!this._aiBaseMean) this._aiBaseMean = buildAIIndex(this.cards, this._aiVecs, [], this.ai.header).mean;
    const index = buildAIIndex(this.cards, this._aiVecs, this._extra, this.ai.header, this._aiBaseMean);
    this._setAI({ index });
  }

  _setAI(patch) {
    this.ai = { ...this.ai, ...patch };
    for (const fn of this._aiSubs) fn(this.aiStatus());
  }

  /** { state, error } of the AI engine, for the UI. */
  aiStatus() {
    return { state: this.ai.state, error: this.ai.error };
  }

  /** Follows the AI state (returns the unsubscribe function). */
  onAIChange(fn) {
    this._aiSubs.add(fn);
    return () => this._aiSubs.delete(fn);
  }

  /**
   * Starts the AI engine (Réglages → « IA »): checks the catalog's signatures,
   * loads the model, checks its SHA-256. Scans made meanwhile wait for it.
   * @param {() => Promise<{ ort: object, loadModel: (file: string) => Promise<Uint8Array>, executionProviders?: string[] }>} io
   */
  startAI(io) {
    if (this.ai.state === 'ready') return Promise.resolve();
    if (this.ai.state === 'loading' && this._aiLoading) return this._aiLoading;
    this._setAI({ state: 'loading', error: null });
    this._aiLoading = (async () => {
      try {
        if (this._aiCatalogError) throw new Error(this._aiCatalogError);
        const header = this._aiHeader;
        const engine = await loadAIEngine(header, await io());
        this._aiBaseMean = null;
        this.ai = { ...this.ai, engine, header };
        this._rebuildAIIndex();
        this._setAI({ state: 'ready' });
        console.log(`[CardMatcher] AI engine ready: ${header.engine} (α ${header.alpha})`);
      } catch (err) {
        console.error('[CardMatcher] AI engine unavailable, colour fingerprint used:', err);
        this._setAI({ state: 'error', error: String(err?.message || err), engine: null, index: null });
      } finally {
        this._aiLoading = null;
      }
    })();
    return this._aiLoading;
  }

  /** Back to the colour fingerprint alone (Réglages → « Empreinte couleurs »). */
  stopAI() {
    this._setAI({ state: 'off', error: null, engine: null, index: null, header: null });
  }

  /** The AI engine to use for a scan (waits while it loads), or null. */
  async _aiForScan() {
    if (this.ai.state === 'loading' && this._aiLoading) await this._aiLoading;
    return this.ai.state === 'ready' && this.ai.index ? this.ai : null;
  }

  /** Look up a card DB entry by id (null if unknown or not loaded yet). */
  getCard(id) {
    return this.byId?.get(id) ?? null;
  }

  /**
   * Display metadata of a card (the `cardData` shape used across the UI and
   * exporters), built once per id and cached. The collection only stores card
   * ids, so this is how stacks get their name, set, text, etc.
   */
  getCardData(id) {
    if (!this._cardDataCache) this._cardDataCache = new Map();
    let data = this._cardDataCache.get(id);
    if (!data) {
      const c = this.getCard(id);
      if (!c) return null;
      data = toCardData(c);
      this._cardDataCache.set(id, data);
    }
    return data;
  }

  /**
   * Thresholds of the fused score (colours + AI) for the last detection's input
   * size, from the catalog header. They were calibrated for one detector: when
   * the header names another one (SHA-256), nothing is accepted automatically —
   * the scanner asks for every card the colours are not sure of.
   */
  fusedDecision(header) {
    // benchSameThresholds (benches only): other detectors measured with the shipped thresholds
    const ok = this.benchSameThresholds || sameDetector(header.detectorSha256);
    const d = ok ? header.decision?.[scanSizeKey()] : null;
    if (d) return { ...DECISION_PRUDENT, ...d };
    if (!this._decisionWarned) {
      this._decisionWarned = true;
      console.warn('[CardMatcher] Catalog thresholds made for another detector: every doubtful card is asked');
    }
    return { ...DECISION_PRUDENT, abs: Infinity };
  }

  /**
   * Identify a card from a de-rotated crop canvas.
   *
   * Every orientation is tested (normal, mirrored, upside down, turned 90° —
   * battlefields are stored rotated, see cards_scraper.py), with the crop of
   * each candidate's layout.
   *
   * @param {HTMLCanvasElement} cropCanvas
   * @returns {null | {
   *   card: object,             best candidate (catalog entry)
   *   similarity: number,       calibrated probability 0–1 (displayed « % »)
   *   score: number,            centred score of the best card
   *   margin: number,           lead over the best other artwork
   *   accepted: boolean,        safe to add without asking
   *   level: 'sure'|'probable'|'uncertain',
   *   recognized: boolean,      false → looks like no card of the catalog
   *   top: { card, similarity, score }[],   best candidates (one per artwork first)
   *   sameArt: object[],        all printings of the best artwork (reprints)
   * }}
   */
  async identify(cropCanvas, opts) {
    if (!this.ready || this.cards.length === 0 || !cropCanvas?.width || !cropCanvas?.height) return null;
    // Larger crops are reduced to the bench's size first (480 × 670, the size
    // the thresholds were calibrated on): same result, 2–3× less work.
    let src = cropCanvas;
    if (cropCanvas.height >= cropCanvas.width && cropCanvas.width * cropCanvas.height > CROP_W * CROP_H * 1.1) {
      src = document.createElement('canvas');
      src.width = CROP_W;
      src.height = CROP_H;
      const sctx = src.getContext('2d', { willReadFrequently: true });
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(cropCanvas, 0, 0, CROP_W, CROP_H);
    }
    const w = src.width;
    const h = src.height;
    const ctx = src.getContext('2d', { willReadFrequently: true });
    const rgba = ctx.getImageData(0, 0, w, h).data;
    return this.identifyPixels(rgba, w, h, opts);
  }

  /**
   * Same as identify(), from raw RGBA pixels.
   * opts.forceAI: run the AI even when the colours are sure (speed test).
   */
  async identifyPixels(rgba, w, h, { forceAI = false } = {}) {
    const t0 = now();
    const views = queryViews(rgba, w, h, this.uniqueArtBottoms, this.gridSize);
    const ai = await this._aiForScan();
    let top;
    let thresholds;
    let aiViews = null;
    let aiMs = 0;
    if (ai) {
      // Cascade: the colours first — when they are sure (Prudent thresholds),
      // no AI at all. Otherwise the AI looks at the crop (artBottom) of the
      // colours' best card, both ways up (2 model images), scored over the
      // whole catalog and fused with the colours (« variant A », model/MODELS.md).
      const { header } = ai;
      const colour = this.index.scoreAll(views);
      const best = topOfScores(colour, this.index, 12);
      const sure = this.index.decide(best, DECISION_PRUDENT).accepted;
      if ((sure && !forceAI) || !best.length) {
        top = best;
        thresholds = DECISION_PRUDENT;
      } else {
        const t1 = now();
        const bottoms = [this.index.bottom[best[0].index]];
        aiViews = await ai.engine.embed(rgba, w, h, { region: header.region, bottoms, views: ['normal', 'rot180'] });
        aiMs = now() - t1;
        const aiScores = ai.index.scoreAll(aiViews);
        const fused = new Float32Array(colour.length);
        for (let i = 0; i < fused.length; i++) fused[i] = header.alpha * aiScores[i] + (1 - header.alpha) * colour[i];
        top = topOfScores(fused, this.index, 12);
        thresholds = this.fusedDecision(header);
      }
    } else {
      top = this.index.rank(views, { k: 12 });
      thresholds = DECISION_PRUDENT;
    }
    this.lastTiming = { totalMs: now() - t0, aiMs, engine: ai ? 'ai' : 'grid16', aiUsed: !!aiViews };
    if (!top.length) return null;
    const d = this.index.decide(top, thresholds);
    // Probability of each candidate (same softmax as the decision).
    const mx = top[0].score;
    const seen = new Set();
    let z = 0;
    for (const c of top) {
      if (seen.has(c.group)) continue;
      seen.add(c.group);
      z += Math.exp((c.score - mx) / DECISION.temperature);
    }
    const prob = (s) => Math.exp((s - mx) / DECISION.temperature) / z;
    // One entry per artwork first (the alternatives the user can pick from),
    // each card once (a learned example repeats its card).
    const ordered = [];
    const groupsSeen = new Set();
    const idsSeen = new Set();
    for (const c of top) if (!groupsSeen.has(c.group)) { groupsSeen.add(c.group); idsSeen.add(c.id); ordered.push(c); }
    for (const c of top) if (!idsSeen.has(c.id)) { idsSeen.add(c.id); ordered.push(c); }
    const entries = this.entries || this.cards;
    const index = this.index;
    return {
      card: entries[top[0].index],
      // Recognised thanks to an example learned from a correction
      fromLearned: top[0].index >= this.cards.length,
      similarity: d.probability,
      score: d.score,
      margin: d.margin,
      accepted: d.accepted,
      level: d.level,
      recognized: d.score >= MIN_CANDIDATE_SCORE,
      engine: ai ? 'ai' : 'grid16',
      top: ordered.map(c => ({ card: entries[c.index], similarity: prob(c.score), score: c.score })),
      sameArt: d.sameArt.map(id => this.byId.get(id)).filter(Boolean),
      /** Fingerprint of this photo for card `cardId` (base64), to learn it. */
      learnSample: (cardId) => {
        const i = this.cards.findIndex(c => c.id === cardId);
        if (i < 0) return null;
        // Guard: a photo that clearly looks like another artwork is not
        // learned (probably a wrong choice — it would spoil the scanner).
        if (!index.learnable(views, i)) {
          console.warn(`[learning] Not learned: this photo looks much more like another card than ${cardId}`);
          return null;
        }
        const f = index.bestView(views, i);
        return f ? encodeFeatures(f) : null;
      },
      /** AI vector of this photo for card `cardId` ({ [engine key]: text }), learned with the colours. */
      learnSampleAI: (cardId) => {
        if (!ai || !aiViews) return null;
        const i = this.cards.findIndex(c => c.id === cardId);
        if (i < 0) return null;
        const v = ai.index.bestView(aiViews, i);
        return v ? { [aiKey(ai.header)]: encodeEmbedding(v) } : null;
      },
    };
  }
}

let matcherInstance = null;

export function getMatcher() {
  if (!matcherInstance) {
    matcherInstance = new CardMatcher();
  }
  return matcherInstance;
}


export default CardMatcher;
