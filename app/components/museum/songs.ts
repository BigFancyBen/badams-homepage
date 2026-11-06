import afterHours from "../../../museum/songs/after-hours.json";
import velvetRope from "../../../museum/songs/velvet-rope.json";
import galleryLights from "../../../museum/songs/gallery-lights.json";
import strobeHall from "../../../museum/songs/strobe-hall.json";
import mirrorBall from "../../../museum/songs/mirror-ball.json";

/** One house song's cue sheet (museum/songs/<id>.json, written by scripts/museum-song/). The same
    JSON goes to Godot through the bridge, so the lights and the page share one source. */
export interface Song {
  id: string;
  title: string;
  bpm: number;
  bars: number;
  /** Length of the loop proper, in seconds. */
  loopSeconds: number;
  /** One bar of pre-roll in the mp3 before the loop begins. */
  loopStartSeconds: number;
  sections: { name: string; from: number; to: number; energy: number; kick: boolean }[];
}

export const SONGS: readonly Song[] = [afterHours, velvetRope, galleryLights, strobeHall, mirrorBall];

/**
 * Seconds into the loop to start from so the first drop lands `lead` seconds later. Every song's
 * first drop follows a break whose last four bars are the riser, snare roll and the stage screen's
 * countdown, so a lead of a little over four bars opens on the build. Falls back to 0 for a cue
 * sheet without a break into a drop.
 */
export function dropLeadIn(song: Song, lead: number): number {
  const i = song.sections.findIndex((s, k) => s.name === "drop" && song.sections[k - 1]?.name === "break");
  if (i < 0) return 0;
  const bar = 240 / song.bpm;
  const t = song.sections[i].from * bar - lead;
  return ((t % song.loopSeconds) + song.loopSeconds) % song.loopSeconds;
}

const LAST_KEY = "museum-last-song";
let current: Song = SONGS[0];
let chosen = false;

/** The song for this visit. Before chooseSong() has run it is the first one (so server render and
    first paint agree); nothing reads it for real until the engine starts. */
export const getSong = (): Song => current;

/** Picks one song uniformly at random, never the one the previous visit played (remembered in
    localStorage under one small key). Idempotent: later calls return the same pick. */
export function chooseSong(): Song {
  if (chosen) return current;
  chosen = true;
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_KEY);
  } catch {
    /* storage blocked: no memory of the last pick */
  }
  const pool = SONGS.filter((s) => s.id !== last);
  current = pool[Math.floor(Math.random() * pool.length)] ?? SONGS[0];
  try {
    localStorage.setItem(LAST_KEY, current.id);
  } catch {
    /* ignore */
  }
  console.info(`[museum] song: ${current.id} (${current.bpm} BPM)`);
  return current;
}
