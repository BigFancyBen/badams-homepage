import type { Shot } from "./ShotGallery";
import type { DiscordMessage } from "./DiscordFeed";

/** The screenshots and copy behind the homepage cards. */

export const PROGNOSTICATOR_SCREENSHOTS = [
  {
    src: "/prognosticator/01-dashboard.webp",
    label: "Command Center",
    bg: "#1a1a2e",
    description: "The home screen links to all the tools: Now Playing, Effect Picks, the Disperser, Lights, Gear Setup, Scene Controls, and your playlists and tags. When you import a Spotify playlist, it downloads each track from YouTube and gets the BPM and key from VirtualDJ.",
  },
  {
    src: "/prognosticator/02-playlist-browser.webp",
    label: "Playlist Browser",
    bg: "#1a1a2e",
    description: "Imported playlists show as a grid of album art with Camelot key, BPM and length on every card, colored by key. Filter by key or BPM, or search by title and artist. Click a card to open the song.",
  },
  {
    src: "/prognosticator/03-song-detail.webp",
    label: "Vibes and Energy",
    bg: "#1a1a2e",
    description: "Each song gets a preview player, an energy rating from 1 to 5, and vibe tags like Groovy, Hypnotic or Peak-time that you can filter by. The Deck buttons load the track into VirtualDJ.",
  },
  {
    src: "/prognosticator/04-now-playing.webp",
    label: "Live Deck View",
    bg: "#1a1a2e",
    description: "Shows both VirtualDJ decks with album art, live BPM and key. Click a deck to filter the library down to tracks that mix well with it by key and BPM. Auto mix does beat-synced crossfades from 16 to 128 beats long and can swap the bass between decks.",
  },
  {
    src: "/prognosticator/05-song-requests.webp",
    label: "Song Requests",
    bg: "#1a1a2e",
    description: "Paste a YouTube or Spotify link, or search either one from the request box. Spotify requests stream through VirtualDJ right away, so you don't have to wait for a download. Requests go into their own playlist, and you can watch downloads progress.",
  },
  {
    src: "/prognosticator/06-effect-picks.webp",
    label: "Effect Picks",
    bg: "#1a1a2e",
    description: "The board shows three cards at a time, each one a light effect paired with a video look. Tap a card and it starts on the next downbeat, runs for a set number of beats, then goes back to the normal show. A palette picker sets the colors for all the light effects.",
  },
  {
    src: "/prognosticator/07-disperser-runtime.webp",
    label: "Disperser Director",
    bg: "#1a1a2e",
    description: "Pick a venue and the Disperser cycles through idle light looks and OBS scenes in time with the music. Effect pads trigger strobes, fog and laser sweeps on demand, with a countdown of beats left. Changes snap to the next bar or phrase so they stay on time.",
  },
  {
    src: "/prognosticator/08-lights.webp",
    label: "Lights and Rigs",
    bg: "#1a1a2e",
    description: "Build rigs out of 87 actions and 122 group animations that target lights by name, so you don't have to work with raw DMX channels. A rig switches between its actions on bar lines. The same rigs also run the lights in the Godot warehouse scene.",
  },
  {
    src: "/prognosticator/09-scene-controls.webp",
    label: "Scene Controls",
    bg: "#1a1a2e",
    description: "Switch the warehouse camera between nine views, including CCTV, fixture POV and a phone cam. Camera changes wait for the next downbeat. Below that are strobe timing and flash length settings for the DMX rig, all synced to VirtualDJ's beat.",
  },
  {
    src: "/prognosticator/10-gear-setup.webp",
    label: "Gear Setup",
    bg: "#1a1a2e",
    description: "Drag your DMX devices around a canvas, with each one's channels labeled and a panel for the master dimmers. Fixture definitions come from Open Fixture Library, which has over 2,000 of them. If no DMX interface is plugged in, the app runs a virtual one so you can still see the lighting on screen.",
  },
];

