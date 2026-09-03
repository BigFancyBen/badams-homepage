import {
  ACTS,
  ACT_WEEKS,
  BUILDINGS,
  RELICS,
  WORKER_KINDS,
  type BuildingKey,
  type WorkerKind,
} from "./config.ts";
import { getSkills, isFresh } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { getRelics } from "./relics.ts";
import { proposalBlock, proposeRaid, raidLine } from "./raids.ts";
import { actForWeek, campaignWeek } from "./schedule.ts";
import {
  build,
  buildOptions,
  buildingDef,
  costLine,
  getBuildings,
  getStores,
  getTown,
  getWorkers,
  nextWorkerTier,
  recruit,
  repair,
  sackCapHours,
  slotsFor,
  storesLine,
  tierKeyForOwner,
  upgradeWorker,
  workerLabel,
  workerRate,
  workerTierDef,
} from "./town.ts";
import { buttonRow, buttonRows, type Button, type DiscordUser, type Env, type Player } from "./types.ts";
import { castBallot, getOptions, getVote, voteSummary } from "./votes.ts";
import { levelForXp } from "./xp.ts";
import { combatLevel, levelsOf } from "./combat.ts";

/**
 * The town's buttons and the group's votes: everything a fresh player can
 * do that is not a check-in. Every handler here takes a player the caller
 * has already gated (see requireFresh in interactions.ts).
 */

export interface Line {
  content: string;
  components?: unknown[];
}

function actNow(env: Env, day: string): number {
  return actForWeek(campaignWeek(day, env.CAMPAIGN_START), ACT_WEEKS, ACTS.length);
}

// ── The town view ──────────────────────────────────────────────────

export async function townView(env: Env, player: Player, day: string, now: number): Promise<Line> {
  const town = await getTown(env);
  const stores = await getStores(env);
  const lines: string[] = [];
  const components: unknown[] = [];

  if (town.level < 1) {
    lines.push(`🏕️ **The camp** holds ${storesLine(stores)}.`);
    lines.push("Every check-in hauls coins and logs. Workers, buildings and build votes arrive at Founding I.");
    const raid = await raidLine(env);
    if (raid) lines.push(raid);
    return { content: lines.join("\n") };
  }

  const buildings = await getBuildings(env);
  const relics = await getRelics(env);
  lines.push(`🏘️ **The town** (Town Hall ${town.level}) holds ${storesLine(stores)}.`);

  const built = [...buildings.values()].filter((row) => row.level > 0 && row.key !== "town_hall");
  if (built.length > 0) {
    lines.push(
      "Buildings: " +
        built
          .map((row) => `${buildingDef(row.key)?.name ?? row.key} L${row.level}${row.condition < 100 ? ` (${row.condition}%)` : ""}`)
          .join(" · ")
    );
  } else {
    lines.push("No buildings yet. The Monday build vote decides what goes up.");
  }
  if (relics.size > 0) {
    lines.push(`Relics: ${[...relics].map((key) => RELICS.find((r) => r.key === key)?.name ?? key).join(", ")}.`);
  }

  const skills = await getSkills(env, player.discord_id);
  const hp = combatLevel(levelsOf(skills, levelForXp));
  const mine = await getWorkers(env, player.discord_id);
  const cap = sackCapHours(buildings);
  if (mine.length > 0) {
    lines.push(`Your workers (${mine.length}/${slotsFor(hp)}):`);
    for (const worker of mine) {
      const rate = workerRate(worker, buildings, town, relics, now);
      const full = worker.sack >= rate * cap * 0.99;
      lines.push(
        `  ${workerLabel(worker)} — sack ${Math.floor(worker.sack)}${full ? " (full)" : ""}, ${rate.toFixed(1)}/h${worker.fed ? "" : ", hungry"}`
      );
    }
    lines.push("Sacks empty into the town on your check-in.");
  } else {
    lines.push(`You have no workers (${slotsFor(hp)} slot${slotsFor(hp) === 1 ? "" : "s"}).`);
  }
  const all = await getWorkers(env);
  const townOwned = all.filter((w) => !w.owner_id).length;
  lines.push(`Town workers: ${all.length} in all${townOwned > 0 ? `, ${townOwned} working for the town while their owners are away` : ""}.`);

  const raid = await raidLine(env);
  if (raid) lines.push(raid);

  const fresh = isFresh(player, day);
  const buttons: Button[] = [
    { label: "Recruit", custom_id: "recruit", style: 3, disabled: !fresh },
    { label: "Upgrade", custom_id: "upg", style: 2, disabled: !fresh || mine.length === 0 },
    { label: "Build", custom_id: "build", style: 2, disabled: !fresh },
    { label: "Repair", custom_id: "repair", style: 2, disabled: !fresh || built.every((row) => row.condition >= 100) },
    { label: "Votes", custom_id: "vote", style: 2 },
  ];
  components.push(buttonRow(buttons));
  if (!fresh) lines.push("Check in to act — a check-in in the last four days unlocks the buttons.");
  return { content: lines.join("\n"), components };
}

