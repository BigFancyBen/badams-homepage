/**
 * The pace model, shared by calibrate.mjs and test-xp.mjs: walks an
 * attendance profile through a year of sessions on the real combat model,
 * with the lamps the campaign hands out, and records the levels at the start
 * of every week. No database, no Worker.
 */
import { combatLevel, drawAssignment, masterFor, simulateSession } from "../../src/combat.ts";
import { levelForXp, ordinalWeight } from "../../src/xp.ts";
import {
  ALTAR_MULTIPLIER,
  FOUNDING_LAMP_XP,
  QUEST_CALENDAR,
  QUEST_LAMP,
  SESSION_ATTACKS,
  STARTING_HITPOINTS_XP,
} from "../../src/config.ts";
import { seededRng } from "../../src/events.ts";
import quests from "../../config/quests.json" with { type: "json" };

export const PROFILES = [
  { name: "A 5/wk", perWeek: [1, 1, 1, 1, 1, 0, 0], style: "controlled" },
  { name: "C 3/wk", perWeek: [1, 0, 1, 0, 1, 0, 0], style: "controlled" },
  { name: "D 2/wk", perWeek: [0, 1, 0, 0, 1, 0, 0], style: "controlled" },
  { name: "D 2/wk aggressive", perWeek: [0, 1, 0, 0, 1, 0, 0], style: "aggressive" },
  { name: "E 1/wk", perWeek: [0, 0, 0, 0, 0, 1, 0], style: "controlled" },
];

/** The lamp a week's quest pays, assuming the party finishes it. */
export function questLampFor(week) {
  const entry = QUEST_CALENDAR.find((q) => q.week === week);
  const data = entry ? quests.quests[entry.quest] : null;
  return data ? QUEST_LAMP[data.difficulty] ?? QUEST_LAMP.Novice : 0;
}

/**
 * Runs one profile. `attacks` overrides SESSION_ATTACKS by scaling the weight;
 * `questLamps` adds each week's quest lamp (a 2+/week player is assumed to
 * take part in every quest). Lamps go into Attack or Defence, whichever is
 * behind, which is what a player chasing tiers does.
 */
export function run(profile, { attacks = null, questLamps = true } = {}) {
  const xp = { hitpoints: STARTING_HITPOINTS_XP, attack: 0, strength: 0, defence: 0, prayer: 0, slayer: 0, woodcutting: 0, mining: 0, fishing: 0 };
  const levels = () => Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, levelForXp(v)]));
  const lamp = (amount) => {
    const target = levelForXp(xp.attack) <= levelForXp(xp.defence) ? "attack" : "defence";
    xp[target] += amount;
  };
  const perWeek = profile.perWeek.reduce((a, b) => a + b, 0);
  let task = null;
  let sessions = 0;
  const masters = {};
  const weekly = {};
  const snapshots = {};
  for (let week = 1; week <= 52; week++) {
    weekly[week] = { ...levels(), cb: combatLevel(levels()) };
    let ordinal = 0;
    for (let day = 0; day < 7; day++) {
      if (!profile.perWeek[day]) continue;
      ordinal++;
      sessions++;
      const lv = levels();
      const cb = combatLevel(lv);
      if (!task || task.left <= 0) {
        const master = masterFor(cb, lv.slayer);
        const drawn = drawAssignment(seededRng(`${profile.name}:${week}:${day}`), master, lv.slayer, cb);
        task = { master, monster: drawn.monster, left: drawn.amount };
        masters[master.name] = (masters[master.name] ?? 0) + 1;
      }
      const weight = ordinalWeight(ordinal) * (attacks ? attacks / SESSION_ATTACKS : 1);
      const s = simulateSession({ levels: lv, style: profile.style, gear: { slayerHelmet: false, glory: false }, monster: task.monster, weight });
      for (const [k, v] of Object.entries(s.xp)) xp[k] += v;
      const onTask = Math.min(s.kills, task.left);
      xp.slayer += onTask * task.monster.slayerXp;
      if (task.monster.bones) xp.prayer += Math.floor(s.kills * task.monster.bones.xp * ALTAR_MULTIPLIER[0]);
      task.left -= s.kills;
    }
    // Founding lamps at 13/26/39/52 for anyone at 2+/week.
    if (week % 13 === 0 && perWeek >= 2) lamp(FOUNDING_LAMP_XP);
    // The week's quest lamp, for anyone who took part (2+/week always does).
    if (questLamps && perWeek >= 2) lamp(questLampFor(week));
    if ([4, 13, 26, 52].includes(week)) snapshots[week] = { ...levels(), cb: combatLevel(levels()) };
  }
  return { snapshots, weekly, sessions, masters, xp, final: { ...levels(), cb: combatLevel(levels()) } };
}
