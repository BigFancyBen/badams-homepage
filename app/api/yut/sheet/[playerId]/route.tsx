import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { iconDataUrl, itemIconDataUrl } from "../../_lib/icons";
import {
  FONT,
  OBSIDIAN_GLOW,
  RS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  SKILL_ORDER,
  skillLabel,
  tierColor,
  trimColor,
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
  /** Tier key: the armour set Defence can wear, e.g. "rune" */
  tier: string;
  /** Tier display name, e.g. "Rune" */
  tn: string;
  /** Combat level */
  cb?: number;
  /** Weapon key: the scimitar Attack can wield, e.g. "rune" */
  wp?: string;
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
  /** The bank's worth, in coins */
  bk?: number;
  /** Title */
  ti?: string;
  /** Act number */
  a: number;
  /**
   * Equipped shop cosmetics. Known keys: `trim` (gold | silver | obsidian |
   * third-age), `pet` (e.g. "Baby Mole"), `cape` (e.g. "Act 2 cape (Varrock)").
   * Anything else is ignored.
   */
  eq?: Record<string, string>;
  /** Boss heads: raids won */
  bh?: number;
  /** Bingo points */
  bp?: number;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const FRAME = 6;
/** Gap between the tier frame and the trim line, then the trim line itself. */
const TRIM_GAP = 4;
const TRIM_LINE = 2;
/** Inner padding, sized so the content box is the same width as before trims. */
const PAD = 14;
const CELL_WIDTH = 270;
const CELL_HEIGHT = 110;
const CELL_GAP = 12;

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** A non-empty string from the cosmetics bag, or undefined. */
function cosmetic(eq: Record<string, string> | undefined, key: string): string | undefined {
  const value = eq?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** A finite, non-negative count, or undefined when the Worker sent nothing usable. */
function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
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

  const { n, s, t, tier, tn, d7, fw, rg, lm, cl, log, ti, a, eq, bh, bp, cb, wp, bk } = result.payload;
  const combat = typeof cb === "number" ? cb : undefined;
  const weaponIcon = typeof wp === "string" ? itemIconDataUrl(`${wp}_scimitar`) : null;
  const frame = tierColor(tier);
  const skills = orderedSkills(Array.isArray(s) ? s : []);
  const days = (d7 ?? "").padEnd(7, ".").slice(0, 7).split("");

  const trimKey = cosmetic(eq, "trim");
  const trim = trimColor(trimKey);
  const pet = cosmetic(eq, "pet");
  const cape = cosmetic(eq, "cape");
  const bossHeads = count(bh);
  const bingoPoints = count(bp);

  const footer: string[] = [
    `Form weeks ${fw}`,
    `Rings ${rg}`,
    `Lamps ${lm}`,
  ];
  if (cl) footer.push(`Clue ${cl.tier} ${cl.step}/${cl.of}`);
  footer.push(`Log ${log}/90`);
  if (typeof bk === "number" && bk > 0) {
    footer.push(`Bank ${bk >= 1_000_000 ? `${(bk / 1_000_000).toFixed(1)}m` : bk >= 1_000 ? `${Math.round(bk / 1_000)}k` : String(Math.round(bk))}`);
  }
  footer.push(`Act ${a}`);

  /** Right-hand footer group. A zero head count is left off; a dragon beside a 0 reads oddly. */
  const trophies: string[] = [];
  if (bossHeads) trophies.push(`🐲 ${bossHeads}`);
  if (bingoPoints !== undefined) trophies.push(`🎯 ${bingoPoints} pts`);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: RS.panel,
          border: `${FRAME}px solid ${frame}`,
          padding: TRIM_GAP,
          fontFamily: FONT.body,
          color: RS.parchment,
        }}
      >
      {/*
        Inner frame line. Always drawn so the content box never moves; without
        a trim it is transparent. Obsidian is near-black, so it gets a violet
        glow line just inside it.
      */}
      <div
        style={{
          display: "flex",
          flex: 1,
          border: `${TRIM_LINE}px solid ${trim ?? "transparent"}`,
          // Satori throws on an undefined boxShadow, hence the spread.
          ...(trimKey === "obsidian"
            ? { boxShadow: `inset 0 0 0 ${TRIM_LINE}px ${OBSIDIAN_GLOW}` }
            : {}),
        }}
      >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: PAD,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingBottom: 8,
            borderBottom: `2px solid ${RS.border}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", height: 52 }}>
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
              {pet ? (
                <div
                  style={{
                    display: "flex",
                    marginLeft: 16,
                    fontFamily: FONT.chat,
                    fontSize: 20,
                    color: RS.parchment,
                    textShadow: RS.shadow,
                  }}
                >
                  {`🐾 ${pet}`}
                </div>
              ) : null}
            </div>
            {cape ? (
              <div
                style={{
                  display: "flex",
                  height: 22,
                  fontFamily: FONT.chat,
                  fontSize: 20,
                  lineHeight: 1,
                  color: RS.parchment,
                  textShadow: RS.shadow,
                }}
              >
                {cape}
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
                alignItems: "center",
                fontFamily: FONT.chat,
                fontSize: 22,
                color: frame,
                textShadow: RS.shadow,
              }}
            >
              {weaponIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={weaponIcon} width={28} height={28} alt="" style={{ marginRight: 8 }} />
              ) : null}
              {combat !== undefined ? `${tn} · Combat ${combat}` : tn}
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
            fontSize: 20,
            color: RS.parchment,
            textShadow: RS.shadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginRight: 18, flexShrink: 0 }}>
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
            <div key={text} style={{ display: "flex", marginRight: 18, flexShrink: 0 }}>
              {text}
            </div>
          ))}
          {trophies.length ? (
            <div style={{ display: "flex", marginLeft: "auto", flexShrink: 0 }}>
              {trophies.map((text, i) => (
                <div key={text} style={{ display: "flex", marginLeft: i === 0 ? 0 : 18 }}>
                  {text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      </div>
      </div>
    ),
    { width: SHEET_WIDTH, height: SHEET_HEIGHT, fonts: await yutFonts() }
  );
}
