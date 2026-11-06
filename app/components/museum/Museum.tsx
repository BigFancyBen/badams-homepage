"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ENGINE_BASE, ENGINE_BYTES_TOTAL, ENGINE_SCRIPT } from "./constants";
import { installEngineFetch } from "./engineLoader";
import { installMuseumBridge, type BridgeHandle, type MuseumCommand, type TourState } from "./museumBridge";
import { MuseumOverlay } from "./MuseumOverlay";
import { MuteButton } from "./MuteButton";
import { Poster, type LoadPhase, type PosterStatus } from "./Poster";

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
  /* The engine cannot abort a download, so Cancel only takes the visitor back to
     the poster; entering again picks the same load up where it got to. */
  const readyRef = useRef(false);
  const [focusId, setFocusId] = useState("");
  const [tour, setTour] = useState<TourState | "">("");
  /* The overlay registers how to measure its bottom edge; Godot asks through the bridge. */
  const insetRef = useRef<() => number>(() => 0);
  /* When the load last moved (a download chunk, or a step of the hall's build). A
     failure that nothing reports would otherwise leave the bar sitting there forever. */
  const progressAtRef = useRef(0);

  const start = useCallback(async () => {
    if (startedRef.current) {
      setStatus(readyRef.current ? "ready" : "loading");
      return;
    }
    startedRef.current = true;
    progressAtRef.current = performance.now();
    setStatus("loading");
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
          readyRef.current = true;
          setProgress(1);
          setStatus((s) => (s === "loading" ? "ready" : s));
          /* Keys reach the canvas only while it has focus, so arrows still scroll the page otherwise. */
          canvasRef.current?.focus({ preventScroll: true });
        },
        onIntroDone: () => {},
        onTour: (state) => setTour(state as TourState),
        onWalk: () => {},
        bottomInset: () => insetRef.current(),
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

  /* Never auto-starts: the visitor opts in to the download. */
  useEffect(() => {
    if (!hasWebGL2()) {
      setFailDetail("no WebGL2");
      setStatus("failed");
    }
  }, []);

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

  useEffect(
    () => () => {
      engineRef.current?.requestQuit();
      bridgeRef.current?.dispose();
    },
    [],
  );

  /* Tell Godot when the hero is off screen so it can drop to a trickle of frames. */
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

  return (
    <section ref={sectionRef} id="museum" aria-label="Museum after hours" className="relative h-svh w-full overflow-hidden overscroll-x-none bg-[#06070a]">
      <canvas
        id="museum-canvas"
        ref={canvasRef}
        tabIndex={0}
        aria-label="3D museum of Ben Adams's projects. Walk with WASD or the arrow keys, or use the controls."
        className={`absolute inset-0 block h-full w-full outline-none transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ touchAction: ready ? "none" : "pan-y", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", userSelect: "none" }}
      />

      <MuteButton ready={ready} />

      {ready && <MuseumOverlay focusId={focusId} tour={tour} send={send} insetRef={insetRef} />}
      <Poster
        status={status}
        detail={failDetail}
        progress={progress}
        phase={phase}
        onEnter={() => void start()}
        onCancel={() => setStatus("manual")}
        onReload={() => window.location.reload()}
      />
    </section>
  );
}
