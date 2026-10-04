import { ImageResponse } from "next/og";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_WIDTH, THEME } from "../../_lib/theme";

interface StandingsRow {
  /** Chef name */
  n: string;
  /** Elo, already rounded by the Worker */
  e: number;
  /** Rating movement since the previous posting */
  d: number;
  /**
   * Places gained since the previous posting; negative is places lost.
   * Optional so a URL minted before the Worker sent it still renders.
   */
  m?: number;
  /** Set when the chef was not on the previous posting at all */
  nw?: 1;
}

interface StandingsPayload {
  t: string;
  rows: StandingsRow[];
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const ROW_HEIGHT = 64;
const HEADER_HEIGHT = 120;
/** Wide enough for a two-digit climb beside its arrow. */
const MOVE_WIDTH = 124;
const CLIMB_TINT = "rgba(163,190,140,0.13)";

function delta(value: number): { text: string; color: string } {
  if (value > 0) return { text: `+${value}`, color: THEME.win };
  if (value < 0) return { text: `${value}`, color: THEME.warm };
  return { text: "—", color: THEME.muted };
}

/**
 * Drawn rather than typed: the card's font has no ▲, and a glyph satori cannot
 * find is a box where the one thing the row is trying to say should be.
 */
function Arrow({ up, color }: { up: boolean; color: string }) {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18">
      <path d={up ? "M10 0 L20 18 L0 18 Z" : "M0 0 L20 0 L10 18 Z"} fill={color} />
    </svg>
  );
}

/**
 * The change of rank, which is the headline of a row. A climb is a filled
 * block — the loudest thing on the card — a fall is the same shape hollow, and
 * a chef who stayed put gets nothing at all, so the eye lands on who moved.
 */
function Movement({ row }: { row: StandingsRow }) {
  const moved = row.m ?? 0;

  if (row.nw) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 40,
          padding: "0 12px",
          border: `2px solid ${THEME.accent}`,
          color: THEME.accent,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        NEW
      </div>
    );
  }

  if (moved === 0) return null;

  const up = moved > 0;
  const color = up ? THEME.bg : THEME.warm;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 40,
        padding: "0 12px",
        backgroundColor: up ? THEME.win : "transparent",
        border: `2px solid ${up ? THEME.win : THEME.warm}`,
        color,
        fontSize: 28,
        fontWeight: 700,
      }}
    >
      <Arrow up={up} color={color} />
      {Math.abs(moved)}
    </div>
  );
}

/**
 * Rasterizing two full-size photographs is not quick — a pair of large
 * landscapes takes seconds — and the default cap is short enough that a cold
 * one can run into it. The Worker waits for this render and mirrors the result
 * to R2, so the only thing a slow one costs now is the Worker's patience.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readSignedPayload<StandingsPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { t, rows } = result.payload;
  const height = HEADER_HEIGHT + Math.max(rows.length, 1) * ROW_HEIGHT + 32;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: THEME.bg,
          padding: 32,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
          <div style={{ display: "flex", color: THEME.text, fontSize: 40, fontWeight: 700 }}>
            {t}
          </div>
          <div style={{ display: "flex", color: THEME.muted, fontSize: 22, marginTop: 4 }}>
            Places gained and lost since last week, then rating
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, i) => {
            const rating = delta(row.d);
            const climbed = (row.m ?? 0) > 0;
            return (
              <div
                key={`${i}-${row.n}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: ROW_HEIGHT,
                  padding: "0 16px 0 10px",
                  // A climb gets the row, not just the badge: the stripe down
                  // the left edge is what is still legible at thumbnail size.
                  borderLeft: `6px solid ${climbed ? THEME.win : "transparent"}`,
                  backgroundColor: climbed
                    ? CLIMB_TINT
                    : i % 2 === 0
                      ? THEME.panel
                      : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 56,
                    color: i < 3 ? THEME.accent : THEME.muted,
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", width: MOVE_WIDTH }}>
                  <Movement row={row} />
                </div>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    color: THEME.text,
                    fontSize: 30,
                    fontWeight: climbed ? 700 : 400,
                  }}
                >
                  {row.n}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 120,
                    justifyContent: "flex-end",
                    color: THEME.muted,
                    fontSize: 26,
                  }}
                >
                  {row.e}
                </div>
                {/* The rating change is still here, a size down and to the
                    far right: it is the detail under the rank, not the news. */}
                <div
                  style={{
                    display: "flex",
                    width: 90,
                    justifyContent: "flex-end",
                    color: rating.color,
                    fontSize: 22,
                  }}
                >
                  {rating.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height }
  );
}
