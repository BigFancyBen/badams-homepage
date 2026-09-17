/**
 * Scrandle insights: pulls the game's tables out of D1 and turns them into
 * charts and a written report — what kinds of food the channel is biased for
 * and against, who cooks what, who votes how, and when the channel eats.
 *
 *   npm run scrandle:insights              # remote D1, needs `npx wrangler login`
 *   npm run scrandle:insights -- --local   # the local D1 from `npm run migrate:local`
 *   npm run scrandle:insights -- --from scrandle-worker/insights/data.json
 *   npm run scrandle:insights -- --post   # also post the charts to Discord
 *
 * --post sends every chart, with its findings underneath, to a Discord
 * webhook: --webhook <url>, else DISCORD_LOG_WEBHOOK_URL in the environment,
 * else the same variable in scrandle-worker/.dev.vars. That is the webhook
 * the bot logs errors to, so by default the charts land wherever those do;
 * pass a webhook for the food channel to put them in front of everybody.
 *
 * Writes to scrandle-worker/insights/ (gitignored): one PNG per chart,
 * report.html with all of them and the findings, insights.md with the findings
 * alone, and data.json — the raw pull, so the charts can be re-rendered or
 * handed to somebody without a Cloudflare login.
 *
 * Everything runs in this file on purpose. The Worker is on the free plan and
 * cannot afford to compute any of this in a tick, and the D1 tables are small
 * enough — hundreds of photographs, thousands of votes — that pulling them
 * whole and doing the arithmetic here is simpler than a hundred SQL queries
 * and easier to read. Rendering is SVG written by hand and rasterised through
 * sharp, which the site already depends on, so nothing new is installed.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const WORKER_DIR = join(ROOT, "scrandle-worker");

// ── Arguments ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const OUT_DIR = resolve(option("out") ?? join(WORKER_DIR, "insights"));
const LOCAL = flag("local");
const FROM = option("from");
/** Fewer votes than this and a share is a coin toss; it is reported, not charted. */
const MIN_VOTES = Number(option("min-votes") ?? 15);
const TIME_ZONE = option("tz") ?? "America/Denver";
const POST = flag("post");
const WEBHOOK = option("webhook") ?? process.env.DISCORD_LOG_WEBHOOK_URL ?? readDevVar("DISCORD_LOG_WEBHOOK_URL");

