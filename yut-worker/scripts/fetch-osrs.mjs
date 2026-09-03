#!/usr/bin/env node
/**
 * Pulls the Old School RuneScape numbers the game runs on from the OSRS wiki.
 * Nothing in the files it writes is invented; re-run this when the wiki changes.
 *
 *   node scripts/fetch-osrs.mjs             every phase
 *   node scripts/fetch-osrs.mjs --osrs      config/osrs.json: Slayer masters' assignment tables,
 *                                           one representative monster per assignment, the
 *                                           scimitars and armour sets the players wear
 *   node scripts/fetch-osrs.mjs --drops     config/drops.json: the real drop table of every monster
 *                                           in osrs.json, with GE unit values
 *   node scripts/fetch-osrs.mjs --quests    config/quests.json: the quest of the week's details,
 *                                           requirements and the stats of the enemies it asks for
 */
import { readFileSync, writeFileSync } from "node:fs";
import { NAMED_RARITY, QUEST_CALENDAR } from "../src/config.ts";
import { itemKey } from "./lib/item-key.mjs";

const API = "https://oldschool.runescape.wiki/api.php";
const PRICES = "https://prices.runescape.wiki/api/v1/osrs";
const UA = "yut-hut-bot/1.0 (benadamsdroid@gmail.com)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function wikitext(page) {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await response.json();
  if (!json.parse) throw new Error(`No page: ${page}`);
  await sleep(250);
  return json.parse.wikitext;
}

