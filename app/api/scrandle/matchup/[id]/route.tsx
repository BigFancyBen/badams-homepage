import { ImageResponse } from "next/og";
import { cropTo, type Focus } from "../../_lib/crop";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_HEIGHT, CARD_WIDTH, THEME } from "../../_lib/theme";

/**
 * `{ a, b }` are public image URLs, `n` is the matchup number, `na`/`nb`
 * are the classifier's names for each dish and `fa`/`fb` its focal points,
 * which the crop is centred on. Names and focal points are optional so URLs
 * signed before they existed still render.
 */
interface MatchupPayload {
  a: string;
  b: string;
  n: number;
  na?: string;
  nb?: string;
  fa?: Focus;
  fb?: Focus;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const HEADER_HEIGHT = 76;
const GAP = 4;
/** Tall enough for two wrapped lines, so both captions match. */
const NAME_STRIP_HEIGHT = 96;
const PLATE_WIDTH = (CARD_WIDTH - GAP) / 2;
const IMAGE_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT - NAME_STRIP_HEIGHT;

/**
 * The numbers live in the header rather than on top of the food. They sit
 * directly above their own image, so the mapping stays obvious without
 * covering a corner of the photograph.
 */
function HeaderCell({ label, trailing }: { label: string; trailing?: string }) {
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
      <div
        style={{
          display: "flex",
          color: THEME.accent,
          fontSize: 38,
          fontWeight: 700,
        }}
      >
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

function Plate({ src, name }: { src: string; name?: string }) {
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
        }}
      />

      {/* Below the photograph, not over it — nothing of the food is hidden. */}
      <div
        style={{
          display: "flex",
          height: NAME_STRIP_HEIGHT,
          alignItems: "center",
          padding: "0 24px",
          color: THEME.text,
          fontSize: 28,
          lineHeight: 1.25,
        }}
      >
        {name ?? ""}
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
  const result = await readSignedPayload<MatchupPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { a, b, n, na, nb, fa, fb } = result.payload;
  const [srcA, srcB] = await Promise.all([
    cropTo(a, PLATE_WIDTH, IMAGE_HEIGHT, fa),
    cropTo(b, PLATE_WIDTH, IMAGE_HEIGHT, fb),
  ]);

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
          <HeaderCell label="1" />
          <HeaderCell label="2" trailing={`#${n}`} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: GAP,
            backgroundColor: THEME.hairline,
          }}
        >
          <Plate src={srcA} name={na} />
          <Plate src={srcB} name={nb} />
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT }
  );
}
