import type { Shot } from "./ShotGallery";
import type { DiscordMessage } from "./DiscordFeed";

/** The screenshots and copy behind the homepage cards. */

export const PROGNOSTICATOR_SCREENSHOTS = [
  {
    src: "/prognosticator/01-dashboard.webp",
    label: "Command Center",
    bg: "#1a1a2e",
    description: "One home screen links every tool: Now Playing, Effect Picks, the Disperser, Lights, Gear Setup, Scene Controls and your playlists and tags. Import a Spotify playlist and Prognosticator downloads each track from YouTube, then pulls BPM and key from VirtualDJ.",
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
    description: "Each song has a preview player, an energy rating from 1 to 5 and vibe labels like Groovy, Hypnotic or Peak-time. The labels become filterable tags, and the Deck buttons load the track into VirtualDJ.",
  },
  {
    src: "/prognosticator/04-now-playing.webp",
    label: "Live Deck View",
    bg: "#1a1a2e",
    description: "Both VirtualDJ decks show here with art, live BPM and key. Click a deck and the library filters to tracks that are harmonically compatible and within BPM range. Auto mix can run beat-synced crossfades of 16 to 128 beats and swap the bass between decks.",
  },
  {
    src: "/prognosticator/05-song-requests.webp",
    label: "Song Requests",
    bg: "#1a1a2e",
    description: "Paste a YouTube or Spotify link, or search either service from the request box. A Spotify request streams straight through VirtualDJ without waiting for a download. Requests land in their own playlist, and downloads show live progress.",
  },
  {
    src: "/prognosticator/06-effect-picks.webp",
    label: "Effect Picks",
    bg: "#1a1a2e",
    description: "Instead of a wall of pads, the board deals three cards, each pairing a light effect with a video look. Tap one and it fires on the next downbeat, runs for its set number of beats, then hands the room back. A palette picker tints every light effect to the colors you choose.",
  },
  {
    src: "/prognosticator/07-disperser-runtime.webp",
    label: "Disperser Director",
    bg: "#1a1a2e",
    description: "Pick a venue and the Disperser shuffles idle lights and OBS scenes on the beat. Active effect pads fire strobes, fog and laser sweeps on demand, with a beats-left countdown. Everything is quantized to the bar or phrase, so changes read as decisions instead of glitches.",
  },
  {
    src: "/prognosticator/08-lights.webp",
    label: "Lights and Rigs",
    bg: "#1a1a2e",
    description: "Build rigs from a catalog of 87 actions and 122 group animations, each aimed at named lights instead of raw DMX channels. A rig's action pool rotates on bar boundaries. The same rigs also drive the fixtures inside the Godot warehouse scene.",
  },
  {
    src: "/prognosticator/09-scene-controls.webp",
    label: "Scene Controls",
    bg: "#1a1a2e",
    description: "Switch the warehouse camera between nine lenses, including CCTV, fixture POV and a phone cam, with changes landing on the next downbeat. Below that, set strobe trigger intervals and flash length for the DMX rig. The beat timing comes from VirtualDJ.",
  },
  {
    src: "/prognosticator/10-gear-setup.webp",
    label: "Gear Setup",
    bg: "#1a1a2e",
    description: "A canvas of every DMX device with its named channels, drag-to-arrange positions, and a panel of master-dimmer channels. Fixtures come from a library of 2000+ OpenFixtureLibrary definitions. With no interface plugged in, the app runs a virtual universe so lighting still works on screen.",
  },
];

export const WAREHOUSE_SCENE = {
  title: "Warehouse",
  description:
    "An endless, procedurally generated club that the Godot visualizer builds out of code and lights only with DMX values. The same rig, action or Effect Picks card that drives the real fixtures drives its 104 virtual ones, while a camera rides through rooms and tunnels and cuts on the beat.",
  tags: ["Godot 4", "GDScript", "DMX", "Beat sync", "Procedural generation", "Spout"],
  shots: [
    {
      src: "/prognosticator/warehouse/01-moving-heads-lasers.webp",
      video: "/prognosticator/warehouse/loop.mp4",
      label: "Heads and lasers",
      caption: "Two moving heads and a laser fan over a haze-filled crowd, shot through the production multicam.",
      alt: "A dark crowd under two orange-red moving-head beams and a fan of gold laser lines, with haze in the air.",
    },
    {
      src: "/prognosticator/warehouse/02-laser-sheets-mirror.webp",
      label: "Booth mirror view",
      caption: "The booth-mirror lens: a wall of blue laser sheets cutting across pars hung over the crowd.",
      alt: "Bands of blue laser light stretching across a hall, with yellow and magenta par cones and crowd silhouettes below.",
    },
    {
      src: "/prognosticator/warehouse/03-laser-fan-haze.webp",
      label: "Laser fan",
      caption: "A magenta laser fan, amber par glow and a blue wash, seen from the first-person rail ride.",
      alt: "A fan of magenta laser beams from a point at the left, over amber and blue haze in a dark room.",
    },
    {
      src: "/prognosticator/warehouse/04-beams-in-haze.webp",
      label: "White beams",
      caption: "White moving-head beams through heavy haze with blue lasers below, from the production camera.",
      alt: "Three white spotlight beams angling down through fog, with blue laser lines at the bottom of the frame.",
    },
    {
      src: "/prognosticator/warehouse/05-fixture-pov.webp",
      label: "Fixture POV",
      caption: "The fixture camera rides a moving head and looks down its own beam, here inside a turbine-ring hall.",
      alt: "A pale beam entering the frame from the lower left toward a large ring-shaped structure, with a magenta beam beyond it.",
    },
    {
      src: "/prognosticator/warehouse/06-smoking-yard.webp",
      label: "Smoking yard",
      caption: "One of the generator's venue types: a timber yard with crates, barrels, fog and people standing in knots, cigarettes glowing.",
      alt: "Dark figures standing among crates and barrels in a wood-panelled yard, lit by a white fog-lit spot, with orange cigarette embers.",
    },
  ] satisfies Shot[],
};

