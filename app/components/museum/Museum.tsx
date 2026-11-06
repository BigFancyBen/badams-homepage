"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ENGINE_BASE, ENGINE_BYTES_TOTAL, ENGINE_SCRIPT } from "./constants";
import { installEngineFetch } from "./engineLoader";
import { installMuseumBridge, type BridgeHandle, type MuseumCommand, type TourState } from "./museumBridge";
import { MuseumOverlay } from "./MuseumOverlay";
import { MuteButton, type AimPrompt } from "./MuteButton";
import { getSongClock } from "./songClock";
import { chooseSong, dropLeadIn, getSong } from "./songs";
import { Poster, type LoadPhase, type PosterStatus } from "./Poster";
import { attachScrollInput, type ScrollInput } from "./scrollInput";

/* The Engine class comes from the exported museum.js, which is a plain script. */
interface GodotEngine {
  startGame(): Promise<void>;
  requestQuit(): void;
}
interface GodotEngineCtor {
  new (config: Record<string, unknown>): GodotEngine;
}
declare global {
  var Engine: GodotEngineCtor | undefined;
}

type Status = PosterStatus;

/* The loading bar: the download is the first part, the hall building itself and compiling its
   shaders behind the poster (reported by Godot through the bridge) is the rest. */
const DOWNLOAD_SHARE = 0.5;
/* The scene opens on the build: the first drop lands this many seconds after it appears, so a visit
   of under half a minute still sees the countdown and the drop. A little over four bars at 120-128 BPM. */
const DROP_LEAD_SECONDS = 8.5;

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(el);
  });
}