/** A value from the worker's gitignored .dev.vars, the file `wrangler dev` reads. */
function readDevVar(name) {
  try {
    const text = readFileSync(join(WORKER_DIR, ".dev.vars"), "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
    return value || undefined;
  } catch {
    return undefined;
  }
}

// ── Pulling the data ─────────────────────────────────────────────────

const TABLES = {
  players: "SELECT discord_id, username, first_seen FROM players",
  dishes:
    "SELECT id, poster_discord_id, caption, posted_at, elo, rd, matches_played, category, kind, name, first_matchup_id FROM dishes",
  matchups:
    "SELECT id, dish_a_id, dish_b_id, status, created_at, closes_at, closed_at, votes_a, votes_b, elo_a_before, elo_b_before, elo_a_after, elo_b_after, bonus FROM matchups",
  votes: "SELECT id, matchup_id, voter_discord_id, picked_dish_id, voted_at FROM votes",
  rounds: "SELECT id, category, status, created_at, closes_at, closed_at FROM rounds",
  round_entries:
    "SELECT round_id, dish_id, slot, elo_before, elo_after, wins, firsts FROM round_entries",
  round_votes: "SELECT round_id, voter_discord_id, dish_id, rank, voted_at FROM round_votes",
  contests: "SELECT id, dish_id, status, created_at, closed_at FROM contests",
  contest_entries:
    "SELECT id, contest_id, author_discord_id, text, slot, points, firsts, submitted_at FROM contest_entries",
  contest_votes: "SELECT contest_id, voter_discord_id, entry_id, rank, voted_at FROM contest_votes",
};

/** D1 returns whole result sets, but a page keeps any one response small. */
const PAGE = 5000;

function wranglerExecute(sql) {
  const base = ["wrangler", "d1", "execute", "scrandle", "--json", "--command", sql];
  const argv = LOCAL
    ? [...base, "--local", "--config", "wrangler.test.toml"]
    : [...base, "--remote"];
  const result = spawnSync("npx", argv, {
    cwd: WORKER_DIR,
    encoding: "utf8",
    // No telemetry: it is a second host to allow through a proxy, for nothing.
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    shell: process.platform === "win32",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `wrangler d1 execute failed (${result.status}):\n${result.stderr || result.stdout}`
    );
  }
  // Wrangler prints the JSON last; anything before it is a banner or a
  // warning, so take the array from its first bracket onward.
  const text = result.stdout;
  const start = text.indexOf("[");
  const parsed = JSON.parse(text.slice(start));
  return parsed.map((block) => {
    if (!block.success) throw new Error(`D1 query failed: ${JSON.stringify(block)}`);
    return block.results;
  });
}

function pull() {
  const names = Object.keys(TABLES);
  const data = {};
  // One round trip for the first page of every table, then more only for a
  // table that filled its page.
  const first = wranglerExecute(
    names.map((name) => `${TABLES[name]} ORDER BY 1 LIMIT ${PAGE}`).join("; ")
  );
  names.forEach((name, index) => {
    data[name] = first[index];
  });
  for (const name of names) {
    let offset = PAGE;
    while (data[name].length === offset) {
      const [page] = wranglerExecute(`${TABLES[name]} ORDER BY 1 LIMIT ${PAGE} OFFSET ${offset}`);
      data[name].push(...page);
      offset += PAGE;
    }
  }
  return data;
}

// ── Small helpers ────────────────────────────────────────────────────

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (x) => `${Math.round(x * 100)}%`;
const signed = (x, digits = 0) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const groupBy = (xs, key) => {
  const map = new Map();
  for (const x of xs) {
    const k = key(x);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return map;
};
const escapeXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? "");

/**
 * Wilson lower bound on a share: a kind that won 3 of 4 is not "75% loved",
 * and this is what keeps a tiny sample from topping a chart.
 */
function wilsonLow(wins, n, z = 1.28) {
  if (n === 0) return 0;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (centre - spread) / denom;
}

const dtf = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts });
const hourOf = (ms) => Number(dtf({ hour: "numeric", hourCycle: "h23" }).format(new Date(ms)));
const weekdayOf = (ms) => dtf({ weekday: "short" }).format(new Date(ms));
const dayOf = (ms) => dtf({ day: "numeric", month: "short" }).format(new Date(ms));
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Monday-anchored week start, in local time, as a sortable key. */
function weekKey(ms) {
  const d = new Date(ms);
  const parts = dtf({ year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(d)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const back = (WEEKDAYS.indexOf(parts.weekday) + 7) % 7;
  const local = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  local.setUTCDate(local.getUTCDate() - back);
  return local.toISOString().slice(0, 10);
}

// ── Analysis ─────────────────────────────────────────────────────────

function analyse(data) {
  const players = new Map(data.players.map((p) => [p.discord_id, p.username]));
  const nameOf = (id) => players.get(id) ?? `#${String(id).slice(-4)}`;
  const dishes = new Map(data.dishes.map((d) => [d.id, d]));
  const dishLabel = (d) => truncate(d.name ?? d.caption ?? `photo ${d.id}`, 28);

  const closed = data.matchups.filter((m) => m.status === "closed");
  const votesByMatchup = groupBy(data.votes, (v) => v.matchup_id);

  // Every vote, with both sides of the pair resolved to their photographs.
  const ballots = [];
  for (const m of closed) {
    const a = dishes.get(m.dish_a_id);
    const b = dishes.get(m.dish_b_id);
    if (!a || !b) continue;
    for (const v of votesByMatchup.get(m.id) ?? []) {
      const picked = v.picked_dish_id === a.id ? a : v.picked_dish_id === b.id ? b : null;
      if (!picked) continue;
      const other = picked === a ? b : a;
      ballots.push({ matchup: m, voter: v.voter_discord_id, picked, other, at: v.voted_at });
    }
  }

  // ── Kinds ──
  // A kind's share is its votes won against *other* kinds; a pasta-vs-pasta
  // vote says nothing about pasta.
  function kindShares(category) {
    const stats = new Map();
    for (const b of ballots) {
      if (b.picked.category !== category || b.other.category !== category) continue;
      const kp = b.picked.kind ?? "other";
      const ko = b.other.kind ?? "other";
      if (kp === ko) continue;
      for (const [k, won] of [
        [kp, 1],
        [ko, 0],
      ]) {
        if (!stats.has(k)) stats.set(k, { kind: k, won: 0, n: 0 });
        const s = stats.get(k);
        s.won += won;
        s.n += 1;
      }
    }
    const rated = data.dishes.filter((d) => d.category === category && d.matches_played > 0);
    for (const [k, group] of groupBy(rated, (d) => d.kind ?? "other")) {
      if (!stats.has(k)) stats.set(k, { kind: k, won: 0, n: 0 });
      Object.assign(stats.get(k), {
        dishes: group.length,
        rating: mean(group.map((d) => d.elo)),
        top: [...group].sort((a, b) => b.elo - a.elo)[0],
      });
    }
    return [...stats.values()]
      .map((s) => ({ ...s, share: s.n ? s.won / s.n : 0.5, low: wilsonLow(s.won, s.n) }))
      .sort((a, b) => b.share - a.share);
  }

  function kindMatrix(category) {
    const counts = new Map();
    const bump = (a, b, won) => {
      const key = `${a}|${b}`;
      if (!counts.has(key)) counts.set(key, { won: 0, n: 0 });
      counts.get(key).won += won;
      counts.get(key).n += 1;
    };
    for (const b of ballots) {
      if (b.picked.category !== category || b.other.category !== category) continue;
      const kp = b.picked.kind ?? "other";
      const ko = b.other.kind ?? "other";
      if (kp === ko) continue;
      bump(kp, ko, 1);
      bump(ko, kp, 0);
    }
    const totals = new Map();
    for (const [key, c] of counts) {
      const [a] = key.split("|");
      totals.set(a, (totals.get(a) ?? 0) + c.n);
    }
    const kinds = [...totals.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 9)
      .map(([k]) => k);
    return { kinds, cell: (a, b) => counts.get(`${a}|${b}`) ?? null };
  }

  // ── Chefs ──
  const chefs = [...groupBy(data.dishes, (d) => d.poster_discord_id)].map(([id, posted]) => {
    const food = posted.filter((d) => d.category === "food");
    const rated = posted.filter((d) => d.matches_played > 0);
    const won = ballots.filter((b) => b.picked.poster_discord_id === id).length;
    const faced = ballots.filter(
      (b) =>
        (b.picked.poster_discord_id === id || b.other.poster_discord_id === id) &&
        b.picked.poster_discord_id !== b.other.poster_discord_id
    ).length;
    const kinds = [...groupBy(food, (d) => d.kind ?? "other")]
      .map(([kind, ds]) => ({ kind, n: ds.length }))
      .sort((a, b) => b.n - a.n);
    const best = [...rated].sort((a, b) => b.elo - a.elo)[0];
    const categories = groupBy(posted, (d) => d.category ?? "unclassified");
    return {
      id,
      name: nameOf(id),
      posted: posted.length,
      food: food.length,
      drinks: categories.get("drink")?.length ?? 0,
      rated: rated.length,
      rating: mean(rated.map((d) => d.elo)),
      best,
      won,
      faced,
      share: faced ? won / faced : 0.5,
      low: wilsonLow(won, faced),
      signature: kinds[0],
      kinds,
      firstPost: Math.min(...posted.map((d) => d.posted_at)),
    };
  });
  chefs.sort((a, b) => b.posted - a.posted);

  // Chef against chef: when A's plate meets B's, how often A wins.
  const chefMatrix = (() => {
    const counts = new Map();
    for (const b of ballots) {
      const p = b.picked.poster_discord_id;
      const o = b.other.poster_discord_id;
      if (p === o) continue;
      for (const [x, y, won] of [
        [p, o, 1],
        [o, p, 0],
      ]) {
        const key = `${x}|${y}`;
        if (!counts.has(key)) counts.set(key, { won: 0, n: 0 });
        counts.get(key).won += won;
        counts.get(key).n += 1;
      }
    }
    const ids = chefs.filter((c) => c.faced >= MIN_VOTES).slice(0, 9).map((c) => c.id);
    return { ids, cell: (a, b) => counts.get(`${a}|${b}`) ?? null };
  })();

  // ── Voters ──
  const matchupsWithMajority = new Map();
  for (const m of closed) {
    const total = m.votes_a + m.votes_b;
    if (total >= 3 && m.votes_a !== m.votes_b) {
      matchupsWithMajority.set(m.id, m.votes_a > m.votes_b ? m.dish_a_id : m.dish_b_id);
    }
  }
  const overallKindShare = new Map();
  for (const b of ballots) {
    for (const [k, won] of [
      [b.picked.kind ?? "other", 1],
      [b.other.kind ?? "other", 0],
    ]) {
      if (!overallKindShare.has(k)) overallKindShare.set(k, { won: 0, n: 0 });
      overallKindShare.get(k).won += won;
      overallKindShare.get(k).n += 1;
    }
  }
  const voters = [...groupBy(ballots, (b) => b.voter)].map(([id, mine]) => {
    const withMajority = mine.filter((b) => matchupsWithMajority.has(b.matchup.id));
    const agreed = withMajority.filter(
      (b) => matchupsWithMajority.get(b.matchup.id) === b.picked.id
    ).length;
    const ownOnBoard = mine.filter(
      (b) =>
        (b.picked.poster_discord_id === id || b.other.poster_discord_id === id) &&
        b.picked.poster_discord_id !== b.other.poster_discord_id
    );
    const ownPicked = ownOnBoard.filter((b) => b.picked.poster_discord_id === id).length;
    const delays = mine.map((b) => (b.at - b.matchup.created_at) / 60000).filter((d) => d >= 0);
    // Personal taste: this voter's share for a kind against everybody's.
    const taste = new Map();
    for (const b of mine) {
      if (b.picked.kind === b.other.kind) continue;
      for (const [k, won] of [
        [b.picked.kind ?? "other", 1],
        [b.other.kind ?? "other", 0],
      ]) {
        if (!taste.has(k)) taste.set(k, { kind: k, won: 0, n: 0 });
        taste.get(k).won += won;
        taste.get(k).n += 1;
      }
    }
    const tastes = [...taste.values()]
      .filter((t) => t.n >= Math.max(6, MIN_VOTES / 2))
      .map((t) => {
        const all = overallKindShare.get(t.kind);
        return { ...t, share: t.won / t.n, lift: t.won / t.n - (all ? all.won / all.n : 0.5) };
      })
      .sort((a, b) => b.lift - a.lift);
    const hours = new Array(24).fill(0);
    for (const b of mine) hours[hourOf(b.at)] += 1;
    return {
      id,
      name: nameOf(id),
      votes: mine.length,
      agreed,
      judged: withMajority.length,
      agreement: withMajority.length ? agreed / withMajority.length : 0,
      ownPicked,
      ownOnBoard: ownOnBoard.length,
      loyalty: ownOnBoard.length ? ownPicked / ownOnBoard.length : null,
      medianDelay: median(delays),
      loves: tastes[0],
      hates: tastes[tastes.length - 1],
      hours,
      peakHour: hours.indexOf(Math.max(...hours)),
    };
  });
  voters.sort((a, b) => b.votes - a.votes);

  // Voter → chef affinity: does this voter favour that chef beyond the room?
  const affinity = (() => {
    const chefShare = new Map(chefs.map((c) => [c.id, c.share]));
    const counts = new Map();
    for (const b of ballots) {
      const p = b.picked.poster_discord_id;
      const o = b.other.poster_discord_id;
      if (p === o) continue;
      for (const [chef, won] of [
        [p, 1],
        [o, 0],
      ]) {
        const key = `${b.voter}|${chef}`;
        if (!counts.has(key)) counts.set(key, { won: 0, n: 0 });
        counts.get(key).won += won;
        counts.get(key).n += 1;
      }
    }
    const voterIds = voters.slice(0, 10).map((v) => v.id);
    const chefIds = chefs.filter((c) => c.faced >= MIN_VOTES).slice(0, 10).map((c) => c.id);
    return {
      voterIds,
      chefIds,
      cell: (voter, chef) => {
        const c = counts.get(`${voter}|${chef}`);
        if (!c) return null;
        return { ...c, lift: c.won / c.n - (chefShare.get(chef) ?? 0.5) };
      },
    };
  })();

  // ── Time ──
  const weeks = new Map();
  const touch = (key) => {
    if (!weeks.has(key)) weeks.set(key, { week: key, food: 0, drink: 0, other: 0, votes: 0, matchups: 0 });
    return weeks.get(key);
  };
  for (const d of data.dishes) {
    const w = touch(weekKey(d.posted_at));
    if (d.category === "food") w.food += 1;
    else if (d.category === "drink") w.drink += 1;
    else w.other += 1;
  }
  for (const v of data.votes) touch(weekKey(v.voted_at)).votes += 1;
  for (const m of closed) touch(weekKey(m.created_at)).matchups += 1;
  const weekly = [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));

  const postHours = new Array(24).fill(0);
  const voteHours = new Array(24).fill(0);
  for (const d of data.dishes) if (d.category === "food") postHours[hourOf(d.posted_at)] += 1;
  for (const v of data.votes) voteHours[hourOf(v.voted_at)] += 1;
  const postDays = Object.fromEntries(WEEKDAYS.map((d) => [d, 0]));
  for (const d of data.dishes) if (d.category === "food") postDays[weekdayOf(d.posted_at)] += 1;

  // ── Ratings ──
  const foodRated = data.dishes
    .filter((d) => d.category === "food" && d.matches_played > 0)
    .sort((a, b) => b.elo - a.elo);
  const drinkRated = data.dishes
    .filter((d) => d.category === "drink" && d.matches_played > 0)
    .sort((a, b) => b.elo - a.elo);

  const contested = closed
    .map((m) => ({ m, total: m.votes_a + m.votes_b, gap: Math.abs(m.votes_a - m.votes_b) }))
    .filter((x) => x.total >= 4);
  const closest = [...contested].sort((a, b) => a.gap - b.gap || b.total - a.total).slice(0, 5);
  const landslides = [...contested]
    .filter((x) => x.gap === x.total)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const upsets = closed
    .filter((m) => m.elo_a_before != null && m.elo_b_before != null && m.votes_a !== m.votes_b)
    .map((m) => {
      const aWon = m.votes_a > m.votes_b;
      const winner = dishes.get(aWon ? m.dish_a_id : m.dish_b_id);
      const loser = dishes.get(aWon ? m.dish_b_id : m.dish_a_id);
      const gap = (aWon ? m.elo_b_before - m.elo_a_before : m.elo_a_before - m.elo_b_before);
      return { m, winner, loser, gap };
    })
    .filter((u) => u.winner && u.loser && u.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  // Rating history for the top food: every matchup and round it has been in.
  const history = new Map();
  const record = (dishId, at, elo) => {
    if (elo == null) return;
    if (!history.has(dishId)) history.set(dishId, []);
    history.get(dishId).push({ at, elo });
  };
  for (const m of closed) {
    record(m.dish_a_id, m.closed_at ?? m.closes_at, m.elo_a_after);
    record(m.dish_b_id, m.closed_at ?? m.closes_at, m.elo_b_after);
  }
  const roundsById = new Map(data.rounds.map((r) => [r.id, r]));
  for (const e of data.round_entries) {
    const r = roundsById.get(e.round_id);
    if (r?.status === "closed") record(e.dish_id, r.closed_at ?? r.closes_at, e.elo_after);
  }
  for (const h of history.values()) h.sort((a, b) => a.at - b.at);
  const trajectories = foodRated
    .filter((d) => (history.get(d.id)?.length ?? 0) >= 3)
    .slice(0, 5)
    .map((d) => ({ dish: d, points: history.get(d.id) }));

  // ── Rounds ──
  const roundVotes = groupBy(data.round_votes, (v) => v.round_id);
  const roundStats = data.rounds
    .filter((r) => r.status === "closed")
    .map((r) => {
      const byVoter = groupBy(roundVotes.get(r.id) ?? [], (v) => v.voter_discord_id);
      const tops = [...byVoter.values()]
        .map((vs) => vs.find((v) => v.rank === 1)?.dish_id)
        .filter((x) => x != null);
      const topCounts = groupBy(tops, (x) => x);
      const most = Math.max(0, ...[...topCounts.values()].map((g) => g.length));
      const entries = data.round_entries.filter((e) => e.round_id === r.id);
      const kind = entries.map((e) => dishes.get(e.dish_id)?.kind).find((k) => k) ?? r.category;
      return { r, voters: byVoter.size, consensus: tops.length ? most / tops.length : 0, kind };
    });
  const votersTopWinner = voters.map((v) => {
    let hits = 0;
    let n = 0;
    for (const r of data.rounds) {
      if (r.status !== "closed") continue;
      const entries = data.round_entries.filter((e) => e.round_id === r.id && e.wins != null);
      if (!entries.length) continue;
      const winner = [...entries].sort((a, b) => b.wins - a.wins || b.firsts - a.firsts)[0];
      const mine = (roundVotes.get(r.id) ?? []).find(
        (x) => x.voter_discord_id === v.id && x.rank === 1
      );
      if (!mine) continue;
      n += 1;
      if (mine.dish_id === winner.dish_id) hits += 1;
    }
    return { ...v, roundHits: hits, roundBallots: n };
  });

  // ── Captions ──
  const contestEntries = groupBy(data.contest_entries, (e) => e.contest_id);
  const captioners = new Map();
  for (const c of data.contests.filter((c) => c.status === "closed")) {
    const entries = (contestEntries.get(c.id) ?? []).filter((e) => e.points != null);
    if (!entries.length) continue;
    const ranked = [...entries].sort((a, b) => b.points - a.points || b.firsts - a.firsts);
    ranked.forEach((e, index) => {
      const key = e.author_discord_id ?? "bot";
      if (!captioners.has(key)) {
        captioners.set(key, { id: key, name: key === "bot" ? "The bot" : nameOf(key), entries: 0, wins: 0, points: 0, best: null });
      }
      const s = captioners.get(key);
      s.entries += 1;
      s.points += e.points;
      if (index === 0) {
        s.wins += 1;
        if (!s.best || e.points > s.best.points) s.best = e;
      }
    });
  }
  const captionTable = [...captioners.values()]
    .map((c) => ({ ...c, perEntry: c.points / c.entries }))
    .sort((a, b) => b.wins - a.wins || b.perEntry - a.perEntry);

  const firstAt = Math.min(...data.dishes.map((d) => d.posted_at), Date.now());
  const firstMatchup = closed.length ? Math.min(...closed.map((m) => m.created_at)) : Date.now();

  return {
    nameOf,
    dishLabel,
    dishes,
    overview: {
      photographs: data.dishes.length,
      food: data.dishes.filter((d) => d.category === "food").length,
      drinks: data.dishes.filter((d) => d.category === "drink").length,
      matchups: closed.length,
      votes: ballots.length,
      voters: voters.length,
      chefs: chefs.length,
      rounds: data.rounds.filter((r) => r.status === "closed").length,
      contests: data.contests.filter((c) => c.status === "closed").length,
      daysOfGame: Math.max(1, Math.round((Date.now() - firstMatchup) / 86400000)),
      firstPhoto: firstAt,
      turnout: closed.length ? mean(closed.map((m) => m.votes_a + m.votes_b)) : 0,
    },
    foodKinds: kindShares("food"),
    drinkKinds: kindShares("drink"),
    foodMatrix: kindMatrix("food"),
    chefs,
    chefMatrix,
    voters: votersTopWinner,
    affinity,
    weekly,
    postHours,
    voteHours,
    postDays,
    foodRated,
    drinkRated,
    closest,
    landslides,
    upsets,
    trajectories,
    roundStats,
    captionTable,
  };
}

// ── SVG charts ───────────────────────────────────────────────────────
// The site's dark surface, with a categorical palette validated against it.

const C = {
  bg: "#0a0a0a",
  panel: "#111111",
  grid: "#232323",
  axis: "#383835",
  ink: "#ededed",
  ink2: "#c3c2b7",
  muted: "#8b8b8b",
  s1: "#3987e5",
  s2: "#d95926",
  s3: "#199e70",
  pos: "#3987e5",
  neg: "#e66767",
  mid: "#383835",
  seq: ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"],
};
const FONT = `Geist, "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
const W = 1200;
/** Rough advance width of the sans at a given size, for gutters and fits. */
const textWidth = (s, size) => String(s ?? "").length * size * 0.56;

function frame(title, subtitle, height, body, footnote) {
  const sub = subtitle
    ? `<text x="40" y="78" font-size="17" fill="${C.ink2}">${escapeXml(subtitle)}</text>`
    : "";
  const foot = footnote
    ? `<text x="40" y="${height - 22}" font-size="14" fill="${C.muted}">${escapeXml(footnote)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family='${FONT}'>
<rect width="${W}" height="${height}" fill="${C.bg}"/>
<text x="40" y="50" font-size="26" font-weight="600" fill="${C.ink}">${escapeXml(title)}</text>
${sub}
${body}
${foot}
</svg>`;
}

/** Horizontal bars from a baseline, one colour, direct-labelled at the end. */
function barChart({ title, subtitle, rows, value, label, note, format = (v) => String(v), footnote, color = C.s1, max }) {
  const rowH = 34;
  const top = 108;
  const height = top + rows.length * rowH + 60;
  const gutter = Math.min(360, Math.max(...rows.map((r) => textWidth(label(r), 16))) + 60);
  const noteW = note ? 220 : 0;
  const plotW = W - gutter - 60 - noteW;
  const maxV = max ?? Math.max(...rows.map(value), 0.0001);
  const x = (v) => gutter + (v / maxV) * plotW;
  let body = `<line x1="${gutter}" y1="${top - 8}" x2="${gutter}" y2="${top + rows.length * rowH}" stroke="${C.axis}"/>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const v = value(r);
    const w = Math.max(0, x(v) - gutter);
    body += `<text x="${gutter - 12}" y="${y + 22}" font-size="16" fill="${C.ink}" text-anchor="end">${escapeXml(truncate(label(r), 34))}</text>`;
    body += `<rect x="${gutter + 1}" y="${y + 6}" width="${Math.max(w - 1, 0)}" height="${rowH - 12}" fill="${color}"/>`;
    body += `<text x="${gutter + w + 10}" y="${y + 22}" font-size="15" fill="${C.ink2}">${escapeXml(format(v))}</text>`;
    if (note) body += `<text x="${W - 40}" y="${y + 22}" font-size="14" fill="${C.muted}" text-anchor="end">${escapeXml(note(r))}</text>`;
  });
  return frame(title, subtitle, height, body, footnote);
}

