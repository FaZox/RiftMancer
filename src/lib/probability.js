/**
 * Draw probabilities (hypergeometric law — exact, no random simulation).
 *
 * « Probability to have at least X copies of [card or group of cards] by
 * turn N, going first / second. » The number of cards seen by turn N comes
 * from GAME (opening hand + one draw per turn) and can be adjusted if the
 * rules change.
 *
 * Riftbound 1v1 (RiftJudge / Core Rules): opening hand of 4, both players
 * draw on their first turn too (only free-for-all skips the first draw).
 */

export const GAME = {
  handSize: 4,
  drawFirstTurn: { first: true, second: true },
  extraDrawSecond: 0, // tested variants (« going second draws one more ») — 0 in standard rules
  mulliganMax: 2,     // set aside up to 2 cards, draw as many, recycle the set-aside cards
  victoryScore: 8,    // 1v1 (11 in 2v2)
};

const lfCache = [0];
function logFactorial(n) {
  for (let i = lfCache.length; i <= n; i++) lfCache[i] = lfCache[i - 1] + Math.log(i);
  return lfCache[n];
}

export function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * P(exactly k successes) drawing n cards from a deck of N holding K successes.
 */
export function hypergeomPmf(k, N, K, n) {
  if (k < 0 || k > n || k > K || n - k > N - K || n > N) return 0;
  return Math.exp(logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n));
}

/** P(at least x successes) in n cards from N holding K. */
export function atLeast(x, N, K, n) {
  if (x <= 0) return 1;
  const max = Math.min(K, n);
  let p = 0;
  for (let k = x; k <= max; k++) p += hypergeomPmf(k, N, K, n);
  return Math.min(1, Math.max(0, p));
}

/** Cards seen by the start of turn N (N ≥ 1), not counting a mulligan. */
export function cardsSeenByTurn(turn, onThePlay = true, game = GAME) {
  const t = Math.max(1, Math.floor(turn));
  const first = onThePlay ? game.drawFirstTurn.first : game.drawFirstTurn.second;
  const draws = (first ? t : t - 1) + (onThePlay ? 0 : game.extraDrawSecond);
  return game.handSize + Math.max(0, draws);
}

/**
 * Probability of having at least `atLeastCopies` of the `copies` cards in the
 * deck (size `deckSize`) by turn `turn`.
 */
export function probabilityByTurn({ deckSize, copies, atLeastCopies = 1, turn = 1, onThePlay = true, game = GAME }) {
  const n = Math.min(deckSize, cardsSeenByTurn(turn, onThePlay, game));
  return atLeast(atLeastCopies, deckSize, Math.min(copies, deckSize), n);
}
