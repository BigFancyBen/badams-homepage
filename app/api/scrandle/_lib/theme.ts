/** Shared palette for the rendered Discord cards. Matches the site. */
export const THEME = {
  bg: "#0a0a0a",
  panel: "#111111",
  hairline: "#2a2a2a",
  text: "#ededed",
  muted: "#8b8b8b",
  accent: "#81a1c1",
  warm: "#d08770",
  win: "#a3be8c",
} as const;

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// ── Ranking cards ──────────────────────────────────────────────────

export const GAP = 4;
export const HEADER_HEIGHT = 76;
/** The number-and-name band above each photograph. */
export const TILE_STRIP_HEIGHT = 56;
export const TILE_IMAGE_HEIGHT = 302;
export const BALLOT_WIDTH = CARD_WIDTH;

/**
 * Lays a round's photographs out as a grid: three over two for a full five,
 * one row for anything up to three.
 *
 * Splitting rather than a single row of five is what keeps a place recognisable
 * on a phone — a fifth of the card is a sliver, and the whole point of putting
 * five up at once is that people can actually compare them. The last tile in a
 * row absorbs the rounding so the grid always reaches the far edge.
 */
export function ballotRows<T>(
  items: T[]
): { item: T; width: number; index: number }[][] {
  const perRow =
    items.length <= 3
      ? [items.length]
      : [Math.ceil(items.length / 2), Math.floor(items.length / 2)];

  const rows: { item: T; width: number; index: number }[][] = [];
  let index = 0;

  for (const count of perRow) {
    if (count === 0) continue;
    const base = Math.floor((BALLOT_WIDTH - (count - 1) * GAP) / count);
    const used = base * count + (count - 1) * GAP;

    const row: { item: T; width: number; index: number }[] = [];
    for (let i = 0; i < count; i++) {
      row.push({
        item: items[index],
        width: i === count - 1 ? base + (BALLOT_WIDTH - used) : base,
        index,
      });
      index++;
    }
    rows.push(row);
  }

  return rows;
}

/** Card height for a grid of `rows` rows. One row makes a much shorter card. */
export function ballotHeight(rows: number): number {
  return (
    HEADER_HEIGHT +
    rows * (TILE_STRIP_HEIGHT + TILE_IMAGE_HEIGHT) +
    Math.max(0, rows - 1) * GAP
  );
}