/** Bars either side of a centre line: blue for above the baseline, red below. */
function divergingChart({ title, subtitle, rows, value, label, note, baseline = 0.5, span = 0.35, format, footnote }) {
  const rowH = 36;
  const top = 108;
  const height = top + rows.length * rowH + 64;
  const gutter = Math.min(320, Math.max(...rows.map((r) => textWidth(label(r), 16))) + 60);
  const noteW = note ? 240 : 0;
  const plotW = W - gutter - 60 - noteW;
  const centre = gutter + plotW / 2;
  const scale = plotW / 2 / span;
  let body = "";
  for (const t of [-span, -span / 2, 0, span / 2, span]) {
    const gx = centre + t * scale;
    body += `<line x1="${gx}" y1="${top - 10}" x2="${gx}" y2="${top + rows.length * rowH}" stroke="${t === 0 ? C.axis : C.grid}"/>`;
    body += `<text x="${gx}" y="${top - 16}" font-size="13" fill="${C.muted}" text-anchor="middle">${escapeXml(format ? format(baseline + t) : `${Math.round((baseline + t) * 100)}%`)}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const d = Math.max(-span, Math.min(span, value(r) - baseline));
    const w = Math.abs(d) * scale;
    const fill = d >= 0 ? C.pos : C.neg;
    const bx = d >= 0 ? centre + 1 : centre - w;
    body += `<text x="${gutter - 12}" y="${y + 23}" font-size="16" fill="${C.ink}" text-anchor="end">${escapeXml(truncate(label(r), 30))}</text>`;
    body += `<rect x="${bx}" y="${y + 7}" width="${Math.max(w - 1, 0)}" height="${rowH - 14}" fill="${fill}"/>`;
    const tx = d >= 0 ? centre + w + 10 : centre - w - 10;
    body += `<text x="${tx}" y="${y + 23}" font-size="15" fill="${C.ink2}" text-anchor="${d >= 0 ? "start" : "end"}">${escapeXml(format ? format(value(r)) : pct(value(r)))}</text>`;
    if (note) body += `<text x="${W - 40}" y="${y + 23}" font-size="14" fill="${C.muted}" text-anchor="end">${escapeXml(note(r))}</text>`;
  });
  return frame(title, subtitle, height, body, footnote);
}

/** A grid of shares on one blue ramp; the count sits in the cell in small type. */
function heatmap({ title, subtitle, rowIds, colIds, rowLabel, colLabel, cell, value, format, footnote, minN = 1, legend }) {
  const gutter = Math.min(240, Math.max(...rowIds.map((id) => textWidth(rowLabel(id), 15))) + 40);
  const top = 150;
  const size = Math.min(84, Math.floor((W - gutter - 60) / Math.max(colIds.length, 1)));
  const height = top + rowIds.length * size + 90;
  let body = "";
  colIds.forEach((c, j) => {
    const x = gutter + j * size + size / 2;
    body += `<text x="${x}" y="${top - 14}" font-size="14" fill="${C.ink2}" text-anchor="end" transform="rotate(-35 ${x} ${top - 14})">${escapeXml(truncate(colLabel(c), 14))}</text>`;
  });
  rowIds.forEach((r, i) => {
    const y = top + i * size;
    body += `<text x="${gutter - 12}" y="${y + size / 2 + 5}" font-size="15" fill="${C.ink}" text-anchor="end">${escapeXml(truncate(rowLabel(r), 20))}</text>`;
    colIds.forEach((c, j) => {
      const x = gutter + j * size;
      const v = cell(r, c);
      if (r === c || !v || v.n < minN) {
        body += `<rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" fill="${C.panel}"/>`;
        if (v && v.n > 0 && r !== c) body += `<text x="${x + size / 2}" y="${y + size / 2 + 5}" font-size="12" fill="${C.muted}" text-anchor="middle">n=${v.n}</text>`;
        return;
      }
      const t = Math.max(0, Math.min(1, value(v)));
      const step = C.seq[Math.round(t * (C.seq.length - 1))];
      const ink = t > 0.55 ? "#0a0a0a" : C.ink;
      body += `<rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" fill="${step}"/>`;
      body += `<text x="${x + size / 2}" y="${y + size / 2 + 1}" font-size="16" font-weight="600" fill="${ink}" text-anchor="middle">${escapeXml(format(v))}</text>`;
      body += `<text x="${x + size / 2}" y="${y + size / 2 + 19}" font-size="11" fill="${ink}" opacity="0.8" text-anchor="middle">n=${v.n}</text>`;
    });
  });
  const ly = top + rowIds.length * size + 30;
  C.seq.forEach((s, i) => {
    body += `<rect x="${gutter + i * 26}" y="${ly}" width="24" height="12" fill="${s}"/>`;
  });
  body += `<text x="${gutter + C.seq.length * 26 + 8}" y="${ly + 11}" font-size="13" fill="${C.muted}">${escapeXml(legend)}</text>`;
  return frame(title, subtitle, height, body, footnote);
}

