import { getSongClock } from "./songClock";

/** goto:stage flies to the stage hold, goto:entrance to the end-of-tour view of the marquee, goto:<id> to an exhibit. */
export type MuseumCommand = "next" | "prev" | "home" | "browse" | "tour:pause" | "tour:play" | "goto:stage" | "goto:entrance" | `goto:${string}`;

/** What the tour is doing: stage (holding from the first frame, show Browse projects), touring, paused, end (at the marquee). */
export type TourState = "stage" | "touring" | "paused" | "end";

export interface MuseumBridge {
  time(): number;
  audible(): boolean;
  pollCommand(): string;
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
  /** CSS px from the bottom of the hero that the card and controls cover; Godot keeps its stick above. */
  bottomInset(): number;
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
}): BridgeHandle {
  const clock = getSongClock();
  const queue: string[] = [];
  let onScreen = true;
  const bridge: MuseumBridge = {
    time: () => clock.time(),
    audible: () => clock.getState().audible,
    pollCommand: () => queue.shift() ?? "",
    visible: () => onScreen && document.visibilityState === "visible",
    onFocus: (id) => handlers.onFocus(String(id ?? "")),
    onReady: () => handlers.onReady(),
    onBuildProgress: (fraction) => handlers.onBuildProgress(Number(fraction) || 0),
    onIntroDone: () => handlers.onIntroDone(),
    onTour: (state) => handlers.onTour(String(state ?? "")),
    onWalk: (walking) => handlers.onWalk(Boolean(walking)),
    reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    bottomInset: () => {
      const v = handlers.bottomInset();
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
