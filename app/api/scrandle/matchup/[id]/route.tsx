import { ImageResponse } from "next/og";
import { readSignedPayload } from "../../_lib/signing";
import { CARD_HEIGHT, CARD_WIDTH, THEME } from "../../_lib/theme";

/**
 * `{ a, b }` are public image URLs, `n` is the matchup number, and `na`/`nb`
 * are the classifier's names for each dish. Names are optional so URLs signed
 * before they existed still render.
 */
interface MatchupPayload {
  a: string;
  b: string;
  n: number;
  na?: string;
  nb?: string;
}

const HEADER_HEIGHT = 78;
const GAP = 4;
const PLATE_WIDTH = (CARD_WIDTH - GAP) / 2;
const PLATE_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT;
/** Tall enough for two wrapped lines, so both strips match. */
const NAME_STRIP_HEIGHT = 104;

/**
 * The numbers live in the header rather than on top of the food. They sit
 * directly above their own image, so the mapping stays obvious without
 * covering a corner of the photograph.
 */
function HeaderCell({
  label,
  trailing,
}: {
  label: string;
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
        position: "relative",
        width: `${PLATE_WIDTH}px`,
        height: "100%",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={PLATE_WIDTH}
        height={PLATE_HEIGHT}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {name ? (
        // Fixed height so a name that wraps to two lines still lines up with a
        // one-line name beside it.
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: NAME_STRIP_HEIGHT,
            alignItems: "center",
            padding: "0 24px",
            backgroundColor: "rgba(10,10,10,0.82)",
            color: THEME.text,
            fontSize: 29,
            lineHeight: 1.25,
          }}
        >
          {name}
        </div>
      ) : null}
    </div>
  );
}

export async function GET(request: Request) {
  const result = await readSignedPayload<MatchupPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { a, b, n, na, nb } = result.payload;

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
          <Plate src={a} name={na} />
          <Plate src={b} name={nb} />
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT }
  );
}
