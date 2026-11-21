import { tx } from './i18n.js';
/**
 * Card conditions: Cardmarket's scale (lot 1.3), the one used by the prices
 * and the Cardmarket links. Labels in the app's language (i18n.js) with Cardmarket's abbreviation.
 *
 * Copies made before this scale used the American one (NM / LP / MP / HP / D).
 * They are moved once to the Cardmarket scale with the table chosen by the
 * user (LEGACY_TO_CM), the old value kept in `conditionOld`; the move goes
 * through the sync like any edit (new updatedAt).
 */

/** value = Cardmarket's English name (stored in the copies); cm = Cardmarket's condition id (links). */
export const CONDITIONS = [
  { value: 'Mint', label: tx('Neuve (MT)'), short: 'MT', cm: '1' },
  { value: 'Near Mint', label: tx('Quasi neuve (NM)'), short: 'NM', cm: '2' },
  { value: 'Excellent', label: tx('Excellente (EX)'), short: 'EX', cm: '3' },
  { value: 'Good', label: tx('Bonne (GD)'), short: 'GD', cm: '4' },
  { value: 'Light Played', label: tx('Légèrement jouée (LP)'), short: 'LP', cm: '5' },
  { value: 'Played', label: tx('Jouée (PL)'), short: 'PL', cm: '6' },
  { value: 'Poor', label: tx('Abîmée (PO)'), short: 'PO', cm: '7' },
];

/** Former American scale → Cardmarket (validated by the user before the migration). */
export const LEGACY_TO_CM = {
  'Lightly Played': 'Excellent',
  'Moderately Played': 'Good',
  'Heavily Played': 'Played',
  Damaged: 'Poor',
};

/**
 * Cardmarket → American scale, for the exports that keep it (CardNexus).
 * Inverse of LEGACY_TO_CM, so a migrated copy exports exactly its old
 * condition; Mint and Light Played (unused before) go to the nearest one.
 */
export const CM_TO_US = {
  Mint: 'Near Mint',
  'Near Mint': 'Near Mint',
  Excellent: 'Lightly Played',
  Good: 'Moderately Played',
  'Light Played': 'Moderately Played',
  Played: 'Heavily Played',
  Poor: 'Damaged',
};

const CM_VALUES = new Set(CONDITIONS.map(c => c.value));

/** A condition of either scale → the Cardmarket one ('Near Mint' when unknown or empty). */
export function toCardmarket(v) {
  if (CM_VALUES.has(v)) return v;
  return LEGACY_TO_CM[v] || 'Near Mint';
}

/**
 * The copy moved to the Cardmarket scale, or null when it already is. The old
 * value is kept in `conditionOld`; `updatedAt` changes so the sync carries it.
 */
export function migrateCopy(copy, now = Date.now()) {
  if (CM_VALUES.has(copy.condition)) return null;
  return { ...copy, condition: toCardmarket(copy.condition), conditionOld: copy.condition ?? null, updatedAt: now };
}

/** The copies to rewrite (only those that change). */
export function migrateCopies(copies, now = Date.now()) {
  const out = [];
  for (const c of copies) {
    const m = c.deleted ? null : migrateCopy(c, now);
    if (m) out.push(m);
  }
  return out;
}

/** Condition for the exports that use the American scale. */
export function usCondition(v) {
  return CM_TO_US[toCardmarket(v)];
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
// Names and abbreviations read in imported files. The American full names
// map through LEGACY_TO_CM; the abbreviation « LP » is Cardmarket's (Light Played).
const ALIASES = new Map([
  ...CONDITIONS.flatMap(c => [[norm(c.value), c.value], [norm(c.label), c.value], [norm(c.short), c.value]]),
  ...Object.entries(LEGACY_TO_CM).map(([us, cm]) => [norm(us), cm]),
  ['mp', 'Good'], ['hp', 'Played'], ['d', 'Poor'], ['dmg', 'Poor'],
  ['m', 'Mint'], ['nearmint', 'Near Mint'], ['ex', 'Excellent'], ['gd', 'Good'], ['po', 'Poor'], ['pl', 'Played'],
  ['lightplayed', 'Light Played'], ['slightlyplayed', 'Excellent'],
]);

/** Condition read from an imported file (either scale), or null when not recognised. */
export function parseCondition(v) {
  const s = norm(v);
  return s ? ALIASES.get(s) || null : null;
}

/** Short label of a stored condition (old values shown with their Cardmarket equivalent). */
export function conditionShort(v) {
  return CONDITIONS.find(c => c.value === toCardmarket(v))?.short || v;
}
