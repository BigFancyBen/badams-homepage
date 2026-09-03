import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { iconDataUrl } from "../../_lib/icons";
import { FONT, RS, skillLabel } from "../../_lib/theme";

interface LevelUpPayload {
  /** Display name */
  n: string;
  /** Skill key */
  k: string;
  /** New level */
  l: number;
  /** Date line, already formatted by the Worker */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** The parchment's own size. */
const WIDTH = 1040;
const HEIGHT = 283;

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readYutPayload<LevelUpPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, k, l, d } = result.payload;
  const background = iconDataUrl("levelUpBackground");
  const icon = iconDataUrl(k);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: "#d8c39a",
          fontFamily: FONT.npc,
        }}
      >
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={background}
            width={WIDTH}
            height={HEIGHT}
            alt=""
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        ) : null}

        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={icon}
            width={64}
            height={64}
            alt=""
            style={{ position: "absolute", top: 100, left: 80 }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "absolute",
            top: 84,
            left: 0,
            width: WIDTH,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, color: RS.navy }}>
            {`Congratulations, ${n}!`}
          </div>
          <div style={{ display: "flex", fontSize: 36, color: "#000000", marginTop: 22 }}>
            {`Your ${skillLabel(k)} level is now ${l}.`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 20,
            bottom: 16,
            fontFamily: FONT.body,
            fontSize: 20,
            color: RS.yellow,
            textShadow: RS.shadow,
          }}
        >
          {d}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts: await yutFonts() }
  );
}
