/**
 * AI recognition (AMELIORATIONS-MODELES.md, step 4): DINOv2-small int8 combined
 * with the colour fingerprint.
 *
 * The catalog (card-hashes.json) carries, for every card, the AI signature of
 * its illustration (`e`, scripts/build-embeddings.mjs) and an `embeddings`
 * header: which model made them (SHA-256), the weight of each engine and the
 * thresholds calibrated on the bench. The app:
 *   1. loads the model file and checks its SHA-256 against the header — a
 *      different model would give meaningless scores: refused;
 *   2. scores every card with both engines, score = α·AI + (1 − α)·colours;
 *   3. decides with the header's thresholds (not those of the colours alone).
 * If anything fails, the scanner uses the colours alone AND says so
 * (no silent fallback: CardMatcher.ai.state = 'error', banner in the scanner).
 *
 * Pure module (no DOM): also used by the Node tests.
 */
import { createOnnxEngine, ENGINE_CONFIGS, decodeEmbedding } from './engines/index.js';
import { MatchIndex } from './matchIndex.js';
import { Sha256 } from './sha256.js';import { tx } from './i18n.js';


/** SHA-256 (hex) of bytes: Web Crypto when available, else the incremental one. */
export async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const d = new Uint8Array(await subtle.digest('SHA-256', bytes));
    return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const h = new Sha256();
  h.update(bytes);
  return h.hex();
}

/** Key of the engine + model that made a vector (learned examples are kept per engine). */
export function aiKey(header) {
  return `${header.engine}:${String(header.modelSha256).slice(0, 12)}`;
}

/**
 * Checks the catalog's AI part. Returns the decoded vector of every card
 * (same order) or throws a French message.
 */
export function readCatalogEmbeddings(header, cards) {
  if (!header) throw new Error(tx('Ce catalogue n’a pas de signatures IA (npm run catalog:update).'));
  if (!ENGINE_CONFIGS[header.engine]) throw new Error(tx('Moteur IA inconnu : {engine}', { engine: header.engine }));
  if (!/^[0-9a-f]{64}$/.test(header.modelSha256 || '')) throw new Error(tx('Signatures IA sans empreinte de modèle : refusées.'));
  const out = [];
  for (const c of cards) {
    if (typeof c.e !== 'string') throw new Error(tx('Signatures IA incomplètes (carte {id}) : relancez npm run catalog:update.', { id: c.id }));
    const v = decodeEmbedding(c.e);
    if (v.length !== header.dim) throw new Error(tx('Signatures IA de taille inattendue : refusées.'));
    out.push(v);
  }
  return out;
}

/**
 * Loads the model named by the header and checks it.
 * @param {object} header   catalog.embeddings
 * @param {{ ort: object, loadModel: (file: string) => Promise<Uint8Array>, executionProviders?: string[] }} io
 */
export async function loadAIEngine(header, { ort, loadModel, executionProviders = ['wasm'] }) {
  const bytes = await loadModel(header.model);
  if (await sha256Hex(bytes) !== header.modelSha256) {
    throw new Error(tx('Le modèle IA ne correspond pas aux signatures du catalogue : refusé.'));
  }
  const engine = createOnnxEngine(header.engine, ENGINE_CONFIGS[header.engine]);
  await engine.init({ ort, model: bytes, executionProviders });
  if (engine.dim !== header.dim) throw new Error(tx('Modèle IA de taille inattendue : refusé.'));
  return engine;
}

/**
 * Index of the AI vectors, aligned with the colour index: catalog cards first,
 * then the learned examples (their own AI vector when it was made by this
 * engine, otherwise the card's catalog vector — neutral, never wrong).
 */
export function buildAIIndex(cards, catalogVecs, extra, header, mean) {
  const key = aiKey(header);
  const entries = cards.map((c, i) => ({ id: c.id, f: catalogVecs[i], artBottom: c.artBottom, artGroup: c.artGroup }));
  for (const x of extra) {
    const own = x.record?.e?.[key];
    let f = null;
    if (typeof own === 'string') {
      const v = decodeEmbedding(own);
      if (v.length === header.dim) f = v;
    }
    entries.push({ id: x.card.id, f: f || catalogVecs[x.cardIndex], artBottom: x.card.artBottom, artGroup: x.card.artGroup, learned: true });
  }
  return new MatchIndex(entries, mean ? { generic: true, mean } : { generic: true });
}

/** score = α·AI + (1 − α)·colours, for every entry. */
export function fuseScores(colour, ai, alpha) {
  const out = new Float32Array(colour.length);
  for (let i = 0; i < out.length; i++) out[i] = alpha * ai[i] + (1 - alpha) * colour[i];
  return out;
}

/** Best entries of a score array, best first ({ index, id, group, score }, like MatchIndex.rank). */
export function topOfScores(scores, index, k) {
  const top = [];
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (top.length < k || s > top[top.length - 1].score) {
      let p = top.length < k ? top.length : k - 1;
      if (top.length < k) top.push(null);
      while (p > 0 && top[p - 1].score < s) { top[p] = top[p - 1]; p--; }
      top[p] = { index: i, id: index.ids[i], group: index.group[i], score: s };
    }
  }
  return top;
}
