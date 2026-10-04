/**
 * The arithmetic behind the weekly standings post: who is where, who moved,
 * and who they went past. No database and no Discord in here, so it can be
 * checked on its own — see scripts/test-standings.mjs.
 *
 * The post used to report one thing per chef, the rating change. That is the
 * least interesting way to say what happened: +14 reads the same whether it
 * took somebody from fourth to first or left them exactly where they were.
 * The table is a ranking, so the news in it is a change of rank, and the
 * rating change is the detail underneath.
 */

export interface Chef {
  discord_id: string;
  username: string;
  elo: number;
}

/** One line of the card. Short keys because the whole thing rides in a URL. */
export interface StandingsRow {
  /** Chef name */
  n: string;
  /** Rating, rounded */
  e: number;
  /** Rating movement since the previous post */
  d: number;
  /** Places gained since the previous post; negative is places lost */
  m: number;
  /** Set when this chef was not in the previous post at all */
  nw?: 1;
}

/**
 * Last week's ranks, recovered from the snapshot of last week's ratings.
 *
 * Sorted out of the ratings rather than stored beside them, so the snapshot
 * written before any of this existed still answers the question and the first
 * post after the deploy already has movement on it.
 */
export function previousRanks(
  snapshot: Record<string, number>
): Map<string, number> {
  const ranks = new Map<string, number>();
  Object.entries(snapshot)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id], index) => ranks.set(id, index + 1));
  return ranks;
}

/**
 * The card's rows. `standings` is everybody, best first, so a rank means the
 * same thing on both sides of the comparison; `shown` is how many make the
 * card.
 *
 * An empty snapshot is the first post there has ever been, and nobody on it is
 * marked new — a table where every row carries the badge says nothing.
 */
export function standingsRows(
  standings: Chef[],
  snapshot: Record<string, number>,
  shown: number
): StandingsRow[] {
  const before = previousRanks(snapshot);

  return standings.slice(0, shown).map((chef, index) => {
    const elo = Math.round(chef.elo);
    const previousElo = snapshot[chef.discord_id];
    const previousRank = before.get(chef.discord_id);
    const row: StandingsRow = {
      n: chef.username,
      e: elo,
      d: previousElo === undefined ? 0 : elo - Math.round(previousElo),
      m: previousRank === undefined ? 0 : previousRank - (index + 1),
    };
    if (previousRank === undefined && before.size > 0) row.nw = 1;
    return row;
  });
}

export interface Overtake {
  name: string;
  /** Where they are now, 1-based */
  rank: number;
  /** Places gained */
  gained: number;
  /** Who was ahead of them last week and is behind them now, best first */
  passed: string[];
}

/**
 * Everybody who climbed, biggest climb first, with the names they went past.
 *
 * "Past" is worked out rather than assumed from the gap: somebody can gain a
 * place because the chef above them dropped out of the table, which is a
 * climb with nobody overtaken, and the line should not invent a victim.
 */
export function overtakes(
  standings: Chef[],
  snapshot: Record<string, number>,
  shown: number
): Overtake[] {
  const before = previousRanks(snapshot);
  const now = new Map(standings.map((chef, index) => [chef.discord_id, index + 1]));

  const climbs: Overtake[] = [];
  for (const chef of standings.slice(0, shown)) {
    const was = before.get(chef.discord_id);
    const rank = now.get(chef.discord_id)!;
    if (was === undefined || was <= rank) continue;

    climbs.push({
      name: chef.username,
      rank,
      gained: was - rank,
      passed: standings
        .filter((other) => {
          const otherWas = before.get(other.discord_id);
          return (
            otherWas !== undefined &&
            otherWas < was &&
            now.get(other.discord_id)! > rank
          );
        })
        .map((other) => other.username),
    });
  }

  return climbs.sort((a, b) => b.gained - a.gained || a.rank - b.rank);
}

/** How many climbs the post names before it stops — the card has the rest. */
const MAX_LINES = 3;
/** How many overtaken names one line carries before "and N more". */
const MAX_NAMES = 3;

function listNames(names: string[]): string {
  const head = names.slice(0, MAX_NAMES);
  const rest = names.length - head.length;
  if (rest > 0) return `${head.join(", ")} and ${rest} more`;
  if (head.length <= 1) return head.join("");
  return `${head.slice(0, -1).join(", ")} and ${head[head.length - 1]}`;
}

/**
 * The climbs as lines of message text, to sit above the card. `escape` is
 * passed in because usernames go into markdown here and this file does not
 * know about Discord.
 */
export function overtakeLines(
  climbs: Overtake[],
  escape: (text: string) => string
): string[] {
  return climbs.slice(0, MAX_LINES).map((climb) => {
    const places = climb.gained === 1 ? "1 place" : `${climb.gained} places`;
    const past =
      climb.passed.length > 0
        ? `, past ${listNames(climb.passed.map(escape))}`
        : "";
    return `▲ **${escape(climb.name)}** up ${places} to #${climb.rank}${past}`;
  });
}