export const WAREHOUSE_SCENE = {
  title: "Warehouse",
  description:
    "A procedurally generated club, lit only by DMX values. The same rigs, actions and Effect Picks cards that run the real lights also run its 104 virtual fixtures. Each load builds a new layout: concrete rooms, blacklight hallways with graffiti, and outdoor plazas up to 200 meters across with huge wheels, towers and arches on the horizon. A virtual camera cuts between wide, drone, jib and crowd shots on the beat.",
  tags: ["Godot 4", "GDScript", "DMX", "Beat sync", "Procedural generation", "Spout"],
  shots: [
    {
      src: "/prognosticator/warehouse/01-red-beams-wheel-megastructure.webp",
      video: "/prognosticator/warehouse/loop.mp4",
      hold: 24000,
      label: "Red plaza",
      caption: "The biggest outdoor area with the whole rig in red, and the giant structures on the horizon.",
      alt: "Red lasers and moving-head beams sweeping across a night plaza, with giant wheel and tower megastructures against a blue dusk.",
    },
    {
      src: "/prognosticator/warehouse/02-red-laser-sweep-gear-wall.webp",
      label: "Gear wall",
      caption: "A red laser fan off a truss tower, across a wheel the size of a hill.",
      alt: "A red laser fan from a truss tower sweeping across a colossal gear-covered wheel structure at dusk.",
    },
    {
      src: "/prognosticator/warehouse/03-colonnade-gear-dusk.webp",
      label: "Colonnade",
      caption: "The plaza's colonnade in front of the wheel and a stepped tower.",
      alt: "A stone colonnade railing in front of a huge wheel and stepped tower, red lasers rising from a mast.",
    },
    {
      src: "/prognosticator/warehouse/04-red-beam-foreground.webp",
      label: "Beam",
      caption: "A moving head's beam right across the lens, with the wheel behind it.",
      alt: "A thick red beam sweeping through haze across the frame, a giant wheel structure behind it.",
    },
    {
      src: "/prognosticator/warehouse/05-red-laser-burst-portal-tower.webp",
      label: "Portal tower",
      caption: "A laser hit in front of a tower with an oval portal.",
      alt: "A red laser bursting from a pylon in front of a dark tower with a glowing oval portal.",
    },
    {
      src: "/prognosticator/warehouse/06-red-pars-crowd-wheels.webp",
      label: "Pars and crowd",
      caption: "Three red pars over the crowd, and a laser cutting past the portal tower.",
      alt: "Three red par cans lighting the crowd at left, a diagonal red laser and a portal tower behind.",
    },
  ] satisfies Shot[],
};

export const SM64_SCENE = {
  title: "Super Mario 64",
  description:
    "The warehouse's DMX lights reskinned for Super Mario 64: the pars are Power Stars, the moving heads are cannons, the lasers are Amps, and the lava is eight pars. The open-source decomp port runs as a library inside Godot, and Godot renders each frame. All 45 areas have their own lighting setup and DJ Peach on the decks. An autopilot plays Mario in time with the music while the camera cuts between nine angles. Bring your own ROM.",
  tags: ["Godot 4", "GDScript", "GDExtension", "C", "DMX", "Beat sync"],
  shots: [
    {
      src: "/prognosticator/sm64/01-jolly-roger-bay.webp",
      video: "/prognosticator/sm64/loop.mp4",
      label: "Jolly Roger Bay",
      caption: "Mario running toward a bank of coins used as blinders, under star-shaped pars and a laser.",
      alt: "Mario seen from behind running across Jolly Roger Bay's sandy ground, with a coin bank glowing at left, a pink star light and a vertical laser.",
    },
    {
      src: "/prognosticator/sm64/02-sand-stage-spotlights.webp",
      label: "Sand stage",
      caption: "Spotlights with airborne dust and lens streaks over a stretch of sand.",
      alt: "Mario mid-stride on pale sand under bright white spotlights, with dust motes and horizontal lens streaks.",
    },
    {
      src: "/prognosticator/sm64/03-bobomb-battlefield.webp",
      label: "Bob-omb Battlefield",
      caption: "A Bob-omb and Mario at night, with pink pars lighting the stone ground.",
      alt: "Mario and a red Bob-omb on dark grass at night, pink light cones above and a green pipe.",
    },
    {
      src: "/prognosticator/sm64/04-castle-grounds-stars.webp",
      label: "Castle grounds",
      caption: "Power Stars working as pars, throwing pink beams and a red spot onto the lawn.",
      alt: "Mario jumping on the castle lawn at night under floating pale stars, with a pink beam fan and a red floor spot.",
    },
    {
      src: "/prognosticator/sm64/05-bay-laser-vista.webp",
      label: "Laser vista",
      caption: "A high camera angle over the bay, with laser fans and star pars in the haze.",
      alt: "A wide high view of the bay with blue laser lines fanning out, pink stars, coin banks, green pipes and a small Mario in the middle.",
    },
    {
      src: "/prognosticator/sm64/06-night-hillside-beam.webp",
      label: "Hillside beam",
      caption: "A cannon moving head throwing a white beam across a hillside at night, with a neon DJ stage at the top right.",
      alt: "A dark hillside seen from above with a wide white volumetric beam crossing the frame and a small neon-trimmed platform at top right.",
    },
  ] satisfies Shot[],
};

