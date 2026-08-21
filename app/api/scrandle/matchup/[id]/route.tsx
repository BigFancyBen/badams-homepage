import { ImageResponse } from "next/og";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_HEIGHT, CARD_WIDTH, THEME } from "../../_lib/theme";

/** `{ a, b }` are public image URLs, `n` is the matchup number shown in the header. */
interface MatchupPayload {
  a: string;
  b: string;
  n: number;
}

function Plate({ src, label }: { src: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: `${(CARD_WIDTH - 4) / 2}px`,
        height: "100%",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={(CARD_WIDTH - 4) / 2}
        height={CARD_HEIGHT - 96}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 20,
          left: 20,
          width: 56,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10,10,10,0.85)",
          border: `2px solid ${THEME.accent}`,
          color: THEME.accent,
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const result = await readSignedPayload<MatchupPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { a, b, n } = result.payload;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: THEME.bg,
        }}
      >
        <div
          style={{
            display: "flex",
            height: 96,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            borderBottom: `1px solid ${THEME.hairline}`,
          }}
        >
          <div style={{ display: "flex", color: THEME.text, fontSize: 34, fontWeight: 700 }}>
            Which would you rather eat?
          </div>
          <div style={{ display: "flex", color: THEME.muted, fontSize: 24 }}>
            Matchup #{n}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 4, backgroundColor: THEME.hairline }}>
          <Plate src={a} label="1" />
          <Plate src={b} label="2" />
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT }
  );
}