/** Runs a Bucket (the wiki's structured-data store) Lua query and returns its rows. */
async function bucket(query) {
  const url = `${API}?action=bucket&format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await response.json();
  await sleep(250);
  if (json.error) throw new Error(`Bucket query failed: ${JSON.stringify(json.error)}\n  ${query}`);
  return json.bucket ?? [];
}

/** A Lua string literal; names with apostrophes must be double-quoted. */
const lua = (s) => JSON.stringify(s);

/** Where a link like [[ice troll]] lands: the redirect target, with the wiki's first-letter capital. */
async function resolveTitle(title) {
  const url = `${API}?action=query&redirects=1&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await response.json();
  await sleep(250);
  const page = json.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.title;
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

/** Wikitext to plain prose: links flattened to their labels, markup and templates gone. */
function plain(text) {
  if (!text) return "";
  let out = String(text);
  out = out.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<ref[^>]*\/>/gi, "");
  for (let i = 0; i < 3; i++) out = out.replace(/\{\{[^{}]*\}\}/g, "");
  out = out.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  out = out.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1").replace(/\[\[([^\]]*)\]\]/g, "$1");
  out = out.replace(/<[^>]+>/g, "").replace(/'''?/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return out.replace(/\s+/g, " ").trim();
}

/** The first two sentences of a paragraph, for a card. */
function firstSentences(text, count = 2) {
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  if (!sentences) return text;
  return sentences.slice(0, count).map((sentence) => sentence.trim()).join(" ");
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

// ── Phase: osrs.json ───────────────────────────────────────────────

async function fetchOsrs() {
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
}

// ── Phase: drops.json ──────────────────────────────────────────────

/**
 * Which version of a monster's page the game fights, where the wiki keeps
 * several drop tables under one name. The value is the `#suffix`; null means
 * "the rows with no version" (the page's main table, when its only versioned
 * rows are a quest variant). Versions not on the page are logged and the
 * ordinary choice is made instead.
 */
const DROP_VERSION_OVERRIDES = {
  Skeleton: "Unarmed",
  Goblin: "Drop table 2",
  Zombie: "Level 24",
  "Terror dog": "Level 110",
  Lizardman: "Level 53",
  "Giant rat": "Low level",
  Hobgoblin: "Armed",
  "Flesh Crawler": "Members",
  "Abyssal demon": "Standard",
  // The Level 13 Icefiend is the Recipe for Disaster one; the main table has no version.
  Icefiend: null,
};

/** Versions a Slayer-task player is not fighting. */
const NICHE_VERSION = /Wilderness|Catacombs|Free-to-play|Slayer Cave|Plateau/i;

/** Monsters that really drop nothing the game can bank; an empty table is not an error for these. */
const NO_DROPS = new Set(["Ghost", "Giant spider"]);

/** Drops the game handles elsewhere or cannot hold: clues, keys, Slayer-cave extras, untradeable tokens. */
const EXCLUDED_ITEM =
  /^(Larran's key|Ancient shard|Dark totem|Slayer's enchantment|Blighted |Brimstone key|Ecumenical key|Looting bag|Mysterious emblem|Ancient (statuette|medallion|effigy|relic|totem)|Clue scroll|Reward casket|Key \(|Dragon token|Book page)/;

/** "1/128", "10/100", "1/1,092.27", "Always", or a named band → a probability; null when the wiki does not know. */
function rarityToP(rarity) {
  const text = String(rarity ?? "").trim();
  if (text === "Always") return 1;
  const fraction = text.replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  if (text in NAMED_RARITY) return NAMED_RARITY[text];
  return null;
}

/** Eight significant digits: enough for 1/174,762.67, short enough to read. */
const sig8 = (p) => Number(p.toPrecision(8));

/**
 * Picks the one drop table for a monster page from the rows' "Dropped from"
 * versions. Rows with no version are the page's shared sub-tables (herbs,
 * gems, the rare drop table) and belong to every version, so they are merged
 * into whichever version is chosen.
 */
function chooseVersion(name, rows) {
  const byVersion = new Map();
  for (const row of rows) {
    const from = row.json["Dropped from"] || name;
    if (!byVersion.has(from)) byVersion.set(from, []);
    byVersion.get(from).push(row);
  }
  const bare = byVersion.get(name) ?? [];
  const versioned = [...byVersion.keys()].filter((v) => v !== name);
  const pick = (version, why) => {
    const merged = version === name ? bare : [...byVersion.get(version), ...bare];
    console.log(`  ${name}: ${version}${version !== name && bare.length ? ` + ${bare.length} shared` : ""} (${merged.length} rows; ${why}; versions: ${[...byVersion.keys()].map((v) => `${v}=${byVersion.get(v).length}`).join(", ")})`);
    return { version, rows: merged };
  };

  if (name in DROP_VERSION_OVERRIDES) {
    const override = DROP_VERSION_OVERRIDES[name];
    if (override === null) {
      if (bare.length) return pick(name, "override: main table");
      console.log(`  ${name}: override wants the main table but the page has no unversioned rows; falling through`);
    } else if (byVersion.has(`${name}#${override}`)) {
      return pick(`${name}#${override}`, "override");
    } else {
      console.log(`  ${name}: override version "${override}" is not on the page; falling through`);
    }
  }
  if (versioned.length === 0) return pick(name, "only table");
  for (const suffix of ["Regular", "Standard"]) {
    if (byVersion.has(`${name}#${suffix}`)) return pick(`${name}#${suffix}`, `#${suffix}`);
  }
  const ordinary = versioned.filter((v) => !NICHE_VERSION.test(v.slice(name.length + 1)));
  if (ordinary.length) {
    ordinary.sort((a, b) => byVersion.get(b).length - byVersion.get(a).length);
    return pick(ordinary[0], "most rows among ordinary versions");
  }
  if (bare.length) return pick(name, "only niche versions; main table");
  throw new Error(`${name}: every version is niche and there is no main table`);
}

async function fetchPrices() {
  const headers = { "User-Agent": UA };
  const mapping = await (await fetch(`${PRICES}/mapping`, { headers })).json();
  await sleep(250);
  const latest = await (await fetch(`${PRICES}/latest`, { headers })).json();
  const byName = new Map();
  for (const item of mapping) {
    if (byName.has(item.name)) continue;
    const price = latest.data?.[item.id];
    if (!price) continue;
    const { high, low } = price;
    const value = high && low ? (high + low) / 2 : (high ?? low ?? 0);
    if (value > 0) byName.set(item.name, Math.round(value));
  }
  return byName;
}

async function fetchDrops() {
  const osrs = JSON.parse(readFileSync(new URL("../config/osrs.json", import.meta.url), "utf8"));
  const monsterNames = Object.keys(osrs.monsters);
  console.log(`Drops for ${monsterNames.length} monsters`);

  const pricesAt = new Date().toISOString();
  const prices = await fetchPrices();
  console.log(`  ${prices.size} GE prices`);

  const items = [];
  const itemIndex = new Map();
  const stats = { kept: 0, unknown: 0, excluded: 0, unparsed: 0, zeroValue: 0, pricedFromGe: 0 };
  const zeroValueNames = new Set();
  const empty = [];
  const monsters = {};

  const indexOf = (name, unitValue) => {
    let index = itemIndex.get(name);
    if (index === undefined) {
      index = items.length;
      items.push({ k: itemKey(name), n: name, v: unitValue });
      itemIndex.set(name, index);
    } else if (items[index].v === 0 && unitValue > 0) {
      items[index].v = unitValue;
    }
    return index;
  };

  for (const name of monsterNames) {
    const raw = await bucket(
      `bucket('dropsline').select('page_name','item_name','drop_json','rare_drop_table').where('page_name',${lua(name)}).limit(1000).run()`,
    );
    const rows = raw.map((row) => ({ item: row.item_name, rdt: "rare_drop_table" in row, json: JSON.parse(row.drop_json) }));
    if (rows.length === 0) throw new Error(`${name}: the dropsline bucket has no rows for this page`);
    const chosen = chooseVersion(name, rows);

    const table = [];
    for (const row of chosen.rows) {
      const j = row.json;
      // "Zombie bone#Unpolished" is the item's page version; the item is "Zombie bone".
      const item = (j["Dropped item"] || row.item).replace(/#.*$/, "");
      if (EXCLUDED_ITEM.test(item)) {
        stats.excluded++;
        continue;
      }
      if (j.Rarity === "Unknown") {
        stats.unknown++;
        continue;
      }
      const p = rarityToP(j.Rarity);
      if (p === null) {
        stats.unparsed++;
        console.log(`    ${name}: cannot read rarity "${j.Rarity}" for ${item}; row dropped`);
        continue;
      }
      const quantityText = String(j["Drop Quantity"] ?? "");
      const numbers = quantityText.replace(/,/g, "").match(/\d+/g)?.map(Number) ?? [1];
      const low = typeof j["Quantity Low"] === "number" ? j["Quantity Low"] : numbers[0];
      const high = typeof j["Quantity High"] === "number" ? j["Quantity High"] : (numbers[1] ?? numbers[0]);
      const noted = /noted/i.test(quantityText);
      const rolls = typeof j.Rolls === "number" && j.Rolls > 0 ? j.Rolls : 1;

      // The wiki's "Drop Value" is the item's GE price per unit (Coins ×102 → 1, Earth rune ×1–170 → 2).
      let unitValue = 0;
      if (item === "Coins") unitValue = 1;
      else if (typeof j["Drop Value"] === "number" && j["Drop Value"] > 0) unitValue = Math.round(j["Drop Value"]);
      else if (prices.has(item)) {
        unitValue = prices.get(item);
        stats.pricedFromGe++;
      }
      if (unitValue === 0) {
        stats.zeroValue++;
        zeroValueNames.add(item);
      }

      const flags = (noted ? 1 : 0) | (row.rdt ? 2 : 0);
      table.push([indexOf(item, unitValue), sig8(p), low, high, rolls, flags]);
    }

    if (table.length === 0) {
      const dropped = chosen.rows.map((r) => `${r.json["Dropped item"] || r.item} [${r.json.Rarity}]`).join(", ");
      if (NO_DROPS.has(name)) console.log(`    ${name}: no bankable drops (expected; wiki rows: ${dropped || "none"})`);
      else empty.push(`${name} (version ${chosen.version}; wiki rows: ${dropped || "none"})`);
    }
    stats.kept += table.length;
    monsters[name] = { version: chosen.version, rows: table };
  }

  // Every monster needs a table; one that drops nothing must be listed in NO_DROPS on purpose.
  if (empty.length) throw new Error(`No drop rows survived for:\n  ${empty.join("\n  ")}\nAdd genuine no-drop monsters to NO_DROPS.`);

  const out = {
    fetchedAt: new Date().toISOString(),
    pricesAt,
    source: "https://oldschool.runescape.wiki (dropsline bucket) + prices.runescape.wiki",
    items,
    monsters,
  };
  writeFileSync(new URL("../config/drops.json", import.meta.url), JSON.stringify(out));
  console.log(
    `wrote config/drops.json: ${stats.kept} rows kept, ${items.length} distinct items, ${stats.excluded} excluded by name, ` +
      `${stats.unknown} Unknown-rarity dropped, ${stats.unparsed} unreadable rarities dropped, ` +
      `${stats.pricedFromGe} rows priced from the GE, ${stats.zeroValue} zero-value rows (${[...zeroValueNames].join(", ")})`,
  );
}

// ── Phase: quests.json ─────────────────────────────────────────────

/** Bullets that describe a fight the quest does not require. */
const SKIP_ENEMY = /optional|can be avoided|only if|unless/i;

/** The skills the game tracks; other requirements (Thieving, Magic…) are not the players' problem. */
const GAME_SKILLS = new Set(["attack", "strength", "defence", "hitpoints", "prayer", "slayer", "woodcutting", "mining", "fishing"]);

/**
 * Enemy lists the wiki writes too loosely to parse: the quest's fights, by
 * page, with the version's combat level where the page has several. These
 * replace the parsed list entirely.
 */
const QUEST_ENEMY_OVERRIDES = {
  "Dragon Slayer I": [
    { page: "Zombie rat", count: 1, level: 3 },
    { page: "Ghost (Melzar's Maze)", count: 1, level: 19 },
    { page: "Skeleton (Melzar's Maze)", count: 1, level: 22 },
    { page: "Zombie (Melzar's Maze)", count: 1, level: 24 },
    { page: "Melzar the Mad", count: 1, level: 43 },
    { page: "Lesser demon (Melzar's Maze)", count: 1, level: 82 },
    { page: "Elvarg", count: 1, level: 83 },
  ],
  // The Culinaromancer's Chest: the six bosses behind the final door.
  "Recipe for Disaster": [
    { page: "Agrith-Na-Na", count: 1, level: 146 },
    { page: "Flambeed", count: 1, level: 149 },
    { page: "Karamel", count: 1, level: 136 },
    { page: "Dessourt", count: 1, level: 121 },
    { page: "Gelatinnoth Mother", count: 1, level: 130 },
    { page: "Culinaromancer", count: 1, level: 75 },
  ],
  // The wiki marks the Ice Queen "unless you already have Ice Gloves"; the game's players do not.
  "Heroes' Quest": [
    { page: "Ice Queen", count: 1, level: 111 },
    { page: "Entrana firebird", count: 1, level: 2 },
  ],
};

/** "* 5 [[ice troll]]s ''(level 120-124)''" → { page, count, levels, text }. */
function parseEnemyBullets(text, quest) {
  if (!text || /^\s*none\s*$/i.test(text)) return [];
  const enemies = [];
  let optionalSection = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^'{2,3}\s*optional/i.test(line)) {
      optionalSection = true;
      continue;
    }
    if (optionalSection || !line.includes("[[")) continue;
    const prose = plain(line);
    if (SKIP_ENEMY.test(prose)) {
      console.log(`    ${quest}: skipping optional fight: ${prose}`);
      continue;
    }
    const body = line.replace(/^\*+\s*/, "");
    const link = body.match(/\[\[(?!File:|Image:)([^\]|]+)(?:\|[^\]]*)?\]\]/);
    if (!link) continue;
    const page = link[1].trim();
    const leading = body.match(/^(\d+)\s/)?.[1];
    const times = body.match(/(\d+)\s*times\b/i)?.[1];
    const levels = [...body.matchAll(/levels?\s+(\d+(?:\s*(?:[-–/,]|and)\s*\d+)*)/gi)]
      .flatMap((m) => m[1].match(/\d+/g).map(Number));
    const count = leading ? Number(leading) : times ? Number(times) : levels.length > 1 ? levels.length : 1;
    enemies.push({ page, count, levels, text: prose });
  }
  return enemies;
}

const monsterStatsCache = new Map();

/** Every version of a monster page from the infobox_monster bucket, following a redirect if the link was one. */
async function monsterVersions(page) {
  const title = page.charAt(0).toUpperCase() + page.slice(1);
  if (monsterStatsCache.has(title)) return monsterStatsCache.get(title);
  const select =
    "'page_name','version_anchor','default_version','hitpoints','combat_level','attack_level','strength_level','defence_level'," +
    "'stab_defence_bonus','slash_defence_bonus','crush_defence_bonus','attack_bonus','strength_bonus','max_hit','attack_speed','attack_style'";
  let rows = await bucket(`bucket('infobox_monster').select(${select}).where('page_name',${lua(title)}).run()`);
  if (rows.length === 0) {
    const resolved = await resolveTitle(title);
    if (resolved && resolved !== title) {
      console.log(`    ${title} → ${resolved}`);
      rows = await bucket(`bucket('infobox_monster').select(${select}).where('page_name',${lua(resolved)}).run()`);
    }
  }
  monsterStatsCache.set(title, rows);
  return rows;
}

/** The version the quest means: a listed combat level, else the page's default, else the first. */
function pickVersion(rows, levels) {
  for (const level of levels) {
    const hit = rows.find((r) => r.combat_level === level);
    if (hit) return hit;
  }
  const fallback = rows.find((r) => "default_version" in r);
  if (fallback) return fallback;
  return [...rows].sort((a, b) => String(a.version_anchor ?? "").localeCompare(String(b.version_anchor ?? "")))[0];
}

function enemyStats(name, count, row) {
  const styles = (Array.isArray(row.attack_style) ? row.attack_style : [row.attack_style])
    .map((s) => String(s ?? "").toLowerCase())
    .filter((s) => ["stab", "slash", "crush"].includes(s));
  return {
    name,
    count,
    hitpoints: row.hitpoints ?? 1,
    combat: row.combat_level ?? 1,
    att: row.attack_level ?? 1,
    str: row.strength_level ?? 1,
    def: row.defence_level ?? 1,
    attbns: row.attack_bonus ?? 0,
    strbns: row.strength_bonus ?? 0,
    dslash: row.slash_defence_bonus ?? 0,
    dstab: row.stab_defence_bonus ?? 0,
    dcrush: row.crush_defence_bonus ?? 0,
    maxHit: num(Array.isArray(row.max_hit) ? row.max_hit[0] : row.max_hit) ?? 0,
    speed: row.attack_speed ?? 4,
    style: styles[0] ?? "crush",
  };
}

/** Quest points from the page's {{Quest rewards}} template, summing subpages for a quest told in chapters. */
async function questPoints(quest, allRows) {
  const text = await wikitext(quest);
  const direct = text.match(/\|\s*qp\s*=\s*(\d+)/);
  if (direct) return Number(direct[1]);
  const chapters = allRows.filter((r) => r.page_name.startsWith(`${quest}/`)).map((r) => r.page_name);
  if (chapters.length === 0) throw new Error(`${quest}: no |qp= on the page`);
  let total = 0;
  for (const chapter of chapters) {
    const chapterText = await wikitext(chapter);
    const qp = chapterText.match(/\|\s*qp\s*=\s*(\d+)/);
    if (!qp) throw new Error(`${quest}: no |qp= on ${chapter}`);
    total += Number(qp[1]);
  }
  console.log(`    ${quest}: ${total} qp summed over ${chapters.length} chapters`);
  return total;
}

async function fetchQuests() {
  const rows = await bucket(
    `bucket('quest').select('page_name','official_difficulty','official_length','enemies_to_defeat','items_required','requirements','description','start_point').limit(500).run()`,
  );
  const byName = new Map(rows.map((r) => [r.page_name, r]));
  console.log(`Quests: ${rows.length} in the bucket, ${QUEST_CALENDAR.length} on the calendar`);

  const missing = QUEST_CALENDAR.filter(({ quest }) => !byName.has(quest)).map(({ quest }) => quest);
  if (missing.length) throw new Error(`Calendar quests not in the wiki's quest bucket (check spelling): ${missing.join(", ")}`);

  const unresolved = [];
  const quests = {};
  for (const { week, quest } of QUEST_CALENDAR) {
    const row = byName.get(quest);
    const qp = await questPoints(quest, rows);

    const items = (row.items_required ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\*[^*]/.test(l) && !/obtain(?:able|ed) during|optional/i.test(l)).length;

    const skills = {};
    for (const m of (row.requirements ?? "").matchAll(/data-skill="([^"]+)"\s+data-level="(\d+)"/g)) {
      const skill = m[1].toLowerCase();
      if (GAME_SKILLS.has(skill)) skills[skill] = Math.max(skills[skill] ?? 0, Number(m[2]));
    }

    const wanted = QUEST_ENEMY_OVERRIDES[quest]
      ? QUEST_ENEMY_OVERRIDES[quest].map((e) => ({ page: e.page, count: e.count, levels: e.level ? [e.level] : [], text: `override: ${e.page}` }))
      : parseEnemyBullets(row.enemies_to_defeat, quest);
    const enemies = [];
    for (const enemy of wanted) {
      const versions = await monsterVersions(enemy.page);
      if (versions.length === 0) {
        unresolved.push(`${quest}: ${enemy.text}`);
        console.log(`    ${quest}: UNRESOLVED ${enemy.text}`);
        continue;
      }
      const version = pickVersion(versions, enemy.levels);
      enemies.push(enemyStats(version.page_name, enemy.count, version));
    }

    quests[quest] = {
      difficulty: row.official_difficulty,
      length: row.official_length,
      qp,
      description: firstSentences(plain(row.description)),
      start: plain(row.start_point),
      items,
      skills,
      enemies,
    };
    console.log(
      `  week ${week} ${quest}: ${row.official_difficulty}, ${qp} qp, ${items} items, ` +
        `${enemies.length} enemies (${enemies.map((e) => `${e.count}× ${e.name} cb${e.combat} hp${e.hitpoints}`).join("; ") || "none"})`,
    );
  }

  const out = { fetchedAt: new Date().toISOString(), source: "https://oldschool.runescape.wiki (quest + infobox_monster buckets)", quests };
  writeFileSync(new URL("../config/quests.json", import.meta.url), JSON.stringify(out, null, 1));
  console.log(`wrote config/quests.json: ${Object.keys(quests).length} quests`);
  if (unresolved.length) console.log(`UNRESOLVED enemies (${unresolved.length}):\n  ${unresolved.join("\n  ")}`);
}

// ── Main ───────────────────────────────────────────────────────────

const flags = process.argv.slice(2);
const all = !flags.some((f) => ["--osrs", "--drops", "--quests"].includes(f));
if (all || flags.includes("--osrs")) await fetchOsrs();
if (all || flags.includes("--drops")) await fetchDrops();
if (all || flags.includes("--quests")) await fetchQuests();
