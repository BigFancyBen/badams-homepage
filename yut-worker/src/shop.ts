import {
  ACTS,
  ANTIQUE_LAMP,
  SHOP,
  SHOP_PETS,
  SHOP_TITLES,
  SHOP_TRIMS,
  WORKER_NAMES,
} from "./config.ts";
import { grantLampStatement, logEntry, updatePlayer } from "./db.ts";
import { creditStatements, getWorkers, workerLabel } from "./town.ts";
import { buttonRow, buttonRows, type Button, type Env, type Player } from "./types.ts";

/**
 * The shop: bingo points for cosmetics, a small lamp, a crate for the town.
 * Rings are never for sale. Everything here is an ephemeral menu; the
 * purchase is one button.
 */

export function cosmeticsOf(player: Player): Record<string, string> {
  try {
    return JSON.parse(player.cosmetics || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export interface Line {
  content: string;
  components?: unknown[];
}

export function shopMenu(player: Player): Line {
  const lines = [`🛒 **The shop** — you have ${player.bingo_points} bingo points.`];
  for (const item of SHOP) lines.push(`**${item.name}** — ${item.points}`);
  lines.push("Rings of Life are not for sale; they are earned in weeks.");
  const buttons: Button[] = SHOP.map((item) => ({
    label: `${item.name.split(" (")[0]} (${item.points})`,
    custom_id: `shop:${item.key}`,
    style: player.bingo_points >= item.points ? 1 : 2,
    disabled: player.bingo_points < item.points,
  }));
  return { content: lines.join("\n"), components: buttonRows(buttons) };
}

function choiceButtons(item: string, choices: string[]): unknown[] {
  return buttonRows(choices.map((choice, i) => ({ label: choice, custom_id: `shop:${item}:${i}`, style: 1 })));
}

/**
 * A press on a shop button. Items with a choice show the choice first;
 * the second press buys.
 */
export async function shopPress(
  env: Env,
  player: Player,
  item: string,
  choice: string | undefined,
  day: string,
  now: number,
  act: number
): Promise<Line> {
  const def = SHOP.find((i) => i.key === item);
  if (!def) return { content: "No such item." };
  if (player.bingo_points < def.points) {
    return { content: `${def.name} costs ${def.points} points; you have ${player.bingo_points}.` };
  }

  // Choices first.
  if (item === "title" && choice === undefined) {
    return { content: "Pick a title:", components: choiceButtons(item, SHOP_TITLES) };
  }
  if (item === "trim" && choice === undefined) {
    return { content: "Pick a trim for your sheet:", components: choiceButtons(item, SHOP_TRIMS) };
  }
  if (item === "pet" && choice === undefined) {
    return { content: "Pick a pet:", components: choiceButtons(item, SHOP_PETS) };
  }
  if (item === "worker_name" && choice === undefined) {
    const workers = await getWorkers(env, player.discord_id);
    if (workers.length === 0) return { content: "You have no workers to name." };
    return {
      content: "Which worker gets a name?",
      components: buttonRows(workers.map((w) => ({ label: workerLabel(w), custom_id: `shop:worker_name:${w.id}`, style: 1 }))),
    };
  }

  const cosmetics = cosmeticsOf(player);
  let chosen: string | null = null;
  let line: string;
  const statements: D1PreparedStatement[] = [];

  switch (item) {
    case "small_lamp":
      // The shop lamp is the easy antique lamp, as its label says.
      statements.push(grantLampStatement(env, player.discord_id, ANTIQUE_LAMP.easy, "shop", day));
      line = "A small lamp, banked. Rub it from the hub.";
      break;
    case "title": {
      chosen = SHOP_TITLES[Number(choice)] ?? null;
      if (!chosen) return { content: "That title is not on the shelf." };
      await updatePlayer(env, player.discord_id, { title: chosen });
      line = `You are now ${chosen}.`;
      break;
    }
    case "trim": {
      chosen = SHOP_TRIMS[Number(choice)] ?? null;
      if (!chosen) return { content: "That trim is not on the shelf." };
      cosmetics.trim = chosen;
      await updatePlayer(env, player.discord_id, { cosmetics: JSON.stringify(cosmetics) });
      line = `Your sheet wears ${chosen} trim now.`;
      break;
    }
    case "pet": {
      chosen = SHOP_PETS[Number(choice)] ?? null;
      if (!chosen) return { content: "That pet is not on the shelf." };
      cosmetics.pet = chosen;
      await updatePlayer(env, player.discord_id, { cosmetics: JSON.stringify(cosmetics) });
      await logEntry(env, player.discord_id, `pet:${chosen.toLowerCase().replace(/\s+/g, "_")}`, day);
      line = `${chosen} follows you now.`;
      break;
    }
    case "worker_name": {
      const workers = await getWorkers(env, player.discord_id);
      const worker = workers.find((w) => String(w.id) === choice);
      if (!worker) return { content: "That worker is not yours." };
      chosen = WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)];
      statements.push(env.DB.prepare("UPDATE workers SET name = ? WHERE id = ?").bind(chosen, worker.id));
      line = `Your ${worker.kind} is called ${chosen} now.`;
      break;
    }
    case "crate":
      statements.push(...creditStatements(env, "coins", 500, "crate", day, player.discord_id, now));
      line = "A crate of 500 coins, delivered to the town.";
      break;
    case "act_cape": {
      const cape = `Act ${act} cape (${ACTS[act - 1]?.name ?? act})`;
      cosmetics.cape = cape;
      await updatePlayer(env, player.discord_id, { cosmetics: JSON.stringify(cosmetics) });
      await logEntry(env, player.discord_id, `milestone:act_cape_${act}`, day);
      line = `You wear the ${cape}.`;
      break;
    }
    default:
      return { content: "No such item." };
  }

  statements.push(
    env.DB.prepare("INSERT INTO shop_purchases (player_id, item, choice, points, day, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      player.discord_id, item, chosen, def.points, day, now
    )
  );
  await env.DB.batch(statements);
  await updatePlayer(env, player.discord_id, { bingo_points: player.bingo_points - def.points });
  return {
    content: `${line} (−${def.points} points, ${player.bingo_points - def.points} left.)`,
    components: [buttonRow([{ label: "Shop", custom_id: "shop", style: 2 }])],
  };
}
