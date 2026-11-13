/**
 * Clave Boss: a tick-based boss fight where the safe tile on each beat traces
 * a salsa step pattern. The audio clock is the only clock: beats are scheduled
 * on the AudioContext timeline and key presses are judged against the same
 * timeline, so the frame rate never affects timing.
 */

type Step = "N" | "S" | "W" | "E" | "T" | "H"; // forward, back, left, right, tap in place, hold
type Action = Exclude<Step, "H">;
type PatternKey = "mambo" | "side" | "on2";
type Mode = "boss" | PatternKey;

interface Settings {
  bpm: number;
  mode: Mode;
  role: "lead" | "follow";
  next: boolean;
  clave: boolean;
  bell: boolean;
  conga: boolean;
  offset: number;
}

interface Game {
  spb: number;
  win: number;
  start: number;
  inputs: Map<number, { a: Action; off: number; double?: boolean }>;
  resolved: number;
  schedE: number;
  barPat: PatternKey[];
  results: Map<number, "ok" | "bad" | "hold">;
  hp: number;
  boss: number;
  hits: number;
  streak: number;
  best: number;
  steps: number;
  perfect: number;
  offsets: number[];
  over: boolean;
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
const BOSS_MAX = 400;
const HP_MAX = 99;
const COUNT_IN = 8;
const CLAVE = new Set([0, 3, 6, 10, 12]); // 3-2 son clave, in eighth notes over one 8-count
const CONGA = new Set([6, 7, 14, 15]); // tumbao open tones on 4, 4&, 8, 8&
const KEYS: Record<string, Action> = {
  ArrowUp: "N", KeyW: "N", ArrowDown: "S", KeyS: "S",
  ArrowLeft: "W", KeyA: "W", ArrowRight: "E", KeyD: "E", Space: "T",
};
const SETTINGS_KEY = "clave-boss-settings";
const RECORD_KEY = "clave-boss-record";

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
  const settings: Settings = {
    bpm: 180, mode: "boss", role: "lead", next: true, clave: true, bell: true, conga: true, offset: 0,
    ...load<Settings>(SETTINGS_KEY),
  };
  const record = { kills: 0, flawless: 0, ...load<{ kills: number; flawless: number }>(RECORD_KEY) };

  let actx: AudioContext | null = null;
  let master: GainNode | null = null;
  let G: Game | null = null;
  let running = false;
  let schedTimer = 0;
  let raf = 0;
  const tiles = all(".tile");
  const player = ref("player");
  const bossEl = ref("boss");
  const arena = ref("arena");

  function newGame(): Game {
    const spb = 60 / settings.bpm;
    return {
      spb, win: Math.min(0.15, spb * 0.45), start: 0, inputs: new Map(), resolved: COUNT_IN - 1, schedE: 0,
      barPat: [], results: new Map(), hp: HP_MAX, boss: BOSS_MAX, hits: 0, streak: 0, best: 0, steps: 0,
      perfect: 0, offsets: [], over: false, disp: [1, 1],
    };
  }

  /* ---------- pattern lookup ---------- */
  function patKey(b: number): PatternKey {
    if (settings.mode !== "boss") return settings.mode;
    if (!G) return "mambo";
    if (G.barPat[b]) return G.barPat[b];
    const f = G.boss / BOSS_MAX;
    const keys: PatternKey[] = ["mambo", "side", "on2"];
    const k: PatternKey =
      f > 2 / 3 ? "mambo" : f > 1 / 3 ? "side" : f > 0.15 ? "on2" : keys[Math.floor(Math.random() * 3)];
    return (G.barPat[b] = k);
  }
  function phaseName() {
    if (settings.mode !== "boss") return "Drill";
    const f = G ? G.boss / BOSS_MAX : 1;
    return f > 2 / 3 ? "Phase 1" : f > 1 / 3 ? "Phase 2" : f > 0.15 ? "Phase 3" : "Final";
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
    if (!running || !G || G.over || !actx) return;
    const h = G.spb / 2, until = actx.currentTime + 0.15;
    while (G.start + G.schedE * h < until) {
      playEighth(G.schedE, G.start + G.schedE * h);
      G.schedE++;
    }
  }
  /** Seconds since beat 0 as the player hears it. */
  function relT() {
    return actx!.currentTime - (actx!.outputLatency || actx!.baseLatency || 0) - settings.offset / 1000 - G!.start;
  }

