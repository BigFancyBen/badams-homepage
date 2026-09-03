import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { iconDataUrl } from "../../_lib/icons";
import {
  FONT,
  RS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  SKILL_ORDER,
  skillLabel,
  tierColor,
} from "../../_lib/theme";

interface SheetSkill {
  /** Skill key, e.g. "attack" */
  k: string;
  /** Level */
  l: number;
  /** 0-100 percent of the way to the next level */
  pct: number;
}

interface SheetPayload {
  /** Player id */
  p: string;
  /** Display name */
  n: string;
  s: SheetSkill[];
  /** Total level */
  t: number;
  /** Tier key, e.g. "rune_t" */
  tier: string;
  /** Tier display name, e.g. "Rune (t)" */
  tn: string;
  /** Seven chars, "x" = checked in that day, "." = not, oldest first */
  d7: string;
  /** Form weeks (streak) */
  fw: number;
  /** Rings of life held */
  rg: number;
  /** Banked lamps */
  lm: number;
  /** Held clue */
  cl?: { tier: string; step: number; of: number };
  /** Collection log entries, out of 90 */
  log: number;
  /** Title */
  ti?: string;
  /** Act number */
  a: number;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const FRAME = 6;
const PAD = 20;
const CELL_WIDTH = 270;
const CELL_HEIGHT = 110;
const CELL_GAP = 12;

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Cells in stats-tab order, then anything the Worker sent that this side has
 * no slot for. An unknown key still gets a cell, just without art.
 */
function orderedSkills(skills: SheetSkill[]): SheetSkill[] {
  const byKey = new Map(skills.map((skill) => [skill.k, skill]));
  const known: SheetSkill[] = [];
  for (const key of SKILL_ORDER) {
    const hit = byKey.get(key);
    if (hit) {
      known.push(hit);
      byKey.delete(key);
    }
  }
  return [...known, ...byKey.values()];
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<SheetPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, s, t, tier, tn, d7, fw, rg, lm, cl, log, ti, a } = result.payload;
  const frame = tierColor(tier);
  const skills = orderedSkills(Array.isArray(s) ? s : []);
  const days = (d7 ?? "").padEnd(7, ".").slice(0, 7).split("");

  const footer: string[] = [
    `Form weeks ${fw}`,
    `Rings ${rg}`,
    `Lamps ${lm}`,
  ];
  if (cl) footer.push(`Clue ${cl.tier} ${cl.step}/${cl.of}`);
  footer.push(`Log ${log}/90`, `Act ${a}`);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: RS.panel,
          border: `${FRAME}px solid ${frame}`,
          padding: PAD,
          fontFamily: FONT.body,
          color: RS.parchment,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            height: 64,
            paddingBottom: 10,
            borderBottom: `2px solid ${RS.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                display: "flex",
                fontFamily: FONT.bold,
                fontSize: 44,
                color: RS.yellow,
                textShadow: RS.shadow,
              }}
            >
              {n}
            </div>
            {ti ? (
              <div
                style={{
                  display: "flex",
                  marginLeft: 16,
                  fontFamily: FONT.chat,
                  fontSize: 26,
                  color: RS.orange,
                  textShadow: RS.shadow,
                }}
              >
                {ti}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div
              style={{
                display: "flex",
                fontFamily: FONT.bold,
                fontSize: 28,
                color: RS.yellow,
                textShadow: RS.shadow,
              }}
            >
              {`Total level ${t}`}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: FONT.chat,
                fontSize: 22,
                color: frame,
                textShadow: RS.shadow,
              }}
            >
              {tn}
            </div>
          </div>
        </div>

        {/* Skill grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: CELL_WIDTH * 3 + CELL_GAP * 2,
            marginTop: 16,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {skills.map((skill, i) => {
            const icon = iconDataUrl(skill.k);
            const maxed = skill.l >= 99;
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={skill.k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: CELL_WIDTH,
                  height: CELL_HEIGHT,
                  marginLeft: col === 0 ? 0 : CELL_GAP,
                  marginTop: row === 0 ? 0 : CELL_GAP,
                  padding: "0 16px",
                  backgroundColor: RS.panelDark,
                  border: `2px solid ${RS.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 48,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} width={48} height={48} alt="" />
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    marginLeft: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontFamily: FONT.chat,
                      fontSize: 22,
                      color: RS.parchment,
                      textShadow: RS.shadow,
                    }}
                  >
                    {skillLabel(skill.k)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: FONT.bold,
                      fontSize: 40,
                      lineHeight: 1,
                      marginTop: 2,
                      color: maxed ? RS.orange : RS.yellow,
                      textShadow: RS.shadow,
                    }}
                  >
                    {`${skill.l}`}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      height: 6,
                      marginTop: 6,
                      backgroundColor: RS.barTrack,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: `${clampPct(skill.pct)}%`,
                        height: "100%",
                        backgroundColor: RS.barFill,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 10,
            borderTop: `2px solid ${RS.border}`,
            fontFamily: FONT.chat,
            fontSize: 22,
            color: RS.parchment,
            textShadow: RS.shadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginRight: 22 }}>
            {days.map((day, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  width: 14,
                  height: 14,
                  marginLeft: i === 0 ? 0 : 6,
                  borderRadius: 7,
                  backgroundColor: day === "x" ? RS.barFill : "transparent",
                  border: `2px solid ${day === "x" ? RS.barFill : RS.border}`,
                }}
              />
            ))}
          </div>
          {footer.map((text) => (
            <div key={text} style={{ display: "flex", marginRight: 22 }}>
              {text}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: SHEET_WIDTH, height: SHEET_HEIGHT, fonts: await yutFonts() }
  );
}
