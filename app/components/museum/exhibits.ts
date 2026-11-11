/**
 * The museum's exhibits, in walking order. One source for both sides:
 * the React overlay reads this module, and `node scripts/museum-sync.mjs`
 * writes it to museum/exhibits.json (plus resized copies of the images) for
 * the Godot scene. Re-run the sync and re-export after changing it.
 *
 * Self-contained on purpose (no imports), so the sync script can load it
 * with Node's built-in type stripping.
 */

export interface Exhibit {
  id: string;
  title: string;
  /** Small caps line above the title: what kind of thing it is. */
  kicker: string;
  blurb: string;
  href: string;
  linkLabel: string;
  /** Files under /public. The first one is the exhibit's hero image. */
  images: string[];
  /** The room's light palette: two hex colors the fixtures pick from. */
  palette: [string, string];
}

export const EXHIBITS: Exhibit[] = [
  {
    id: "mfrs",
    title: "Middle Fork Rafting Simulator",
    kicker: "Godot game · in development",
    blurb: "Multiplayer whitewater: one raft, everyone paddles. A three-word code puts a friend in your boat mid-trip.",
    href: "/river",
    linkLabel: "Visit the river",
    images: ["/mfrs/01-wave.webp", "/mfrs/05-rope-rescue.webp", "/mfrs/07-ledge-drop.webp"],
    palette: ["#2ec4ff", "#ffffff"],
  },
  {
    id: "oathkeep",
    title: "Oathkeep",
    kicker: "Android · testing",
    blurb: "A guild chat app with an async co-op idle ARPG. A daily check-in powers your hero, the guild and the weekly raid.",
    href: "/#oathkeep",
    linkLabel: "Read more",
    images: ["/oathkeep/01-unlit-hall.webp", "/oathkeep/town.webp", "/oathkeep/constellation.webp"],
    palette: ["#ffb347", "#b04cff"],
  },
  {
    id: "prognosticator",
    title: "Prognosticator",
    kicker: "Electron · DJ companion",
    blurb: "A DJ companion for VirtualDJ. It shows what mixes next and runs DMX lights, OBS and Godot visualizers on the beat.",
    href: "/#prognosticator",
    linkLabel: "Read more",
    images: ["/prognosticator/stadium/01.webp", "/prognosticator/11-live-board.webp", "/prognosticator/04-now-playing.webp"],
    palette: ["#ff2d55", "#ffd60a"],
  },
  {
    id: "warehouse",
    title: "Warehouse",
    kicker: "Godot 4 · DMX visualizer",
    blurb: "An endless club generated from code and lit only by DMX. The rig that drives the real lights drives its 104 virtual ones.",
    href: "/#warehouse",
    linkLabel: "Read more",
    images: ["/prognosticator/warehouse/01-red-beams-wheel-megastructure.webp", "/prognosticator/warehouse/02-red-laser-sweep-gear-wall.webp", "/prognosticator/warehouse/05-red-laser-burst-portal-tower.webp"],
    palette: ["#ff1a1a", "#ff8c1a"],
  },
  {
    id: "hobbit-house",
    title: "hobbit.house",
    kicker: "React · Docker · MQTT",
    blurb: "Phone control for a living-room mini PC: games, streaming, a TV music visualizer, lights and Kodi.",
    href: "https://github.com/BigFancyBen/hobbit-ccp",
    linkLabel: "GitHub",
    images: ["/radiance/games-visualizer.webp", "/radiance/lights.webp", "/radiance/games-idle.webp"],
    palette: ["#00e5a0", "#2e7dff"],
  },
  {
    id: "testq",
    title: "testq",
    kicker: "Node · tooling",
    blurb: "One queue for every Godot run on the machine, so a dozen worktrees stop fighting over the cores and GPU.",
    href: "https://github.com/BigFancyBen/testq",
    linkLabel: "GitHub",
    images: ["/testq/page.webp"],
    palette: ["#9dff00", "#00ffd5"],
  },
  {
    id: "scrandle",
    title: "Scrandle",
    kicker: "Web game · weekly",
    blurb: "A weekly game made from friends' dinner photos: pick the plate the group rated higher.",
    href: "/scrandle/play",
    linkLabel: "Play",
    images: ["/scrandle/site-01-pick.webp", "/scrandle/site-02-reveal.webp", "/scranbot/01-matchup.webp"],
    palette: ["#ff6b9d", "#ffe066"],
  },
  {
    id: "yut-hut",
    title: "Yut Hut",
    kicker: "Discord bot",
    blurb: "Turns workout check-ins into Old School RuneScape Slayer sessions, run on the game's real XP and drop tables.",
    href: "/yut-hut",
    linkLabel: "Visit",
    images: ["/yut-hut/01-checkin-report.webp", "/yut-hut/03-spoils.webp", "/yut-hut/05-character-sheet.webp"],
    palette: ["#ffcc00", "#ff5500"],
  },
  {
    id: "magic",
    title: "Magic: The Gathering tools",
    kicker: "Three table-side apps",
    blurb: "A four-player Commander life tracker, a deck filter for tutor targets, and a token tracker that finds every token a deck can make.",
    href: "/commander",
    linkLabel: "Open Commander",
    images: ["/magic/commander.webp", "/magic/tutor-helper.webp", "/magic/token-helper.webp"],
    palette: ["#a855f7", "#22d3ee"],
  },
  {
    id: "floatwise",
    title: "FloatWise",
    kicker: "Trip planner",
    blurb: "Hourly forecasts, live Yellowstone River flow and a map of put-ins and take-outs.",
    href: "/floatwise",
    linkLabel: "Open",
    images: ["/floatwise/forecast.webp"],
    palette: ["#38bdf8", "#facc15"],
  },
  {
    id: "dota-randomizer",
    title: "Dota Randomizer",
    kicker: "Canvas toy",
    blurb: "Two canvas wheels spin up a random hero and item from live OpenDota data.",
    href: "/dota-randomizer",
    linkLabel: "Spin",
    images: ["/dota-randomizer/wheels.webp"],
    palette: ["#ef4444", "#f97316"],
  },
  {
    id: "irlscape",
    title: "IRLScape",
    kicker: "Streaming overlay",
    blurb: "Old School RuneScape's UI over a live camera feed, with Twitch chat and Joycon controls.",
    href: "https://www.youtube.com/watch?v=gCofVhR5HUQ",
    linkLabel: "Watch",
    images: ["/irlscape/thumbnail.webp", "/osrsprogs/progresspic.webp"],
    palette: ["#eab308", "#84cc16"],
  },
  {
    id: "resume",
    title: "Résumé",
    kicker: "Technologies",
    blurb: "The tools and frameworks I work with.",
    href: "/resume",
    linkLabel: "Résumé",
    images: ["/resume/museum-technologies.webp"],
    palette: ["#ffffff", "#ffffff"],
  },
];
