/**
 * Glicko rather than plain Elo, because the thing a fixed K gets wrong here is
 * not the size of the moves — it is that the size never depends on how much is
 * already known.
 *
 * The catalog is around a thousand photographs and four of them go on the
 * board a day, so a sweep takes most of a year. At K = 24 a photograph that
 * belongs 300 points above the opening rating gains about eight points the
 * first time it wins: thirty-five games to arrive, at one game a sweep. Every
 * rating in the table was therefore 1500 plus a coin toss, and would have
 * stayed that way.
 *
 * Glicko carries a second number, the rating deviation, which is how unsure we
 * are of a rating in rating points. It starts wide and narrows as results
 * arrive, and the update divides by it — so a photograph nobody has voted on
 * moves a long way on its first result, and one with a dozen games behind it
 * barely moves at all. That is the whole change. Ratings are still on the same
 * 400-point scale, still centred on 1500, and still read the same way.
 *
 * Glicko-1 rather than Glicko-2: Glicko-2 adds a volatility term modelling a
 * competitor's true strength drifting over time, solved for iteratively. A
 * photograph's true strength does not drift. It is the same photograph.
 *
 * For the same reason there is no deviation inflation between games. Glicko
 * widens an inactive competitor's deviation because they may have got better
 * or worse while away, and here nothing has: a photograph that last played
 * eight months ago is exactly as well understood as it was then. Inflating it
 * would also be ruinous at this cadence — every photograph is inactive almost
 * all of the time, so it would push the whole catalog back to maximum
 * uncertainty permanently and hand back the noise this replaced.
 */

/** Glicko's scale constant, ln(10)/400 — the same 400 the Elo curve uses. */
const Q = Math.LN10 / 400;

/**
 * The deviation a photograph enters on.
 *
 * Glicko's usual opener is 350, which says the rating could be anywhere in a
 * 1400-point band. That is right for a chess population and wrong for this
 * one: dinner is not spread over 1400 points, and at 350 a photograph's first
 * shutout would move it more than 160 points on six people's opinion of a
 * single comparison. At 250 that first shutout is worth about 110, and three
 * or four results put a photograph roughly where it belongs — which is the
 * point of the exercise, without the first result being the whole answer.
 */
export const RD_START = 250;

/**
 * The floor. Without one the deviation keeps shrinking, the update keeps
 * dividing by it, and a well-played rating eventually freezes solid.
 *
 * 60 is chosen so two settled photographs meeting produce an effective K of
 * about 20 — near enough to the fixed 24 this replaced that a photograph with
 * a history behind it goes on behaving as it always did. The change is meant
 * to be felt at the new end of the catalog, not the old one.
 */
export const RD_MIN = 60;

/** A rating, and how sure of it we are. */
export interface Rated {
  elo: number;
  rd: number;
}

/**
 * One comparison inside a rating period: an opponent as it stood when the
 * period opened, and this side's share of the vote against it. 1 is a shutout,
 * 0.5 a dead heat.
 */
export interface Comparison extends Rated {
  score: number;
}

/**
 * How much weight an opponent's opinion carries, given how sure we are of the
 * opponent. Beating someone whose own rating is a guess says less than beating
 * someone whose rating is known, and this is the term that says so.
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
}

/**
 * One photograph's whole rating period, however many comparisons are in it.
 *
 * Glicko is defined over a period rather than a game, which is what makes a
 * ranking round fall out of it rather than have to be bolted on: five
 * photographs on a card is four comparisons for each of them, and four
 * comparisons is a period with four games in it.
 *
 * The 1/rd² term is the prior, and it is what stops four comparisons moving a
 * rating four times as far as one — a round moves a settled rating about three
 * and a half times a matchup's worth, and leaves it on a tighter deviation, so
 * the round after moves it less. That is the honest version of what dividing K
 * by n-1 used to approximate by hand.
 *
 * Every comparison is scored against the ratings as they stood when the period
 * opened, so the answer cannot depend on the order they are walked in.
 */
