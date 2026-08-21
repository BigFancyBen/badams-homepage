const K = 24;

/**
 * One update per matchup, not one per vote.
 *
 * Applying a rating change per voter is order-dependent and jumpy with a pool
 * this small. Instead, vote share becomes a fractional score: 6 of 8 voters
 * pick A, so A scored 0.75 against B's 0.25, and that resolves as a single
 * game.
 */
export function updateElo(
  eloA: number,
  eloB: number,
  votesA: number,
  votesB: number
): { a: number; b: number } {
  const total = votesA + votesB;
  if (total === 0) return { a: eloA, b: eloB };

  const scoreA = votesA / total;
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

  return {
    a: eloA + K * (scoreA - expectedA),
    b: eloB + K * (expectedA - scoreA),
  };
}