export const MK64_SCENE = {
  title: "Mario Kart 64",
  description:
    "Mario Kart 64 running under the same 104-light rig as the warehouse, so the lights, rigs and Effect Picks cards that run the club also run the racetrack. The decomp's PC port is built as a library that Godot steps one frame at a time and renders. All 20 courses (16 race tracks and 4 battle arenas) have their own lighting setup. When nobody's playing, CPU drivers race while the camera cuts between 12 angles on the downbeat, and up to four people can grab a controller and play split screen. Bring your own ROM.",
  tags: ["Godot 4", "GDScript", "GDExtension", "C", "DMX", "Beat sync"],
  shots: [
    {
      src: "/prognosticator/mk64/01-luigi-spotlight-sweep.webp",
      video: "/prognosticator/mk64/loop.mp4",
      hold: 28000,
      label: "Luigi Raceway",
      caption: "CPU drivers racing through Luigi Raceway, Toad's Turnpike and Bowser's Castle at night, with the lights running live.",
      alt: "Luigi Raceway at night, white spotlights sweeping down from a truss onto the track, a kart ahead.",
    },
    {
      src: "/prognosticator/mk64/04-red-beams-turn.webp",
      label: "Red beams",
      caption: "Red beams from a pylon over a bend, past the Koopa Air hoardings.",
      alt: "Red light beams from a lighting pylon over a bend of Luigi Raceway, a kart on the track and a Koopa Air wall behind.",
    },
    {
      src: "/prognosticator/mk64/02-magenta-lamp-straight.webp",
      label: "Night straight",
      caption: "A magenta lamp glows on the verge of the back straight.",
      alt: "A kart on a dark straight with a magenta lamp glow on the verge.",
    },
    {
      src: "/prognosticator/mk64/03-brick-tunnel-kart.webp",
      label: "The tunnel",
      caption: "Into the brick tunnel under warm work lights.",
      alt: "A kart entering a warm-lit brick tunnel.",
    },
    {
      src: "/prognosticator/mk64/05-turnpike-pink-flare.webp",
      label: "Toad's Turnpike",
      caption: "Traffic under a lit gantry on Toad's Turnpike.",
      alt: "Toad's Turnpike at night, a bus and a truck ahead under an overhead gantry with pink light.",
    },
    {
      src: "/prognosticator/mk64/06-thwomps-castle.webp",
      label: "Bowser's Castle",
      caption: "Two Thwomps hang over the checkered floor in amber light.",
      alt: "Two Thwomps hovering over a red and checkered floor in Bowser's Castle, lit amber, with a small kart below.",
    },
  ] satisfies Shot[],
};

export const TESTQ = {
  title: "testq",
  tagline: "A job queue for all the Godot runs on my PC.",
  description:
    "The warehouse, the two Nintendo scenes, the rafting game and Oathkeep all run their tests and captures on one PC, from a couple dozen worktrees at once. When two test suites started at the same time, they slowed each other down enough to fail timing-sensitive tests, and those failures looked just like real bugs. testq is a small daemon that hands out the machine's CPU and GPU slots, and each run script checks with it before launching Godot.",
  features: [
    { label: "Separate from the projects", text: "A capture in the DJ app and a physics test in the rafting game don't know about each other, so the queue lives in its own repo outside both." },
    { label: "Shortest first", text: "It estimates each job's length from its past runs, so a 20-second test doesn't get stuck behind two 11-minute suites. Jobs that have been waiting a long time move to the front." },
    { label: "Hung runs get killed", text: "If Godot stalls or runs past its time limit, testq kills it and frees the slot. If a client crashes, testq takes its slots back in about five seconds." },
    { label: "Status page", text: "A web page and a tray icon show what's running, what's queued and roughly when it'll start. Finished runs are saved in SQLite, which makes flaky tests easy to find." },
  ],
  tags: ["Python", "SQLite", "Node", "Bash", "PowerShell", "Godot"],
  repoUrl: "https://github.com/BigFancyBen/testq",
  image: {
    src: "/testq/page.webp",
    alt: "The testq status page: eight CPU slots and two GPU slots all in use, five running jobs across mfrs and prognosticator worktrees with progress bars, five queued jobs with estimated start times and what each is waiting for, and recent results including one marked killed: stalled",
    width: 1600,
    height: 1166,
  },
};

