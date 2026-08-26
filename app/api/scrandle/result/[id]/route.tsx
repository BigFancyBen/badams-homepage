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
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const HEADER_HEIGHT = 76;
const GAP = 4;
/** Share, votes, dish name and chef, stacked under the photograph. */
const INFO_STRIP_HEIGHT = 168;
const PLATE_WIDTH = (CARD_WIDTH - GAP) / 2;
const IMAGE_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT - INFO_STRIP_HEIGHT;

/**
 * The numbers live in the header rather than on top of the food, matching the
 * matchup card. Each cell sits directly above its own image.
 */
function HeaderCell({
  label,
  color,
  trailing,
}: {
  label: string;
  color: string;
  trailing?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: `${PLATE_WIDTH}px`,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <div style={{ display: "flex", color, fontSize: 38, fontWeight: 700 }}>
        {label}
      </div>
      {trailing ? (
        <div style={{ display: "flex", color: THEME.muted, fontSize: 24 }}>
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

function ResultPlate({
  src,
  chef,
  votes,
  share,
  won,
  name,
}: {
  src: string;
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
        width: `${PLATE_WIDTH}px`,
        height: "100%",
        backgroundColor: THEME.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: `${PLATE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={PLATE_WIDTH}
          height={IMAGE_HEIGHT}
          style={{
            width: `${PLATE_WIDTH}px`,
            height: `${IMAGE_HEIGHT}px`,
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
      </div>

      {/* Below the photograph, not over it — nothing of the food is hidden. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: INFO_STRIP_HEIGHT,
          padding: "18px 24px",
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
        <div
          style={{
            display: "flex",
            color: THEME.accent,
            fontSize: 24,
            marginTop: 6,
          }}
        >
          {chef}
        </div>
      </div>
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
  const result = await readSignedPayload<ResultPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { a, b, va, vb, ca, cb, n, na, nb } = result.payload;
  const total = va + vb;
  const shareA = total === 0 ? 0 : Math.round((va / total) * 100);
  const shareB = total === 0 ? 0 : 100 - shareA;
  const wonA = va >= vb;
  const wonB = vb >= va;

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
            height: HEADER_HEIGHT,
            gap: GAP,
            borderBottom: `1px solid ${THEME.hairline}`,
          }}
        >
          <HeaderCell label="1" color={wonA ? THEME.win : THEME.muted} />
          <HeaderCell
            label="2"
            color={wonB ? THEME.win : THEME.muted}
            trailing={`Result #${n} · ${total} ${total === 1 ? "vote" : "votes"}`}
          />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: GAP,
            backgroundColor: THEME.hairline,
          }}
        >
          <ResultPlate
            src={a}
            chef={ca}
            votes={va}
            share={shareA}
            won={wonA}
            name={na}
          />
          <ResultPlate
            src={b}
            chef={cb}
            votes={vb}
            share={shareB}
            won={wonB}
            name={nb}
          />
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT }
  );
}
