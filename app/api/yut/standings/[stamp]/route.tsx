import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { FONT, RS, SHEET_WIDTH, tierColor } from "../../_lib/theme";

interface StandingsRow {
  /** Display name */
  n: string;
  /** Hitpoints */
  hp: number;
  /** Tier key */
  tier: string;
  /** Form weeks (streak) */
  fw: number;
  /** Units, one decimal */
  u: number;
}

interface StandingsPayload {
  t: string;
  rows: StandingsRow[];
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const ROW_HEIGHT = 58;
const HEADER_HEIGHT = 120;
const FRAME = 6;

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<StandingsPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { t } = result.payload;
  const rows = Array.isArray(result.payload.rows) ? result.payload.rows : [];
  const height = HEADER_HEIGHT + Math.max(rows.length, 1) * ROW_HEIGHT + 32;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: RS.panel,
          border: `${FRAME}px solid ${RS.border}`,
          padding: "20px 26px",
          fontFamily: FONT.chat,
          color: RS.parchment,
          textShadow: RS.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: HEADER_HEIGHT - 20,
            justifyContent: "flex-end",
            paddingBottom: 10,
            marginBottom: 10,
            borderBottom: `2px solid ${RS.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: FONT.bold,
              fontSize: 40,
              color: RS.yellow,
            }}
          >
            {t}
          </div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 4 }}>
            Yut Hut standings
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, i) => (
            <div
              key={`${row.n}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                height: ROW_HEIGHT,
                padding: "0 14px",
                backgroundColor: i % 2 === 0 ? RS.panelDark : "transparent",
                fontSize: 26,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 56,
                  fontFamily: FONT.bold,
                  color: i < 3 ? RS.orange : RS.parchment,
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: "flex", flex: 1, color: RS.yellow }}>{row.n}</div>
              <div style={{ display: "flex", alignItems: "center", width: 160 }}>
                <div
                  style={{
                    display: "flex",
                    width: 18,
                    height: 18,
                    marginRight: 10,
                    backgroundColor: tierColor(row.tier),
                    border: "2px solid #000",
                  }}
                />
                <div style={{ display: "flex", fontSize: 22 }}>{row.tier}</div>
              </div>
              <div style={{ display: "flex", width: 110, justifyContent: "flex-end" }}>
                {`Combat ${row.hp}`}
              </div>
              <div style={{ display: "flex", width: 190, justifyContent: "flex-end" }}>
                {`Form weeks ${row.fw}`}
              </div>
              <div style={{ display: "flex", width: 140, justifyContent: "flex-end" }}>
                {`Units ${Number(row.u).toFixed(1)}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: SHEET_WIDTH, height, fonts: await yutFonts() }
  );
}