export const RADIANCE_SCREENSHOTS = [
  { src: "/radiance/lights.webp", label: "Smart light controls", bg: "#161616" },
  { src: "/radiance/games-idle.webp", label: "TV launcher", bg: "#161616" },
  { src: "/radiance/games-visualizer.webp", label: "Music visualizer", bg: "#161616" },
  { src: "/radiance/games-playing.webp", label: "Game touchpad", bg: "#161616" },
  { src: "/radiance/games-kodi.webp", label: "Kodi remote", bg: "#161616" },
  { src: "/radiance/tunes.webp", label: "Music queue", bg: "#161616" },
  { src: "/radiance/wifi.webp", label: "Guest Wi-Fi and gamepad", bg: "#161616" },
  { src: "/radiance/settings-system.webp", label: "System settings", bg: "#080808" },
  { src: "/radiance/settings-stats.webp", label: "System stats", bg: "#080808" },
];

export const MTG_SCREENSHOTS = [
  { src: "/magic/tutor-helper.webp", label: "Tutor Helper", bg: "#1a1a1a" },
  { src: "/magic/commander.webp", label: "Commander", bg: "#1a1a1a" },
  { src: "/magic/token-helper.webp", label: "Token Helper", bg: "#1a1a1a" },
];

export const SCRANDLE_SHOTS: Shot[] = [
  {
    src: "/scrandle/site-01-pick.webp",
    label: "Pick a plate",
    caption: "Two plates from the Discord. Pick the one people rated higher.",
    alt: "Scrandle round 1 of 10: two plates side by side, a breaded cutlet with sweet potato and a seared steak, with the question of which the channel rated higher",
  },
  {
    src: "/scrandle/site-02-reveal.webp",
    label: "The reveal",
    caption: "After you pick, you see both ratings, who cooked each plate, and the point gap.",
    alt: "After the pick, both plates show their channel ratings, 1429 and 1571, and the cook's name. The higher plate is outlined green and the page says Right, 142 points in it",
  },
  {
    src: "/scrandle/site-03-midgame.webp",
    label: "Midway through",
    caption: "Ten rounds a week, with your rights and wrongs tracked along the top.",
    alt: "Round 6 of 10 revealed, with a progress strip of green and red squares along the top and a running score of 5 of 10",
  },
  {
    src: "/scrandle/site-04-score.webp",
    label: "Your score",
    caption: "Your score to paste into the chat, plus how each of the ten pairs went.",
    alt: "End screen showing a 7 of 10 score, a Copy score button, and a list of all ten pairs with ratings and thumbnails",
  },
];

export const SCRANBOT_MESSAGES: DiscordMessage[] = [
  {
    id: "matchup",
    timestamp: "09/28/2026 9:00 AM",
    text: "**Today's matchup**",
    image: {
      src: "/scranbot/01-matchup.webp",
      alt: "Bot card with two numbered food photos side by side, a Detroit-style pizza and fried chicken with fries, each with its name underneath and the matchup number in the corner",
      width: 800,
      height: 420,
    },
    buttons: ["1", "2"],
  },
  {
    id: "result",
    timestamp: "09/29/2026 9:00 AM",
    image: {
      src: "/scranbot/02-result.webp",
      alt: "Result card: the same two photos with vote shares of 67 and 33 percent, vote counts, and each cook's name, with the winner outlined in green and the loser dimmed",
      width: 800,
      height: 420,
    },
  },
  {
    id: "ballot",
    timestamp: "09/30/2026 9:00 AM",
    text: "**Rank the plates**",
    image: {
      src: "/scranbot/03-ballot.webp",
      alt: "Ranking card with five numbered food photos in a grid under the header Rank the plates",
      width: 800,
      height: 531,
    },
    buttons: ["1", "2", "3", "4", "5"],
  },
  {
    id: "ballot-result",
    timestamp: "10/01/2026 9:00 AM",
    image: {
      src: "/scranbot/04-ballot-result.webp",
      alt: "The five photos in finishing order, from 1st to 5th, each with its rating change and the number of ballots in the corner",
      width: 800,
      height: 531,
    },
  },
  {
    id: "standings",
    timestamp: "10/04/2026 6:00 PM",
    image: {
      src: "/scranbot/05-standings.webp",
      alt: "Chef standings card: a ranked table with places gained or lost, a NEW tag, the rating, and the rating change for each cook",
      width: 800,
      height: 400,
    },
  },
];

