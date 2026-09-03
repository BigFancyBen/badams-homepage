import type { RuleSection } from "./types";

export const ACCENT = "#a3be8c";
export const ACCENT_WARM = "#ebcb8b";

export const SUMMARY =
  "A year-long workout-accountability campaign that lives in the yut-hut Discord channel. You check in when you exercise. The bot turns check-ins into RuneScape-style XP, tiers, streaks, and a shared town. Two a week keeps you in form. Nothing else is required and nothing else is rewarded.";

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
          "You get an ephemeral receipt. It doubles as your play hub: Lamp, Clue, Sheet, Town, Log, Bingo, Shop, Votes.",
          "The channel sees one line per check-in. That is all the noise the bot makes about you.",
          "Sunday 5pm Mountain: last call. Nobody is named.",
          "Monday: the week resolves. Streaks, Rings, and rivalries settle. From Act 2 the build vote opens.",
          "The 1st of each month: a campaign log of the month just gone.",
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
      { kind: "p", text: "Fresh means you have checked in within the last 4 days. Fresh is what unlocks every action: rubbing lamps, working clues, verifying others, changing style, opening the hub, and running the town." },
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
          ["Hitpoints", "Every check-in. 2,000 XP, times the weight."],
          [
            "Attack / Strength / Defence",
            "Every check-in. 2,000 XP, times the weight, split by your **combat style**: Accurate → Attack, Aggressive → Strength, Defensive → Defence, Controlled → a third each. Set it with `/style` or from the hub.",
          ],
          [
            "Slayer",
            "Verified check-ins: the author gets +1,000, and +100 per further verification. Verifying someone else: +250, paid on your own next check-in.",
          ],
          ["Prayer", "1,500 per Form week. +1,000 more if you hit 3+ that week. The Chapel adds 500 per level."],
          ["Woodcutting", "Logs delivered on check-in."],
          ["Mining / Fishing", "Worker sacks, from week 13 (Founding I)."],
        ],
      },
      { kind: "p", text: "The XP table is RuneScape's, exactly. Level 99 is 13,034,431 XP." },
      {
        kind: "table",
        columns: ["Level", "XP"],
        rows: [
          ["2", "83"],
          ["10", "1,154"],
          ["20", "4,470"],
          ["30", "13,363"],
          ["40", "37,224"],
          ["50", "101,333"],
          ["60", "273,742"],
          ["70", "737,627"],
          ["92", "6,517,253"],
          ["99", "13,034,431"],
        ],
      },
      { kind: "note", text: "Two a week, every week, is a Dragon at the finale. The awards are tuned to that promise." },
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
    lede: "1 in 6 per check-in; a Tavern makes it 1 in 5, then 1 in 4. Pity at 12: go twelve check-ins without one and the next is certain.",
    blocks: [
      {
        kind: "table",
        columns: ["Event", "Weight", "What happens"],
        rows: [
          ["Genie", "30", "A lamp worth 100 × the chosen skill's level, 1,000–6,000 XP. Unrubbed after 14 days, it rubs itself into Hitpoints."],
          ["Mysterious Old Man", "15", "150 of a resource to the town."],
          ["Drunken Dwarf", "12", "A Ring of Life, or 200 coins if you are full."],
          ["Evil Chicken", "10", "+1,500 Defence."],
          ["Sandwich Lady", "8", "+1,500 Hitpoints."],
          ["Beekeeper", "8", "Workers +25% for 24 hours."],
          ["Quiz Master", "7", "Three-button trivia. Right: +2,000 combat XP. Wrong: 50 coins to the town."],
          ["Freaky Forester", "5", "Repairs the worst building, or leaves logs."],
          ["Drill Demon", "3", "A bounty. Check in again within 3 days for a 4,000 XP lamp."],
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
          "**Rings of Life** are earned, never sold. Weeks 1–8: one per 3 Form weeks. From week 9: one per 2. Cap of 2, or 3 after Graduation. The Last Recall relic adds one to the cap and deals a Ring every Form week.",
          "A Ring is spent automatically on a week that closed at exactly one check-in. A week at zero breaks the streak regardless. No Ring saves a zero.",
          "**Bootstrap:** your first two weeks after joining pay double Hitpoints.",
          "**Graduation** is your week 13.",
        ],
      },
      { kind: "p", text: "**The Restless Lifter** is the recovery quest. Your first check-in after 14 or more silent days opens it. Three check-ins in 14 days and you get a 5,000 XP lamp, a Ring, and a streak that restarts at 1." },
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
          ["Easy", "1–19", "2", "1,500", "100", "1 in 3"],
          ["Medium", "20–39", "3", "3,000", "200", "1 in 4"],
          ["Hard", "40–54", "4", "4,500", "400", "1 in 5"],
          ["Elite", "55–59", "5", "6,000", "700", "1 in 6"],
          ["Master", "60+", "6", "8,000", "1,000", "1 in 8"],
        ],
      },
      { kind: "p", text: "Steps are generic, so any clue can be finished by anyone. They can be done in **any order**, one step per check-in:" },
      {
        kind: "ul",
        items: [
          "A verified photo. A verified video.",
          "A weekend check-in. A Monday check-in.",
          "Before 8am. After 8pm.",
          "Two days in a row. The same day as two other players.",
          "Deliver 200+ to the town. Write a 20-word note.",
          "Verify someone. Check in the day after a rivalry loss. Check in during a raid week. Bring in a full sack.",
        ],
      },
      { kind: "note", text: "Three steps wait for their systems: delivering 200+ needs the town, a raid-week check-in needs raids, and a full sack needs workers. A clue is never dealt a step you cannot yet complete." },
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
          "**Author:** combat XP ×1.5 and +1,000 Slayer. +100 per further verification, up to three.",
          "**Verifier:** +250 Slayer, paid on their own next check-in within 7 days. Max 3 a day.",
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
          "Most weighted units wins a lamp: 100 × Hitpoints level, 1,500–4,000 XP.",
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
    lede: "The camp runs from day one. At week 13, Founding I, it becomes a town with workers and buildings. `/town` shows it.",
    blocks: [
      { kind: "p", text: "Every check-in hauls 20 coins and 10 logs to the town, multiplied by your weight and your tier. Ore delivered is smelted at the Furnace, five to a bar." },
      { kind: "p", text: "**Quiet-day rule.** A day with fewer check-ins than a quarter of the roster costs every store 1%. Never more. Nobody is named." },
      { kind: "p", text: "**Workers** gather one resource each, hourly, into a sack: a Miner brings ore, a Woodcutter logs, a Fisher fish, a Merchant coins. The sack fills for 96 hours, plus 24 per Bank level, and empties into the town on your next check-in." },
      {
        kind: "ul",
        items: [
          "**Slots:** 1 + one more per 15 Hitpoints levels.",
          "**Recruiting** costs 300 coins × the workers you already own. Your first is free at the Founding.",
          "Workers eat 6 fish a day. A hungry worker runs at half rate.",
          "Fresh players only: `/recruit kind`, `/upgrade`, `/build building`, `/repair building`.",
          "After 21 silent days a player's workers go to the town and work at half rate until they come back.",
        ],
      },
      {
        kind: "table",
        columns: ["Worker tier", "Per hour", "Upgrade cost", "Needs"],
        rows: [
          ["Bronze", "2", "Free at the Founding", ""],
          ["Iron", "3", "150 coins, 20 ore", ""],
          ["Steel", "4", "250 coins, 40 ore", ""],
          ["Black", "5", "400 coins, 60 ore, 20 logs", ""],
          ["Mithril", "7", "700 coins, 100 ore, 40 logs", ""],
          ["Adamant", "9", "1,200 coins, 160 ore, 80 logs", ""],
          ["Rune", "12", "2,000 coins, 250 ore, 120 logs, 20 bars", "Furnace L2"],
          ["Dragon", "16", "3,500 coins, 400 ore, 200 logs, 50 bars", "Furnace L3 and a Dragon-tier owner"],
        ],
      },
      { kind: "p", text: "**Buildings** go up from the town's stores. Level 1 costs are below; level 2 is 2.5× and level 3 is 6×. Buildings lose 3 condition a day, repairs cost 2 logs a point, and a building under 50% gives half its bonus." },
      {
        kind: "table",
        columns: ["Building", "Level 1", "From", "Effect"],
        rows: [
          ["Bank", "200 coins, 150 logs", "Act 2", "Sacks fill 24 hours longer per level"],
          ["Furnace", "300 coins, 200 logs", "Act 2", "Smelts ore into bars. L2 unlocks Rune workers, L3 Dragon"],
          ["Fishing Dock", "200 coins, 150 logs, 50 ore", "Act 2", "Fish +25% per level"],
          ["Lumber Mill", "200 coins, 150 logs, 50 ore", "Act 2", "Logs +25% per level"],
          ["Mine Cart", "200 coins, 150 logs, 50 ore", "Act 2", "Ore +25% per level"],
          ["Chapel", "300 coins, 200 logs", "Act 2", "Prayer +500 per Form week per level"],
          ["Tavern", "400 coins, 250 logs", "Act 2", "Random events 1 in 6 → 1 in 5 → 1 in 4 (two levels)"],
          ["Barracks", "600 coins, 300 logs, 100 ore", "Act 3", "Raid damage +10% per level"],
          ["Walls", "600 coins, 300 logs, 100 ore", "Act 3", "Raid heals −5 per miss per level"],
          ["Dragon Statue", "2,000 coins, 900 logs, 100 bars", "Act 4", "The finale. +10% to everything, forever"],
        ],
      },
    ],
  },
  {
    id: "votes",
    label: "Votes, relics, raids",
    title: "Votes, relics and raid weeks",
    lede: "Build votes open in Act 2, relic picks land at weeks 27 and 40, and raids can be proposed from Act 3. `/vote`, `/relics` and `/raid status` show where each stands.",
    blocks: [
      { kind: "p", text: "**Build votes.** Every Monday from Act 2 the bot lists up to four buildings the town can afford. Quorum is half the active roster, rounded up, and never fewer than 2. The vote closes after 48 hours; if it falls short, the options carry over to the next Monday." },
      { kind: "p", text: "**Relic picks.** At weeks 27 and 40 the roster is offered three relics and has 72 hours to choose. Silence picks the first. Relics last the rest of the year." },
      {
        kind: "table",
        columns: ["Relic", "Effect"],
        rows: [
          ["Xeric's Endurance", "Your 3rd and 4th check-ins weigh 0.75 instead of 0.5"],
          ["Trickster", "Random events give +4 bingo points"],
          ["Fire Sale", "Worker upgrades cost 25% less"],
          ["Production Master", "Worker output +20%"],
          ["Last Recall", "Ring cap +1 and a Ring every Form week"],
          ["Berserker", "Raid damage +25%"],
          ["Treasure Seeker", "Lamps are worth ×1.5"],
          ["Golden God", "+20 coins to the town per check-in"],
        ],
      },
      { kind: "p", text: "**Raid weeks** are the opt-in hard mode. From Act 3 anyone can `/raid propose`. The vote needs 60% of the active roster and at least 3 yes votes; a Sit out button keeps you off the roster with no penalty. The raid starts the next Monday with the roster frozen." },
      {
        kind: "ul",
        items: [
          "**Boss HP** = roster size × 2.4 × (100 + 2 × the roster's mean Hitpoints) × the boss multiplier.",
          "**Damage** per check-in = (100 + 2 × your Hitpoints) × your weight × the Barracks bonus × Berserker.",
          "**Heals:** 20 per roster member under form per day, capped at 80. Each Walls level takes 5 off every heal.",
          "**Win:** a lamp for everyone on the roster, worth 100 × Hitpoints and at least 2,000 XP, plus one more for anyone with 3+ that week, and 1,000 coins and 200 bars to the town.",
          "**Loss:** the town loses 15% of its stores, once, and every building loses 20 condition. Three losses lock raids for 4 weeks.",
        ],
      },
      {
        kind: "table",
        columns: ["Boss", "Order", "Multiplier"],
        rows: [
          ["Giant Mole", "1st", "×0.8 — proposed by the bot at week 27"],
          ["King Black Dragon", "2nd", "×1.0"],
          ["Kalphite Queen", "3rd", "×1.0"],
          ["Chaos Elemental", "4th", "×1.0"],
          ["Corporeal Beast", "5th", "×1.2"],
          ["Elvarg", "Act 4", "×2 HP over 14 days — proposed by the bot at week 50"],
        ],
      },
    ],
  },
  {
    id: "bingo",
    label: "Bingo and the shop",
    title: "Bingo and the shop",
    lede: "A 5×5 bingo card per act. Cells claim themselves; you never have to remember to tick one. `/bingo` shows the card, `/shop` spends the points.",
    blocks: [
      {
        kind: "ul",
        items: [
          "Each cell is worth its points once. A completed line pays **+5** and a blackout **+40**.",
          "When every active player has at least one line, the town gets a 500-coin crate.",
          "Acts 2–4 swap in worker, raid and Dragon cells for the ones you have outgrown.",
        ],
      },
      { kind: "p", text: "The Act 1 card, with points in brackets:" },
      {
        kind: "table",
        columns: ["B", "I", "N", "G", "O"],
        rows: [
          ["First check-in (1)", "Two check-ins in one week (2)", "A verified check-in (2)", "Check in before 8am (2)", "Reach Mithril (3)"],
          ["Check in with a note (1)", "A Saturday check-in (1)", "Verify three friends (2)", "Two days in a row (2)", "Three Form weeks in a row (3)"],
          ["Check in after 8pm (1)", "Rub a lamp (2)", "10 check-ins (3)", "A Sunday check-in (2)", "Same day as three others (2)"],
          ["A Monday check-in (1)", "Reach Adamant (3)", "A verified video (2)", "Two verified in one week (2)", "Four different weekdays in one week (2)"],
          ["A note that says PR (1)", "Beat the Quiz Master (2)", "Any skill to 30 (3)", "Six Form weeks in a row (3)", "Reach Rune (3)"],
        ],
      },
      { kind: "p", text: "**The shop** takes bingo points and sells only cosmetics and small lamps. Rings of Life are never for sale." },
      {
        kind: "table",
        columns: ["Item", "Points", "Choices"],
        rows: [
          ["Small lamp", "15", "2,000 XP into a skill of your choice"],
          ["Sheet trim", "30", "Gold, silver, obsidian, third-age"],
          ["A title", "25", "of Lumbridge, the Relentless, Ironman, of the Wilderness, the Early Riser"],
          ["Name a worker", "10", ""],
          ["Town crate", "20", "A resource drop for the town"],
          ["Pet", "50", "Baby Mole, Chompy chick"],
          ["Act cape", "60", "The cape of the current act"],
        ],
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
        columns: ["Act", "Weeks", "Name", "What activates"],
        rows: [
          ["1", "1–13", "Lumbridge", "Skills, streaks, random events, clues, rivalries, bingo, the camp"],
          ["2", "14–26", "Varrock", "Founding I: workers, sacks, buildings, build votes"],
          ["3", "27–39", "The Wilderness", "Relic picks, raid weeks, Barracks and Walls"],
          ["4", "40–52", "Dragon Slayer", "Dragon tier, the Dragon Statue, Elvarg, the finale"],
        ],
      },
      { kind: "p", text: "Each act ends in a **Founding**: Town Hall +1, +10% output, stores reset, and a 5,000 XP Founding lamp for anyone in form 6 or more of the act's 13 weeks." },
      { kind: "p", text: "Holidays: Halloween week 7, Thanksgiving week 11, Christmas weeks 15–16, Valentine's week 22, Easter week 28, Independence week 42." },
      { kind: "p", text: "On the 1st of every month the bot posts a campaign log: who was in form, what the town built, what the month's lamps and clues came to." },
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
          ["`/town`", "The town: stores, workers, buildings."],
          ["`/recruit kind`", "Hire a Miner, Woodcutter, Fisher, or Merchant."],
          ["`/upgrade`", "Take a worker up a tier."],
          ["`/build building`", "Put a building up, or take it up a level."],
          ["`/repair building`", "Spend logs on condition."],
          ["`/vote`", "This week's build vote."],
          ["`/relics`", "The relic pick, or the relics held."],
          ["`/raid status|propose`", "The current raid, or propose one from Act 3."],
          ["`/bingo`", "This act's card and your points."],
          ["`/shop`", "Spend bingo points."],
          ["`/freeze`", "Your Rings and streak state."],
          ["`/standings`", "This week's roster, weighted."],
          ["`/help`", "A short version of this page."],
          ["`/admin …`", "Admin only."],
        ],
      },
      { kind: "p", text: "Buttons: **Check In**, **Join**, **Verify**, **Ping me**, **Sit out**, the hub buttons (**Lamp**, **Clue**, **Sheet**, **Town**, **Log**, **Bingo**, **Shop**, **Votes**), the three quiz answers, the lamp skill picker, the vote options, and **Share to channel**." },
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
