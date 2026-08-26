import { ImageResponse } from "next/og";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_WIDTH, THEME } from "../../_lib/theme";

interface StandingsRow {
  /** Chef name */
  n: string;
  /** Elo, already rounded by the Worker */
  e: number;
  /** Movement since the previous posting */
  d: number;
}

interface StandingsPayload {
  t: string;
  rows: StandingsRow[];
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const ROW_HEIGHT = 58;
const HEADER_HEIGHT = 120;

function delta(value: number): { text: string; color: string } {
  if (value > 0) return { text: `+${value}`, color: THEME.win };
  if (value < 0) return { text: `${value}`, color: THEME.warm };
  return { text: "—", color: THEME.muted };
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
            Chef standings
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, i) => {
            const movement = delta(row.d);
            return (
              <div
                key={row.n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: ROW_HEIGHT,
                  padding: "0 16px",
                  backgroundColor: i % 2 === 0 ? THEME.panel : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 64,
                    color: i < 3 ? THEME.accent : THEME.muted,
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", flex: 1, color: THEME.text, fontSize: 28 }}>
                  {row.n}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 130,
                    justifyContent: "flex-end",
                    color: THEME.text,
                    fontSize: 28,
                  }}
                >
                  {row.e}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 110,
                    justifyContent: "flex-end",
                    color: movement.color,
                    fontSize: 24,
                  }}
                >
                  {movement.text}
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
