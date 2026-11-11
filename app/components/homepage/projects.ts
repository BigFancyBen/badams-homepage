import type { Shot } from "./ShotGallery";
import type { DiscordMessage } from "./DiscordFeed";

/** The screenshots and copy behind the homepage cards. */

export const PROGNOSTICATOR_SCREENSHOTS = [
  {
    src: "/prognosticator/04-now-playing.webp",
    label: "Mix",
    bg: "#1a1a2e",
    description: "Live BPM and key from VirtualDJ's decks. Pick a deck and the library narrows to tracks that mix with it.",
  },
  {
    src: "/prognosticator/02-playlist-browser.webp",
    label: "Library",
    bg: "#1a1a2e",
    description: "Spotify playlists, downloaded and tagged with Camelot key and BPM.",
  },
  {
    src: "/prognosticator/03-song-detail.webp",
    label: "Vibes",
    bg: "#1a1a2e",
    description: "Vibe tags, a preview player and one click to load a track onto a deck.",
  },
  {
    src: "/prognosticator/05-song-requests.webp",
    label: "Requests",
    bg: "#1a1a2e",
    description: "Paste a YouTube or Spotify link. Spotify requests stream straight into VirtualDJ.",
  },
  {
    src: "/prognosticator/11-live-board.webp",
    label: "Live board",
    bg: "#1a1a2e",
    description: "One tap fires a light effect or video look on the next downbeat. Auto runs the board by itself.",
  },
  {
    src: "/prognosticator/12-song-moments.webp",
    label: "Song moments",
    bg: "#1a1a2e",
    description: "A scan finds each track's builds and drops, so the big hits land on them.",
  },
  {
    src: "/prognosticator/13-shows.webp",
    label: "Shows",
    bg: "#1a1a2e",
    description: "Themed slices of colours, looks and lenses for the automatic director to pick from.",
  },
  {
    src: "/prognosticator/14-visualizers.webp",
    label: "Visualizers",
    bg: "#1a1a2e",
    description: "Switch scenes and camera lenses, cut on the downbeat.",
  },
  {
    src: "/prognosticator/08-lights.webp",
    label: "Lights",
    bg: "#1a1a2e",
    description: "Rigs built from named actions and animations instead of raw DMX channels.",
  },
  {
    src: "/prognosticator/10-gear-setup.webp",
    label: "Gear",
    bg: "#1a1a2e",
    description: "DMX fixtures from Open Fixture Library on a canvas. No interface plugged in? A virtual one runs the show.",
  },
];

