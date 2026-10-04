# Yut Hut engagement backlog

Why a check-in felt flat: it was one button, one fixed outcome, and nothing to
decide. The session is arithmetic (expected values), the drops go to a bank
that buys nothing, and the only choices in the game (`/lamp`, `/style`) show up
once in twenty check-ins.

## What habit-forming games do

| Pattern | Where it comes from | What it does |
| --- | --- | --- |
| Trigger → action → variable reward → investment | Nir Eyal's Hook model | The loop itself. The reward has to vary, and the player has to leave something behind that makes the next visit better. |
| Pick one of three | Roguelike drafts, chest pickers | Agency. The reward is the player's decision, and the two they turned down are a reason to talk about it. |
| Rarity ladders and reveals | Gacha, loot boxes | Anticipation is split in two: what did I get offered, then what was inside. |
| Pity timers | Gacha "soft/hard pity" | A dry streak becomes a counter climbing towards a guarantee instead of bad luck. |
| Goal gradient, endowed progress | Kivetz et al. 2006 (coffee cards) | People speed up as a visible goal gets close. Show the nearest goal every time. |
| Milestone chest at the target | Daily/weekly login chests | The target behaviour itself opens something, at the moment it happens. |
| Streak with a freeze | Duolingo | Loss aversion, softened so one miss does not end it. (Form weeks and Rings already do this, weekly rather than daily.) |
| Rotating daily offer | Shop rotations, daily deals | A reason to look today that is not a streak. |
| Currency sinks and loadouts | Every F2P economy | Loot matters because it buys the next run's edge. |
| Achievement ladders | Battle pass tracks, achievement tiers | Long goals with a bar on each. |
| Collections | Collection logs, card albums | Completion pull: 7 of 11. |

## Constraints kept

Two a week is the whole game (nothing here pays more for a third check-in than
the weight already allows); only players exist; nothing is awarded except by a
check-in; a fresh check-in gates every action; everything is async; and the
mechanics and numbers are Old School RuneScape's (wiki tables through
`fetch-osrs.mjs`), not invented. No daily streaks.

## Backlog

- [x] **1. Spoils: pick one of three after every check-in.** Your roll (an
  impling jar or a reward chest, real wiki loot table), today's featured
  container, and a sure thing (Book of knowledge, supply crate, clue). Unpicked
  spoils open themselves at the next check-in. `src/spoils.ts`, migration 0008.
- [x] **2. Rarity ladder and pity.** Containers sit on five tiers; a counter of
  dry check-ins guarantees a rare one, and `/spoils` shows the counter.
- [x] **3. The week's chest.** The second check-in of the week rolls its
  container with advantage, better again on a long Form streak. Third check-in
  onward the pickings are slimmer.
- [x] **4. Today's impling.** One featured container a day, the same for
  everyone, named on the morning post.
- [x] **5. Grand Exchange (`/ge`).** Banked loot is spendable: a super combat
  potion or sharks for the next session, bones for Prayer.
- [x] **6. Achievement Diary (`/diary`).** Easy, Medium, Hard, Elite task lists
  with progress bars; each tier pays its real antique lamp.
- [x] **7. "Next up" on every receipt.** The nearest goals, with numbers.
- [x] **8. Collections.** Containers opened (n of 17) in `/spoils`.
- [x] **9. New images.** A spoils card for every opening, a diary card, and
  sprites for jars, chests, potions, food and books.
- [x] **10. New endpoints.** `/spoils`, `/ge`, `/diary`; render routes
  `api/yut/spoils`, `api/yut/diary`; admin seams for the harness.
- [x] **11. Reminders, help, rules page, README, tests.**

## Backlog 2: depth

The first pass made the check-in a decision. This one gives the game things to
own, chase and tend between check-ins. No Duel Arena.

- [x] **12. Gear from Slayer drops.** The equipment the task monsters really
  drop is wearable: boots from bronze to granite, the brine sabre, leaf-bladed
  sword, granite maul, dragon dagger and mace, the abyssal whip, the black mask.
  Real bonuses and requirements; the session uses what is worn. `/gear`.
- [x] **13. Adapted drop rates.** Wearable drops fall at four times the wiki's rate
  (two sessions a week, not two hours a night), and the one item a player is
  chasing at twice that again.
- [x] **14. Cosmetics to flex and chase.** A wardrobe of looks worn over the
  armour: the mystic sets, coloured gloves, flippers, capes, monster heads and
  champion scrolls as trophies, and every clue unique. A gear card to show off,
  a wardrobe count, and a wishlist that says where the piece drops.
- [x] **15. Slayer choices.** Pick a master you qualify for, and block tasks
  with points, so a player can steer towards the monster that drops what they
  want.
- [x] **16. Managing Miscellania (weekly).** A personal kingdom: ten subjects
  split across herbs, fishing, mining, wood and flax, a coffer funded from the
  bank, approval that falls daily and rises with check-ins. Collect when you
  like; a week's worth is the rhythm.
- [x] **17. Farm runs (daily).** Farming as a tenth skill: an allotment, a herb
  patch and a tree patch, planted with the seeds the kills already drop, one
  run a day.
- [x] **18. Tears of Guthix (weekly).** Once a week, XP into the lowest skill,
  sized by the group's quest points.
- [x] **19. Reminders, receipts and the hub know about all of it.**
- [x] **20. A gear card, sprites, rules page, README, tests.**

## Backlog 3: the group

- [x] **21. The boss of the week.** Scurrius, Obor and Bryophyta in rotation
  from week one. Every check-in swings at a bar the roster shares; a player's
  first real kill's worth of damage each week rolls the boss's real table; when the bar empties,
  everyone who fought gets a roll and the channel hears about it. `/boss`.
- [x] **22. Boss uniques in the wardrobe.** Scurrius' spine, Scurry, the hill
  giant club (a usable weapon) and Bryophyta's essence, all chaseable.
- [x] **23. Private reminders.** A player's own to-do list, shown only to them:
  on the receipt, the rest-day reply, the hub, `/todo`, and a My to-do button
  on the morning post. The channel's evening message keeps only the group's
  business.
- [x] **24. First-time nudges.** The list says so when a player has never
  planted the farm, funded the kingdom, picked something to chase, or is
  holding gear they are not wearing.
