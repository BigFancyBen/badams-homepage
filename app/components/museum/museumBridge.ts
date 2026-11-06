import { getSongClock } from "./songClock";
import { getSong } from "./songs";

/** goto:stage flies to the stage hold, goto:entrance to the end-of-tour view of the marquee, goto:<id> to an exhibit.
    mode:scroll (the default) moves between the views by scrolling; mode:free walks freely (WASD, the stick, pointer lock). */
export type MuseumCommand =
  | "next"
  | "prev"
  | "home"
  | "browse"
  | "tour:pause"
  | "tour:play"
  | "mode:scroll"
  | "mode:free"
  | "goto:stage"
  | "goto:entrance"
  | `goto:${string}`;

/** What the tour is doing: stage (holding from the first frame, show Browse projects), touring, paused, end (at the marquee). */
export type TourState = "stage" | "touring" | "paused" | "end";

export interface MuseumBridge {
  time(): number;
  audible(): boolean;
  /** This visit's song as its cue sheet JSON (museum/songs/<id>.json): tempo, loop and sections. */
  songCues(): string;
  pollCommand(): string;
  /** CSS px scrolled (wheel, trackpad, swipes) since Godot last asked; positive moves on toward the entrance. */
  scrollDelta(): number;
  /** True while a finger is down on the canvas or the wheel turned in the last moment: a gesture still going, so Godot does not snap yet. */
  scrollHeld(): boolean;
  /** False while the hero is scrolled away or the tab is hidden; Godot throttles. */
  visible(): boolean;
  onFocus(id: string): void;
  onReady(): void;
  /** Godot: how far the hall has got in building itself and compiling its shaders, 0..1. */
  onBuildProgress(fraction: number): void;
  /** Godot: sent with onReady (there is no opening move any more); the visitor has control. */
  onIntroDone(): void;
  /** Godot: the tour state changed. */
  onTour(state: string): void;
  /** Godot: true when the visitor starts walking, false when an auto-walk to an exhibit begins. */
  onWalk(walking: boolean): void;
  /** True under prefers-reduced-motion: shorter glides, no idle drift. */
  reducedMotion(): boolean;
  /** True while the canvas holds the pointer lock (desktop mouse aim); Godot asks each frame to notice Esc. */
  pointerLocked(): boolean;
  /** CSS px from the bottom of the hero that the card and controls cover; Godot keeps its stick above. */
  bottomInset(): number;
  /** CSS px from the right of the hero that the project details panel covers while open (0 on phones and while closed); Godot frames the art in the rest. */
  rightInset(): number;
  /** Set by Godot ~5 times a second: "x,y,z,yawDegrees,mode" (mode 1 auto-walk, 2 holds and free walk). */
  debugPos?: string;
}

declare global {
  interface Window {
    museumBridge?: MuseumBridge;
  }
}

export interface BridgeHandle {
  send(cmd: MuseumCommand): void;
  setVisible(v: boolean): void;
  dispose(): void;
}

/**
 * Installs window.museumBridge, the surface the Godot scene calls. Must run
 * before the engine starts. Commands are queued because Godot polls once per
 * frame; focus and ready are pushed to the page through the handlers.
 */
export function installMuseumBridge(handlers: {
  onFocus(id: string): void;
  onReady(): void;
  onBuildProgress(fraction: number): void;
  onIntroDone(): void;
  onTour(state: string): void;
  onWalk(walking: boolean): void;
  bottomInset(): number;
  rightInset(): number;
  pointerLocked(): boolean;
  scrollDelta(): number;
  scrollHeld(): boolean;
}): BridgeHandle {
  const clock = getSongClock();
  const queue: string[] = [];
  let onScreen = true;
  const bridge: MuseumBridge = {
    time: () => clock.time(),
    audible: () => clock.getState().audible,
    songCues: () => JSON.stringify(getSong()),
    pollCommand: () => queue.shift() ?? "",
    scrollDelta: () => {
      const v = handlers.scrollDelta();
      return Number.isFinite(v) ? v : 0;
    },
    scrollHeld: () => Boolean(handlers.scrollHeld()),
    visible: () => onScreen && document.visibilityState === "visible",
    onFocus: (id) => handlers.onFocus(String(id ?? "")),
    onReady: () => handlers.onReady(),
    onBuildProgress: (fraction) => handlers.onBuildProgress(Number(fraction) || 0),
    onIntroDone: () => handlers.onIntroDone(),
    onTour: (state) => handlers.onTour(String(state ?? "")),
    onWalk: (walking) => handlers.onWalk(Boolean(walking)),
    reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    pointerLocked: () => Boolean(handlers.pointerLocked()),
    bottomInset: () => {
      const v = handlers.bottomInset();
      return Number.isFinite(v) ? v : 0;
    },
    rightInset: () => {
      const v = handlers.rightInset();
      return Number.isFinite(v) ? v : 0;
    },
  };
  window.museumBridge = bridge;
  return {
    send: (cmd) => {
      /* A burst of taps should not replay as a long tour afterwards. */
      if (queue.length < 8) queue.push(cmd);
    },
    setVisible: (v) => {
      onScreen = v;
    },
    dispose: () => {
      if (window.museumBridge === bridge) delete window.museumBridge;
    },
  };
}
