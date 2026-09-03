#!/usr/bin/env node
/**
 * Pulls the Old School RuneScape numbers the game runs on from the OSRS wiki
 * and writes them to config/osrs.json: every Slayer master's real assignment
 * table (amounts, unlock requirements, weights), the stats of one
 * representative monster per assignment, and the bonuses of the scimitars and
 * armour sets the players wear. Nothing in that file is invented; re-run this
 * when the wiki changes.
 *
 *   node scripts/fetch-osrs.mjs
 */
import { writeFileSync } from "node:fs";

const API = "https://oldschool.runescape.wiki/api.php";
const UA = "yut-hut-bot/1.0 (benadamsdroid@gmail.com)";

async function wikitext(page) {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await response.json();
  if (!json.parse) throw new Error(`No page: ${page}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return json.parse.wikitext;
}

/** Reads `|key = value` from a template body, preferring an unsuffixed key, then key1. */
function field(body, key) {
  for (const k of [key, `${key}1`]) {
    const match = body.match(new RegExp(`\\|\\s*${k.replace(/ /g, "\\s")}\\s*=\\s*([^\\n|]*)`));
    if (match && match[1].trim() !== "") return match[1].trim();
  }
  return null;
}

/** The first number in a field: "10 (melee), 50 (dragonfire)" is 10. */
function num(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** The first {{Infobox X ...}} block, with balanced braces. */
function firstTemplate(text, name) {
  const start = text.indexOf(`{{${name}`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ── Slayer masters ─────────────────────────────────────────────────

const MASTERS = [
  { key: "turael", name: "Turael", combat: 1, slayer: 1, points: 0 },
  { key: "mazchna", name: "Mazchna", combat: 20, slayer: 1, points: 2 },
  { key: "vannaka", name: "Vannaka", combat: 40, slayer: 1, points: 4 },
  { key: "chaeldar", name: "Chaeldar", combat: 70, slayer: 1, points: 10 },
  { key: "nieve", name: "Nieve", combat: 85, slayer: 1, points: 12 },
  { key: "duradel", name: "Duradel", combat: 100, slayer: 50, points: 15 },
];

/**
 * One monster stands in for each assignment category — the ordinary one a
 * player at that master would fight. Categories without an entry are skipped
 * (quest-locked, boss-only, or too niche).
 */
const REPRESENTATIVE = {
  Birds: "Chicken", Cows: "Cow", Goblins: "Goblin", Rats: "Giant rat", Spiders: "Giant spider",
  Skeletons: "Skeleton", Zombies: "Zombie", Bats: "Giant bat", Wolves: "Wolf", Bears: "Grizzly bear",
  Dogs: "Guard dog", Monkeys: "Monkey", Dwarves: "Dwarf", Scorpions: "Scorpion", Minotaurs: "Minotaur",
  "Cave crawlers": "Cave crawler", "Crawling Hands": "Crawling Hand", Ghosts: "Ghost", Banshees: "Banshee",
  Icefiends: "Icefiend", Kalphite: "Kalphite Worker", Lizards: "Desert Lizard", "Cave bugs": "Cave bug",
  "Cave slime": "Cave slime",
  "Hill Giants": "Hill Giant", Hobgoblins: "Hobgoblin", Ghouls: "Ghoul", Cockatrice: "Cockatrice",
  Pyrefiends: "Pyrefiend", "Ice warriors": "Ice warrior", "Earth warriors": "Earth warrior", Rockslugs: "Rockslug",
  "Flesh Crawlers": "Flesh Crawler", Catablepon: "Catablepon", Killerwatts: "Killerwatt", Mogres: "Mogre",
  "Wall beasts": "Wall beast", Vampyres: "Feral Vampyre",
  "Moss giants": "Moss giant", "Ice giants": "Ice giant", Ogres: "Ogre", Crocodiles: "Crocodile", Jellies: "Jelly",
  "Lesser demons": "Lesser demon", "Fire giants": "Fire giant", Bloodveld: "Bloodveld", "Dust devils": "Dust devil",
  "Green dragons": "Green dragon", "Blue dragons": "Blue dragon", Turoth: "Turoth", Kurask: "Kurask",
  Basilisks: "Basilisk", Ankou: "Ankou", "Aberrant spectres": "Aberrant spectre", Gargoyles: "Gargoyle",
  Nechryael: "Nechryael", Dagannoth: "Dagannoth", "Infernal mages": "Infernal Mage", Trolls: "Mountain troll",
  Werewolves: "Werewolf", "Harpie Bug Swarms": "Harpie Bug Swarm", "Brine rats": "Brine rat", Shades: "Loar Shade",
  "Greater demons": "Greater demon", Hellhounds: "Hellhound", "Cave horrors": "Cave horror", "Black demons": "Black demon",
  "Bronze dragons": "Bronze dragon", "Iron dragons": "Iron dragon", "Steel dragons": "Steel dragon",
  "Abyssal demons": "Abyssal demon", "Black dragons": "Black dragon", "Dark beasts": "Dark beast",
  "Red dragons": "Red dragon", "Smoke devils": "Smoke devil", "Skeletal Wyverns": "Skeletal Wyvern", Wyrms: "Wyrm",
  "Mithril dragons": "Mithril dragon", "Adamant dragons": "Adamant dragon", "Rune dragons": "Rune dragon",
  Hydras: "Hydra", Drakes: "Drake", Suqahs: "Suqah", Waterfiends: "Waterfiend", Aviansies: "Aviansie",
  Elves: "Elf Warrior", Lizardmen: "Lizardman", "Fossil Island Wyverns": "Ancient Wyvern", Kraken: "Cave kraken",
  "Cave kraken": "Cave kraken", "Spiritual creatures": "Spiritual Warrior", TzHaar: "TzHaar-Hur",
  "Mutated Zygomites": "Mutated Zygomite", Zygomites: "Mutated Zygomite", "Sea snakes": "Sea Snake Young",
  "Terror dogs": "Terror dog", "Shadow warriors": "Shadow warrior", "Otherworldly beings": "Otherworldly being",
  Cyclopes: "Cyclops", "Fever spiders": "Fever spider", "Jungle horrors": "Jungle horror", "Mogres ": "Mogre",
  "Vampyres ": "Feral Vampyre",
};

function parseAssignments(text) {
  const rows = [];
  for (const block of text.split("\n|-")) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
    if (lines.length < 3) continue;
    const name = lines[0].match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/)?.[1]?.replace(/s$/, (s) => s) ?? null;
    const amount = lines[1].replace(/^\|/, "").match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!name || !amount) continue;
    const unlock = lines[2];
    const slayerReq = num(unlock.match(/SCP\|Slayer\|(\d+)/)?.[1]) ?? 1;
    const combatReq = num(unlock.match(/SCP\|Combat\|(\d+)/)?.[1]) ?? 1;
    const quest = /completion of|\[\[.*?(quest|Quest)/.test(unlock) && !/SCP/.test(unlock.replace(/completion of.*/, ""));
    const weight = num(block.match(/\{\{\+=\|weight\|(\d+)/)?.[1]) ?? 1;
    rows.push({ category: name.replace(/\]\]$/, "").trim(), min: Number(amount[1]), max: Number(amount[2]), slayerReq, combatReq, weight, quest });
  }
  return rows;
}

// ── Monsters ───────────────────────────────────────────────────────

const BONES = [
  ["Superior dragon bones", 150], ["Dragon bones", 72], ["Lava dragon bones", 85], ["Wyvern bones", 50],
  ["Babydragon bones", 30], ["Big bones", 15], ["Bones", 4.5],
  ["Infernal ashes", 110], ["Abyssal ashes", 85], ["Malicious ashes", 65], ["Vile ashes", 25], ["Fiendish ashes", 10],
];

async function monster(name) {
  const text = await wikitext(name);
  const box = firstTemplate(text, "Infobox Monster");
  if (!box) throw new Error(`No monster infobox: ${name}`);
  let bones = null;
  for (const [item, xp] of BONES) {
    if (new RegExp(`DropsLine\\|name=${item}\\b`, "i").test(text)) {
      bones = { item, xp };
      break;
    }
  }
  const style = (field(box, "attack style") ?? "").replace(/[\[\]]/g, "").split(",")[0].trim().toLowerCase() || "crush";
  return {
    name: field(box, "name") ?? name,
    combat: num(field(box, "combat")),
    hitpoints: num(field(box, "hitpoints")),
    att: num(field(box, "att")) ?? 1,
    str: num(field(box, "str")) ?? 1,
    def: num(field(box, "def")) ?? 1,
    attbns: num(field(box, "attbns")) ?? 0,
    strbns: num(field(box, "strbns")) ?? 0,
    dstab: num(field(box, "dstab")) ?? 0,
    dslash: num(field(box, "dslash")) ?? 0,
    dcrush: num(field(box, "dcrush")) ?? 0,
    maxHit: num(field(box, "max hit")) ?? 0,
    speed: num(field(box, "attack speed")) ?? 4,
    style: ["stab", "slash", "crush"].includes(style) ? style : "crush",
    slayerXp: num(field(box, "slayxp")) ?? num(field(box, "hitpoints")),
    slayerLevel: num(field(box, "slaylvl")) ?? 1,
    bones,
  };
}

// ── Equipment ──────────────────────────────────────────────────────

const METALS = [
  { key: "bronze", name: "Bronze", level: 1 },
  { key: "iron", name: "Iron", level: 1 },
  { key: "steel", name: "Steel", level: 5 },
  { key: "black", name: "Black", level: 10 },
  { key: "mithril", name: "Mithril", level: 20 },
  { key: "adamant", name: "Adamant", level: 30 },
  { key: "rune", name: "Rune", level: 40 },
  { key: "dragon", name: "Dragon", level: 60 },
];
const ARMOUR_PIECES = ["full helm", "platebody", "platelegs", "kiteshield"];

async function bonuses(page) {
  const text = await wikitext(page);
  const box = firstTemplate(text, "Infobox Bonuses");
  if (!box) throw new Error(`No bonuses: ${page}`);
  const pick = (k) => num(field(box, k)) ?? 0;
  return {
    astab: pick("astab"), aslash: pick("aslash"), acrush: pick("acrush"),
    dstab: pick("dstab"), dslash: pick("dslash"), dcrush: pick("dcrush"),
    str: pick("str"), prayer: pick("prayer"), speed: num(field(box, "speed")),
  };
}

// ── Main ───────────────────────────────────────────────────────────

const out = { fetchedAt: new Date().toISOString(), source: "https://oldschool.runescape.wiki", masters: [], monsters: {}, weapons: [], armour: [], extras: {} };
const wanted = new Set();

for (const master of MASTERS) {
  // Most masters keep the table on a subpage; Vannaka and Chaeldar inline it.
  let text;
  try {
    text = await wikitext(`${master.name}/Slayer assignments`);
  } catch {
    text = await wikitext(master.name);
  }
  const rows = parseAssignments(text);
  const tasks = [];
  for (const row of rows) {
    const rep = REPRESENTATIVE[row.category] ?? REPRESENTATIVE[`${row.category}s`];
    if (!rep || row.quest) continue;
    wanted.add(rep);
    tasks.push({ ...row, monster: rep });
  }
  console.log(`${master.name}: ${tasks.length} of ${rows.length} assignments kept`);
  out.masters.push({ ...master, tasks });
}

for (const name of wanted) {
  try {
    out.monsters[name] = await monster(name);
    const m = out.monsters[name];
    console.log(`  ${name}: cb ${m.combat} hp ${m.hitpoints} def ${m.def} ${m.bones?.item ?? "no bones"}`);
  } catch (error) {
    console.log(`  ${name}: ${String(error)}`);
  }
}

for (const metal of METALS) {
  out.weapons.push({ key: metal.key, name: `${metal.name} scimitar`, attack: metal.level, ...(await bonuses(`${metal.name} scimitar`)) });
  const set = { key: metal.key, name: `${metal.name} armour`, defence: metal.level, dstab: 0, dslash: 0, dcrush: 0, str: 0, prayer: 0 };
  for (const piece of ARMOUR_PIECES) {
    const b = await bonuses(`${metal.name} ${piece}`);
    set.dstab += b.dstab;
    set.dslash += b.dslash;
    set.dcrush += b.dcrush;
    set.str += b.str;
    set.prayer += b.prayer;
  }
  out.armour.push(set);
  console.log(`${metal.name}: scim slash ${out.weapons.at(-1).aslash} str ${out.weapons.at(-1).str}; set slash def ${set.dslash}`);
}

// A task whose monster page could not be read is dropped rather than guessed.
for (const master of out.masters) {
  master.tasks = master.tasks.filter((task) => out.monsters[task.monster]?.hitpoints);
}

out.extras.glory = await bonuses("Amulet of glory");
out.extras.slayerHelmet = await bonuses("Slayer helmet");

writeFileSync(new URL("../config/osrs.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("wrote config/osrs.json");