export const WAREHOUSE_SCENE = {
  title: "Warehouse",
  description:
    "An endless club generated from code and lit only by DMX. Every load deals new rooms, blacklight halls and outdoor plazas.",
  tags: ["Godot 4", "GDScript", "DMX", "Procedural generation"],
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

export const MAINSTAGE_SCENE = {
  title: "Main Stage",
  description:
    "One designed festival stage for peak time: a 96 m gate with a toothed wheel turning on the beat clock.",
  tags: ["Godot 4", "Blender", "DMX"],
  shots: [
    {
      src: "/prognosticator/mainstage/01.webp",
      video: "/prognosticator/mainstage/loop.mp4",
      hold: 24000,
      label: "The crown",
      caption: "The wheel in the gate, the rig in red over the crowd.",
      alt: "A huge toothed wheel glowing red inside a dark stepped gate, white spotlights along the stage and a crowd below.",
    },
    {
      src: "/prognosticator/mainstage/02.webp",
      label: "The wheel",
      caption: "Close on the wheel as beams cut across it.",
      alt: "Close view of a red-lit spoked wheel with beams crossing it and small lamps on the gate around it.",
    },
    {
      src: "/prognosticator/mainstage/03.webp",
      label: "DJ booth",
      caption: "The booth under the wheel's lit rim.",
      alt: "A curved red-lit rim of the wheel above an LED wall and a row of white stage lights.",
    },
    {
      src: "/prognosticator/mainstage/04.webp",
      label: "Crowd",
      caption: "From the crowd, beams fanning off the deck.",
      alt: "The wheel and stage from the crowd, beams fanning out from the deck in red.",
    },
    {
      src: "/prognosticator/mainstage/05.webp",
      label: "Low angle",
      caption: "Spots and lasers under the wheel's teeth.",
      alt: "A low view of the stage with spotlights and laser lines under the toothed rim of the wheel.",
    },
  ] satisfies Shot[],
};

export const STADIUM_SCENE = {
  title: "Stadium",
  description:
    "Washington-Grizzly Stadium in Missoula as a night festival, built from real terrain, aerial imagery and buildings. Lasers fire off the M on Mount Sentinel.",
  tags: ["Godot 4", "GIS data", "DMX"],
  shots: [
    {
      src: "/prognosticator/stadium/01.webp",
      video: "/prognosticator/stadium/loop.mp4",
      hold: 32000,
      label: "Stage",
      caption: "Lasers and beams over the field in front of the stage.",
      alt: "White beams and red laser fans crossing above a crowd in front of a red-lit festival stage.",
    },
    {
      src: "/prognosticator/stadium/02.webp",
      label: "Field",
      caption: "The stage from the crowd, rig in red.",
      alt: "A festival stage at night seen from the crowd, red beams fanning out from the deck.",
    },
    {
      src: "/prognosticator/stadium/03.webp",
      label: "The M",
      caption: "Laser fans off the M on the mountain above the stadium.",
      alt: "Red laser fans rising from the hillside letter M on a dark mountain under the stars.",
    },
    {
      src: "/prognosticator/stadium/04.webp",
      label: "The bowl",
      caption: "The whole bowl from the stands, lasers along the rim.",
      alt: "A wide night view across the stadium bowl with laser lines rising from the rim.",
    },
    {
      src: "/prognosticator/stadium/05.webp",
      label: "Down the field",
      caption: "Lasers raking the field toward the stage.",
      alt: "Red laser beams raking down a packed field toward a bright stage at the far end.",
    },
  ] satisfies Shot[],
};

export const CATTOWN_SCENE = {
  title: "Cat Town",
  description:
    "A PS1-style night town with a cat on autopilot. It rides the bus, chases light pools and plays the decks on the club roof.",
  tags: ["Godot 4", "Blender", "Python", "DMX"],
  shots: [
    {
      src: "/prognosticator/cattown/01.webp",
      video: "/prognosticator/cattown/loop.mp4",
      hold: 32000,
      label: "Night walk",
      caption: "The cat past the laundromat's vending machine.",
      alt: "A ginger low-poly cat walking past a laundromat and a lit vending machine at night.",
    },
    {
      src: "/prognosticator/cattown/02.webp",
      label: "Crosswalk",
      caption: "Crossing the street under the moving heads.",
      alt: "A ginger cat crossing a zebra crossing at night with red beams sweeping over the town.",
    },
    {
      src: "/prognosticator/cattown/03.webp",
      label: "Main street",
      caption: "Down the main street under string lights.",
      alt: "A cat walking along a shopfront under strings of coloured lights and dark apartment blocks.",
    },
    {
      src: "/prognosticator/cattown/04.webp",
      label: "Lasers",
      caption: "The rig in full over the town square.",
      alt: "Red beams criss-crossing above a pixel-art town square with a Catnap Motel sign.",
    },
    {
      src: "/prognosticator/cattown/05.webp",
      label: "The court",
      caption: "Watching the light pools on the court.",
      alt: "The cat seen from behind on cobblestones, watching a house and shop lit at night.",
    },
  ] satisfies Shot[],
};

export const CEILING_SCENE = {
  title: "Ceiling",
  description:
    "For a projector aimed at the ceiling: a hatch opens into a world above the room, and things fly down out of it.",
  tags: ["Godot 4", "Blender", "DMX"],
  shots: [
    {
      src: "/prognosticator/ceiling/01.webp",
      video: "/prognosticator/ceiling/loop.mp4",
      hold: 31000,
      label: "Space",
      caption: "A saucer drops out of the hatch.",
      alt: "Looking up into a hatch in the ceiling at a starfield, a detailed saucer coming down through it.",
    },
    {
      src: "/prognosticator/ceiling/02.webp",
      label: "The pit",
      caption: "Bats fly down out of the pit.",
      alt: "Looking up a ringed shaft at the night sky, two pale bats flying down toward the room.",
    },
    {
      src: "/prognosticator/ceiling/03.webp",
      label: "City",
      caption: "A drone between the towers.",
      alt: "Looking straight up between lit skyscrapers at a small drone hovering in the gap.",
    },
    {
      src: "/prognosticator/ceiling/04.webp",
      label: "Cave",
      caption: "Bats leaving the cavern mouth.",
      alt: "A cavern opening overhead with red crystals round its rim and bats flying out.",
    },
    {
      src: "/prognosticator/ceiling/05.webp",
      label: "Deep water",
      caption: "A jellyfish drifts through the hatch.",
      alt: "A glowing jellyfish drifting down out of a deep-water world, rays and fish above it.",
    },
    {
      src: "/prognosticator/ceiling/06.webp",
      label: "Forest",
      caption: "An owl glides out of the clearing.",
      alt: "An owl gliding down out of a forest clearing seen from below, red beams through the trees.",
    },
  ] satisfies Shot[],
};

export const N64_SCENE = {
  title: "Super Mario 64 and Mario Kart 64",
  description:
    "The games' decompiled PC ports run as libraries inside Godot, under the same 104-light rig. CPU drivers and an autopilot Mario play while the camera cuts on the beat. Bring your own ROM.",
  tags: ["Godot 4", "GDExtension", "C", "DMX"],
  shots: [
    {
      src: "/prognosticator/sm64/01-jolly-roger-bay.webp",
      video: "/prognosticator/sm64/loop.mp4",
      label: "Jolly Roger Bay",
      caption: "Mario running toward a bank of coins used as blinders, under star-shaped pars and a laser.",
      alt: "Mario seen from behind running across Jolly Roger Bay's sandy ground, with a coin bank glowing at left, a pink star light and a vertical laser.",
    },
    {
      src: "/prognosticator/mk64/01-luigi-spotlight-sweep.webp",
      video: "/prognosticator/mk64/loop.mp4",
      hold: 28000,
      label: "Luigi Raceway",
      caption: "CPU drivers racing through Luigi Raceway, Toad's Turnpike and Bowser's Castle at night, with the lights running live.",
      alt: "Luigi Raceway at night, white spotlights sweeping down from a truss onto the track, a kart ahead.",
    },
    {
      src: "/prognosticator/sm64/04-castle-grounds-stars.webp",
      label: "Castle grounds",
      caption: "Power Stars working as pars, throwing pink beams and a red spot onto the lawn.",
      alt: "Mario jumping on the castle lawn at night under floating pale stars, with a pink beam fan and a red floor spot.",
    },
    {
      src: "/prognosticator/mk64/05-turnpike-pink-flare.webp",
      label: "Toad's Turnpike",
      caption: "Traffic under a lit gantry on Toad's Turnpike.",
      alt: "Toad's Turnpike at night, a bus and a truck ahead under an overhead gantry with pink light.",
    },
    {
      src: "/prognosticator/sm64/05-bay-laser-vista.webp",
      label: "Laser vista",
      caption: "A high camera angle over the bay, with laser fans and star pars in the haze.",
      alt: "A wide high view of the bay with blue laser lines fanning out, pink stars, coin banks, green pipes and a small Mario in the middle.",
    },
    {
      src: "/prognosticator/mk64/06-thwomps-castle.webp",
      label: "Bowser's Castle",
      caption: "Two Thwomps hang over the checkered floor in amber light.",
      alt: "Two Thwomps hovering over a red and checkered floor in Bowser's Castle, lit amber, with a small kart below.",
    },
  ] satisfies Shot[],
};

/** The scenes the homepage's visualizer group shows, in order. */
export const SCENES = [WAREHOUSE_SCENE, MAINSTAGE_SCENE, STADIUM_SCENE, CATTOWN_SCENE, CEILING_SCENE, N64_SCENE];

export const TESTQ = {
  title: "testq",
  tagline: "A job queue for every Godot run on my PC.",
  description:
    "Dozens of worktrees run Godot tests and captures on one PC, and runs that overlapped slowed each other into fake failures. testq is a small daemon that hands out CPU and GPU slots; every run script asks it before launching Godot.",
  features: [
    { label: "Shortest first", text: "Job lengths come from past runs, so a 20-second test never waits behind an 11-minute suite." },
    { label: "Hung runs get killed", text: "A stalled or overdue run is killed and its slot freed." },
    { label: "Status page", text: "A web page and tray icon show what's running and queued. History in SQLite makes flaky tests easy to spot." },
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
    "Otters in oversized helmets paddle one raft down a generated Idaho canyon to deliver cargo. Godot, with host-authoritative netcode and river physics.",
  features: [
    { label: "Jobs", text: "Deliver a wedding cake, a beehive or a piano. Hit a rock and the cake loses a tier." },
    { label: "Join by code", text: "A three-word code drops a friend into a trip already on the water." },
    { label: "Real rapids", text: "Seeded canyons with rocks that pin, holes that trap and waves that launch." },
    { label: "Rescues", text: "Throw bags and ropes for swimmers and pinned rafts." },
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
    "Once a day the guild is asked whether they kept their oath: a run, a lift, twenty minutes of practice. Checking in powers your hero, the guild's hearth and the weekly raid, and fights play out while you're away.",
  features: [
    { label: "Builds", text: "Any support gem on any skill, a hundred-star constellation with rule-breaking keystones, free respecs." },
    { label: "Fight breakdowns", text: "DPS, damage taken and biggest hit after every fight. Fights are seeded, so anyone can replay yours." },
    { label: "Endgame", text: "Twelve zones, then the Unlit Depths: endless levels with a boss every ten." },
    { label: "Rest days are fine", text: "Power comes from the last two weeks, so a day off costs nothing." },
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
    "A DJ companion for VirtualDJ. It tags the library by key, BPM and vibe, shows what mixes next, and runs DMX lights, OBS and Godot visualizers on the beat.",
  oathkeep:
    "A guild chat app with an async co-op idle ARPG built in. A daily check-in powers your hero, the guild and the weekly raid.",
  hobbitHouse:
    "Phone control for a living-room mini PC: games, streaming, a TV music visualizer, lights and Kodi. A QR code turns a guest's phone into a controller.",
  scrandle:
    "A weekly game made from friends' dinner photos: ten pairs of plates, pick the one the group rated higher.",
  scranbot:
    "The Discord bot behind Scrandle: a daily food matchup with hidden votes, then the result, and weekly standings.",
  yutHut:
    "A Discord bot that turns workout check-ins into Old School RuneScape Slayer sessions, run on the game's real XP and drop tables.",
  commander:
    "Touch-friendly Commander scorekeeper: life, poison and commander damage for four players.",
  tutorHelper:
    "Filter an Archidekt decklist by mana cost and card type, with Scryfall art.",
  tokenHelper:
    "Finds every token a deck can make and tracks them on the battlefield.",
  floatwise:
    "Float trip planner: hourly forecasts, live Yellowstone River flow and a map of put-ins and take-outs.",
  dotaRandomizer:
    "Two canvas wheels spin up a random hero and item from live OpenDota data.",
  irlscape:
    "Old School RuneScape's UI over a live camera feed, with Twitch chat and Joycon controls.",
  osrsProgress:
    "An API that renders Old School RuneScape progress reports from collection log data.",
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
    "Prognosticator's beat grid and DMX output drive scenes I built in Godot, so one light show plays in every venue.",
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
    { label: "Two a week", text: "The first two check-ins a week count in full. Rest days cost nothing." },
    { label: "Morning check-in", text: "A yes-or-no post that fills in as people answer." },
    { label: "Real game data", text: "Monsters, drop rates and gear straight from the OSRS Wiki." },
    { label: "Goals", text: "Clue caskets, gear drops, a quest and a weekly group boss." },
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
