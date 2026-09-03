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
  /** e.g. "Slayer task: Hill giants 3/5 for Mazchna" */
  task?: string;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
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

  const lootHeight = loot.length ? LABEL_H + gridRows(loot.length, LOOT_COLS) * LOOT_CELL_H : 0;
  const xpHeight = xp.length ? LABEL_H + gridRows(xp.length, XP_COLS) * XP_CELL_H : 0;
  const linesHeight = levelUps.length * LINE_H + (task ? LINE_H : 0);
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
            {levelUps.map((up, i) => (
              <CardLine
                key={`${up.k}-${i}`}
                icon={iconDataUrl(up.k)}
                color={LEVEL_UP}
                text={`Level up! ${skillLabel(up.k)} ${up.l}`}
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
