import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { itemIconDataUrl } from "../../_lib/icons";
import { FONT, RS } from "../../_lib/theme";
import { formatDate } from "../../_lib/format";
import {
  CARD_WIDTH,
  Card,
  CardLine,
  CardSubtitle,
  CardTitle,
  DATE_H,
  DateStamp,
  LINE_H,
  SUBTITLE_H,
  TITLE_H,
  cardHeight,
} from "../../_lib/card";

/** What a player is wearing: one cell a slot, the wardrobe count, and what they are chasing. */
interface GearPayload {
  /** Player name */
  n: string;
  /** Slot label, item key, item name */
  slots: { s: string; k: string; n: string }[];
  /** Pieces owned, and pieces there are */
  own: number;
  of: number;
  /** The item being chased */
  chase?: string;
  /** Title */
  ti?: string;
  /** Combat level */
  cb: number;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const COLS = 4;
const CELL_W = 154;
const CELL_H = 132;
const ICON = 72;
const GAP = 8;

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<GearPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, d } = result.payload;
  const slots = (Array.isArray(result.payload.slots) ? result.payload.slots : [])
    .filter((slot) => !!slot && typeof slot.s === "string" && typeof slot.k === "string" && typeof slot.n === "string")
    .slice(0, 12);
  const own = typeof result.payload.own === "number" ? result.payload.own : 0;
  const of = typeof result.payload.of === "number" ? result.payload.of : 0;
  const chase = typeof result.payload.chase === "string" ? result.payload.chase : "";
  const title = typeof result.payload.ti === "string" ? result.payload.ti : "";
  const combat = typeof result.payload.cb === "number" ? result.payload.cb : 0;

  const rows = Math.ceil(slots.length / COLS);
  const height = cardHeight([TITLE_H, SUBTITLE_H, GAP + rows * CELL_H, LINE_H + (chase ? LINE_H : 0), GAP + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={`${n ?? ""}${title ? ` ${title}` : ""}`} />
        <CardSubtitle text={`Combat ${combat} - wardrobe ${own}/${of}`} />

        <div style={{ display: "flex", flexWrap: "wrap", width: CELL_W * COLS, height: rows * CELL_H, marginTop: GAP }}>
          {slots.map((slot, i) => {
            const src = itemIconDataUrl(slot.k);
            return (
              <div
                key={`${slot.k}-${i}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CELL_W, height: CELL_H }}
              >
                <div
                  style={{
                    display: "flex",
                    fontFamily: FONT.chat,
                    fontSize: 16,
                    lineHeight: 1,
                    height: 18,
                    color: RS.orange,
                    textShadow: RS.shadow,
                  }}
                >
                  {slot.s}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: ICON + 12,
                    height: ICON + 12,
                    backgroundColor: RS.barTrack,
                    border: `2px solid ${RS.border}`,
                  }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} width={ICON} height={ICON} alt="" />
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    width: CELL_W - 6,
                    marginTop: 4,
                    fontFamily: FONT.chat,
                    fontSize: 15,
                    lineHeight: 1,
                    color: RS.parchment,
                    textShadow: RS.shadow,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {slot.n.length > 20 ? `${slot.n.slice(0, 19)}.` : slot.n}
                </div>
              </div>
            );
          })}
        </div>

        <CardLine icon={itemIconDataUrl("casket")} color={RS.yellow} text={`${own} of ${of} pieces collected`} />
        {chase ? <CardLine icon={itemIconDataUrl("gem")} color={RS.parchment} text={`Chasing: ${chase}`} /> : null}

        <DateStamp text={formatDate(d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