// ── Recruit / upgrade / build / repair ─────────────────────────────

export async function recruitMenu(env: Env, player: Player, day: string): Promise<Line> {
  const town = await getTown(env);
  if (town.level < 1) return { content: "Workers arrive at Founding I." };
  const skills = await getSkills(env, player.discord_id);
  const hp = combatLevel(levelsOf(skills, levelForXp));
  const mine = await getWorkers(env, player.discord_id);
  const cost = mine.length === 0 ? 0 : 300 * mine.length;
  void day;
  return {
    content:
      `Recruit a Bronze worker (${mine.length}/${slotsFor(hp)} slots${cost > 0 ? `, ${cost} coins from the town` : ", free"}). ` +
      "Miners bring ore, Woodcutters logs, Fishers fish (workers eat six a day), Merchants coins.",
    components: [
      buttonRow(
        WORKER_KINDS.map((kind) => ({
          label: kind[0].toUpperCase() + kind.slice(1),
          custom_id: `recruit:${kind}`,
          style: 1,
        }))
      ),
    ],
  };
}

export async function doRecruit(env: Env, player: Player, kind: string, day: string, now: number): Promise<Line> {
  if (!WORKER_KINDS.includes(kind as WorkerKind)) return { content: "No such kind of worker." };
  const skills = await getSkills(env, player.discord_id);
  const hp = combatLevel(levelsOf(skills, levelForXp));
  const result = await recruit(env, player, kind as WorkerKind, hp, day, now);
  if (!result.ok) return { content: result.reason };
  return {
    content: `Recruited a Bronze ${kind}${result.cost > 0 ? ` for ${result.cost} coins` : ""}. It starts gathering now; your next check-in delivers the sack.`,
    components: [buttonRow([{ label: "Town", custom_id: "town", style: 2 }])],
  };
}

export async function upgradeMenu(env: Env, player: Player): Promise<Line> {
  const mine = await getWorkers(env, player.discord_id);
  if (mine.length === 0) return { content: "You have no workers to upgrade." };
  const relics = await getRelics(env);
  const buttons: Button[] = mine.map((worker) => {
    const next = nextWorkerTier(worker.tier);
    return {
      label: next ? `${workerLabel(worker)} → ${next.name}` : `${workerLabel(worker)} (max)`,
      custom_id: `upg:${worker.id}`,
      style: 1,
      disabled: !next,
    };
  });
  const lines = mine.map((worker) => {
    const next = nextWorkerTier(worker.tier);
    if (!next) return `${workerLabel(worker)} — Dragon already.`;
    const discount = relics.has("fire_sale") ? " (Fire Sale −25%)" : "";
    return `${workerLabel(worker)} → ${next.name}: ${costLine(next.cost)}${discount}, ${next.rate}/h${next.furnace ? `, Furnace L${next.furnace}` : ""}.`;
  });
  return { content: lines.join("\n"), components: buttonRows(buttons) };
}

export async function doUpgrade(env: Env, player: Player, workerId: number, day: string, now: number): Promise<Line> {
  const skills = await getSkills(env, player.discord_id);
  const relics = await getRelics(env);
  const result = await upgradeWorker(env, player, workerId, tierKeyForOwner(levelForXp(skills.defence ?? 0)), day, now, relics);
  if (!result.ok) return { content: result.reason };
  return {
    content: `Upgraded to ${result.tier.name}: ${result.tier.rate} an hour now.`,
    components: [buttonRow([{ label: "Town", custom_id: "town", style: 2 }])],
  };
}

export async function buildMenu(env: Env, day: string): Promise<Line> {
  const town = await getTown(env);
  if (town.level < 1) return { content: "Buildings arrive at Founding I." };
  const options = buildOptions(await getBuildings(env), town, actNow(env, day));
  if (options.length === 0) return { content: "Nothing can be built or raised right now — the Town Hall caps every building at its own level." };
  const stores = await getStores(env);
  const lines = options.map(
    (o) => `**${o.name} L${o.nextLevel}** — ${o.effect}. ${costLine(o.cost)}.`
  );
  lines.push(`The town holds ${storesLine(stores)}. Anyone fresh can build; the Monday vote is for deciding together.`);
  return {
    content: lines.join("\n"),
    components: buttonRows(
      options.map((o) => ({ label: `${o.name} L${o.nextLevel}`, custom_id: `build:${o.key}`, style: 1 }))
    ),
  };
}