export const YUT_MESSAGES: DiscordMessage[] = [
  {
    id: "morning-post",
    timestamp: "10/04/2026 8:00 AM",
    embed: {
      color: "#c9a227",
      lines: [
        "**Act 1 · Week 3 · Day 17** in Lumbridge",
        "**Did you work out in the last 24 hours?**",
        "Yesterday: Bramble (verified by Odo), Odo, Tamsin. 3 of 6.",
        "Week so far: 4 in form, 1 with one to go.",
        "Quest: Rune Mysteries, supplies 2/3.",
        "🌿 Bryophyta ██████░░░░░░ 46%. Every check-in takes a swing.",
        "🎁 Today's spoils: Magpie impling jar (rare) is on the table for every full-value check-in.",
        "✅ Bramble, Odo · 😴 Marlowe · 3 still to answer",
      ],
    },
    buttons: ["💪 Yes", "😴 No, rest day", "Join the campaign", "📋 My to-do"],
  },
  {
    id: "checkin",
    timestamp: "10/04/2026 8:12 AM",
    text: "**Bramble** checked in (2nd this week, full value).\n⚔️ 23 hill giants slain (23/40 on task).\n**Strength 54!** **Slayer 58!**",
    image: {
      src: "/yut-hut/01-checkin-report.webp",
      alt: "Old School RuneScape style progress card for a check-in: loot icons, XP gained in seven skills, two level-ups and the current Slayer task",
      width: 660,
      height: 722,
    },
  },
  {
    id: "spoils",
    timestamp: "10/04/2026 8:13 AM",
    text: "🎁 **Bramble** opened a magpie impling jar (rare): 2 diamonds, 1 dragonstone, 5 gold rings, 8,200 coins, 3 ruby rings, 4 emeralds. 62.4k gp.",
    image: {
      src: "/yut-hut/03-spoils.webp",
      alt: "Card for a magpie impling jar opened from a check-in spoils pick, with a rare blue frame and the gems, rings and coins inside",
      width: 660,
      height: 392,
    },
  },
  {
    id: "casket",
    timestamp: "10/04/2026 5:40 PM",
    text: "**Odo** checked in (1st this week, full value).\n📜 Odo opened a hard casket: **Robin hood hat**!",
    image: {
      src: "/yut-hut/04-clue-casket.webp",
      alt: "Check-in card showing a clue casket, an antique lamp, a Robin hood hat unique and 21.3k coins alongside the session's drops and XP",
      width: 660,
      height: 490,
    },
  },
  {
    id: "level-up",
    timestamp: "10/04/2026 5:41 PM",
    text: "**Slayer 60!**",
    image: {
      src: "/yut-hut/02-level-up.webp",
      alt: "RuneScape level-up scroll reading Congratulations, Bramble! Your Slayer level is now 60.",
      width: 1040,
      height: 283,
    },
  },
  {
    id: "sheet",
    timestamp: "10/04/2026 6:02 PM",
    image: {
      src: "/yut-hut/05-character-sheet.webp",
      alt: "Stats sheet in the RuneScape skills-tab style for Bramble: nine skill levels with progress bars, total level 483, combat 78, Dragon tier frame, form dots and clue progress",
      width: 900,
      height: 560,
    },
  },
  {
    id: "gear",
    timestamp: "10/04/2026 6:03 PM",
    text: "✨ **Bramble**'s gear",
    image: {
      src: "/yut-hut/07-gear.webp",
      alt: "Gear card for Bramble showing ten worn slots from a Dragon mace to a Kurask head, 21 of 89 pieces collected, chasing an Abyssal whip",
      width: 660,
      height: 624,
    },
  },
  {
    id: "standings",
    timestamp: "10/05/2026 8:00 AM",
    image: {
      src: "/yut-hut/06-standings.webp",
      alt: "Week 14 standings table for six players, ranked by combat level with armour tier, form weeks and units",
      width: 900,
      height: 500,
    },
  },
];

export const OSRS_MESSAGES: DiscordMessage[] = [
  {
    id: "progress",
    timestamp: "01/08/2025 9:14 PM",
    image: { src: "/osrsprogs/progresspic.webp", alt: "OSRS progress report", width: 330, height: 285 },
  },
  {
    id: "collection-log",
    timestamp: "10/14/2025 11:11 PM",
    image: { src: "/osrsprogs/collectionlog.webp", alt: "OSRS collection log", width: 396, height: 221 },
  },
];

