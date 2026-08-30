const K = 24;

/**
 * One update per matchup, not one per vote.
 *
 * Applying a rating change per voter is order-dependent and jumpy with a pool
 * this small. Instead, vote share becomes a fractional score: 6 of 8 voters
 * pick A, so A scored 0.75 against B's 0.25, and that resolves as a single
 * game.
 *
 * `k` is the rating weight of one comparison. Only the ranking rounds pass it:
 * they resolve several comparisons at once and have to divide the weight
 * between them, for the reason in scoreRanking.
 */
export function updateElo(
  eloA: number,
  eloB: number,
  votesA: number,
  votesB: number,
  k: number = K
): { a: number; b: number } {
  const total = votesA + votesB;
  if (total === 0) return { a: eloA, b: eloB };

  const scoreA = votesA / total;
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

  return {
    a: eloA + k * (scoreA - expectedA),
    b: eloB + k * (expectedA - scoreA),
  };
}

/** One photograph's share of a ranking round, in finishing order. */
export interface RankingResult {
  id: number;
  /** Rating movement for the whole round, already summed across every pair. */
  delta: number;
  /** Head-to-head comparisons won across every ballot. This is the finish. */
  wins: number;
  /** Ballots that put it top. The tiebreak, and the stat worth showing. */
  firsts: number;
}

/**
 * Scores a ranking round as the round-robin it already is.
 *
 * A ballot is a set of pairwise judgements and nothing more: whatever someone
 * ranked beat whatever they put below it, and beat everything they left
 * unranked entirely. Every pair in the round is therefore an ordinary matchup
 * with its own vote split, resolved by the same updateElo the pair rounds use
 * — no second rating system, and a five-way round stays comparable with the
 * matchups either side of it.
 *
 * That is also what makes a partial ballot worth casting. Someone who clicks
 * their favourite and wanders off has still said something about four pairs,
 * and it costs them one click. A round that demanded all five from everybody
 * would collect fewer opinions, not more.
 *
 * Two details keep it honest. Every pair is scored against the ratings as they
 * stood when the round opened and the movements are summed and applied once,
 * so the answer cannot depend on the arbitrary order the pairs are walked in.
 * And each comparison carries K/(n-1), because a photograph in a five-way
 * round appears in four of them: at full K one ranking round would move a
 * rating as far as four matchups, and the weekly bonus would outweigh the week.
 *
 * A pair nobody expressed any opinion on — left unranked on every ballot —
 * carries no information and is skipped, rather than scored as a draw.
 */
export function scoreRanking(
  entries: { id: number; elo: number }[],
  ballots: number[][]
): RankingResult[] {
  const n = entries.length;
  const delta = new Map<number, number>();
  const wins = new Map<number, number>();
  const firsts = new Map<number, number>();

  for (const entry of entries) {
    delta.set(entry.id, 0);
    wins.set(entry.id, 0);
    firsts.set(entry.id, 0);
  }

  for (const ballot of ballots) {
    const top = ballot[0];
    if (top !== undefined && firsts.has(top)) {
      firsts.set(top, (firsts.get(top) ?? 0) + 1);
    }
  }

  // Position in the ballot is the rank, so a lower index beat a higher one and
  // a missing one was beaten by everything present.
  const ranks = ballots.map((ballot) => {
    const rank = new Map<number, number>();
    ballot.forEach((id, index) => rank.set(id, index));
    return rank;
  });

  const weight = n > 1 ? K / (n - 1) : K;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = entries[i];
      const b = entries[j];
      let votesA = 0;
      let votesB = 0;

      for (const rank of ranks) {
        const rankA = rank.get(a.id);
        const rankB = rank.get(b.id);
        if (rankA === undefined && rankB === undefined) continue;
        if (rankB === undefined) votesA++;
        else if (rankA === undefined) votesB++;
        else if (rankA < rankB) votesA++;
        else votesB++;
      }

      if (votesA + votesB === 0) continue;

      wins.set(a.id, (wins.get(a.id) ?? 0) + votesA);
      wins.set(b.id, (wins.get(b.id) ?? 0) + votesB);

      const next = updateElo(a.elo, b.elo, votesA, votesB, weight);
      delta.set(a.id, (delta.get(a.id) ?? 0) + (next.a - a.elo));
      delta.set(b.id, (delta.get(b.id) ?? 0) + (next.b - b.elo));
    }
  }

  return entries
    .map((entry) => ({
      id: entry.id,
      delta: delta.get(entry.id) ?? 0,
      wins: wins.get(entry.id) ?? 0,
      firsts: firsts.get(entry.id) ?? 0,
    }))
    .sort((x, y) => y.wins - x.wins || y.firsts - x.firsts || x.id - y.id);
}