  /* ---------- input & judging ---------- */
  function press(a: Action) {
    if (!running || !G || G.over) return;
    const t = relT(), n = Math.round(t / G.spb), off = t - n * G.spb;
    if (n < COUNT_IN || n <= G.resolved) return;
    if (Math.abs(off) > G.win) {
      showGrade("Off beat", "meh");
      return;
    }
    const ex = G.inputs.get(n);
    if (ex) {
      ex.double = true;
      return;
    }
    G.inputs.set(n, { a, off });
    const base = tileAt(n - 1);
    G.disp = [clamp(base[0] + DIR[a][0]), clamp(base[1] + DIR[a][1])];
    renderPlayer();
    player.classList.add("tap");
    later(() => player.classList.remove("tap"), 70);
  }
  function resolve(n: number) {
    const g = G!;
    const s = stepAt(n);
    if (!s) return;
    const inp = g.inputs.get(n);
    g.inputs.delete(n);
    let res: "ok" | "bad" | "hold";
    if (s === "H") res = inp ? fail("Moved on the hold", false) : "hold";
    else if (!inp) res = fail("Missed step", true);
    else if (inp.double) res = fail("Double step", true);
    else if (inp.a !== s) res = fail("Wrong step", true);
    else res = land(inp.off);
    g.results.set(n, res);
    g.disp = tileAt(n);
    renderPlayer();
    if (s !== "H") swing(g.disp);
  }
  function land(off: number): "ok" {
    const g = G!;
    const a = Math.abs(off);
    let grade: string, dmg: number, cls = "good";
    if (a <= 0.04) {
      grade = "Perfect";
      dmg = 4;
      g.perfect++;
    } else if (a <= 0.08) {
      grade = "Good";
      dmg = 3;
    } else {
      grade = off < 0 ? "Early" : "Late";
      dmg = 1;
      cls = "meh";
    }
    g.steps++;
    g.streak++;
    g.best = Math.max(g.best, g.streak);
    g.offsets.push(off);
    if (g.offsets.length > 24) g.offsets.shift();
    showGrade(grade, cls);
    if (settings.mode === "boss") {
      g.boss = Math.max(0, g.boss - dmg);
      splat(bossEl, dmg, "dmg");
      if (g.boss <= 0) end(true);
    }
    return "ok";
  }
  function fail(msg: string, isStep: boolean): "bad" {
    const g = G!;
    const dmg = 7 + Math.floor(Math.random() * 12);
    g.hp = Math.max(0, g.hp - dmg);
    g.hits++;
    g.streak = 0;
    if (isStep) g.steps++;
    splat(player, dmg, "hit");
    showGrade(msg, "bad");
    player.classList.add("ouch");
    later(() => player.classList.remove("ouch"), 180);
    if (g.hp <= 0) {
      if (settings.mode === "boss") end(false);
      else g.hp = HP_MAX;
    }
    return "bad";
  }

  /* ---------- effects ---------- */
  function swing(safe: [number, number]) {
    bossEl.classList.remove("swing");
    void bossEl.offsetWidth;
    bossEl.classList.add("swing");
    tiles.forEach((t, i) => {
      if (i !== safe[1] * 3 + safe[0]) t.classList.add("hot");
    });
    later(() => tiles.forEach((t) => t.classList.remove("hot")), Math.min(130, G!.spb * 450));
  }
  function splat(el: HTMLElement, num: number, cls: string) {
    const ar = arena.getBoundingClientRect(), r = el.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "splat " + cls;
    d.textContent = String(num);
    d.style.left = r.left - ar.left + r.width / 2 + (Math.random() * 16 - 8) + "px";
    d.style.top = r.top - ar.top + r.height / 2 + "px";
    arena.appendChild(d);
    later(() => d.remove(), 720);
  }
  function showGrade(txt: string, cls: string) {
    const g = ref("grade");
    g.className = "grade";
    void g.offsetWidth;
    g.textContent = txt;
    g.className = "grade show " + cls;
  }

