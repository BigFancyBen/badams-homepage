import type { RuleSection } from "./types";

export const ACCENT = "#a3be8c";
export const ACCENT_WARM = "#ebcb8b";

export const SUMMARY =
  "A year-long workout-accountability campaign that lives in the yut-hut Discord channel. You check in when you exercise. The bot turns check-ins into RuneScape-style XP, tiers, streaks, and a shared camp. Two a week keeps you in form. Nothing else is required and nothing else is rewarded.";

export const STAT_LINE = [
  { label: "The rule", value: "2 a week" },
  { label: "Launch", value: "14 Sep 2026" },
  { label: "Length", value: "52 weeks" },
  { label: "Skills", value: "9" },
];

export const SECTIONS: RuleSection[] = [
  {
    id: "rules",
    label: "The two rules",
    title: "The two rules",
    blocks: [
      { kind: "p", text: "**Two a week is the whole game.** Check in twice in a calendar week and you are in form. Everything else on this page is decoration on that one fact." },
      { kind: "p", text: "**Only players exist.** If you have not joined, the bot does not know you are there. You are never counted, named, or pinged." },
      { kind: "note", text: "Nothing is ever awarded for anything but a check-in. Not chat, not reactions, not hanging around the channel. A check-in is the only coin." },
    ],
  },
  {
    id: "joining",
    label: "Joining",
    title: "Joining",
    blocks: [
      {
        kind: "ul",
        items: [
          "`/join`, or the Join button on the pinned board, makes you a player.",
          "`/leave` retires you. Your sheet is kept. Come back whenever.",
          "`/expedition weeks:1-8` pauses you for that many weeks. You drop out of the group maths and the weeks you miss do not count against you.",
          "Pings are off until you ask. `/pings on` or the Ping me button turns them on. You are pinged twice at most: the morning post and Sunday's last call.",
        ],
      },
      { kind: "p", text: "Only players are counted, named, or pinged. Observers never appear in any message, ever." },
    ],
  },
  {
    id: "day",
    label: "How a day works",
    title: "How a day works",
    blocks: [
      {
        kind: "ol",
        items: [
          "The game day runs 3am to 3am Mountain. A midnight session counts as today, not tomorrow.",
          "8am Mountain: the morning post goes up with a Check In button.",
          "Press it, or run `/checkin` with an optional note and a photo or video.",
          "You get an ephemeral receipt. It doubles as your play hub: Lamp, Clue, Sheet, Camp, Log.",
          "The channel sees one line per check-in. That is all the noise the bot makes about you.",
          "Sunday 5pm Mountain: last call. Nobody is named.",
          "Monday: the week resolves. Streaks, Rings, and rivalries settle.",
        ],
      },
      { kind: "note", text: "One check-in per day. Any exercise counts. There are no workout types, so there is nothing to argue about." },
    ],
  },
  {
    id: "fresh",
    label: "Fresh",
    title: "Fresh",
    blocks: [
      { kind: "p", text: "Fresh means you have checked in within the last 4 days. Fresh is what unlocks every action: rubbing lamps, working clues, verifying others, changing style, opening the hub." },
      { kind: "p", text: "Stale players are told \"Check in to play\" and nothing else changes. Nothing is taken away. Lamps wait for you." },
    ],
  },
  {
    id: "weight",
    label: "The weight",
    title: "The weight",
    lede: "Each check-in carries a weight by its ordinal in the calendar week, Monday to Sunday. The first two are full value. After that it falls off, on purpose.",
    blocks: [
      {
        kind: "table",
        columns: ["Check-in", "Weight", "Week total"],
        rows: [
          ["1st", "100%", "1.0"],
          ["2nd", "100%", "2.0"],
          ["3rd", "50%", "2.5"],
          ["4th", "50%", "3.0"],
          ["5th", "20%", "3.2"],
          ["6th", "20%", "3.4"],
          ["7th", "20%", "3.6"],
        ],
      },
      { kind: "p", text: "A seven-a-week player earns **1.8×** a two-a-week player. Not 3.5×. The game pays for showing up, not for living in the gym." },
    ],
  },
  {
    id: "skills",
    label: "Skills",
    title: "Skills",
    lede: "Nine skills on a 3×3 sheet. XP arrives only through check-ins and the things check-ins trigger.",
    blocks: [
      {
        kind: "table",
        columns: ["Skill", "How it grows"],
        rows: [
          ["Hitpoints", "Every check-in. 200 XP."],
          [
            "Attack / Strength / Defence",
            "Every check-in. 200 XP split by your **combat style**: Accurate → Attack, Aggressive → Strength, Defensive → Defence, Controlled → a third each. Set it with `/style` or from the hub.",
          ],
          [
            "Slayer",
            "Verified check-ins: the author gets +100. Verifying someone else: +25, paid on your own next check-in.",
          ],
          ["Prayer", "150 per Form week. +100 more if you hit 3+ that week."],
          ["Woodcutting", "Logs delivered on check-in."],
          ["Mining / Fishing", "Worker sacks, from Founding I."],
        ],
      },
      { kind: "p", text: "The XP curve is RuneScape's divided by ten." },
      {
        kind: "table",
        columns: ["Level", "XP"],
        rows: [
          ["10", "115"],
          ["20", "447"],
          ["30", "1,336"],
          ["40", "3,722"],
          ["50", "10,133"],
          ["60", "27,374"],
          ["70", "73,762"],
          ["92", "651,725"],
          ["99", "1,303,443"],
        ],
      },
      { kind: "note", text: "Two a week, every week, is a Dragon at the finale. The curve is tuned to that promise." },
    ],
  },
  {
    id: "tiers",
    label: "Tiers",
    title: "Tiers",
    lede: "Your tier is your Hitpoints level. Nothing else feeds it.",
    blocks: [
      {
        kind: "table",
        columns: ["Tier", "Hitpoints", "Title"],
        rows: [
          ["Bronze", "1", ""],
          ["Iron", "2", ""],
          ["Steel", "5", ""],
          ["Black", "10", ""],
          ["Mithril", "20", "Regular"],
          ["Adamant", "30", "Veteran"],
          ["Rune", "40", "Champion"],
          ["Rune (t)", "45", ""],
          ["Rune (g)", "50", "Elite"],
          ["Rune (or)", "55", ""],
          ["Dragon", "60", "Dragon Slayer"],
        ],
      },
    ],
  },
  {
    id: "events",
    label: "Random events",
    title: "Random events",
    lede: "1 in 6 per check-in. Pity at 12: go twelve check-ins without one and the next is certain.",
    blocks: [
      {
        kind: "table",
        columns: ["Event", "Weight", "What happens"],
        rows: [
          ["Genie", "30", "A lamp worth 10 × the chosen skill's level, 100–600 XP. Unrubbed after 14 days, it rubs itself into Hitpoints."],
          ["Mysterious Old Man", "15", "150 of a resource to the camp."],
          ["Drunken Dwarf", "12", "A Ring of Life, or 200 coins if you are full."],
          ["Evil Chicken", "10", "+150 Defence."],
          ["Sandwich Lady", "8", "+150 Hitpoints."],
          ["Beekeeper", "8", "Workers +25% for 24 hours."],
          ["Quiz Master", "7", "Three-button trivia. Right: +200 combat XP. Wrong: 50 coins to the camp."],
          ["Freaky Forester", "5", "Repairs the worst building, or leaves logs."],
          ["Drill Demon", "3", "A bounty. Check in again within 3 days for a 400 XP lamp."],
          ["Prison Pete", "2", "Two lamps."],
        ],
      },
      { kind: "note", text: "Nothing on the table hurts anyone. Read it again if you do not believe it." },
    ],
  },
  {
    id: "form",
    label: "Form, streaks, Rings",
    title: "Form, streaks, Rings",
    blocks: [
      {
        kind: "ul",
        items: [
          "**Form** is 2+ check-ins in the trailing 7 days. It shows as dots on your sheet.",
          "**Form weeks** are consecutive calendar weeks with 2+. That is your streak.",
          "**Rings of Life** are earned, never sold. Weeks 1–8: one per 3 Form weeks. From week 9: one per 2. Cap of 2, or 3 after Graduation.",
          "A Ring is spent automatically on a week that closed at exactly one check-in. A week at zero breaks the streak regardless. No Ring saves a zero.",
          "**Bootstrap:** your first two weeks after joining pay double Hitpoints.",
          "**Graduation** is your week 13.",
        ],
      },
      { kind: "p", text: "**The Restless Lifter** is the recovery quest. Your first check-in after 14 or more silent days opens it. Three check-ins in 14 days and you get a 500 XP lamp, a Ring, and a streak that restarts at 1." },
    ],
  },
  {
    id: "clues",
    label: "Clue scrolls",
    title: "Clue scrolls",
    lede: "1 in 12 per check-in. You hold one at a time. The tier is set by your Hitpoints when it drops. `/clue` shows the trail.",
    blocks: [
      {
        kind: "table",
        columns: ["Tier", "Hitpoints", "Steps", "XP", "Coins", "Unique"],
        rows: [
          ["Easy", "1–19", "2", "150", "100", "1 in 3"],
          ["Medium", "20–39", "3", "300", "200", "1 in 4"],
          ["Hard", "40–54", "4", "450", "400", "1 in 5"],
          ["Elite", "55–59", "5", "600", "700", "1 in 6"],
          ["Master", "60+", "6", "800", "1,000", "1 in 8"],
        ],
      },
      { kind: "p", text: "Steps are generic, so any clue can be finished by anyone:" },
      {
        kind: "ul",
        items: [
          "A verified photo. A verified video.",
          "A weekend check-in. A Monday check-in.",
          "Before 8am. After 8pm.",
          "Two days in a row. The same day as two other players.",
          "Deliver 200+ to the camp. Write a 20-word note.",
          "Verify someone. Check in the day after a rivalry loss. Bring in a full sack.",
        ],
      },
      { kind: "p", text: "Clues die at the Founding. Finish them or lose them. The 24 uniques are sheet cosmetics only: Ranger boots, Robin hood hat, Third-age full helm, a Bloodhound, and twenty more." },
    ],
  },
  {
    id: "verification",
    label: "Verification",
    title: "Verification",
    blocks: [
      {
        kind: "ul",
        items: [
          "A check-in with a photo or video gets a Verify button for 72 hours.",
          "Any fresh player other than the author can press it. One press is enough.",
          "**Author:** combat XP ×1.5 and +100 Slayer. +10 per further verification, up to three.",
          "**Verifier:** +25 Slayer, paid on their own next check-in within 7 days. Max 3 a day.",
        ],
      },
    ],
  },
  {
    id: "rivalries",
    label: "Rivalries",
    title: "Rivalries",
    lede: "From week 3, once the roster is 4 or more. Monday draws random pairs. No repeat pairing within 3 weeks. The odd one out plays the town: beat the roster's mean.",
    blocks: [
      {
        kind: "ul",
        items: [
          "Most weighted units wins a lamp: 10 × Hitpoints level, 150–400 XP.",
          "Tie at 2.0 or more and both win.",
          "The loser is not named. Ever.",
          "Three wins running: the Duellist title.",
        ],
      },
    ],
  },
  {
    id: "log",
    label: "Collection log",
    title: "Collection log",
    lede: "90 entries in eight categories. `/log` shows yours.",
    blocks: [
      {
        kind: "table",
        columns: ["Category", "Entries"],
        rows: [
          ["Random events", "12"],
          ["Clue uniques", "24"],
          ["Boss heads", "7"],
          ["Pets", "6"],
          ["Titles", "8"],
          ["Holiday", "7"],
          ["Milestones", "17"],
          ["Skills to 50", "9"],
        ],
      },
      {
        kind: "ul",
        items: ["30 entries: Collector.", "60 entries: a pet.", "90 entries: the Completionist cape."],
      },
    ],
  },
  {
    id: "camp",
    label: "The camp and the town",
    title: "The camp and the town",
    badge: "arrives at Founding I",
    blocks: [
      { kind: "p", text: "Every check-in hauls 20 coins and 10 logs to the camp, multiplied by your weight and your tier." },
      { kind: "p", text: "**Quiet-day rule.** A day with fewer check-ins than a quarter of the roster costs every store 1%. Never more. Nobody is named." },
      { kind: "p", text: "**Founding I** (week 13) turns the camp into a town. Everyone gets a free Bronze worker. Workers gather hourly into a sack, capped at 96 hours, delivered on your next check-in. Buildings go up. Build votes open." },
    ],
  },
  {
    id: "votes",
    label: "Votes and raid weeks",
    title: "Group votes and raid weeks",
    badge: "arrives in Act 3",
    blocks: [
      {
        kind: "ul",
        items: ["**Relic picks:** one of three, in Acts 3 and 4.", "**Build votes:** where the town's stores go next.", "**Raid weeks:** votable, opt-in hard mode. Boss HP scales to the roster. Every miss heals the boss, capped at 20 per day per head. Success is lamps for everyone."],
      },
    ],
  },
  {
    id: "year",
    label: "The year",
    title: "The year",
    lede: "Launch is Monday 14 September 2026. Four 13-week acts. Week 52 is 6–12 September 2027.",
    blocks: [
      {
        kind: "table",
        columns: ["Act", "Weeks", "Name", "What arrives"],
        rows: [
          ["1", "1–13", "Lumbridge", "Skills, streaks, random events, the camp"],
          ["2", "14–26", "Varrock", "Workers, buildings"],
          ["3", "27–39", "The Wilderness", "Raids, relics"],
          ["4", "40–52", "Dragon Slayer", "Dragon tier, the statue, Elvarg, the finale"],
        ],
      },
      { kind: "p", text: "Each act ends in a **Founding**: Town Hall +1, +10% output, stores reset, and a 500 XP Founding lamp for anyone in form 6 or more of the act's 13 weeks." },
      { kind: "p", text: "Holidays: Halloween week 7, Thanksgiving week 11, Christmas weeks 15–16, Valentine's week 22, Easter week 28, Independence week 42." },
    ],
  },
  {
    id: "commands",
    label: "Commands",
    title: "Commands",
    blocks: [
      {
        kind: "table",
        columns: ["Command", "What it does"],
        rows: [
          ["`/checkin [note] [photo]`", "Check in for today. Note and photo or video are optional."],
          ["`/play`", "Open your hub without checking in."],
          ["`/sheet [player] [public]`", "Your sheet, or someone else's. Public posts it to the channel."],
          ["`/join [ping]`", "Become a player. Pass ping to turn pings on at the same time."],
          ["`/leave`", "Retire. Sheet kept."],
          ["`/expedition weeks`", "Pause for 1–8 weeks."],
          ["`/pings on|off`", "Morning post and last call pings."],
          ["`/style`", "Accurate, Aggressive, Defensive, or Controlled."],
          ["`/lamp`", "Rub a held lamp into a skill."],
          ["`/clue`", "Your current clue trail."],
          ["`/log`", "Your collection log."],
          ["`/town`", "The camp, later the town."],
          ["`/freeze`", "Your Rings and streak state."],
          ["`/standings`", "This week's roster, weighted."],
          ["`/help`", "A short version of this page."],
          ["`/admin …`", "Admin only."],
        ],
      },
      { kind: "p", text: "Buttons: **Check In**, **Join**, **Verify**, **Ping me**, the hub buttons (**Lamp**, **Clue**, **Sheet**, **Camp**, **Log**), the three quiz answers, the lamp skill picker, and **Share to channel**." },
    ],
  },
  {
    id: "refuses",
    label: "What it refuses to do",
    title: "What this game refuses to do",
    blocks: [
      {
        kind: "ul",
        items: [
          "No purchasable streak repair. Rings are earned or they do not exist.",
          "Nothing rewards chat. Talk because you want to.",
          "No punishing rolls. Every random event is a gift or nothing.",
          "Group harm is capped at 1% and nobody is named for it.",
          "No workout-type micromanagement. You moved or you did not.",
          "Observers are invisible. Nobody gets guilted into a game they did not join.",
          "One morning post. One line per check-in. That is the bot's entire footprint.",
        ],
      },
    ],
  },
];
