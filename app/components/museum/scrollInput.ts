/**
 * Scrolling through the museum: the wheel, a trackpad and swipes on the canvas add up to a distance in
 * CSS px that Godot reads each frame (bridge scrollDelta()) and turns into a move along the tour.
 * Positive moves on toward the entrance: scrolling down, or a finger moving up (or left).
 *
 * Only events aimed at the canvas count, so the details panel and the menu still scroll themselves.
 * While `enabled()` is false (free roam, or not ready yet) the wheel is swallowed and nothing adds up.
 */

/** Line-mode wheels (Firefox) report lines, not pixels. */
const LINE_PX = 16;
/** A flick carries on for about this long at its release speed. */
const FLING_MS = 160;
const FLING_MAX_PX = 500;
/** Pixels a finger travels before the swipe picks an axis. */
const AXIS_SLOP = 8;
/** A wheel gesture counts as still going for this long after its last event. */
const WHEEL_HOLD_MS = 120;

export interface ScrollInput {
  /** The distance scrolled since the last call, and reset. */
  take(): number;
  /** A gesture is still going: a finger is down, or the wheel turned within WHEEL_HOLD_MS. */
  held(): boolean;
  dispose(): void;
}

export function attachScrollInput(canvas: HTMLCanvasElement, enabled: () => boolean): ScrollInput {
  let pending = 0;
  let wheelAt = -Infinity;
  const add = (px: number) => {
    if (enabled() && Number.isFinite(px)) pending += px;
  };

  const onWheel = (e: WheelEvent) => {
    /* Pinch-zoom on a trackpad arrives as ctrl+wheel: leave it to the browser. */
    if (e.ctrlKey) return;
    e.preventDefault();
    wheelAt = performance.now();
    const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? window.innerHeight : 1;
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    add(d * unit);
  };

  /* One finger scrolls; a second finger (or a pinch) ends the swipe. */
  let id: number | null = null;
  let last = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let axis: "x" | "y" | null = null;
  let samples: { t: number; d: number }[] = [];
  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      id = null;
      return;
    }
    const t = e.touches[0];
    id = t.identifier;
    last = start = { x: t.clientX, y: t.clientY };
    axis = null;
    samples = [];
  };
  const onMove = (e: TouchEvent) => {
    if (id === null) return;
    const t = Array.from(e.touches).find((x) => x.identifier === id);
    if (!t) return;
    if (!axis) {
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.hypot(dx, dy) < AXIS_SLOP) return;
      axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
    }
    const d = axis === "y" ? last.y - t.clientY : last.x - t.clientX;
    last = { x: t.clientX, y: t.clientY };
    add(d);
    const now = performance.now();
    samples.push({ t: now, d });
    samples = samples.filter((s) => now - s.t < 100);
  };
  const onEnd = (e: TouchEvent) => {
    if (id === null || Array.from(e.touches).some((x) => x.identifier === id)) return;
    id = null;
    if (!axis || samples.length < 2) return;
    const span = Math.max(16, performance.now() - samples[0].t);
    const v = samples.reduce((a, s) => a + s.d, 0) / span;
    add(Math.max(-FLING_MAX_PX, Math.min(FLING_MAX_PX, v * FLING_MS)));
  };

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onStart, { passive: true });
  canvas.addEventListener("touchmove", onMove, { passive: true });
  canvas.addEventListener("touchend", onEnd, { passive: true });
  canvas.addEventListener("touchcancel", onEnd, { passive: true });
  return {
    take: () => {
      const v = pending;
      pending = 0;
      return v;
    },
    held: () => id !== null || performance.now() - wheelAt < WHEEL_HOLD_MS,
    dispose: () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onEnd);
      canvas.removeEventListener("touchcancel", onEnd);
    },
  };
}
