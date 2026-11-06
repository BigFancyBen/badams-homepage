import { songUrl } from "./constants";
import { getSong, type Song } from "./songs";

export interface ClockState {
  audible: boolean;
  /** True while the mp3 is being fetched and decoded on the first unmute. */
  loading: boolean;
  /** True if the song could not be loaded; the clock keeps running silently. */
  failed: boolean;
}

/** A 0.1 s silent WAV. Playing it from a gesture moves iOS Safari's audio session to
 *  "playback", so Web Audio is not muted by the ringer (silent) switch. */
function silentWavUrl(): string {
  const rate = 8000;
  const n = rate / 10;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128); // 8-bit silence
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}


/**
 * One clock, always running. Muted, it follows performance.now(). Audible, it
 * follows the AudioContext (what the listener actually hears) minus the
 * output latency. Switching either way continues from the same position, so
 * the lights never jump.
 *
 * Both modes are "loop position `base` at reference instant `ref`, plus time
 * elapsed since", with `ref` in the units of whichever clock is current.
 */
export class SongClock {
  private state: ClockState = { audible: false, loading: false, failed: false };
  private listeners = new Set<() => void>();
  private base = 0;
  private ref = typeof performance !== "undefined" ? performance.now() / 1000 : 0;

  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: Promise<AudioBuffer> | null = null;
  private bufferReady = false;
  /** The mp3 bytes fetched ahead of any gesture; decoded (which needs the AudioContext) at the first unmute. */
  private bytes: Promise<ArrayBuffer> | null = null;
  private keepAlive: HTMLAudioElement | null = null;
  /** Bumped by every toggle so a stale async unmute can tell it was overtaken. */
  private token = 0;