export function rate(subject: Rated, comparisons: Comparison[]): Rated {
  if (comparisons.length === 0) return subject;

  let precision = 0;
  let direction = 0;

  for (const opponent of comparisons) {
    const weight = g(opponent.rd);
    const expected =
      1 / (1 + Math.pow(10, (weight * (opponent.elo - subject.elo)) / 400));

    precision += Q * Q * weight * weight * expected * (1 - expected);
    direction += weight * (opponent.score - expected);
  }

  // expected * (1 - expected) only reaches zero at a rating gap of a couple of
  // thousand points, which this pool cannot produce. Guarded rather than
  // reasoned about, because what it would otherwise do is divide by nothing.
  if (precision === 0) return subject;

  const total = 1 / (subject.rd * subject.rd) + precision;

  return {
    elo: subject.elo + (Q / total) * direction,
    rd: Math.max(RD_MIN, Math.sqrt(1 / total)),
  };
}

/**
 * One update per matchup, not one per vote.
 *
 * Applying a rating change per voter is order-dependent and jumpy with a pool
 * this small. Instead, vote share becomes a fractional score: 6 of 8 voters
 * pick A, so A scored 0.75 against B's 0.25, and that resolves as a single
 * game.
 *
 * Both sides are rated against the other as it stood before the matchup, so
 * neither can see the other's movement. This is deliberately not zero-sum the
 * way fixed-K Elo was: the side with the wider deviation moves further, which
 * is the entire point — a newcomer beating a veteran teaches us far more about
 * the newcomer than about the veteran.
 */
export function updateElo(
  a: Rated,
  b: Rated,
  votesA: number,
  votesB: number
): { a: Rated; b: Rated } {
  const total = votesA + votesB;
  if (total === 0) return { a, b };

  const scoreA = votesA / total;

  return {
    a: rate(a, [{ ...b, score: scoreA }]),
    b: rate(b, [{ ...a, score: 1 - scoreA }]),
  };
}

/** One photograph's share of a ranking round, in finishing order. */
export interface RankingResult {
  id: number;
  /** Rating movement for the whole round, across every comparison in it. */
  delta: number;
  /** The deviation it comes out on — narrower than it went in. */
  rd: number;
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
 * with its own vote split, and every photograph's whole card is one Glicko
 * rating period — the n-1 comparisons it appears in, resolved together.
 *
 * That is also what makes a partial ballot worth casting. Someone who clicks
 * their favourite and wanders off has still said something about four pairs,
 * and it costs them one click. A round that demanded all five from everybody
 * would collect fewer opinions, not more.
 *
 * A pair nobody expressed any opinion on — left unranked on every ballot —
 * carries no information and is skipped, rather than scored as a draw.
 */
export function scoreRanking(
  entries: (Rated & { id: number })[],
  ballots: number[][]
): RankingResult[] {
  const n = entries.length;
  const comparisons = new Map<number, Comparison[]>();
  const wins = new Map<number, number>();
  const firsts = new Map<number, number>();

  for (const entry of entries) {
    comparisons.set(entry.id, []);
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

      const scoreA = votesA / (votesA + votesB);
      comparisons.get(a.id)?.push({ elo: b.elo, rd: b.rd, score: scoreA });
      comparisons.get(b.id)?.push({ elo: a.elo, rd: a.rd, score: 1 - scoreA });
    }
  }

  return entries
    .map((entry) => {
      const next = rate(entry, comparisons.get(entry.id) ?? []);
      return {
        id: entry.id,
        delta: next.elo - entry.elo,
        rd: next.rd,
        wins: wins.get(entry.id) ?? 0,
        firsts: firsts.get(entry.id) ?? 0,
      };
    })
    .sort((x, y) => y.wins - x.wins || y.firsts - x.firsts || x.id - y.id);
}