/** Vertical columns, one series, optional emphasis on one column. */
function columnChart({ title, subtitle, labels, values, emphasis, footnote, format = (v) => String(v), height = 420 }) {
  const top = 110;
  const bottom = height - 70;
  const left = 70;
  const plotW = W - left - 40;
  const n = values.length;
  const gap = 4;
  const colW = plotW / n;
  const maxV = Math.max(...values, 1);
  let body = "";
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const gy = bottom - t * (bottom - top);
    body += `<line x1="${left}" y1="${gy}" x2="${W - 40}" y2="${gy}" stroke="${C.grid}"/>`;
    body += `<text x="${left - 10}" y="${gy + 5}" font-size="13" fill="${C.muted}" text-anchor="end">${escapeXml(format(Math.round(maxV * t)))}</text>`;
  }
  body += `<line x1="${left}" y1="${bottom}" x2="${W - 40}" y2="${bottom}" stroke="${C.axis}"/>`;
  values.forEach((v, i) => {
    const h = (v / maxV) * (bottom - top);
    const x = left + i * colW + gap / 2;
    const fill = emphasis == null || emphasis === i ? C.s1 : "#2b3f57";
    body += `<rect x="${x}" y="${bottom - h}" width="${colW - gap}" height="${h}" fill="${fill}"/>`;
    if (n <= 31 || i % Math.ceil(n / 24) === 0) {
      body += `<text x="${x + (colW - gap) / 2}" y="${bottom + 22}" font-size="13" fill="${C.muted}" text-anchor="middle">${escapeXml(labels[i])}</text>`;
    }
    if (emphasis === i) {
      body += `<text x="${x + (colW - gap) / 2}" y="${bottom - h - 8}" font-size="14" fill="${C.ink2}" text-anchor="middle">${escapeXml(format(v))}</text>`;
    }
  });
  return frame(title, subtitle, height, body, footnote);
}

/** Lines over time. Up to three series, each named at its right-hand end. */
function lineChart({ title, subtitle, xs, series, footnote, height = 460, format = (v) => String(Math.round(v)), xLabel }) {
  const top = 110;
  const bottom = height - 70;
  const left = 70;
  const right = W - 170;
  const allV = series.flatMap((s) => s.values).filter((v) => v != null);
  const minV = Math.min(...allV);
  const maxV = Math.max(...allV);
  const lo = minV === maxV ? minV - 1 : minV;
  const hi = minV === maxV ? maxV + 1 : maxV;
  const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const x = (i) => left + (i / Math.max(xs.length - 1, 1)) * (right - left);
  let body = "";
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const gy = bottom - t * (bottom - top);
    body += `<line x1="${left}" y1="${gy}" x2="${right}" y2="${gy}" stroke="${t === 0 ? C.axis : C.grid}"/>`;
    body += `<text x="${left - 10}" y="${gy + 5}" font-size="13" fill="${C.muted}" text-anchor="end">${escapeXml(format(lo + t * (hi - lo)))}</text>`;
  }
  const step = Math.max(1, Math.ceil(xs.length / 10));
  xs.forEach((label, i) => {
    if (i % step === 0 || i === xs.length - 1) {
      body += `<text x="${x(i)}" y="${bottom + 22}" font-size="13" fill="${C.muted}" text-anchor="middle">${escapeXml(xLabel ? xLabel(label) : label)}</text>`;
    }
  });
  const colors = [C.s1, C.s2, C.s3, "#c98500", "#d55181"];
  series.forEach((s, k) => {
    const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
    body += `<polyline points="${pts.join(" ")}" fill="none" stroke="${colors[k]}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const lastIndex = s.values.length - 1;
    const last = s.values[lastIndex];
    if (last != null) {
      body += `<circle cx="${x(lastIndex)}" cy="${y(last)}" r="4" fill="${colors[k]}" stroke="${C.bg}" stroke-width="2"/>`;
      body += `<text x="${right + 12}" y="${y(last) + 5 + (s.nudge ?? 0)}" font-size="14" fill="${C.ink2}">${escapeXml(truncate(s.name, 18))}</text>`;
    }
  });
  return frame(title, subtitle, height, body, footnote);
}

/** A row of big numbers. The whole chart is the figure. */
function statTiles({ title, subtitle, tiles, footnote }) {
  const perRow = 4;
  const rows = Math.ceil(tiles.length / perRow);
  const tileW = (W - 80 - (perRow - 1) * 16) / perRow;
  const tileH = 120;
  const height = 110 + rows * (tileH + 16) + 40;
  let body = "";
  tiles.forEach((t, i) => {
    const x = 40 + (i % perRow) * (tileW + 16);
    const y = 100 + Math.floor(i / perRow) * (tileH + 16);
    body += `<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" fill="${C.panel}"/>`;
    body += `<text x="${x + 20}" y="${y + 60}" font-size="44" font-weight="600" fill="${C.ink}">${escapeXml(t.value)}</text>`;
    body += `<text x="${x + 20}" y="${y + 92}" font-size="15" fill="${C.muted}">${escapeXml(t.label)}</text>`;
  });
  return frame(title, subtitle, height, body, footnote);
}