export const MFRS = {
  kicker: "In development",
  title: "Middle Fork Rafting Simulator",
  tagline: "A co-op rafting game where everyone paddles the same raft.",
  description:
    "A multiplayer rafting game I'm making in Godot. You and your friends play river otters in oversized helmets, paddling one raft down a procedurally generated Idaho canyon to deliver cargo to the take-out. The water physics are based on real rivers.",
  features: [
    { label: "Jobs", text: "Pick a cargo like a wedding cake, a beehive or a piano and get it to the take-out flag. Hit something too hard and you lose a tier of the cake." },
    { label: "Join by code", text: "Friends can join with a three-word code or a link, even after the trip has started. If the host leaves, the trip keeps going." },
    { label: "Real rapids", text: "Each canyon is generated from a seed. Rocks can pin the raft, holes can trap it, and waves can launch it." },
    { label: "Rescues", text: "Use throw bags and ropes to pull swimmers back in or haul the raft off a rock. If someone gets stranded, a bird carries them back to the raft." },
  ],
  tags: ["Godot 4", "GDScript", "Multiplayer", "Host-authoritative netcode", "Procedural generation"],
  itchUrl: "https://bigfancyben.itch.io/middle-fork-rafting-simulator",
  shots: [
    { src: "/mfrs/loop-poster.webp", video: "/mfrs/loop.mp4", label: "On the water", caption: "A full raft squeezing past a rock in a sunny rapid, close enough to count as a near-miss.", alt: "Six otters paddling a raft through white water between two boulders, with a merit badge and a near-miss card on screen" },
    { src: "/mfrs/01-wave.webp", label: "Big water", caption: "Launching off a standing wave, two of the crew going over the stern.", alt: "A raft launching off a standing wave with two otters thrown over the stern, an inner tube floating in the foreground" },
    { src: "/mfrs/02-cargo.webp", label: "Jobs", caption: "Delivering a wedding cake downriver. The tag shows the distance to the take-out and how much cake is left.", alt: "Six otters paddling a raft with a wedding cake aboard, a tag above reading take-out 450 m, wedding cake 69%" },
    { src: "/mfrs/03-takeout.webp", label: "The take-out", caption: "Jobs end at a flag on a gravel beach.", alt: "A raft with its cargo aboard coming in toward the take-out sign on a gravel beach, rubber ducks floating by" },
    { src: "/mfrs/04-trip-board.webp", label: "Trip board", caption: "Pick a job, see who's in the crew, and send the trip code to a friend.", alt: "The trip board listing the day's jobs, the party of four, and a three-word trip code" },
    { src: "/mfrs/05-rope-rescue.webp", label: "Rope rescue", caption: "Two otters hauling a pinned raft off a rock while a swimmer waits.", alt: "Two otters on a rock holding a rope out to a raft pinned in the current, a golden rubber duck floating past" },
    { src: "/mfrs/06-hats.webp", label: "The crew", caption: "Merit badges unlock hats, like the wizard hat and traffic cone here.", alt: "Otters in life jackets paddling a raft wearing a wizard hat, top hat, traffic cone, viking helm and sombrero" },
    { src: "/mfrs/07-ledge-drop.webp", label: "Ledge drop", caption: "A raft flipped below a ledge, with one otter on a rock holding out a rope.", alt: "A flipped raft in the pour below a ledge, its crew in the water around it and one otter on a rock holding a rope out to the boat" },
  ] satisfies Shot[],
};

