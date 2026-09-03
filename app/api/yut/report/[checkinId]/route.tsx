import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { iconDataUrl, itemIconDataUrl } from "../../_lib/icons";
import { RS, skillLabel } from "../../_lib/theme";
import { formatDate } from "../../_lib/format";
import {
  CARD_WIDTH,
  Card,
  CardLine,
  CardSubtitle,
  CardTitle,
  DATE_H,
  DateStamp,
  LABEL_H,
  LINE_H,
  LOOT_CELL_H,
  LOOT_COLS,
  LootGrid,
  SUBTITLE_H,
  SectionLabel,
  TITLE_H,
  XP_CELL_H,
  XP_COLS,
  XpGrid,
  cardHeight,
  cleanLoot,
  cleanXp,
  gridRows,
} from "../../_lib/card";

interface LevelUp {
  /** Skill key */
  k: string;
  /** New level */
  l: number;
  /** The level before, when the worker sends it */
  f?: number;
}

/** What one check-in produced, drawn like an OSRS progress report. */
interface ReportPayload {
  /** Player name */
  n: string;
  /** Subtitle, e.g. "2nd check-in this week · full value" */
  t: string;
  /** Item key and count; c is 1 for a single item */
  loot: { k: string; c: number }[];
  /** Skill key and XP gained */
  xp: { k: string; x: number }[];
  /** Level-ups */
  lv?: LevelUp[];
  /** e.g. "Task: Hill giants 23/40 for Mazchna" */
  task?: string;
  /** The session: "23 hill giants · max hit 4 · 54% to hit · Rune scimitar" */
  s?: string;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** The scimitar named at the end of the session line, as an icon key. */
function sessionIcon(session: string): string {
  const match = session.match(/(bronze|iron|steel|black|mithril|adamant|rune|dragon) scimitar/i);
  return match ? `${match[1].toLowerCase()}_scimitar` : "gem";
}

/** Space above a block, kept out of the block's own height so labels sit flush. */
const GAP = 6;
const LEVEL_UP = "#00ff80";

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<ReportPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, t, d } = result.payload;
  const loot = cleanLoot(result.payload.loot);
  const xp = cleanXp(result.payload.xp);
  const levelUps = (Array.isArray(result.payload.lv) ? result.payload.lv : []).filter(
    (entry): entry is LevelUp =>
      !!entry && typeof entry.k === "string" && typeof entry.l === "number"
  );
  const task = typeof result.payload.task === "string" ? result.payload.task.trim() : "";
  const session = typeof result.payload.s === "string" ? result.payload.s.trim() : "";

  const lootHeight = loot.length ? LABEL_H + gridRows(loot.length, LOOT_COLS) * LOOT_CELL_H : 0;
  const xpHeight = xp.length ? LABEL_H + gridRows(xp.length, XP_COLS) * XP_CELL_H : 0;
  const linesHeight = (session ? LINE_H : 0) + levelUps.length * LINE_H + (task ? LINE_H : 0);
  const height = cardHeight([
    TITLE_H,
    SUBTITLE_H,
    lootHeight,
    xpHeight,
    linesHeight ? GAP + linesHeight : 0,
    GAP + DATE_H,
  ]);

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={n ?? ""} />
        <CardSubtitle text={t ?? ""} />

        {loot.length ? <SectionLabel text="Loot:" /> : null}
        {loot.length ? <LootGrid items={loot} /> : null}

        {xp.length ? <SectionLabel text="XP:" /> : null}
        {xp.length ? <XpGrid items={xp} /> : null}

        {linesHeight ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: GAP }}>
            {session ? (
              <CardLine icon={itemIconDataUrl(sessionIcon(session))} color={RS.parchment} text={session} />
            ) : null}
            {levelUps.map((up, i) => (
              <CardLine
                key={`${up.k}-${i}`}
                icon={iconDataUrl(up.k)}
                color={LEVEL_UP}
                text={
                  typeof up.f === "number"
                    ? // The RuneScape fonts have no arrow glyph; "->" is the closest they draw.
                      `${skillLabel(up.k)} ${up.f} -> ${up.l}`
                    : `Level up! ${skillLabel(up.k)} ${up.l}`
                }
              />
            ))}
            {task ? (
              <CardLine icon={itemIconDataUrl("gem")} color={RS.parchment} text={task} />
            ) : null}
          </div>
        ) : null}

        <DateStamp text={formatDate(d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
