#!/usr/bin/env node
/**
 * The pace, without a database: walks the design's attendance profiles
 * through a year of sessions on the real combat model (scripts/lib/pace.mjs)
 * and prints where each lands. Use it when touching SESSION_ATTACKS, the
 * food model or the lamp sizes; the year simulation (test:year) confirms the
 * same thing end to end.
 *
 *   node scripts/calibrate.mjs [--attacks 1500] [--no-quests]
 */
import { simulateSession, MONSTERS } from "../src/combat.ts";
import { tierForDefence, xpForLevel } from "../src/xp.ts";
import { PROFILES, run } from "./lib/pace.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : fallback);
const ATTACKS = arg("--attacks", null);
const QUESTS = !process.argv.includes("--no-quests");

console.log(`SESSION_ATTACKS ${ATTACKS ?? "(config)"} · quest lamps ${QUESTS ? "on" : "off"}\n`);
for (const profile of PROFILES) {
  const r = run(profile, { attacks: ATTACKS, questLamps: QUESTS });
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
