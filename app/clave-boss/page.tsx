"use client";

import { useEffect, useRef } from "react";
import { mountClaveBoss } from "./engine";

/**
 * The markup is static; everything that changes during a fight (tiles, splats,
 * counts, bars) is written straight to the DOM by the engine at frame rate,
 * which keeps React out of the 60fps loop and the audio clock.
 */
export default function ClaveBossPage() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    return mountClaveBoss(root.current);
  }, []);

  return (
    <div className="clave" ref={root}>
      <div className="app">
        <header>
          <h1 className="logo">
            Clave <span>Boss</span>
          </h1>
          <div className="tickread" data-ref="tickread">Tick 0 · Bar 0</div>
        </header>

        <div className="layout">
          <section className="stage">
            <div className="bossbar">
              <div className="bossline">
                <span className="bossname">El Clavero</span>
                <span className="phase" data-ref="phase">Phase 1 · Mambo basic</span>
              </div>
              <div className="bar" data-ref="bossbar">
                <i data-ref="bossfill" />
                <b data-ref="bosshp">400 / 400</b>
              </div>
            </div>

            <div className="arena" data-ref="arena">
              <div className="bossrow">
                <div className="bigcount dim" data-ref="bigcount" />
                <div className="boss" data-ref="boss" aria-label="El Clavero">
                  <svg viewBox="0 0 56 56" aria-hidden="true">
                    <rect x="8" y="24" width="42" height="9" rx="4.5" fill="#f0b84c" transform="rotate(-28 28 28)" />
                    <rect x="8" y="24" width="42" height="9" rx="4.5" fill="#c98a2a" transform="rotate(28 28 28)" />
                  </svg>
                </div>
                <div className="grade" data-ref="grade" />
              </div>
              <div className="grid" data-ref="grid">
                {Array.from({ length: 9 }, (_, i) => (
                  <div className="tile" key={i} />
                ))}
                <div className="player" data-ref="player">
                  <div className="me">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <ellipse cx="8.5" cy="12" rx="3" ry="5.5" fill="#140c12" />
                      <ellipse cx="15.5" cy="12" rx="3" ry="5.5" fill="#140c12" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="overlay" data-ref="overlay">
                <h2 data-ref="ovTitle">Clave Boss</h2>
                <p data-ref="ovText">
                  Step on the beat. Arrows or WASD move, Space taps in place. Stay still on 4 and 8.
                </p>
                <p className="sub" data-ref="ovSub">
                  Every beat El Clavero swings at the whole floor except one tile. Be on it.
                </p>
                <div className="results" data-ref="ovResults" hidden />
                <button className="go" data-ref="ovGo">Start</button>
              </div>
            </div>

            <div className="counts" data-ref="counts">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="cnt" key={i}>
                  <b>{i + 1}</b>
                  <span />
                </div>
              ))}
            </div>

            <div className="pad" data-ref="pad">
              <button className="u" data-a="N" aria-label="Forward">↑</button>
              <button className="t" data-a="T" aria-label="Tap">●</button>
              <button className="l" data-a="W" aria-label="Left">←</button>
              <button className="d" data-a="S" aria-label="Back">↓</button>
              <button className="r" data-a="E" aria-label="Right">→</button>
            </div>
          </section>

          <aside className="panel">
            <button className="go" data-ref="go">Start</button>

            <fieldset data-ref="setup">
              <div className="group">
                <span className="label">Fight</span>
                <div className="seg" data-ref="mode">
                  <button data-v="boss">Boss</button>
                  <button data-v="mambo">Mambo</button>
                  <button data-v="side">Side</button>
                  <button data-v="on2">Break on 2</button>
                </div>
              </div>

              <div className="group">
                <span className="label">Tempo</span>
                <div className="tempo">
                  <strong data-ref="bpmv">180</strong>
                  <span>BPM</span>
                  <span data-ref="msv">333 ms</span>
                </div>
                <input type="range" id="clave-bpm" data-ref="bpm" min={80} max={230} step={1} aria-label="Tempo" />
                <div className="seg" data-ref="presets">
                  <button data-v="100">100</button>
                  <button data-v="160">160</button>
                  <button data-v="180">180</button>
                  <button data-v="200">200</button>
                </div>
              </div>

              <div className="group">
                <span className="label">Role</span>
                <div className="seg" data-ref="role">
                  <button data-v="lead">Lead</button>
                  <button data-v="follow">Follow</button>
                </div>
              </div>
            </fieldset>

            <div className="group">
              <span className="label">Assists</span>
              <div className="seg" data-ref="toggles">
                <button data-k="next">Next tile</button>
                <button data-k="clave">Clave</button>
                <button data-k="bell">Cowbell</button>
                <button data-k="conga">Conga</button>
              </div>
            </div>

            <div className="group">
              <div className="row">
                <span className="label">Offset</span>
                <span data-ref="offv">0 ms</span>
              </div>
              <input type="range" id="clave-offset" data-ref="offset" min={-120} max={120} step={5} aria-label="Offset" />
            </div>

            <div className="stats">
              <div className="stat">
                <div className="orb" data-ref="orb">
                  <b data-ref="hp">99</b>
                </div>
                <span className="label">HP</span>
              </div>
              <div className="stat">
                <strong data-ref="hits">0</strong>
                <span className="label">Hits</span>
              </div>
              <div className="stat">
                <strong data-ref="streak">0</strong>
                <span className="label">Streak</span>
              </div>
              <div className="stat">
                <strong data-ref="perf">–</strong>
                <span className="label">Perfect</span>
              </div>
            </div>

            <div className="group">
              <div className="row">
                <span>Early</span>
                <span data-ref="avg">Avg –</span>
                <span>Late</span>
              </div>
              <div className="meter" data-ref="meter" />
            </div>
            <div className="kc" data-ref="kc">Kills 0 · Flawless 0</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