  /* ---------- render ---------- */
  function renderPlayer() {
    const [x, y] = G ? G.disp : [1, 1];
    player.style.transform = `translate(calc(${x} * (100% + 6px)), calc(${y} * (100% + 6px)))`;
  }
  function renderStrip(bar: number, cur: number) {
    const base = COUNT_IN + bar * 8;
    const cells = ref("counts").children;
    for (let k = 0; k < 8; k++) {
      const n = base + k, s = stepAt(n)!, c = cells[k] as HTMLElement, r = G ? G.results.get(n) : undefined;
      (c.lastElementChild as HTMLElement).textContent = GLYPH[s];
      c.className =
        "cnt" + (s === "H" ? " hold" : "") + (n === cur ? " now" : "") + (r === "ok" ? " ok" : r === "bad" ? " bad" : "");
    }
  }
  function renderStats() {
    const hp = G ? G.hp : HP_MAX;
    ref("hp").textContent = String(hp);
    ref("orb").style.setProperty("--p", String(hp / HP_MAX));
    ref("hits").textContent = String(G ? G.hits : 0);
    ref("streak").textContent = String(G ? G.streak : 0);
    ref("perf").textContent = G && G.steps ? Math.round((100 * G.perfect) / G.steps) + "%" : "–";
    const boss = G ? G.boss : BOSS_MAX, isBoss = settings.mode === "boss";
    ref("bossfill").style.transform = `scaleX(${isBoss ? boss / BOSS_MAX : 1})`;
    ref("bosshp").textContent = isBoss ? `${boss} / ${BOSS_MAX}` : "∞";
    const offs = G ? G.offsets : [];
    ref("meter").innerHTML = offs
      .map((o) => `<i style="left:${50 + Math.max(-1, Math.min(1, o / G!.win)) * 50}%"></i>`)
      .join("");
    if (offs.length) {
      const avg = (offs.reduce((a, b) => a + b, 0) / offs.length) * 1000;
      ref("avg").textContent = `Avg ${avg >= 0 ? "+" : "−"}${Math.abs(avg).toFixed(0)} ms`;
    } else ref("avg").textContent = "Avg –";
    ref("kc").textContent = `Kills ${record.kills} · Flawless ${record.flawless}`;
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
    ref("phase").textContent = `${phaseName()} · ${PATTERNS[patKey(0)].name}`;
    ref("bigcount").textContent = "";
    ref("tickread").textContent = "Tick 0 · Bar 0";
  }
  function frame() {
    if (!running || !G) return;
    const g = G;
    const t = relT();
    while (!g.over && (g.resolved + 1) * g.spb + g.win < t) resolve(++g.resolved);
    if (!running) return;
    const cur = Math.floor(t / g.spb), gb = cur - COUNT_IN, bar = Math.max(0, Math.floor(gb / 8));
    const frac = t / g.spb - cur;

    const bc = ref("bigcount");
    if (gb < 0) {
      bc.textContent = cur >= 4 ? String(cur + 1) : "";
      bc.className = "bigcount";
    } else {
      const c = (gb % 8) + 1;
      bc.textContent = String(c);
      bc.className = "bigcount" + (c === 4 || c === 8 ? " dim" : "");
    }
    if (!reduced && cur >= 0) bossEl.style.scale = String(1 + 0.07 * Math.pow(Math.max(0, 1 - frac), 3));

    clearTargets();
    if (settings.next) {
      let m = Math.round(t / g.spb);
      if (g.inputs.has(m) || m <= g.resolved) m++;
      const s = stepAt(m);
      if (s) {
        const [x, y] = tileAt(m), tl = tiles[y * 3 + x];
        tl.classList.add("target");
        if (s === "H") tl.classList.add("holdt");
        tl.innerHTML = `<em>${((m - COUNT_IN) % 8) + 1}</em>`;
      }
    }
    renderStrip(bar, cur);
    ref("phase").textContent = `${phaseName()} · ${PATTERNS[patKey(bar)].name}`;
    ref("tickread").textContent = `Tick ${Math.max(0, cur)} · Bar ${gb < 0 ? 0 : bar + 1}`;
    renderStats();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- flow ---------- */
  async function start() {
    await ensureAudio();
    if (signal.aborted) return;
    G = newGame();
    G.start = actx!.currentTime + 0.25;
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
  function showOverlay(title: string, text: string, button: string) {
    ref("ovTitle").textContent = title;
    ref("ovText").textContent = text;
    ref("ovSub").hidden = true;
    ref("ovGo").textContent = button;
    root.querySelector(".badge")?.remove();
    ref("overlay").hidden = false;
  }
  function end(win: boolean) {
    const g = G!;
    g.over = true;
    const secs = Math.max(0, relT() - COUNT_IN * g.spb);
    stop();
    if (win) {
      record.kills++;
      if (g.hits === 0) record.flawless++;
      save(RECORD_KEY, record);
    }
    const avg = g.offsets.length ? (g.offsets.reduce((a, b) => a + b, 0) / g.offsets.length) * 1000 : 0;
    showOverlay(
      win ? "El Clavero is down" : "You got stepped on",
      win
        ? g.hits === 0
          ? "Not a single hit taken."
          : `${g.hits} hit${g.hits === 1 ? "" : "s"} taken at ${settings.bpm} BPM.`
        : `El Clavero had ${g.boss} HP left.`,
      "Fight again",
    );
    const r = ref("ovResults");
    r.hidden = false;
    r.innerHTML =
      `<div><span>Time</span>${secs.toFixed(1)}s</div><div><span>Hits</span>${g.hits}</div>` +
      `<div><span>Perfect</span>${g.steps ? Math.round((100 * g.perfect) / g.steps) : 0}%</div><div><span>Best streak</span>${g.best}</div>` +
      `<div><span>Avg</span>${avg >= 0 ? "+" : "−"}${Math.abs(avg).toFixed(0)} ms</div><div><span>Tempo</span>${settings.bpm}</div>`;
    if (win && g.hits === 0) {
      const b = document.createElement("div");
      b.className = "badge";
      b.textContent = "Flawless";
      r.before(b);
    }
    renderStats();
  }
  function userStop() {
    stop();
    const bar = G ? Math.max(0, Math.floor((G.resolved - COUNT_IN) / 8) + 1) : 0;
    showOverlay("Paused", `Stopped at bar ${bar}.`, "Start over");
    ref("ovResults").hidden = true;
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
    ref("bossbar").classList.toggle("mine", settings.mode !== "boss");
    save(SETTINGS_KEY, settings);
    if (!running) {
      G = null;
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
  onButton("mode", (b) => (settings.mode = b.dataset.v as Mode));
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
  ref("go").addEventListener("click", () => (running ? userStop() : void start()), { signal });
  ref("ovGo").addEventListener("click", () => void start(), { signal });
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
      const a = KEYS[e.code];
      if (running && a) {
        e.preventDefault();
        if (!e.repeat) press(a);
        return;
      }
      if (e.code === "Escape" && running) {
        userStop();
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
      if (document.hidden && running) userStop();
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
