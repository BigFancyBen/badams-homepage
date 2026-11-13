/**
 * Clave Boss: a tick-based footwork trainer where the target tile on each beat
 * traces a salsa step pattern. The audio clock is the only clock: beats are
 * scheduled on the AudioContext timeline and key presses are judged against
 * the same timeline, so the frame rate never affects timing.
 */

type Step = "N" | "S" | "W" | "E" | "T" | "H"; // forward, back, left, right, tap in place, hold
type Action = Exclude<Step, "H">;
type PatternKey = "mambo" | "side" | "on2";

interface Settings {
  bpm: number;
  mode: PatternKey;
  role: "lead" | "follow";
  next: boolean;
  clave: boolean;
  bell: boolean;
  conga: boolean;
  offset: number;
}

interface Session {
  spb: number;
  win: number;
  start: number;
  inputs: Map<number, { a: Action; off: number; double?: boolean }>;
  resolved: number;
  schedE: number;
  results: Map<number, "ok" | "bad" | "hold">;
  recent: boolean[]; // rolling window for the consistency bar
  okTotal: number;
  judged: number;
  streak: number;
  best: number;
  steps: number;
  perfect: number;
  offsets: number[];
  disp: [number, number];
}

const PATTERNS: Record<PatternKey, { name: string; steps: Step[] }> = {
  mambo: { name: "Mambo basic", steps: ["N", "S", "T", "H", "S", "N", "T", "H"] },
  side: { name: "Side basic", steps: ["W", "E", "T", "H", "E", "W", "T", "H"] },
  on2: { name: "Break on 2", steps: ["T", "S", "N", "H", "T", "N", "S", "H"] },
};
const MIRROR: Record<Step, Step> = { N: "S", S: "N", W: "E", E: "W", T: "T", H: "H" };
const DIR: Record<Step, [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], T: [0, 0], H: [0, 0] };
const GLYPH: Record<Step, string> = { N: "↑", S: "↓", W: "←", E: "→", T: "●", H: "·" };
const COUNT_IN = 8;
const WINDOW = 32; // judged counts the consistency bar looks back over
const CLAVE = new Set([0, 3, 6, 10, 12]); // 3-2 son clave, in eighth notes over one 8-count
const CONGA = new Set([6, 7, 14, 15]); // tumbao open tones on 4, 4&, 8, 8&
const KEYS: Record<string, Action> = {
  ArrowUp: "N", KeyW: "N", ArrowDown: "S", KeyS: "S",
  ArrowLeft: "W", KeyA: "W", ArrowRight: "E", KeyD: "E", Space: "T",
};
const SETTINGS_KEY = "clave-boss-settings";
const RECORD_KEY = "clave-boss-best";

function load<T>(k: string): Partial<T> | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null");
  } catch {
    return null;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: settings just don't persist */
  }
}
const clamp = (v: number) => Math.max(0, Math.min(2, v));
const pct = (ok: number, n: number) => (n ? Math.round((100 * ok) / n) : null);
const signedMs = (s: number) => `${s >= 0 ? "+" : "−"}${Math.abs(s * 1000).toFixed(0)} ms`;

