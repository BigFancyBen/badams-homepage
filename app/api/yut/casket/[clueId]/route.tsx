import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { itemName } from "../../_lib/icons";
import { FONT, RS } from "../../_lib/theme";
import { formatDate, formatXp } from "../../_lib/format";
import {
  CARD_WIDTH,
  Card,
  CardSubtitle,
  CardTitle,
  DATE_H,
  DateStamp,
  LABEL_H,
  LOOT_CELL_H,
  LOOT_COLS,
  LootCell,
  LootGrid,
  SUBTITLE_H,
  SectionLabel,
  TITLE_H,
  cardHeight,
  cleanLoot,
  gridRows,
  type LootItem,
} from "../../_lib/card";

/** A finished clue: the casket opened and what fell out. */
interface CasketPayload {
  /** Player name */
  n: string;
  /** easy | medium | hard | elite | master */
  tier: string;
  loot: { k: string; c: number }[];
  /** XP the clue paid */
  xp: number;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/**
 * Everything a casket can hold that is not a unique. The first loot entry
 * outside this set is the unique and gets drawn large with its name.
 */
const COMMON = new Set([
  "coins",
  "logs",
  "ore",
  "fish",
  "bars",
  "lamp",
  "casket",
  "ring",
  "gem",
  "crate",
  "clue_easy",
  "clue_medium",
  "clue_hard",
  "clue_elite",
  "clue_master",
]);

const UNIQUE_ICON = 96;
const UNIQUE_ROW_H = 112;
const GAP = 6;

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<CasketPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, d } = result.payload;
  const tier = typeof result.payload.tier === "string" ? result.payload.tier : "";
  const xp = typeof result.payload.xp === "number" ? result.payload.xp : 0;
  const loot = cleanLoot(result.payload.loot);

  let unique: LootItem | null = null;
  const rest: LootItem[] = [];
  for (const item of loot) {
    if (!unique && !COMMON.has(item.k)) unique = item;
    else rest.push(item);
  }

  const lootHeight =
    loot.length
      ? LABEL_H + (unique ? UNIQUE_ROW_H : 0) + gridRows(rest.length, LOOT_COLS) * LOOT_CELL_H
      : 0;
  const height = cardHeight([TITLE_H, SUBTITLE_H, lootHeight, GAP + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={`${n ?? ""} opened a ${tier} casket`} />
        <CardSubtitle text={`Clue scroll (${tier}) · ${formatXp(xp)} XP`} />

        {loot.length ? <SectionLabel text="Loot:" /> : null}
        {unique ? (
          <div style={{ display: "flex", alignItems: "center", height: UNIQUE_ROW_H }}>
            <LootCell item={unique} icon={UNIQUE_ICON} w={UNIQUE_ICON + 16} h={UNIQUE_ROW_H} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 12 }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: FONT.bold,
                  fontSize: 28,
                  lineHeight: 1,
                  color: RS.orange,
                  textShadow: RS.shadow,
                  whiteSpace: "nowrap",
                }}
              >
                {itemName(unique.k) ?? unique.k}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontFamily: FONT.chat,
                  fontSize: 20,
                  lineHeight: 1,
                  color: RS.parchment,
                  textShadow: RS.shadow,
                }}
              >
                New item added to your collection log.
              </div>
            </div>
          </div>
        ) : null}
        {rest.length ? <LootGrid items={rest} /> : null}

        <DateStamp text={formatDate(d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
