import { ImageResponse } from "next/og";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_HEIGHT, CARD_WIDTH, THEME } from "../../_lib/theme";

/** Vote counts `va`/`vb` and chef names `ca`/`cb` are revealed here for the first time. */
interface ResultPayload {
  a: string;
  b: string;
  va: number;
  vb: number;
  ca: string;
  cb: string;
  n: number;
  na?: string;
  nb?: string;
}

function ResultPlate({
  src,
  label,
  chef,
  votes,
  share,
  won,
  name,
}: {
  src: string;
  label: string;
  chef: string;
  votes: number;
  share: number;
  won: boolean;
  name?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: won ? 1 : 0.4,
        }}
      />

      {won ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `4px solid ${THEME.win}`,
          }}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 20,
          left: 20,
          width: 52,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10,10,10,0.85)",
          border: `2px solid ${won ? THEME.win : THEME.muted}`,
          color: won ? THEME.win : THEME.muted,
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "18px 22px",
          backgroundColor: "rgba(10,10,10,0.88)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              color: won ? THEME.win : THEME.text,
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            {share}%
          </div>
          <div style={{ display: "flex", color: THEME.muted, fontSize: 24 }}>
            {votes} {votes === 1 ? "vote" : "votes"}
          </div>
        </div>
        {name ? (
          <div
            style={{
              display: "flex",
              color: THEME.text,
              fontSize: 26,
              marginTop: 8,
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
        ) : null}
        <div style={{ display: "flex", color: THEME.accent, fontSize: 24, marginTop: 6 }}>
          {chef}
        </div>
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const result = await readSignedPayload<ResultPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { a, b, va, vb, ca, cb, n, na, nb } = result.payload;
  const total = va + vb;
  const shareA = total === 0 ? 0 : Math.round((va / total) * 100);
  const shareB = total === 0 ? 0 : 100 - shareA;

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
            Result
          </div>
          <div style={{ display: "flex", color: THEME.muted, fontSize: 24 }}>
            Matchup #{n} &middot; {total} {total === 1 ? "vote" : "votes"}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 4, backgroundColor: THEME.hairline }}>
          <ResultPlate
            src={a}
            label="1"
            chef={ca}
            votes={va}
            share={shareA}
            won={va >= vb}
            name={na}
          />
          <ResultPlate
            src={b}
            label="2"
            chef={cb}
            votes={vb}
            share={shareB}
            won={vb >= va}
            name={nb}
          />
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT }
  );
}
