import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { itemIconDataUrl } from "../../_lib/icons";
import { FONT, RS } from "../../_lib/theme";
import { formatCount, formatDate } from "../../_lib/format";
import { CARD_WIDTH, Card, CardSubtitle, CardTitle, DATE_H, DateStamp, SUBTITLE_H, TITLE_H, cardHeight } from "../../_lib/card";

/** A rare drop, for the channel: the item drawn large, who got it, where from, and the odds. */
interface DropPayload {
  /** Player name */
  n: string;
  /** Item name */
  item: string;
  /** Item key, for the sprite */
  k: string;
  /** Quantity, when more than one */
  q?: number;
  /** Where it came from: "abyssal demons", "Obor", "a hard casket" */
  src?: string;
  /** The odds as text: "1/512" */
  rate?: string;
  /** Worth in coins */
  v?: number;
  /** rare | very_rare | legendary */
  tier?: string;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** The frame and the banner, by how rare the drop is. Same colours as the spoils' tiers. */
const TIER: Record<string, { color: string; label: string }> = {
  rare: { color: "#3a9ad9", label: "Rare drop!" },
  very_rare: { color: "#b36bff", label: "Very rare drop!" },
  legendary: { color: "#ff981f", label: "Legendary drop!" },
};

const BIG_ICON = 128;
const BIG_ROW_H = 160;
const GAP = 8;

export const maxDuration = 60;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function GET(request: Request) {
  const result = await readYutPayload<DropPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { payload } = result;
  const tier = TIER[text(payload.tier, 20)] ?? TIER.rare;
  const src = itemIconDataUrl(text(payload.k, 80));
  const qty = typeof payload.q === "number" && payload.q > 1 ? ` x${formatCount(payload.q)}` : "";
  const facts = [
    text(payload.rate, 20),
    typeof payload.v === "number" && payload.v > 0 ? `${formatCount(payload.v)} gp` : "",
  ].filter(Boolean);
  const height = cardHeight([TITLE_H, SUBTITLE_H, GAP + BIG_ROW_H, GAP + DATE_H]);
  const line = { display: "flex", lineHeight: 1, textShadow: RS.shadow, whiteSpace: "nowrap" } as const;

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={tier.label} />
        <CardSubtitle text={`${text(payload.n, 40)} received a drop`} />

        <div style={{ display: "flex", alignItems: "center", height: BIG_ROW_H, marginTop: GAP }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: BIG_ICON + 24,
              height: BIG_ICON + 24,
              backgroundColor: RS.barTrack,
              border: `4px solid ${tier.color}`,
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} width={BIG_ICON} height={BIG_ICON} alt="" />
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 20 }}>
            <div style={{ ...line, fontFamily: FONT.bold, fontSize: 38, color: tier.color }}>{`${text(payload.item, 34)}${qty}`}</div>
            {payload.src ? (
              <div style={{ ...line, marginTop: 14, fontFamily: FONT.chat, fontSize: 22, color: RS.parchment }}>{`From ${text(payload.src, 40)}`}</div>
            ) : null}
            {facts.length > 0 ? (
              <div style={{ ...line, marginTop: 12, fontFamily: FONT.body, fontSize: 24, color: RS.yellow }}>{facts.join("  -  ")}</div>
            ) : null}
          </div>
        </div>

        <DateStamp text={formatDate(payload.d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
