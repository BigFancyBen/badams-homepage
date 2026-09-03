import { ImageResponse } from "next/og";
import { BallotHeader, Tile } from "../../_lib/ballot-card";
import { cropTo, type Focus } from "../../_lib/crop";
import { readSignedPayload } from "../../_lib/signing";
import {
  BALLOT_WIDTH,
  GAP,
  THEME,
  TILE_IMAGE_HEIGHT,
  ballotHeight,
  ballotRows,
} from "../../_lib/theme";

/**
 * `items` is the round's photographs in slot order — `u` the public image URL,
 * `t` the classifier's name for it, `f` the focal point the crop is centred
 * on. `n` is the round number.
 *
 * `h` is the header the Worker wants on the card: "Rank the pasta" on a themed
 * round, "Rank the places" on a mixed one. Optional, because the Worker and
 * this endpoint deploy separately and neither can wait on the other — a
 * payload without it gets the header the card carried before rounds had
 * themes.
 */
interface BallotPayload {
  n: number;
  h?: string;
  items: { u: string; t?: string; f?: Focus }[];
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/**
 * Five photographs is a good deal more rasterizing than the pair card does, so
 * the ceiling matters more here rather than less. The Worker waits for this
 * render and mirrors it to R2, so a slow one costs nothing downstream.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readSignedPayload<BallotPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, h, items } = result.payload;
  const rows = ballotRows(items);
  // Tile widths come from the layout, so the crops are cut once it is known.
  const sources = await Promise.all(
    rows.map((row) =>
      Promise.all(
        row.map(({ item, width }) =>
          cropTo(item.u, width, TILE_IMAGE_HEIGHT, item.f)
        )
      )
    )
  );

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
        <BallotHeader
          title={h || "Rank them"}
          titleColor={THEME.accent}
          trailing={`#${n}`}
        />

        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: "flex",
              gap: GAP,
              marginTop: rowIndex === 0 ? 0 : GAP,
              backgroundColor: THEME.hairline,
            }}
          >
            {row.map(({ item, width, index }, column) => (
              <Tile
                key={index}
                src={sources[rowIndex][column]}
                width={width}
                label={String(index + 1)}
                labelColor={THEME.accent}
                name={item.t}
              />
            ))}
          </div>
        ))}
      </div>
    ),
    { width: BALLOT_WIDTH, height: ballotHeight(rows.length) }
  );
}
