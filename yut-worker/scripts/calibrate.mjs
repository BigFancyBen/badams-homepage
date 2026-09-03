#!/usr/bin/env node
/**
 * The pace, without a database: walks the design's attendance profiles
 * through a year of sessions on the real combat model and prints where each
 * lands. Use it when touching SESSION_ATTACKS, SESSION_FOOD_HP or the lamp
 * sizes; the year simulation (test:year) confirms the same thing end to end.
 *
 *   node scripts/calibrate.mjs [--attacks 1500]
 */
import { combatLevel, drawAssignment, masterFor, simulateSession, MONSTERS } from "../src/combat.ts";
import { levelForXp, ordinalWeight, tierForDefence, xpForLevel } from "../src/xp.ts";
import { ALTAR_MULTIPLIER, FOUNDING_LAMP_XP, SESSION_ATTACKS, STARTING_HITPOINTS_XP } from "../src/config.ts";
import { seededRng } from "../src/events.ts";

const arg = (name, fallback) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : fallback);
const ATTACKS = arg("--attacks", null);

// --attacks scales the weight, which is how the session length is varied
// without editing config.ts.
const PROFILES = [
  { name: "A 5/wk", perWeek: [1, 1, 1, 1, 1, 0, 0], style: "controlled" },
  { name: "C 3/wk", perWeek: [1, 0, 1, 0, 1, 0, 0], style: "controlled" },
  { name: "D 2/wk", perWeek: [0, 1, 0, 0, 1, 0, 0], style: "controlled" },
  { name: "D 2/wk aggressive", perWeek: [0, 1, 0, 0, 1, 0, 0], style: "aggressive" },
  { name: "E 1/wk", perWeek: [0, 0, 0, 0, 0, 1, 0], style: "controlled" },
];

function run(profile) {
  const xp = { hitpoints: STARTING_HITPOINTS_XP, attack: 0, strength: 0, defence: 0, prayer: 0, slayer: 0, woodcutting: 0, mining: 0, fishing: 0 };
  const levels = () => Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, levelForXp(v)]));
  let task = null;
  let sessions = 0;
  let masters = {};
  const snapshots = {};
  for (let week = 1; week <= 52; week++) {
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
      const weight = ordinalWeight(ordinal) * (ATTACKS ? ATTACKS / SESSION_ATTACKS : 1);
      const s = simulateSession({ levels: lv, style: profile.style, gear: { slayerHelmet: false, glory: false }, monster: task.monster, weight });
      for (const [k, v] of Object.entries(s.xp)) xp[k] += v;
      const onTask = Math.min(s.kills, task.left);
      xp.slayer += onTask * task.monster.slayerXp;
      if (task.monster.bones) xp.prayer += Math.floor(s.kills * task.monster.bones.xp * ALTAR_MULTIPLIER[0]);
      task.left -= s.kills;
    }
    // Founding lamps at 13/26/39/52 for anyone at 2+/week: into Attack, then Defence, alternating.
    if (week % 13 === 0 && profile.perWeek.reduce((a, b) => a + b, 0) >= 2) {
      const target = levelForXp(xp.attack) <= levelForXp(xp.defence) ? "attack" : "defence";
      xp[target] += FOUNDING_LAMP_XP;
    }
    if ([4, 13, 26, 52].includes(week)) snapshots[week] = { ...levels(), cb: combatLevel(levels()) };
  }
  return { snapshots, sessions, masters, xp };
}

console.log(`SESSION_ATTACKS ${ATTACKS ?? "(config)"}\n`);
for (const profile of PROFILES) {
  const r = run(profile);
  console.log(`${profile.name} (${r.sessions} sessions)`);
  for (const [week, lv] of Object.entries(r.snapshots)) {
    console.log(
      `  wk${String(week).padStart(2)}: cb ${String(lv.cb).padStart(3)} · att ${lv.attack} str ${lv.strength} def ${lv.defence} hp ${lv.hitpoints} pray ${lv.prayer} slay ${lv.slayer} · ${tierForDefence(lv.defence).name}`
    );
  }
  console.log(`  masters: ${Object.entries(r.masters).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}

// A few real anchors, printed so the formulas can be eyeballed against the wiki.
const anchor = simulateSession({
  levels: { hitpoints: 99, attack: 99, strength: 99, defence: 99, prayer: 1, slayer: 99, woodcutting: 1, mining: 1, fishing: 1 },
  style: "aggressive",
  gear: { slayerHelmet: false, glory: false },
  monster: MONSTERS["Hill Giant"],
  weight: 1,
});
console.log(`\n99 Strength, dragon scimitar, aggressive, no prayer: max hit ${anchor.maxHit} (wiki: 22 with a +66 strength bonus)`);
console.log(`xpForLevel(60) = ${xpForLevel(60)}`);
