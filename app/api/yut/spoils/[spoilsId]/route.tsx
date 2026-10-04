import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { itemIconDataUrl } from "../../_lib/icons";
import { FONT, RS } from "../../_lib/theme";
import { formatDate } from "../../_lib/format";
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
  LootGrid,
  SUBTITLE_H,
  SectionLabel,
  TITLE_H,
  cardHeight,
  cleanLoot,
  gridRows,
} from "../../_lib/card";

/** A spoils pick: the jar, chest, book or crate somebody took, and what came out. */
interface SpoilsPayload {
  /** Player name */
  n: string;
  /** Headline, e.g. "Ben opened a magpie impling jar" */
  t: string;
  /** Subtitle, e.g. "Rare spoils · worth 5.2k gp" */
  sub: string;
  /** The icon drawn large */
  big: string;
  /** common | uncommon | rare | very_rare | legendary */
  tier?: string;
  loot: { k: string; c: number }[];
  /** The loot's worth in coins */
  v?: number;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** The frame round the container, by how rare it is. */
const TIER_FRAME: Record<string, { color: string; label: string }> = {
  common: { color: "#8f8674", label: "Common" },
  uncommon: { color: "#7fb347", label: "Uncommon" },
  rare: { color: "#3a9ad9", label: "Rare" },
  very_rare: { color: "#b36bff", label: "Very rare" },
  legendary: { color: "#ff981f", label: "Legendary" },
};

const BIG_ICON = 96;
const BIG_ROW_H = 124;
const GAP = 6;

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<SpoilsPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { t, sub, d } = result.payload;
  const big = typeof result.payload.big === "string" ? result.payload.big : "";
  const frame = TIER_FRAME[typeof result.payload.tier === "string" ? result.payload.tier : ""] ?? null;
  const loot = cleanLoot(result.payload.loot);
  const src = itemIconDataUrl(big);

  const lootHeight = loot.length ? LABEL_H + gridRows(loot.length, LOOT_COLS) * LOOT_CELL_H : 0;
  const height = cardHeight([TITLE_H, SUBTITLE_H, GAP + BIG_ROW_H, lootHeight, GAP + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={t ?? ""} />
        <CardSubtitle text={sub ?? ""} />

        <div style={{ display: "flex", alignItems: "center", height: BIG_ROW_H, marginTop: GAP }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: BIG_ICON + 20,
              height: BIG_ICON + 20,
              backgroundColor: RS.barTrack,
              border: `4px solid ${frame?.color ?? RS.border}`,
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} width={BIG_ICON} height={BIG_ICON} alt="" />
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
            <div
              style={{
                display: "flex",
                fontFamily: FONT.bold,
                fontSize: 34,
                lineHeight: 1,
                color: frame?.color ?? RS.orange,
                textShadow: RS.shadow,
                whiteSpace: "nowrap",
              }}
            >
              {frame ? frame.label : "Spoils"}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontFamily: FONT.chat,
                fontSize: 20,
                lineHeight: 1,
                color: RS.parchment,
                textShadow: RS.shadow,
                whiteSpace: "nowrap",
              }}
            >
              {loot.length ? "Banked" : ""}
            </div>
          </div>
        </div>

        {loot.length ? <SectionLabel text="Loot:" /> : null}
        {loot.length ? <LootGrid items={loot} /> : null}

        <DateStamp text={formatDate(d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