/** A ranked table as an image: rank, name, and up to four columns. */
function tableChart({ title, subtitle, columns, rows, footnote }) {
  const rowH = 40;
  const top = 108;
  const height = top + (rows.length + 1) * rowH + 60;
  const widths = columns.map((c) => c.width);
  let body = "";
  let x = 40;
  columns.forEach((c, j) => {
    const anchor = c.align === "right" ? "end" : "start";
    const tx = c.align === "right" ? x + widths[j] - 8 : x;
    body += `<text x="${tx}" y="${top}" font-size="13" fill="${C.muted}" text-anchor="${anchor}" letter-spacing="0.5">${escapeXml(c.header.toUpperCase())}</text>`;
    x += widths[j];
  });
  body += `<line x1="40" y1="${top + 12}" x2="${W - 40}" y2="${top + 12}" stroke="${C.axis}"/>`;
  rows.forEach((r, i) => {
    const y = top + (i + 1) * rowH + 10;
    let cx = 40;
    columns.forEach((c, j) => {
      const anchor = c.align === "right" ? "end" : "start";
      const tx = c.align === "right" ? cx + widths[j] - 8 : cx;
      const v = c.cell(r, i);
      body += `<text x="${tx}" y="${y + 4}" font-size="16" fill="${c.muted ? C.ink2 : C.ink}" text-anchor="${anchor}" font-weight="${c.bold ? 600 : 400}">${escapeXml(truncate(String(v ?? ""), c.max ?? 40))}</text>`;
      cx += widths[j];
    });
    body += `<line x1="40" y1="${y + 18}" x2="${W - 40}" y2="${y + 18}" stroke="${C.grid}"/>`;
  });
  return frame(title, subtitle, height, body, footnote);
}

// ── The report ───────────────────────────────────────────────────────