export async function doBuild(env: Env, player: Player, key: string, day: string, now: number): Promise<Line> {
  const result = await build(env, key as BuildingKey, day, player.discord_id, now, actNow(env, day));
  if (!result.ok) return { content: result.reason };
  return {
    content: `${buildingDef(key)?.name ?? key} is now level ${result.level}.`,
    components: [buttonRow([{ label: "Town", custom_id: "town", style: 2 }])],
  };
}

export async function repairMenu(env: Env): Promise<Line> {
  const rows = [...(await getBuildings(env)).values()].filter((row) => row.level > 0 && row.condition < 100);
  if (rows.length === 0) return { content: "Everything is in good repair." };
  const stores = await getStores(env);
  const lines = rows.map(
    (row) => `**${buildingDef(row.key)?.name ?? row.key}** at ${row.condition}% — ${(100 - row.condition) * 2} logs to full.`
  );
  lines.push(`The town holds ${Math.floor(stores.logs)} logs.`);
  return {
    content: lines.join("\n"),
    components: buttonRows(rows.map((row) => ({ label: `Repair ${buildingDef(row.key)?.name ?? row.key}`, custom_id: `repair:${row.key}`, style: 1 }))),
  };
}

export async function doRepair(env: Env, player: Player, key: string, day: string, now: number): Promise<Line> {
  const result = await repair(env, key as BuildingKey, day, player.discord_id, now);
  if (!result.ok) return { content: result.reason };
  return {
    content: `${buildingDef(key)?.name ?? key} repaired ${result.points} points for ${result.logs} logs.`,
    components: [buttonRow([{ label: "Town", custom_id: "town", style: 2 }])],
  };
}

// ── Votes ──────────────────────────────────────────────────────────

export async function votesView(env: Env, player: Player): Promise<Line> {
  const summary = await voteSummary(env, player.discord_id);
  return { content: summary.lines.join("\n"), components: summary.components };
}

export async function doVote(env: Env, player: Player, voteId: number, choice: string, now: number): Promise<Line> {
  const vote = await getVote(env, voteId);
  if (!vote) return { content: "That vote is gone." };
  if (vote.status !== "open" || vote.closes_at <= now) return { content: "That vote has closed." };
  const options = await getOptions(env, voteId);
  const idx = choice === "sitout" ? 2 : Number(choice);
  const option = options.find((o) => o.idx === idx);
  if (!option) return { content: "That is not one of the options." };
  await castBallot(env, voteId, player.discord_id, idx, now);
  return {
    content: `Ballot in: **${escapeMarkdown(option.label)}** on "${vote.title}". Change it any time before it closes <t:${Math.floor(vote.closes_at / 1000)}:R>. Nobody sees the tally until then.`,
  };
}

// ── Raids ──────────────────────────────────────────────────────────

export async function raidPropose(env: Env, player: Player, day: string, now: number): Promise<Line> {
  const result = await proposeRaid(env, day, now, actNow(env, day), player.discord_id);
  if (!result.ok) return { content: result.reason };
  return { content: `Raid vote open: ${result.vote.title}. It closes in 48 hours; it needs 60% of the active roster and at least three yes.` };
}

export async function raidStatus(env: Env, day: string): Promise<Line> {
  const line = await raidLine(env);
  if (line) return { content: line };
  const block = await proposalBlock(env, day, actNow(env, day));
  return { content: block ? `No raid. ${block}` : "No raid. Anyone can `/raid propose`." };
}

export async function relicsView(env: Env): Promise<Line> {
  const held = await getRelics(env);
  if (held.size === 0) return { content: "No relics yet. The first pick comes at the start of Act 3." };
  return {
    content: [...held]
      .map((key) => {
        const relic = RELICS.find((r) => r.key === key);
        return `**${relic?.name ?? key}** — ${relic?.effect ?? ""}`;
      })
      .join("\n"),
  };
}

export function buildingChoices() {
  return BUILDINGS.filter((b) => b.key !== "town_hall").map((b) => ({ name: b.name, value: b.key }));
}

export { workerTierDef };
export type { DiscordUser };