export const SM64_SCENE = {
  title: "Super Mario 64",
  description:
    "The warehouse's DMX kit re-skinned onto Super Mario 64: pars are Power Stars, movers are Battlefield cannons, lasers are Amps, and the lava is eight pars. The open-source decomp port runs as a library inside Godot, which draws every frame the game produces. An autopilot plays Mario on the beat and a director cuts the camera on downbeats. Still on a branch, and it needs your own ROM.",
  tags: ["Godot 4", "GDScript", "GDExtension", "C", "DMX", "Beat sync"],
  shots: [
    {
      src: "/prognosticator/sm64/01-castle-grounds-wide.webp",
      video: "/prognosticator/sm64/loop.mp4",
      label: "Castle at night",
      caption: "Peach's castle lit as a venue: blue lasers from the window, red uplights on the roofs, Power Stars as pars.",
      alt: "Super Mario 64 castle at night with blue laser lines from its central window, red-lit towers and pink light on the front path.",
    },
    {
      src: "/prognosticator/sm64/02-castle-star-par.webp",
      label: "Star as a par",
      caption: "A Power Star hung as a par can, throwing a pink beam down the lawn while the castle facade glows.",
      alt: "The castle entrance with a large Power Star at top right projecting a translucent pink light cone onto the grass.",
    },
    {
      src: "/prognosticator/sm64/03-castle-lobby.webp",
      label: "Castle lobby",
      caption: "Inside the castle: cannon-style movers and a laser sheet over the lobby's checkerboard floor.",
      alt: "A high view of the castle lobby with pink beams from ceiling fixtures, a blue laser across the room and a checkered floor.",
    },
    {
      src: "/prognosticator/sm64/04-bobomb-battlefield.webp",
      label: "Battlefield lasers",
      caption: "A high vista over Bob-omb Battlefield with blue lasers raking the hillside and stars hung along the path.",
      alt: "A night view of a grassy battlefield level with several blue laser beams crossing the slope and small pink star lights.",
    },
    {
      src: "/prognosticator/sm64/05-whomps-fortress.webp",
      label: "Whomp's Fortress",
      caption: "Mario on the fortress ledge under cannon heads and star pars, one of five hand-plotted rigs.",
      alt: "Mario in a white hat at the edge of a grass ledge, with stars and purple-pink beams overhead and a stone fortress wall at right.",
    },
    {
      src: "/prognosticator/sm64/06-lethal-lava-land.webp",
      label: "Lava as eight pars",
      caption: "Lethal Lava Land: the lava sea is cut into eight wedges, each taking the colour and level of a par.",
      alt: "Mario jumping above a stone platform on a glowing pink lava sea, with a red spotlight pool on the platform.",
    },
  ] satisfies Shot[],
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
    caption: "Two plates from the channel. Pick the one it rated higher.",
    alt: "Scrandle round 1 of 10: two plates side by side, a breaded cutlet with sweet potato and a seared steak, with the question of which the channel rated higher",
  },
  {
    src: "/scrandle/site-02-reveal.webp",
    label: "The reveal",
    caption: "Both ratings, who cooked each plate, and how many points were in it.",
    alt: "After the pick, both plates show their channel ratings, 1429 and 1571, and the cook's name. The higher plate is outlined green and the page says Right, 142 points in it",
  },
  {
    src: "/scrandle/site-03-midgame.webp",
    label: "Midway through",
    caption: "Ten rounds a week, with a strip of rights and wrongs along the top.",
    alt: "Round 6 of 10 revealed, with a progress strip of green and red squares along the top and a running score of 5 of 10",
  },
  {
    src: "/scrandle/site-04-score.webp",
    label: "Your score",
    caption: "A score to copy into the channel and a list of how all ten pairs went.",
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
      width: 1200,
      height: 630,
    },
    buttons: ["1", "2"],
  },
  {
    id: "result",
    timestamp: "09/29/2026 9:00 AM",
    image: {
      src: "/scranbot/02-result.webp",
      alt: "Result card: the same two photos with vote shares of 67 and 33 percent, vote counts, and each cook's name, with the winner outlined in green and the loser dimmed",
      width: 1200,
      height: 630,
    },
  },
  {
    id: "ballot",
    timestamp: "09/30/2026 9:00 AM",
    text: "**Rank the plates**",
    image: {
      src: "/scranbot/03-ballot.webp",
      alt: "Ranking card with five numbered food photos in a grid under the header Rank the plates",
      width: 1200,
      height: 796,
    },
    buttons: ["1", "2", "3", "4", "5"],
  },
  {
    id: "ballot-result",
    timestamp: "10/01/2026 9:00 AM",
    image: {
      src: "/scranbot/04-ballot-result.webp",
      alt: "The five photos in finishing order, from 1st to 5th, each with its rating change and the number of ballots in the corner",
      width: 1200,
      height: 796,
    },
  },
  {
    id: "standings",
    timestamp: "10/04/2026 6:00 PM",
    image: {
      src: "/scranbot/05-standings.webp",
      alt: "Chef standings card: a ranked table with places gained or lost, a NEW tag, the rating, and the rating change for each cook",
      width: 1200,
      height: 600,
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
  tagline: "Multiplayer whitewater. One raft, everyone paddles.",
  description:
    "A multiplayer rafting game built in Godot. You and a boat of friends, all river otters in oversized helmets, paddle a procedurally generated Idaho canyon and carry a job's cargo to its take-out. The water is modelled to real ranges, and the otters are cartoons.",
  features: [
    { label: "Jobs", text: "Pick a cargo (wedding cake, beehive, watermelon, piano) and run it to the take-out flag. A hard hit costs you a tier of cake." },
    { label: "Join by code", text: "A three-word trip code or a link puts a friend in your boat, even on a trip already on the water. If the host leaves, the trip carries on." },
    { label: "Real rapids", text: "A canyon generated from a seed. Rocks wrap boats, holes keep them, waves launch them." },
    { label: "Nobody stays stuck", text: "Throw bags and rope hauls for rescues, and a bird that carries a stranded swimmer back to the raft." },
  ],
  tags: ["Godot 4", "GDScript", "Multiplayer", "Host-authoritative netcode", "Procedural generation"],
  itchUrl: "https://bigfancyben.itch.io/middle-fork-rafting-simulator",
  shots: [
    { src: "/mfrs/loop-poster.webp", video: "/mfrs/loop.mp4", label: "On the water", caption: "A ledge drop, then the rapid below it.", alt: "A raft of otters dropping over a ledge into a rapid" },
    { src: "/mfrs/01-wave.webp", label: "Big water", caption: "Launching off a standing wave, two of the crew going over the stern.", alt: "A raft launching off a standing wave with two otters thrown over the stern, an inner tube floating in the foreground" },
    { src: "/mfrs/02-cargo.webp", label: "Jobs", caption: "A wedding cake to deliver 2 km downriver. The sign tracks the take-out and what is left of the cake.", alt: "Six otters paddling a raft with a wedding cake aboard, a sign above reading take-out 2.0 km, wedding cake 69%" },
    { src: "/mfrs/03-takeout.webp", label: "The take-out", caption: "Every job ends at a flag on a gravel beach.", alt: "A raft coming in to the take-out sign on a gravel beach with a beehive aboard" },
    { src: "/mfrs/04-trip-board.webp", label: "Trip board", caption: "Pick a job, see the crew, and hand a friend the trip code.", alt: "The trip board listing four jobs, the party of four, and a three-word trip code" },
    { src: "/mfrs/05-rope-rescue.webp", label: "Rope rescue", caption: "A wrapped raft, two otters hauling it off a rock, a swimmer waiting.", alt: "Two otters on a rock holding a rope out to a raft pinned in the current, a golden rubber duck floating past" },
    { src: "/mfrs/06-hats.webp", label: "The crew", caption: "Merit badges unlock hats. Every one is on a head here.", alt: "Otters in life jackets paddling a raft wearing a wizard hat, top hat, traffic cone, viking helm and sombrero" },
    { src: "/mfrs/07-ledge-drop.webp", label: "Ledge drop", caption: "A flipped raft in the pour, one otter on the rock with a rope.", alt: "A flipped raft in the pour below a ledge, its crew in the water around it and one otter on a rock holding a rope out to the boat" },
  ] satisfies Shot[],
};