function build(a) {
  const charts = [];
  const findings = [];
  const add = (slug, svg, text) => {
    charts.push({ slug, svg });
    if (text) findings.push({ slug, text });
  };
  const o = a.overview;
  const kindName = (k) => cap(k === "other" ? "everything else" : k);

  // 0. Overview
  add(
    "00-overview",
    statTiles({
      title: "Scrandle so far",
      subtitle: `${o.daysOfGame} days of matchups, counting from the first one`,
      tiles: [
        { value: String(o.photographs), label: `photographs (${o.food} food, ${o.drinks} drink)` },
        { value: String(o.matchups), label: "matchups decided" },
        { value: String(o.votes), label: "votes cast" },
        { value: String(o.voters), label: "people who have voted" },
        { value: String(o.chefs), label: "people who have posted" },
        { value: String(o.rounds), label: "ranking rounds" },
        { value: String(o.contests), label: "caption contests" },
        { value: o.turnout.toFixed(1), label: "votes per matchup, on average" },
      ],
    }),
    [
      `**The numbers.** ${o.photographs} photographs have been ingested (${o.food} food, ${o.drinks} drink), and ${o.matchups} matchups have been decided by ${o.votes} votes from ${o.voters} people. The average matchup draws ${o.turnout.toFixed(1)} votes.`,
    ]
  );

  // 1. Food kind bias
  const foodKinds = a.foodKinds.filter((k) => k.n >= MIN_VOTES);
  if (foodKinds.length >= 2) {
    const loved = foodKinds[0];
    const hated = foodKinds[foodKinds.length - 1];
    const thin = a.foodKinds.filter((k) => k.n < MIN_VOTES && k.n > 0).map((k) => kindName(k.kind));
    add(
      "01-food-bias",
      divergingChart({
        title: "What the channel is biased for and against",
        subtitle: "Share of votes each kind of plate wins when it meets a different kind. 50% is no bias at all.",
        rows: foodKinds,
        value: (k) => k.share,
        label: (k) => kindName(k.kind),
        note: (k) => `${k.won} of ${k.n} votes · ${k.dishes ?? 0} plates`,
        footnote: `Same-kind matchups are left out (a pasta beating a pasta says nothing about pasta). Kinds with under ${MIN_VOTES} cross-kind votes are not shown${thin.length ? `: ${thin.join(", ")}` : ""}.`,
      }),
      [
        `**${kindName(loved.kind)} is the channel's weakness.** When a ${loved.kind === "other" ? "plate of nothing in particular" : loved.kind} goes up against any other kind of plate it wins ${pct(loved.share)} of the votes (${loved.won} of ${loved.n}).`,
        `**${kindName(hated.kind)} is the channel's blind spot.** It wins only ${pct(hated.share)} of cross-kind votes (${hated.won} of ${hated.n})${hated.top ? `, though the best of it — ${a.dishLabel(hated.top)} by ${a.nameOf(hated.top.poster_discord_id)}, rated ${Math.round(hated.top.elo)} — holds its own` : ""}.`,
        ...foodKinds
          .filter((k) => k !== loved && k !== hated && Math.abs(k.share - 0.5) >= 0.12)
          .map((k) => `${kindName(k.kind)} ${k.share > 0.5 ? "wins" : "loses"} ${pct(Math.max(k.share, 1 - k.share))} of the time against other kinds.`),
      ]
    );

    // Rating by kind
    const byRating = [...foodKinds].filter((k) => k.dishes >= 2).sort((x, y) => y.rating - x.rating);
    if (byRating.length >= 2) {
      add(
        "02-food-rating-by-kind",
        divergingChart({
          title: "Average rating by kind of plate",
          subtitle: "Mean Glicko rating of every rated plate of that kind, against the 1500 everything starts on",
          rows: byRating,
          value: (k) => k.rating,
          baseline: 1500,
          span: Math.max(60, ...byRating.map((k) => Math.abs(k.rating - 1500))) * 1.1,
          format: (v) => String(Math.round(v)),
          label: (k) => kindName(k.kind),
          note: (k) => `${k.dishes} rated plates`,
          footnote: "The vote share above is what people pick; this is where the ratings have settled. They differ where a kind has a few stars and a lot of also-rans.",
        })
      );
    }
  }

  // 3. Kind versus kind
  if (a.foodMatrix.kinds.length >= 3) {
    add(
      "03-kind-vs-kind",
      heatmap({
        title: "Kind against kind",
        subtitle: "Share of votes the row wins when it meets the column",
        rowIds: a.foodMatrix.kinds,
        colIds: a.foodMatrix.kinds,
        rowLabel: kindName,
        colLabel: kindName,
        cell: a.foodMatrix.cell,
        value: (v) => v.won / v.n,
        format: (v) => pct(v.won / v.n),
        minN: Math.max(5, Math.floor(MIN_VOTES / 3)),
        legend: "row loses every vote → row wins every vote · dim cells have too few votes",
        footnote: "Read across: the pizza row against the pasta column is how often a pizza beat a pasta.",
      }),
      (() => {
        let best = null;
        for (const r of a.foodMatrix.kinds) {
          for (const c of a.foodMatrix.kinds) {
            const v = r === c ? null : a.foodMatrix.cell(r, c);
            if (v && v.n >= MIN_VOTES / 2 && (!best || v.won / v.n > best.share)) best = { r, c, share: v.won / v.n, ...v };
          }
        }
        return best
          ? [`**The most lopsided rivalry is ${best.r} over ${best.c}.** ${cap(best.r)} has taken ${best.won} of the ${best.n} votes cast between the two kinds (${pct(best.share)}).`]
          : [];
      })()
    );
  }

  // 4. Drinks
  const drinkKinds = a.drinkKinds.filter((k) => k.n >= MIN_VOTES / 2);
  if (drinkKinds.length >= 2) {
    add(
      "04-drink-bias",
      divergingChart({
        title: "Drinks: what wins at happy hour",
        subtitle: "Share of votes each kind of drink wins against a different kind",
        rows: drinkKinds,
        value: (k) => k.share,
        label: (k) => kindName(k.kind),
        note: (k) => `${k.won} of ${k.n} votes · ${k.dishes ?? 0} drinks`,
      }),
      [
        `**At the bar, ${drinkKinds[0].kind} wins.** It takes ${pct(drinkKinds[0].share)} of cross-kind drink votes; ${drinkKinds[drinkKinds.length - 1].kind} takes ${pct(drinkKinds[drinkKinds.length - 1].share)}.`,
      ]
    );
  }

  // 5. Chefs
  const chefsRated = a.chefs.filter((c) => c.faced >= MIN_VOTES);
  if (chefsRated.length >= 2) {
    const byShare = [...chefsRated].sort((x, y) => y.share - x.share);
    add(
      "05-chef-win-rate",
      divergingChart({
        title: "Whose cooking wins",
        subtitle: "Share of votes each person's plates win when they meet somebody else's",
        rows: byShare,
        value: (c) => c.share,
        label: (c) => c.name,
        note: (c) => `${c.won} of ${c.faced} votes · ${c.posted} posted`,
        footnote: "Plates against the same person's plates are left out. A photograph that has never been drawn contributes nothing yet.",
      }),
      [
        `**${byShare[0].name} is the cook to beat.** Their plates win ${pct(byShare[0].share)} of the votes cast against somebody else's (${byShare[0].won} of ${byShare[0].faced}).${byShare[0].signature ? ` Their signature is ${byShare[0].signature.kind === "other" ? "not any one thing" : byShare[0].signature.kind} (${byShare[0].signature.n} of ${byShare[0].food} food posts).` : ""}`,
        `**${byShare[byShare.length - 1].name} is the underdog.** ${pct(byShare[byShare.length - 1].share)} of the votes, over ${byShare[byShare.length - 1].faced} cast${byShare[byShare.length - 1].best ? `, but ${a.dishLabel(byShare[byShare.length - 1].best)} (rated ${Math.round(byShare[byShare.length - 1].best.elo)}) is nothing to be ashamed of` : ""}.`,
      ]
    );
    add(
      "06-chef-table",
      tableChart({
        title: "The cooks",
        subtitle: "Everyone who has posted, by volume",
        columns: [
          { header: "#", width: 40, cell: (_, i) => i + 1, muted: true },
          { header: "Cook", width: 200, cell: (c) => c.name, bold: true, max: 20 },
          { header: "Posted", width: 90, cell: (c) => c.posted, align: "right" },
          { header: "Rated", width: 90, cell: (c) => c.rated, align: "right" },
          { header: "Avg rating", width: 110, cell: (c) => (c.rated ? Math.round(c.rating) : "–"), align: "right" },
          { header: "Win share", width: 110, cell: (c) => (c.faced ? pct(c.share) : "–"), align: "right" },
          { header: "Signature", width: 140, cell: (c) => (c.signature ? kindName(c.signature.kind) : "–"), muted: true },
          { header: "Best plate", width: 340, cell: (c) => (c.best ? `${a.dishLabel(c.best)} (${Math.round(c.best.elo)})` : "–"), muted: true, max: 38 },
        ],
        rows: a.chefs.slice(0, 14),
      })
    );
  }
  if (a.chefMatrix.ids.length >= 3) {
    add(
      "07-chef-vs-chef",
      heatmap({
        title: "Cook against cook",
        subtitle: "When the row's plate meets the column's plate, how often the row wins",
        rowIds: a.chefMatrix.ids,
        colIds: a.chefMatrix.ids,
        rowLabel: a.nameOf,
        colLabel: a.nameOf,
        cell: a.chefMatrix.cell,
        value: (v) => v.won / v.n,
        format: (v) => pct(v.won / v.n),
        minN: Math.max(5, Math.floor(MIN_VOTES / 3)),
        legend: "row never wins → row always wins",
      }),
      (() => {
        let best = null;
        for (const r of a.chefMatrix.ids) {
          for (const c of a.chefMatrix.ids) {
            const v = r === c ? null : a.chefMatrix.cell(r, c);
            if (v && v.n >= MIN_VOTES / 2 && (!best || v.won / v.n > best.share)) best = { r, c, share: v.won / v.n, ...v };
          }
        }
        return best
          ? [`**${a.nameOf(best.r)} owns ${a.nameOf(best.c)}.** Head to head, ${a.nameOf(best.r)}'s plates have taken ${best.won} of ${best.n} votes (${pct(best.share)}).`]
          : [];
      })()
    );
  }

  // 8. Voters
  const votersActive = a.voters.filter((v) => v.judged >= MIN_VOTES);
  if (votersActive.length >= 2) {
    const byAgreement = [...votersActive].sort((x, y) => y.agreement - x.agreement);
    const consensus = byAgreement[0];
    const contrarian = byAgreement[byAgreement.length - 1];
    add(
      "08-voter-agreement",
      barChart({
        title: "Who votes with the room",
        subtitle: "How often each voter's pick was the matchup's eventual winner",
        rows: byAgreement,
        value: (v) => v.agreement,
        label: (v) => v.name,
        format: pct,
        max: 1,
        note: (v) => `${v.agreed} of ${v.judged} decided matchups`,
        footnote: "Only matchups with at least three votes and a clear winner count. Your own vote is part of the majority, so nobody can score zero.",
      }),
      [
        `**${consensus.name} is the voice of the room.** Their pick wins ${pct(consensus.agreement)} of the time. **${contrarian.name} is the contrarian**, on the winning side only ${pct(contrarian.agreement)} of the time.`,
      ]
    );

    const loyal = a.voters.filter((v) => v.ownOnBoard >= 5 && v.loyalty != null).sort((x, y) => y.loyalty - x.loyalty);
    if (loyal.length >= 2) {
      add(
        "09-self-votes",
        barChart({
          title: "Voting for your own dinner",
          subtitle: "When a voter's own plate is on the board, how often they pick it",
          rows: loyal,
          value: (v) => v.loyalty,
          label: (v) => v.name,
          format: pct,
          max: 1,
          note: (v) => `${v.ownPicked} of ${v.ownOnBoard} chances`,
          color: C.s2,
        }),
        [
          `**${loyal[0].name} backs themselves.** They vote for their own plate ${pct(loyal[0].loyalty)} of the time it is up (${loyal[0].ownPicked} of ${loyal[0].ownOnBoard}). ${loyal[loyal.length - 1].name} does it ${pct(loyal[loyal.length - 1].loyalty)} of the time${loyal[loyal.length - 1].loyalty < 0.5 ? " — voting against their own cooking more often than not" : ""}.`,
        ]
      );
    }

    const quick = [...votersActive].sort((x, y) => x.medianDelay - y.medianDelay);
    const fmtDelay = (m) => (m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
    add(
      "10-voter-speed",
      barChart({
        title: "How fast people vote",
        subtitle: "Median time from a matchup going up to each person's vote landing",
        rows: quick,
        value: (v) => v.medianDelay,
        label: (v) => v.name,
        format: fmtDelay,
        note: (v) => `busiest hour ${String(v.peakHour).padStart(2, "0")}:00 · ${v.votes} votes`,
        color: C.s3,
      }),
      [
        `**${quick[0].name} is the early bird**, voting a median ${fmtDelay(quick[0].medianDelay)} after a matchup opens. **${quick[quick.length - 1].name} takes ${fmtDelay(quick[quick.length - 1].medianDelay)}.**`,
      ]
    );

    const tastes = votersActive.filter((v) => v.loves && v.hates && v.loves !== v.hates);
    if (tastes.length) {
      add(
        "11-voter-tastes",
        tableChart({
          title: "Personal taste",
          subtitle: "The kind each voter picks more than the room does, and the one they pick less",
          columns: [
            { header: "Voter", width: 200, cell: (v) => v.name, bold: true, max: 20 },
            { header: "Soft spot", width: 200, cell: (v) => kindName(v.loves.kind) },
            { header: "Their share", width: 130, cell: (v) => pct(v.loves.share), align: "right" },
            { header: "vs room", width: 110, cell: (v) => signed(v.loves.lift * 100) + "%", align: "right", muted: true },
            { header: "Blind spot", width: 200, cell: (v) => kindName(v.hates.kind) },
            { header: "Their share", width: 130, cell: (v) => pct(v.hates.share), align: "right" },
            { header: "vs room", width: 110, cell: (v) => signed(v.hates.lift * 100) + "%", align: "right", muted: true },
          ],
          rows: tastes,
          footnote: "Share is the kind's win rate in that voter's own ballots against other kinds; vs room is the gap to everybody's win rate for it.",
        }),
        tastes.slice(0, 4).map(
          (v) =>
            `${v.name} picks ${v.loves.kind} ${signed(v.loves.lift * 100)}% more often than the room does, and ${v.hates.kind} ${signed(v.hates.lift * 100)}%.`
        )
      );
    }
  }

  // 12. Voter → chef affinity
  if (a.affinity.voterIds.length >= 2 && a.affinity.chefIds.length >= 2) {
    add(
      "12-voter-chef-affinity",
      heatmap({
        title: "Who votes for whom",
        subtitle: "Each voter's share for a cook's plates, relative to what everybody gives that cook",
        rowIds: a.affinity.voterIds,
        colIds: a.affinity.chefIds,
        rowLabel: a.nameOf,
        colLabel: a.nameOf,
        cell: a.affinity.cell,
        value: (v) => 0.5 + v.lift / 0.5,
        format: (v) => signed(v.lift * 100) + "%",
        minN: Math.max(5, Math.floor(MIN_VOTES / 3)),
        legend: "−25% (cooler than the room) → +25% (warmer than the room)",
        footnote: "Rows are voters, columns are cooks. A cell is voter minus room, so a voter's own column is how much they favour themselves.",
      }),
      (() => {
        let warm = null;
        let cold = null;
        for (const v of a.affinity.voterIds) {
          for (const c of a.affinity.chefIds) {
            if (v === c) continue;
            const cell = a.affinity.cell(v, c);
            if (!cell || cell.n < MIN_VOTES / 2) continue;
            if (!warm || cell.lift > warm.lift) warm = { v, c, ...cell };
            if (!cold || cell.lift < cold.lift) cold = { v, c, ...cell };
          }
        }
        const lines = [];
        if (warm) lines.push(`**${a.nameOf(warm.v)} is ${a.nameOf(warm.c)}'s biggest fan**, picking their plates ${signed(warm.lift * 100)}% more often than the room does (${warm.won} of ${warm.n}).`);
        if (cold) lines.push(`**${a.nameOf(cold.v)} is ${a.nameOf(cold.c)}'s toughest critic**, at ${signed(cold.lift * 100)}% against the room (${cold.won} of ${cold.n}).`);
        return lines;
      })()
    );
  }

  // 13. Time
  if (a.weekly.length >= 3) {
    const short = (w) => dayOf(Date.parse(`${w}T12:00:00Z`));
    add(
      "13-weekly-posts",
      lineChart({
        title: "Photographs posted per week",
        subtitle: "Food and drink, by the week they were posted to the channel",
        xs: a.weekly.map((w) => w.week),
        xLabel: short,
        series: [
          { name: "Food", values: a.weekly.map((w) => w.food) },
          { name: "Drink", values: a.weekly.map((w) => w.drink), nudge: 16 },
        ],
      })
    );
    const weeksWithVotes = a.weekly.filter((w) => w.matchups > 0);
    if (weeksWithVotes.length >= 3) {
      add(
        "14-weekly-turnout",
        lineChart({
          title: "Votes per matchup, week by week",
          subtitle: "Is the room still turning up? Votes cast that week divided by matchups opened that week",
          xs: weeksWithVotes.map((w) => w.week),
          xLabel: short,
          series: [{ name: "Votes per matchup", values: weeksWithVotes.map((w) => w.votes / w.matchups) }],
          format: (v) => v.toFixed(1),
        }),
        (() => {
          const recent = weeksWithVotes.slice(-3);
          const earlier = weeksWithVotes.slice(0, -3);
          if (!earlier.length) return [];
          const r = mean(recent.map((w) => w.votes / w.matchups));
          const e = mean(earlier.map((w) => w.votes / w.matchups));
          return [`**Turnout is ${r >= e ? "holding" : "sliding"}.** The last three weeks averaged ${r.toFixed(1)} votes a matchup against ${e.toFixed(1)} before that.`];
        })()
      );
    }
  }
  const peakPost = a.postHours.indexOf(Math.max(...a.postHours));
  add(
    "15-post-hours",
    columnChart({
      title: "When the channel eats",
      subtitle: `Food photographs by hour of the day they were posted (${TIME_ZONE})`,
      labels: Array.from({ length: 24 }, (_, h) => `${h}`),
      values: a.postHours,
      emphasis: peakPost,
      height: 400,
    }),
    [
      `**Dinner is at ${peakPost}:00.** That is the hour most food gets posted; ${pct(sum(a.postHours.slice(17, 22)) / Math.max(1, sum(a.postHours)))} of it lands between 5pm and 10pm.`,
    ]
  );
  const peakVote = a.voteHours.indexOf(Math.max(...a.voteHours));
  add(
    "16-vote-hours",
    columnChart({
      title: "When the channel votes",
      subtitle: `Votes by hour of the day (${TIME_ZONE})`,
      labels: Array.from({ length: 24 }, (_, h) => `${h}`),
      values: a.voteHours,
      emphasis: peakVote,
      height: 400,
    }),
    [`Votes peak at ${peakVote}:00, with ${pct(a.voteHours[peakVote] / Math.max(1, sum(a.voteHours)))} of all votes cast in that hour.`]
  );
  const dayValues = WEEKDAYS.map((d) => a.postDays[d]);
  add(
    "17-post-weekdays",
    columnChart({
      title: "Which days people cook",
      subtitle: "Food photographs by day of the week",
      labels: WEEKDAYS,
      values: dayValues,
      emphasis: dayValues.indexOf(Math.max(...dayValues)),
      height: 380,
    }),
    [`**${WEEKDAYS[dayValues.indexOf(Math.max(...dayValues))]} is cooking night**, and ${WEEKDAYS[dayValues.indexOf(Math.min(...dayValues))]} is the quietest.`]
  );

  // 18. Ratings
  if (a.foodRated.length >= 5) {
    const top = a.foodRated.slice(0, 12);
    add(
      "18-top-food",
      barChart({
        title: "The best plates",
        subtitle: "Highest-rated food photographs, and who cooked them",
        rows: top,
        value: (d) => d.elo - 1400,
        max: Math.max(...top.map((d) => d.elo)) - 1400,
        label: (d) => a.dishLabel(d),
        format: (v) => String(Math.round(v + 1400)),
        note: (d) => `${a.nameOf(d.poster_discord_id)} · ${d.matches_played} games · ±${Math.round(d.rd)}`,
        footnote: "Bars start at 1400. ± is the rating's deviation: the wider it is, the fewer times the plate has been judged.",
      }),
      [
        `**${a.dishLabel(top[0])} by ${a.nameOf(top[0].poster_discord_id)} is the top-rated plate**, at ${Math.round(top[0].elo)} after ${top[0].matches_played} outings.`,
      ]
    );
    const bins = new Array(12).fill(0);
    const lo = 1200;
    const width = 50;
    for (const d of a.foodRated) bins[Math.max(0, Math.min(11, Math.floor((d.elo - lo) / width)))] += 1;
    add(
      "19-rating-distribution",
      columnChart({
        title: "Where the ratings sit",
        subtitle: "Rated food photographs by Glicko rating, in bands of 50",
        labels: bins.map((_, i) => `${lo + i * width}`),
        values: bins,
        height: 380,
        footnote: "Everything starts at 1500. The spread is how far the votes have moved things.",
      })
    );
  }
  if (a.trajectories.length >= 2) {
    const dates = [...new Set(a.trajectories.flatMap((t) => t.points.map((p) => p.at)))].sort((x, y) => x - y);
    const series = a.trajectories.map((t) => {
      let last = null;
      const byAt = new Map(t.points.map((p) => [p.at, p.elo]));
      return {
        name: `${a.dishLabel(t.dish)}`,
        values: dates.map((at) => {
          if (byAt.has(at)) last = byAt.get(at);
          return last;
        }),
      };
    });
    series.forEach((s, i) => {
      s.nudge = 0;
      const lastV = s.values[s.values.length - 1];
      series.slice(0, i).forEach((prev) => {
        if (Math.abs(prev.values[prev.values.length - 1] - lastV) < 25) s.nudge += 16;
      });
    });
    add(
      "20-rating-trajectories",
      lineChart({
        title: "How the top plates got there",
        subtitle: "Rating after every matchup and round the current top five have been in",
        xs: dates,
        xLabel: (at) => dayOf(at),
        series,
        footnote: "Glicko moves a new plate a long way on its first result and less each time after; the flattening is the deviation narrowing.",
      })
    );
  }

  // 21. Matchup trivia
  const trivia = [];
  if (a.upsets.length) {
    const u = a.upsets[0];
    trivia.push(`**Biggest upset:** ${a.dishLabel(u.winner)} (${a.nameOf(u.winner.poster_discord_id)}, rated ${Math.round(u.loser.elo === undefined ? 0 : u.m.dish_a_id === u.winner.id ? u.m.elo_a_before : u.m.elo_b_before)}) beat ${a.dishLabel(u.loser)} (${a.nameOf(u.loser.poster_discord_id)}, rated ${Math.round(u.m.dish_a_id === u.loser.id ? u.m.elo_a_before : u.m.elo_b_before)}) ${u.m.votes_a > u.m.votes_b ? u.m.votes_a : u.m.votes_b}–${Math.min(u.m.votes_a, u.m.votes_b)}, a ${Math.round(u.gap)}-point gap the wrong way.`);
  }
  if (a.closest.length) {
    const c = a.closest[0];
    const da = a.dishes.get(c.m.dish_a_id);
    const db = a.dishes.get(c.m.dish_b_id);
    if (da && db) trivia.push(`**Closest call:** ${a.dishLabel(da)} v ${a.dishLabel(db)} finished ${c.m.votes_a}–${c.m.votes_b}.`);
  }
  if (a.landslides.length) {
    const l = a.landslides[0];
    const winner = a.dishes.get(l.m.votes_a > 0 ? l.m.dish_a_id : l.m.dish_b_id);
    const loser = a.dishes.get(l.m.votes_a > 0 ? l.m.dish_b_id : l.m.dish_a_id);
    if (winner && loser) trivia.push(`**Biggest landslide:** ${a.dishLabel(winner)} (${a.nameOf(winner.poster_discord_id)}) beat ${a.dishLabel(loser)} ${l.total}–0.`);
  }
  if (a.roundStats.length) {
    const sorted = [...a.roundStats].filter((r) => r.voters >= 3).sort((x, y) => y.consensus - x.consensus);
    if (sorted.length) {
      trivia.push(`**Most agreed ranking round:** the ${sorted[0].kind} round on ${dayOf(sorted[0].r.created_at)}, where ${pct(sorted[0].consensus)} of ${sorted[0].voters} voters put the same photograph first. **Most divisive:** the ${sorted[sorted.length - 1].kind} round on ${dayOf(sorted[sorted.length - 1].r.created_at)}, at ${pct(sorted[sorted.length - 1].consensus)}.`);
    }
  }
  if (trivia.length) findings.push({ slug: "trivia", text: trivia });

  // 22. Captions
  if (a.captionTable.length >= 2) {
    add(
      "22-captions",
      tableChart({
        title: "Caption contest form guide",
        subtitle: "Wins, entries, and Borda points per entry — the bot's own caption plays too",
        columns: [
          { header: "#", width: 40, cell: (_, i) => i + 1, muted: true },
          { header: "Writer", width: 220, cell: (c) => c.name, bold: true, max: 22 },
          { header: "Wins", width: 90, cell: (c) => c.wins, align: "right" },
          { header: "Entries", width: 90, cell: (c) => c.entries, align: "right" },
          { header: "Pts / entry", width: 110, cell: (c) => c.perEntry.toFixed(1), align: "right" },
          { header: "Best winning line", width: 570, cell: (c) => (c.best ? `“${c.best.text}”` : "–"), muted: true, max: 62 },
        ],
        rows: a.captionTable.slice(0, 12),
      }),
      (() => {
        const bot = a.captionTable.find((c) => c.id === "bot");
        const human = a.captionTable.find((c) => c.id !== "bot");
        const lines = [`**${a.captionTable[0].name} writes the best captions**, with ${a.captionTable[0].wins} win${a.captionTable[0].wins === 1 ? "" : "s"} from ${a.captionTable[0].entries} entries.`];
        if (bot && human) lines.push(`The bot's own captions have won ${bot.wins} contest${bot.wins === 1 ? "" : "s"} and average ${bot.perEntry.toFixed(1)} points an entry, against ${human.perEntry.toFixed(1)} for ${human.name}.`);
        return lines;
      })()
    );
  }

  return { charts, findings };
}

// ── Output ───────────────────────────────────────────────────────────

function markdown(findings, charts) {
  const lines = ["# Scrandle insights", "", `Generated ${new Date().toISOString().slice(0, 10)}.`, ""];
  for (const f of findings) {
    const chart = charts.find((c) => c.slug === f.slug);
    if (chart) lines.push(`## ${chart.svg.match(/font-weight="600" fill="#ededed">([^<]+)</)?.[1] ?? f.slug}`, "");
    for (const t of f.text) lines.push(`- ${t}`);
    lines.push("");
  }
  return lines.join("\n");
}

function html(findings, charts) {
  const md = (s) => escapeXml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const sections = charts
    .map((c) => {
      const f = findings.find((x) => x.slug === c.slug);
      const text = f ? `<ul>${f.text.map((t) => `<li>${md(t)}</li>`).join("")}</ul>` : "";
      return `<section id="${c.slug}"><img src="${c.slug}.png" alt="${c.slug}" width="${W}">${text}</section>`;
    })
    .join("\n");
  const trivia = findings.find((f) => f.slug === "trivia");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Scrandle insights</title>
<style>
  body { background: #0a0a0a; color: #ededed; font-family: ${FONT}; margin: 0; padding: 32px; }
  main { max-width: 1200px; margin: 0 auto; }
  section { margin: 0 0 48px; }
  img { display: block; max-width: 100%; height: auto; }
  ul { margin: 12px 0 0; padding-left: 20px; color: #c3c2b7; line-height: 1.5; }
  strong { color: #ededed; }
  h1 { font-weight: 600; }
</style></head><body><main>
<h1>Scrandle insights</h1>
<p style="color:#8b8b8b">Generated ${new Date().toISOString().slice(0, 10)}.</p>
${sections}
${trivia ? `<section><h2>Trivia</h2><ul>${trivia.text.map((t) => `<li>${md(t)}</li>`).join("")}</ul></section>` : ""}
</main></body></html>`;
}

async function render(charts) {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.warn("sharp is not installed (run `npm install` at the repo root); writing SVG only.");
  }
  for (const c of charts) {
    writeFileSync(join(OUT_DIR, `${c.slug}.svg`), c.svg);
    if (sharp) {
      await sharp(Buffer.from(c.svg), { density: 144 }).png().toFile(join(OUT_DIR, `${c.slug}.png`));
    }
  }
}

// ── Posting to Discord ───────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One message per chart: the findings as the text, the PNG attached. A
 * webhook allows a handful of posts a second, so a 429 is waited out rather
 * than treated as a failure.
 */
async function postToDiscord(charts, findings, title) {
  const heading = (svg) => svg.match(/font-weight="600" fill="#ededed">([^<]+)</)?.[1];
  const messages = [
    { content: `**${title}**`, files: [] },
    ...charts.map((c) => {
      const f = findings.find((x) => x.slug === c.slug);
      const text = [`**${heading(c.svg) ?? c.slug}**`, ...(f?.text ?? [])].join("\n");
      return { content: text.slice(0, 1900), files: [`${c.slug}.png`] };
    }),
  ];
  const trivia = findings.find((f) => f.slug === "trivia");
  if (trivia) messages.push({ content: ["**Trivia**", ...trivia.text].join("\n").slice(0, 1900), files: [] });

  let sent = 0;
  for (const m of messages) {
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: m.content,
        allowed_mentions: { parse: [] },
        attachments: m.files.map((name, id) => ({ id, filename: name })),
      })
    );
    m.files.forEach((name, id) => {
      form.append(`files[${id}]`, new Blob([readFileSync(join(OUT_DIR, name))], { type: "image/png" }), name);
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(WEBHOOK, { method: "POST", body: form });
      if (response.status === 429) {
        const wait = Number((await response.json().catch(() => ({}))).retry_after ?? 2) * 1000;
        await sleep(wait + 250);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Discord refused a post (${response.status}): ${await response.text()}`);
      }
      sent += 1;
      break;
    }
    await sleep(400);
  }
  console.log(`Posted ${sent} of ${messages.length} messages to Discord.`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let data;
  if (FROM) {
    data = JSON.parse(readFileSync(resolve(FROM), "utf8"));
  } else {
    console.log(`Pulling the ${LOCAL ? "local" : "remote"} scrandle database…`);
    data = pull();
    writeFileSync(join(OUT_DIR, "data.json"), JSON.stringify(data));
  }
  const counts = Object.entries(data).map(([k, v]) => `${k} ${v.length}`).join(", ");
  console.log(`Loaded: ${counts}`);
  if (!data.matchups?.length) {
    console.log("No matchups yet; nothing to chart.");
    return;
  }
  const analysis = analyse(data);
  const { charts, findings } = build(analysis);
  await render(charts);
  writeFileSync(join(OUT_DIR, "insights.md"), markdown(findings, charts));
  writeFileSync(join(OUT_DIR, "report.html"), html(findings, charts));
  console.log(`Wrote ${charts.length} charts and the report to ${OUT_DIR}`);
  if (POST) {
    if (!WEBHOOK) {
      throw new Error(
        "--post needs a webhook: pass --webhook <url>, set DISCORD_LOG_WEBHOOK_URL, or put it in scrandle-worker/.dev.vars"
      );
    }
    await postToDiscord(charts, findings, `Scrandle insights, ${new Date().toISOString().slice(0, 10)}`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