export function mountClaveBoss(root: HTMLElement): () => void {
  const ref = <T extends HTMLElement = HTMLElement>(name: string) =>
    root.querySelector(`[data-ref="${name}"]`) as T;
  const all = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];

  const abort = new AbortController();
  const { signal } = abort;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stored = load<Settings>(SETTINGS_KEY) ?? {};
  if (!stored.mode || !(stored.mode in PATTERNS)) stored.mode = "mambo"; // "boss" and "mix" were removed
  const settings: Settings = {
    bpm: 180, mode: "mambo", role: "lead", next: true, clave: true, bell: true, conga: true, offset: 0,
    ...stored,
  };
  const record = { streak: 0, bpm: 0, ...load<{ streak: number; bpm: number }>(RECORD_KEY) };

  let actx: AudioContext | null = null;
  let master: GainNode | null = null;
  let S: Session | null = null;
  let running = false;
  let schedTimer = 0;
  let raf = 0;
  const tiles = all(".tile");
  const player = ref("player");
  const beatEl = ref("beat");

  function newSession(): Session {
    const spb = 60 / settings.bpm;
    return {
      spb, win: Math.min(0.15, spb * 0.45), start: 0, inputs: new Map(), resolved: COUNT_IN - 1, schedE: 0,
      results: new Map(), recent: [], okTotal: 0, judged: 0, streak: 0, best: 0, steps: 0, perfect: 0,
      offsets: [], disp: [1, 1],
    };
  }

  /* ---------- pattern lookup ---------- */
  // Every bar uses the selected pattern; the bar index is kept so a future
  // sequence of patterns has one place to go.
  function patKey(_bar: number): PatternKey {
    return settings.mode;
  }
  function stepAt(n: number): Step | null {
    const g = n - COUNT_IN;
    if (g < 0) return null;
    const s = PATTERNS[patKey(Math.floor(g / 8))].steps[g % 8];
    return settings.role === "follow" ? MIRROR[s] : s;
  }
  function tileAt(n: number): [number, number] {
    const g = n - COUNT_IN;
    if (g < 0) return [1, 1];
    const b = Math.floor(g / 8), k = g % 8;
    let x = 1, y = 1;
    for (let i = 0; i <= k; i++) {
      const s = stepAt(COUNT_IN + b * 8 + i)!;
      x = clamp(x + DIR[s][0]);
      y = clamp(y + DIR[s][1]);
    }
    return [x, y];
  }

  /* ---------- audio ---------- */
  function ensureAudio() {
    if (!actx) {
      actx = new AudioContext({ latencyHint: "interactive" });
      master = actx.createGain();
      master.gain.value = 0.7;
      master.connect(actx.destination);
    }
    return actx.resume();
  }
  function voice(osc: OscillatorNode, t: number, peak: number, dur: number, filter?: BiquadFilterNode) {
    const g = actx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) {
      osc.connect(filter);
      filter.connect(g);
    } else osc.connect(g);
    g.connect(master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function clave(t: number) {
    const o = actx!.createOscillator();
    o.type = "sine";
    o.frequency.value = 2500;
    voice(o, t, 0.5, 0.05);
    const o2 = actx!.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 1250;
    voice(o2, t, 0.15, 0.04);
  }
  function bell(t: number, accent: boolean) {
    const bp = actx!.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 3;
    for (const f of [587, 845]) {
      const o = actx!.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      voice(o, t, accent ? 0.22 : 0.1, accent ? 0.22 : 0.12, bp);
    }
  }
  function conga(t: number, second: boolean) {
    const o = actx!.createOscillator();
    o.type = "sine";
    const f = second ? 260 : 300;
    o.frequency.setValueAtTime(f * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    voice(o, t, 0.55, 0.22);
  }
  function playEighth(e: number, t: number) {
    const p = e % 16;
    if (settings.bell && p % 2 === 0) bell(t, p === 0);
    if (settings.clave && CLAVE.has(p)) clave(t);
    if (settings.conga && CONGA.has(p)) conga(t, p % 2 === 1);
  }
  function scheduler() {
    if (!running || !S || !actx) return;
    const h = S.spb / 2, until = actx.currentTime + 0.15;
    while (S.start + S.schedE * h < until) {
      playEighth(S.schedE, S.start + S.schedE * h);
      S.schedE++;
    }
  }
  /** Seconds since beat 0 as the player hears it. */
  function relT() {
    return actx!.currentTime - (actx!.outputLatency || actx!.baseLatency || 0) - settings.offset / 1000 - S!.start;
  }

  /* ---------- input & judging ---------- */
  function press(a: Action) {
    if (!running || !S) return;
    const t = relT(), n = Math.round(t / S.spb), off = t - n * S.spb;
    if (n < COUNT_IN || n <= S.resolved) return;
    if (Math.abs(off) > S.win) {
      showGrade("Off beat", "meh");
      return;
    }
    const ex = S.inputs.get(n);
    if (ex) {
      ex.double = true;
      return;
    }
    S.inputs.set(n, { a, off });
    const base = tileAt(n - 1);
    S.disp = [clamp(base[0] + DIR[a][0]), clamp(base[1] + DIR[a][1])];
    renderPlayer();
    player.classList.add("tap");
    later(() => player.classList.remove("tap"), 70);
  }
  function judge(ok: boolean) {
    const s = S!;
    s.recent.push(ok);
    if (s.recent.length > WINDOW) s.recent.shift();
    s.judged++;
    if (ok) s.okTotal++;
  }
  function resolve(n: number) {
    const s = S!;
    const step = stepAt(n);
    if (!step) return;
    const inp = s.inputs.get(n);
    s.inputs.delete(n);
    let res: "ok" | "bad" | "hold";
    if (step === "H") res = inp ? miss("Moved on the hold") : "hold";
    else if (!inp) res = miss("Missed");
    else if (inp.double) res = miss("Double step");
    else if (inp.a !== step) res = miss("Wrong step");
    else res = land(inp.off);
    s.results.set(n, res);
    s.disp = tileAt(n);
    renderPlayer();
  }
  function land(off: number): "ok" {
    const s = S!;
    const a = Math.abs(off);
    let grade: string, cls = "good";
    if (a <= 0.04) {
      grade = "Perfect";
      s.perfect++;
    } else if (a <= 0.08) grade = "Good";
    else {
      grade = off < 0 ? "Early" : "Late";
      cls = "meh";
    }
    s.steps++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
    if (s.streak > record.streak) {
      record.streak = s.streak;
      record.bpm = settings.bpm;
    }
    s.offsets.push(off);
    if (s.offsets.length > 24) s.offsets.shift();
    judge(true);
    showGrade(grade, cls);
    return "ok";
  }
  function miss(msg: string): "bad" {
    const s = S!;
    s.streak = 0;
    s.steps++;
    judge(false);
    showGrade(msg, "bad");
    player.classList.add("miss");
    later(() => player.classList.remove("miss"), 180);
    return "bad";
  }

  /* ---------- effects ---------- */
  function showGrade(txt: string, cls: string) {
    const g = ref("grade");
    g.className = "grade";
    void g.offsetWidth;
    g.textContent = txt;
    g.className = "grade show " + cls;
  }

  /* ---------- render ---------- */
  function renderPlayer() {
    const [x, y] = S ? S.disp : [1, 1];
    player.style.transform = `translate(calc(${x} * (100% + 6px)), calc(${y} * (100% + 6px)))`;
  }
  function renderStrip(bar: number, cur: number) {
    const base = COUNT_IN + bar * 8;
    const cells = ref("counts").children;
    for (let k = 0; k < 8; k++) {
      const n = base + k, s = stepAt(n)!, c = cells[k] as HTMLElement, r = S ? S.results.get(n) : undefined;
      (c.lastElementChild as HTMLElement).textContent = GLYPH[s];
      c.className =
        "cnt" + (s === "H" ? " hold" : "") + (n === cur ? " now" : "") + (r === "ok" ? " ok" : r === "bad" ? " bad" : "");
    }
  }
  function renderStats() {
    const recentOk = S ? S.recent.filter(Boolean).length : 0;
    const c = S ? pct(recentOk, S.recent.length) : null;
    ref("consfill").style.transform = `scaleX(${c === null ? 0 : c / 100})`;
    ref("conspct").textContent = c === null ? "–" : `${c}%`;
    ref("streak").textContent = String(S ? S.streak : 0);
    ref("best").textContent = String(record.streak);
    const p = S ? pct(S.perfect, S.steps) : null;
    ref("perf").textContent = p === null ? "–" : `${p}%`;
    const offs = S ? S.offsets : [];
    ref("meter").innerHTML = offs
      .map((o) => `<i style="left:${50 + Math.max(-1, Math.min(1, o / S!.win)) * 50}%"></i>`)
      .join("");
    ref("avg").textContent = offs.length ? `Avg ${signedMs(offs.reduce((a, b) => a + b, 0) / offs.length)}` : "Avg –";
  }
  function clearTargets() {
    tiles.forEach((t) => {
      t.classList.remove("target", "holdt");
      t.innerHTML = "";
    });
  }
  function renderIdle() {
    renderStrip(0, -1);
    renderPlayer();
    renderStats();
    clearTargets();
    ref("phase").textContent = PATTERNS[patKey(0)].name;
    ref("bigcount").textContent = "";
    ref("tickread").textContent = "Tick 0 · Bar 0";
  }
  function frame() {
    if (!running || !S) return;
    const s = S;
    const t = relT();
    while ((s.resolved + 1) * s.spb + s.win < t) resolve(++s.resolved);
    const cur = Math.floor(t / s.spb), g = cur - COUNT_IN, bar = Math.max(0, Math.floor(g / 8));
    const frac = t / s.spb - cur;

    const bc = ref("bigcount");
    if (g < 0) {
      bc.textContent = cur >= 4 ? String(cur + 1) : "";
      bc.className = "bigcount";
    } else {
      const c = (g % 8) + 1;
      bc.textContent = String(c);
      bc.className = "bigcount" + (c === 4 || c === 8 ? " dim" : "");
    }
    if (!reduced && cur >= 0) beatEl.style.scale = String(1 + 0.08 * Math.pow(Math.max(0, 1 - frac), 3));

    clearTargets();
    if (settings.next) {
      let m = Math.round(t / s.spb);
      if (s.inputs.has(m) || m <= s.resolved) m++;
      const step = stepAt(m);
      if (step) {
        const [x, y] = tileAt(m), tl = tiles[y * 3 + x];
        tl.classList.add("target");
        if (step === "H") tl.classList.add("holdt");
        tl.innerHTML = `<em>${((m - COUNT_IN) % 8) + 1}</em>`;
      }
    }
    renderStrip(bar, cur);
    ref("phase").textContent = g < 0 ? "Count-in" : PATTERNS[patKey(bar)].name;
    ref("tickread").textContent = `Tick ${Math.max(0, cur)} · Bar ${g < 0 ? 0 : bar + 1}`;
    renderStats();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- flow ---------- */
  async function start() {
    await ensureAudio();
    if (signal.aborted) return;
    S = newSession();
    S.start = actx!.currentTime + 0.25;
    running = true;
    ref("overlay").hidden = true;
    ref<HTMLFieldSetElement>("setup").disabled = true;
    ref("go").textContent = "Stop";
    ref("go").classList.add("stop");
    (document.activeElement as HTMLElement | null)?.blur();
    clearInterval(schedTimer);
    schedTimer = window.setInterval(scheduler, 25);
    scheduler();
    renderPlayer();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    clearInterval(schedTimer);
    cancelAnimationFrame(raf);
    ref<HTMLFieldSetElement>("setup").disabled = false;
    ref("go").textContent = "Start";
    ref("go").classList.remove("stop");
  }
  /** Stop and show the session summary. */
  function finish() {
    const s = S;
    const secs = s && actx ? Math.max(0, relT() - COUNT_IN * s.spb) : 0;
    stop();
    if (!s || s.judged === 0) {
      ref("ovTitle").textContent = "Clave Boss";
      ref("ovText").textContent = "Stopped before the first count.";
      ref("ovResults").hidden = true;
    } else {
      save(RECORD_KEY, record);
      const what = PATTERNS[settings.mode].name;
      ref("ovTitle").textContent = `${pct(s.okTotal, s.judged)}% consistent`;
      ref("ovText").textContent = `${what}, ${settings.role}, ${settings.bpm} BPM.`;
      const avg = s.offsets.length ? s.offsets.reduce((a, b) => a + b, 0) / s.offsets.length : 0;
      const r = ref("ovResults");
      r.hidden = false;
      r.innerHTML =
        `<div><span>Time</span>${secs.toFixed(1)}s</div><div><span>Steps</span>${s.steps}</div>` +
        `<div><span>Perfect</span>${pct(s.perfect, s.steps) ?? 0}%</div><div><span>Best streak</span>${s.best}</div>` +
        `<div><span>Avg</span>${signedMs(avg)}</div><div><span>All-time best</span>${record.streak}</div>`;
    }
    ref("ovGo").textContent = "Go again";
    ref("overlay").hidden = false;
    renderStats();
  }

  /* ---------- controls ---------- */
  function syncControls() {
    const pressed = (group: string, match: (b: HTMLElement) => boolean) =>
      all(`[data-ref="${group}"] button`).forEach((b) => b.setAttribute("aria-pressed", String(match(b))));
    pressed("mode", (b) => b.dataset.v === settings.mode);
    pressed("role", (b) => b.dataset.v === settings.role);
    pressed("presets", (b) => Number(b.dataset.v) === settings.bpm);
    pressed("toggles", (b) => !!settings[b.dataset.k as "next" | "clave" | "bell" | "conga"]);
    ref<HTMLInputElement>("bpm").value = String(settings.bpm);
    ref("bpmv").textContent = String(settings.bpm);
    ref("msv").textContent = Math.round(60000 / settings.bpm) + " ms";
    ref<HTMLInputElement>("offset").value = String(settings.offset);
    ref("offv").textContent = (settings.offset > 0 ? "+" : "") + settings.offset + " ms";
    save(SETTINGS_KEY, settings);
    if (!running) {
      S = null;
      renderIdle();
    }
  }
  const onButton = (group: string, fn: (b: HTMLElement) => void) =>
    ref(group).addEventListener(
      "click",
      (e) => {
        const b = (e.target as HTMLElement).closest("button");
        if (b) {
          fn(b);
          syncControls();
        }
      },
      { signal },
    );
  onButton("mode", (b) => (settings.mode = b.dataset.v as PatternKey));
  onButton("role", (b) => (settings.role = b.dataset.v as Settings["role"]));
  onButton("presets", (b) => (settings.bpm = Number(b.dataset.v)));
  onButton("toggles", (b) => {
    const k = b.dataset.k as "next" | "clave" | "bell" | "conga";
    settings[k] = !settings[k];
  });
  ref<HTMLInputElement>("bpm").addEventListener(
    "input",
    (e) => {
      settings.bpm = Number((e.target as HTMLInputElement).value);
      syncControls();
    },
    { signal },
  );
  ref<HTMLInputElement>("offset").addEventListener(
    "input",
    (e) => {
      settings.offset = Number((e.target as HTMLInputElement).value);
      syncControls();
    },
    { signal },
  );
  ref("go").addEventListener("click", () => (running ? finish() : void start()), { signal });
  ref("ovGo").addEventListener("click", () => void start(), { signal });

  const helpDlg = ref<HTMLDialogElement>("helpdlg");
  const openHelp = () => {
    if (running) finish();
    if (!helpDlg.open) helpDlg.showModal();
  };
  ref("help").addEventListener("click", openHelp, { signal });
  ref("helpclose").addEventListener("click", () => helpDlg.close(), { signal });
  // A click on the backdrop lands on the dialog element itself.
  helpDlg.addEventListener("click", (e) => e.target === helpDlg && helpDlg.close(), { signal });

  ref("pad").addEventListener(
    "pointerdown",
    (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (b) {
        e.preventDefault();
        press(b.dataset.a as Action);
      }
    },
    { signal },
  );
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "?") {
        e.preventDefault();
        openHelp();
        return;
      }
      if (helpDlg.open) return;
      const a = KEYS[e.code];
      if (running && a) {
        e.preventDefault();
        if (!e.repeat) press(a);
        return;
      }
      if (e.code === "Escape" && running) {
        finish();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (e.code === "Enter" && !running && !target?.closest?.("button,input,a")) {
        e.preventDefault();
        void start();
      }
    },
    { capture: true, signal },
  );
  window.addEventListener(
    "keyup",
    (e) => {
      if (running && e.code === "Space") e.preventDefault();
    },
    { capture: true, signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden && running) finish();
    },
    { signal },
  );

  syncControls();

  return () => {
    abort.abort();
    running = false;
    clearInterval(schedTimer);
    cancelAnimationFrame(raf);
    timers.forEach((id) => clearTimeout(id));
    void actx?.close();
  };
}