export const OATHKEEP = {
  kicker: "Testing on Android",
  title: "Oathkeep",
  tagline: "A guild chat app with a co-op idle ARPG built around a daily check-in.",
  description:
    "Once a day the app asks everyone in the guild whether they kept their oath. You decide what your oath is, like a run, a lift or twenty minutes of practice, and it's on the honor system. Checking in powers up your hero, the guild's hearth and that week's raid. Fights play out while you're away, and you can watch the replay when you come back.",
  features: [
    { label: "Builds", text: "Put any support gem on any skill it fits, pick from a constellation of over a hundred stars with keystones that change the rules, and respec for free. Builds can get pretty broken. Court of Bones never attacks, and its minions do five times the damage of a basic build in the same gear." },
    { label: "Fight breakdowns", text: "After each fight you get the time, DPS and damage taken, plus a breakdown of where the damage came from, your biggest hit and your best second. Fights are seeded, so a guildmate can replay yours exactly." },
    { label: "Endgame", text: "The Unlit Hall is the twelfth and final zone. After that, the Unlit Depths keep going one level at a time, with a boss every ten levels. Gear stops improving, but the difficulty keeps going up." },
    { label: "Rest days are fine", text: "Your power is based on the last two weeks, not your total playtime. Taking a day off doesn't cost you or the guild anything." },
  ],
  tags: ["Godot 4.7", "GDScript", "Android", "Cloudflare Workers", "Async co-op"],
  fights: [
    {
      src: "/oathkeep/01-unlit-hall.webp",
      video: "/oathkeep/unlit-hall.mp4",
      hold: 13700,
      label: "The Unlit Hall",
      caption: "A Court of Bones skeleton army fighting the final zone's boss.",
      alt: "A swarm of skeleton minions surrounds the Unlit Hall's boss on a purple stone arena, huge damage numbers bursting over them, until the Victory card appears.",
    },
    {
      src: "/oathkeep/02-court-of-bones.webp",
      video: "/oathkeep/court-of-bones.mp4",
      label: "Court of Bones",
      caption: "The minions do all the damage and kill the Oathbreaker in under six seconds.",
      alt: "A crowd of skeleton minions overwhelms a caped, crowned boss in a torchlit arena, ending on a Victory card with no damage taken.",
    },
    {
      src: "/oathkeep/03-thunderclap-loop.webp",
      video: "/oathkeep/thunderclap-loop.mp4",
      label: "Thunderclap Loop",
      caption: "A trigger build where the slowest spell fires at the fastest rate.",
      alt: "A lone hero chains spell blasts through three waves and a crowned boss in a torchlit arena, then a Victory card shows.",
    },
  ] satisfies Shot[],
  screens: [
    {
      src: "/oathkeep/town.webp",
      label: "Town",
      caption: "Each feature is a building you walk to. Tap the seal at the bottom to check in for the day.",
      alt: "A pixel-art town square with an observatory, bell tower, war room, dormitory and road gate around a campfire, and an I kept my oath seal at the bottom.",
    },
    {
      src: "/oathkeep/oath-kept.webp",
      label: "Oath kept",
      caption: "What checking in earned you: Mettle, your hero's patrol haul and the guild's hearth bonus.",
      alt: "The Oath kept sheet listing Mettle, this week's oaths, Vigil, patrol yield, caskets waiting and the guild hearth bonus.",
    },
    {
      src: "/oathkeep/skills.webp",
      label: "Skills",
      caption: "Four skill gems, each with a row of supports and its DPS.",
      alt: "The Skills screen: Cinderbolt, Cleave, Raise Oathbones and Rimeburst, each with support gem sockets and a DPS figure.",
    },
    {
      src: "/oathkeep/constellation.webp",
      label: "Constellation",
      caption: "Six branches of stars, with keystones that break the rules.",
      alt: "A radial star map with six branches named Iron, Blood, Shadow, Storm, Arcane and Command, and a glowing allocated path.",
    },
    {
      src: "/oathkeep/guild-chat.webp",
      label: "Guild chat",
      caption: "A photo check-in in #oaths. Guildmates can send boons to whoever posted it.",
      alt: "The #oaths channel: a guildmate's check-in reading bike commute counts, with a sunset photo and five boon buttons.",
    },
  ] satisfies Shot[],
};

/**
 * One paragraph per project. The homepage cards render these and /llms.txt
 * lists them, so a crawler that never runs the carousels reads the same copy.
 */
export const SUMMARIES = {
  prognosticator:
    "A DJ companion app that runs alongside VirtualDJ. It imports Spotify playlists, tags every track with key, BPM, energy and vibe, filters the library to what mixes harmonically with the playing deck, and drives DMX lighting and a Godot visualizer in time with the music.",
  oathkeep:
    "A guild chat app with an async co-op idle ARPG built in. Once a day it asks whether you kept your oath, and checking in powers up your hero, the guild's hearth and the weekly raid. There's a deep build system, and the fights play out while you're away.",
  hobbitHouse:
    "Phone control app for a living room mini PC. Launch games and streaming apps, run a music visualizer on the TV, and control lights, Kodi and cameras. A QR code turns a guest's phone into a game controller.",
  scrandle:
    "A weekly game made from my friends' dinner photos. You get ten pairs of plates and pick the one the group rated higher, then see the ratings and who cooked each one.",
  scranbot:
    "The Discord bot behind Scrandle. Every day it posts a food photo matchup in our group's channel, keeps the votes hidden until voting closes, and then posts the result. Once a week it posts standings with rank changes.",
  yutHut:
    "A Discord bot for my friends that turns workout check-ins into Old School RuneScape progress. Each check-in counts as a Slayer session using the game's real XP and drop tables, and the bot posts the results as OSRS-style cards.",
  commander:
    "Touch-friendly scorekeeper for Commander. Four-player quadrant layout with life, poison, and commander damage tracking.",
  tutorHelper:
    "Import a decklist from Archidekt and filter it by mana cost and card type, with Scryfall card images.",
  tokenHelper:
    "Import a deck and it finds every token the deck can make. Track them on the battlefield with tap/untap, counters, and buffs.",
  floatwise:
    "Float trip planner. Hourly forecast tables for multiple locations with the live Yellowstone River flow, and a map for pinning put-ins, take-outs, and swim spots.",
  dotaRandomizer:
    "Spin two wheels to get a random hero and a random item to build. Canvas-animated wheels fed by live OpenDota data, with sound and confetti.",
  irlscape:
    "Old School RuneScape streaming overlay. Game UI on a live camera feed with Twitch chat integration and Joycon controls.",
  osrsProgress:
    "API for generating progress report images for Old School RuneScape players. Collection log items, OSRS Wiki integration.",
};

