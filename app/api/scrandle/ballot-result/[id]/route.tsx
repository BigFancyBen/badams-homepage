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
 * The reveal. `items` arrives already in finishing order — `p` is the position
 * label, `d` the rounded rating movement, `f` the focal point the crop is
 * centred on, `b` the number of ballots cast.
 */
interface BallotResultPayload {
  n: number;
  b: number;
  items: { u: string; t?: string; p: string; d: number; f?: Focus }[];
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** Signed, so a positive movement reads as one at a glance. */
function delta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readSignedPayload<BallotResultPayload>(
    new URL(request.url)
  );
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, b, items } = result.payload;
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
          title="The order"
          titleColor={THEME.win}
          trailing={`Round #${n} · ${b} ${b === 1 ? "ballot" : "ballots"}`}
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
              // Every photograph stays at full brightness — dimming four of
              // five to crown one would make most of the card unreadable, and
              // the winner is already the only one edged in green.
              <Tile
                key={index}
                src={sources[rowIndex][column]}
                width={width}
                label={item.p}
                labelColor={index === 0 ? THEME.win : THEME.muted}
                name={item.t}
                trailing={delta(item.d)}
                outlined={index === 0}
              />
            ))}
          </div>
        ))}
      </div>
    ),
    { width: BALLOT_WIDTH, height: ballotHeight(rows.length) }
  );
}