  constructor() {
    if (typeof document !== "undefined") {
      /* Music that keeps playing from a background tab is a surprise. The
         clock itself needs no handling: performance.now() keeps going. */
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && (this.state.audible || this.state.loading)) void this.setAudible(false);
      });

    }
  }

  getState = (): ClockState => this.state;

  /** The song whose tempo, loop and mp3 this clock follows. Set once per visit, before the engine starts. */
  private song: Song = getSong();
  setSong(song: Song) {
    if (song.id === this.song.id) return;
    this.song = song;
    this.buffer = null;
    this.bytes = null;
    this.bufferReady = false;
    this.base = 0;
    this.ref = performance.now() / 1000;
  }
  get bpm(): number {
    return this.song.bpm;
  }
  private wrap = (t: number) => ((t % this.song.loopSeconds) + this.song.loopSeconds) % this.song.loopSeconds;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<ClockState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** Seconds into the loop, [0, loopSeconds). Always advancing. */
  time = (): number => {
    if (this.state.audible && this.ctx) {
      const latency = this.ctx.outputLatency ?? this.ctx.baseLatency ?? 0;
      return this.wrap(this.base + (this.ctx.currentTime - latency - this.ref));
    }
    return this.wrap(this.base + (performance.now() / 1000 - this.ref));
  };

  /**
   * Jump to `seconds` into the loop. Muted (or still loading) only the clock moves; audible, the
   * source restarts there, with the same short fade the mute uses so it does not click.
   */
  seek(seconds: number): void {
    const pos = this.wrap(seconds);
    const { ctx, source, gain } = this;
    if (this.state.audible && ctx && source && gain && source.buffer) {
      const buffer = source.buffer;
      this.stopSource();
      const startAt = ctx.currentTime + 0.05;
      const next = ctx.createBufferSource();
      next.buffer = buffer;
      next.loop = true;
      next.loopStart = this.song.loopStartSeconds;
      next.loopEnd = this.song.loopStartSeconds + this.song.loopSeconds;
      next.connect(gain);
      gain.gain.setValueAtTime(1, startAt);
      next.start(startAt, this.song.loopStartSeconds + pos);
      this.source = next;
      this.base = pos;
      this.ref = startAt;
      return;
    }
    this.base = pos;
    this.ref = performance.now() / 1000;
  }

  /** Call from a user gesture when turning sound on. */
  async setAudible(on: boolean): Promise<void> {
    const token = ++this.token;
    if (!on) {
      const pos = this.time();
      this.keepAlive?.pause();
      this.stopSource();
      if (this.state.audible || this.state.loading) {
        this.base = pos;
        this.ref = performance.now() / 1000;
        this.set({ audible: false, loading: false });
      }
      return;
    }
    if (this.state.audible) return;

    try {
      /* All of this runs synchronously inside the tap, before the first await. */
      this.unlockIosAudio();
      const ctx = this.ensureCtx();
      /* resume() starts inside the gesture, before any await that could cost
         the browser's user activation. */
      const resumed = ctx.state === "running" ? Promise.resolve() : ctx.resume();
      if (!this.buffer) {
        this.set({ loading: true, failed: false });
        this.buffer = this.fetchBuffer(ctx);
      } else if (!this.bufferReady) {
        /* The preload is still in flight: wait for it. */
        this.set({ loading: true, failed: false });
      } else if (!this.state.loading) {
        this.set({ loading: false });
      }
      let buffer: AudioBuffer;
      try {
        [buffer] = await Promise.all([this.buffer, resumed]);
      } catch {
        /* A failed preload: fetch once more, as an unmuted visit would. */
        if (token !== this.token) return;
        this.set({ loading: true, failed: false });
        this.buffer = this.fetchBuffer(ctx);
        [buffer] = await Promise.all([this.buffer, resumed]);
      }
      if (token !== this.token) return; // muted again while loading

      const lead = 0.05;
      const startAt = ctx.currentTime + lead;
      /* The loop position the listener should hear when the source starts. */
      const pos = this.wrap(this.time() + lead);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const { loopStartSeconds: loopStart, loopSeconds } = this.song;
      source.loopStart = loopStart;
      source.loopEnd = loopStart + loopSeconds;
      source.connect(this.gain!);
      this.gain!.gain.cancelScheduledValues(ctx.currentTime);
      this.gain!.gain.setValueAtTime(1, ctx.currentTime);
      source.start(startAt, loopStart + pos);
      this.source = source;
      this.base = pos;
      this.ref = startAt;
      this.set({ audible: true, loading: false });
    } catch {
      if (token !== this.token) return;
      this.keepAlive?.pause();
      this.stopSource();
      this.set({ audible: false, loading: false, failed: true });
    }
  }

  private ensureCtx(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
    /* iOS interrupts (calls, Siri, another app) without a pause event: the
       context goes "interrupted"/"suspended". Reflect that, so the button is honest. */
    ctx.addEventListener("statechange", () => {
      if (this.ctx === ctx && ctx.state !== "running" && this.state.audible && !document.hidden) {
        void this.setAudible(false);
      }
    });
    return ctx;
  }

  private fetchBytes(): Promise<ArrayBuffer> {
    return fetch(songUrl(this.song.id)).then((r) => {
      if (!r.ok) throw new Error(`song ${r.status}`);
      return r.arrayBuffer();
    });
  }

  private fetchBuffer(ctx: AudioContext): Promise<AudioBuffer> {
    this.bufferReady = false;
    const raw = this.bytes ?? this.fetchBytes();
    this.bytes = null;
    const buffer = raw.then((data) => ctx.decodeAudioData(data));
    buffer.then(
      () => {
        if (this.buffer === buffer) this.bufferReady = true;
      },
      () => {
        if (this.buffer === buffer) this.buffer = null;
      },
    );
    return buffer;
  }

  /**
   * Fetch the chosen song's bytes ahead of the first unmute, with no AudioContext (that needs a
   * gesture, so decoding waits for the unmute). Starts no playback and leaves mute alone.
   */
  prefetch(): void {
    if (this.buffer || this.bytes || typeof window === "undefined") return;
    const bytes = this.fetchBytes();
    this.bytes = bytes;
    bytes.catch(() => {
      /* The first unmute fetches it again. */
      if (this.bytes === bytes) this.bytes = null;
    });
  }

  /**
   * Fetch and decode the chosen song ahead of the first unmute. Call from the "Game version"
   * click (a gesture, so the AudioContext may be made). Starts no playback and leaves mute alone.
   */
  preload(): void {
    if (this.buffer || typeof window === "undefined") return;
    try {
      this.buffer = this.fetchBuffer(this.ensureCtx());
    } catch {
      /* The first unmute fetches it. */
    }
  }

  toggle(): Promise<void> {
    return this.setAudible(!(this.state.audible || this.state.loading));
  }

  /** Gesture-time iOS workarounds: audio session "playback" plus a silent <audio> loop. */
  private unlockIosAudio() {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
      if (!this.keepAlive) {
        const el = document.createElement("audio");
        el.setAttribute("playsinline", "");
        el.setAttribute("aria-hidden", "true");
        el.loop = true;
        el.preload = "auto";
        el.src = silentWavUrl();
        this.keepAlive = el;
      }
      void this.keepAlive.play().catch(() => {});
    } catch {
      /* best effort */
    }
  }

  private stopSource() {
    const { source, ctx, gain } = this;
    if (!source || !ctx || !gain) return;
    this.source = null;
    /* A 30 ms ramp rather than a hard stop, which clicks. */
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    try {
      source.stop(ctx.currentTime + 0.04);
    } catch {
      /* already stopped */
    }
  }
}

let clock: SongClock | null = null;
export function getSongClock(): SongClock {
  clock ??= new SongClock();
  return clock;
}