/**
 * The titles, tags, links and group copy that BentoGrid used to carry inline. The grid renders
 * these and the museum's details panel (museum/projectDetails.ts) reads the same objects.
 */
export const PROGNOSTICATOR_CARD = {
  title: "Prognosticator",
  tags: ["Electron", "React", "TypeScript", "Node", "Godot", "DMX", "OBS", "Tailwind", "VirtualDJ"],
};

export const HOBBIT_HOUSE = {
  title: "hobbit.house",
  href: "https://github.com/BigFancyBen/hobbit-ccp",
  tags: ["React", "Docker", "Linux", "MQTT"],
};

export const VISUALIZER_SCENES = {
  title: "Prognosticator: visualizer scenes",
  description:
    "Prognosticator also sends its beat grid and DMX output to a visualizer I built in Godot, so the same light cues play in a virtual venue.",
};

export const MFRS_LINKS = {
  river: { label: "Game page", href: "/river" },
  itch: { label: "itch.io page", href: MFRS.itchUrl },
};

export const TESTQ_LINK = { label: "Source on GitHub", href: TESTQ.repoUrl };

export const SCRANDLE = {
  title: "Scrandle",
  href: "/scrandle/play",
  tags: ["Next.js", "TypeScript", "Tailwind", "Cloudflare R2"],
};

export const SCRANBOT = {
  title: "Scranbot",
  tags: ["Cloudflare Workers", "D1", "R2", "Discord", "TypeScript"],
};

export const YUT_HUT = {
  title: "Yut Hut",
  features: [
    { label: "Two a week", text: "Your first two check-ins each week count in full. After that they count for half, then a fifth. Rest days get logged and don't cost you anything." },
    { label: "Morning check-in", text: "Each morning the bot posts a yes-or-no question and updates the post as people answer." },
    { label: "Real game data", text: "Monsters, Slayer masters, drop rates and gear all come from the OSRS Wiki. The only number I tuned is how long a session lasts." },
    { label: "Goals", text: "Clue caskets, a choice of three rewards, gear drops, an Achievement Diary, a quest, and a group boss each week." },
  ],
  tags: ["Cloudflare Workers", "D1", "R2", "Discord", "Next.js", "TypeScript"],
  rulesLink: { label: "Read the rules", href: "/yut-hut" },
};

export const MTG_GROUP = {
  title: "Magic: The Gathering",
  tagline: "Tools for Commander players and deck builders",
  tags: ["Next.js", "React", "Vercel"],
  apps: [
    { title: "MTG Commander Scorekeeper", description: SUMMARIES.commander, href: "/commander" },
    { title: "Magic Tutor Helper", description: SUMMARIES.tutorHelper, href: "/tutor-helper" },
    { title: "MTG Token Helper", description: SUMMARIES.tokenHelper, href: "/token-helper" },
  ],
};

export const FLOATWISE = {
  title: "FloatWise",
  href: "/floatwise",
  tags: ["Next.js", "Leaflet", "Open-Meteo", "USGS"],
};

export const DOTA_RANDOMIZER = {
  title: "Dota 2 Randomizer",
  href: "/dota-randomizer",
  tags: ["Next.js", "Canvas", "OpenDota"],
};

export const IRLSCAPE = {
  title: "IRLScape",
  href: "https://www.youtube.com/watch?v=gCofVhR5HUQ",
};