export function Museum() {
  /* Why the game couldn't start, shown on the error sign under ?museumdebug. */
  const [failDetail, setFailDetail] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bridgeRef = useRef<BridgeHandle | null>(null);
  const engineRef = useRef<GodotEngine | null>(null);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<Status>("manual");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<LoadPhase>("download");
  const receivedRef = useRef<Record<string, number>>({});
  const readyRef = useRef(false);
  const [focusId, setFocusId] = useState("");
  const [tour, setTour] = useState<TourState | "">("");
  /* The overlay registers how to measure its bottom edge; Godot asks through the bridge. */
  const insetRef = useRef<() => number>(() => 0);
  /* Likewise for the width the details panel covers at the right edge. */
  const rightInsetRef = useRef<() => number>(() => 0);
  const framingRef = useRef<() => string>(() => "");
  /* When the load last moved (a download chunk, or a step of the hall's build). A
     failure that nothing reports would otherwise leave the bar sitting there forever. */
  const progressAtRef = useRef(0);
  /* Scrolling moves between the views (the default); free roam walks instead. */
  const [free, setFree] = useState(false);
  const freeRef = useRef(false);
  const readyStateRef = useRef(false);
  const scrollRef = useRef<ScrollInput | null>(null);

  const start = useCallback(async () => {
    if (startedRef.current) {
      setStatus(readyRef.current ? "ready" : "loading");
      return;
    }
    startedRef.current = true;
    progressAtRef.current = performance.now();
    setStatus("loading");
    /* A ~2.5 MB side load, not counted in the bar. Only the bytes: decoding needs an AudioContext,
       which needs a gesture, so that waits for the first unmute. */
    getSongClock().prefetch();
    try {
      if (!hasWebGL2()) throw new Error("no WebGL2");
      bridgeRef.current ??= installMuseumBridge({
        onFocus: setFocusId,
        onBuildProgress: (f) => {
          progressAtRef.current = performance.now();
          setPhase("build");
          setProgress((p) => Math.max(p, DOWNLOAD_SHARE + (1 - DOWNLOAD_SHARE) * Math.min(1, Math.max(0, f))));
        },
        onReady: () => {
          /* Only on the first reveal of the visit; a lost-context reload or remount keeps the song where it is. */
          if (!readyRef.current) getSongClock().seek(dropLeadIn(getSong(), DROP_LEAD_SECONDS));
          readyRef.current = true;
          setProgress(1);
          setStatus((s) => (s === "loading" ? "ready" : s));
          /* Keys reach the canvas only while it has focus, so arrows still scroll the page otherwise. */
          canvasRef.current?.focus({ preventScroll: true });
        },
        onIntroDone: () => {},
        onTour: (state) => setTour(state as TourState),
        onWalk: () => {},
        pointerLocked: () => document.pointerLockElement === canvasRef.current,
        scrollDelta: () => scrollRef.current?.take() ?? 0,
        scrollHeld: () => scrollRef.current?.held() ?? false,
        bottomInset: () => insetRef.current(),
        rightInset: () => rightInsetRef.current(),
        framing: () => framingRef.current(),
      });
      if (!globalThis.Engine) await loadScript(ENGINE_SCRIPT);
      const Ctor = globalThis.Engine;
      if (!Ctor || !canvasRef.current) throw new Error("engine missing");
      const engine = new Ctor({
        executable: ENGINE_BASE,
        canvas: canvasRef.current,
        canvasResizePolicy: 2,
        /* Keys reach the canvas only after the visitor clicks into it. */
        focusCanvas: false,
      });
      engineRef.current = engine;
      /* The big downloads go through our own loader: it retries a broken download (Godot's does
         not), and counts the bytes for the bar. */
      const restoreFetch = installEngineFetch({
        onBytes: (file, received) => {
          progressAtRef.current = performance.now();
          receivedRef.current[file] = received;
          const got = Object.values(receivedRef.current).reduce((a, b) => a + b, 0);
          setProgress((p) => Math.max(p, DOWNLOAD_SHARE * Math.min(1, got / ENGINE_BYTES_TOTAL)));
        },
        onFatal: (err) => {
          console.warn("[museum] download failed", err);
          setFailDetail(`download failed: ${String(err)}`);
          setStatus("failed");
        },
      });
      try {
        await engine.startGame();
      } finally {
        restoreFetch();
      }
    } catch (err) {
      console.warn("[museum]", err);
      setFailDetail(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      setStatus("failed");
    }
  }, []);

  /* A load that makes no progress for STALL_MS (and hasn't reached onReady)
     has failed somewhere the loader doesn't report; show the closed sign. */
  useEffect(() => {
    if (status !== "loading") return;
    const STALL_MS = 45000;
    const id = window.setInterval(() => {
      if (!readyRef.current && performance.now() - progressAtRef.current > STALL_MS) {
        console.warn("[museum] load stalled");
        setFailDetail((d) => d || "load stalled (no progress for 45 s)");
        setStatus("failed");
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [status]);

  /* One of the house songs per visit, picked here (the mp3 itself loads on the first unmute); the
     lights get the same cue sheet through the bridge. */
  useEffect(() => {
    getSongClock().setSong(chooseSong());
  }, []);

  /* The visitor chose the game on the homepage, so the download starts as this page opens. */
  useEffect(() => {
    if (!hasWebGL2()) {
      setFailDetail("no WebGL2");
      setStatus("failed");
      return;
    }
    void start();
  }, [start]);

  /* Errors the engine throws outside the promises we hold (wasm OOM, audio
     setup) still say why a load died; keep the last one for ?museumdebug. */
  useEffect(() => {
    if (status !== "loading") return;
    const onError = (e: ErrorEvent) => setFailDetail(`error: ${e.message}`);
    const onRejection = (e: PromiseRejectionEvent) => setFailDetail(`rejection: ${String(e.reason)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [status]);

  /* Leaving the page quits the engine and lets go of the pointer. The teardown waits a tick so a
     development double mount (mount, unmount, mount) does not kill the engine it just started. */
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (document.pointerLockElement) document.exitPointerLock();
      window.setTimeout(() => {
        if (mountedRef.current) return;
        engineRef.current?.requestQuit();
        bridgeRef.current?.dispose();
      }, 0);
    };
  }, []);

  /* The wheel and swipes on the canvas scroll through the museum while it is ready and not in free roam. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const input = attachScrollInput(canvas, () => readyStateRef.current && !freeRef.current);
    scrollRef.current = input;
    return () => {
      input.dispose();
      scrollRef.current = null;
    };
  }, []);

  /* Pointer lock (desktop mouse aim in free roam, started by a click in Godot): the page shows a prompt for it. */
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(!window.matchMedia("(pointer: coarse)").matches);
  }, []);
  /* "Click to aim" shows for a few seconds each time the game is ready and the pointer is free. */
  const [hint, setHint] = useState<"in" | "out" | null>(null);

  /* Tell Godot when the page is off screen so it can drop to a trickle of frames. */
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        bridgeRef.current?.setVisible(e.isIntersecting);
        /* Scrolled away: hand the arrow keys back to the page. */
        if (!e.isIntersecting && document.activeElement === canvasRef.current) canvasRef.current?.blur();
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Phones: keep a horizontal swipe from becoming browser back/forward, stop
     iOS's pinch and double-tap zoom on the canvas, and notice the GPU context
     being taken away (iOS evicts WebGL under memory pressure). */
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = sectionRef.current;
    if (!canvas || !el) return;
    const root = document.documentElement;
    const prev = [root.style.overscrollBehaviorX, document.body.style.overscrollBehaviorX];
    root.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", stop);
    el.addEventListener("gesturechange", stop);
    el.addEventListener("dblclick", stop);
    const onLost = (e: Event) => {
      e.preventDefault();
      if (startedRef.current) setStatus("lost");
    };
    canvas.addEventListener("webglcontextlost", onLost);
    /* Back from another app or tab: iOS Safari may have resized the visual
       viewport or killed the context while we were away. */
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !startedRef.current) return;
      window.dispatchEvent(new Event("resize"));
      const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
      if (gl?.isContextLost()) setStatus("lost");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      root.style.overscrollBehaviorX = prev[0];
      document.body.style.overscrollBehaviorX = prev[1];
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("gesturechange", stop);
      el.removeEventListener("dblclick", stop);
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const send = useCallback((cmd: MuseumCommand) => {
    bridgeRef.current?.send(cmd);
    /* Hide Browse projects at once; Godot's onTour confirms (or corrects) the state. */
    if (cmd === "browse") setTour("touring");
  }, []);
  const ready = status === "ready";
  useEffect(() => {
    readyStateRef.current = ready;
  }, [ready]);
  const toggleFree = useCallback(() => {
    const on = !freeRef.current;
    freeRef.current = on;
    setFree(on);
    bridgeRef.current?.send(on ? "mode:free" : "mode:scroll");
    if (!on && document.pointerLockElement) document.exitPointerLock();
    /* Keys go to the game straight away (WASD in free roam, arrows either way). */
    canvasRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!ready || !desktop || !free || locked) {
      setHint(null);
      return;
    }
    setHint("in");
    const fade = window.setTimeout(() => setHint("out"), 4000);
    const gone = window.setTimeout(() => setHint(null), 4800);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, [ready, desktop, free, locked]);
  const aim: AimPrompt = !ready || !desktop || !free ? null : locked ? "locked" : hint === "in" ? "hint" : hint === "out" ? "hint-out" : null;

  return (
    <section ref={sectionRef} id="museum" aria-label="Museum after hours" className="relative h-svh w-full overflow-hidden overscroll-x-none bg-[#06070a]">
      <canvas
        id="museum-canvas"
        ref={canvasRef}
        tabIndex={0}
        aria-label="3D museum of Ben Adams's projects. Scroll, swipe or use the arrow keys to move between the exhibits, or turn on free roam to walk around."
        className={`absolute inset-0 block h-full w-full outline-none transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ touchAction: ready ? "none" : "pan-y", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", userSelect: "none" }}
      />

      <MuteButton ready={ready} aim={aim} />

      {ready && <MuseumOverlay focusId={focusId} tour={tour} free={free} onToggleFree={toggleFree} touch={!desktop} send={send} insetRef={insetRef} rightInsetRef={rightInsetRef} framingRef={framingRef} />}
      <Poster
        status={status}
        detail={failDetail}
        progress={progress}
        phase={phase}
        onReload={() => window.location.reload()}
      />
    </section>
  );
}
