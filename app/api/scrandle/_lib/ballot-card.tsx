import {
  HEADER_HEIGHT,
  THEME,
  TILE_IMAGE_HEIGHT,
  TILE_STRIP_HEIGHT,
} from "./theme";

/**
 * The pieces both ranking cards are built from. They live here rather than in
 * either route because a route module may only export the handful of things
 * Next recognises — a shared component exported from one would fail the build.
 */

/**
 * The label sits in a strip above its own photograph rather than on top of it,
 * the same way the pair card does it — nothing of the picture is covered, and
 * the mapping from button to image stays obvious at a glance.
 */
export function Tile({
  src,
  width,
  label,
  labelColor,
  name,
  trailing,
  outlined,
}: {
  src: string;
  width: number;
  label: string;
  labelColor: string;
  name?: string;
  trailing?: string;
  outlined?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: `${width}px`,
        backgroundColor: THEME.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          height: TILE_STRIP_HEIGHT,
          alignItems: "center",
          gap: 14,
          padding: "0 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: labelColor,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {label}
        </div>
        {/*
          Clipped to one line rather than wrapped. The strip is a fixed height
          so a second line spills over the photograph below it, and — worse —
          only in the tiles whose names happen to be long, which knocks the row
          out of alignment with itself. A name too long to fit is one the
          classifier over-wrote; the photograph is the thing being judged.
        */}
        <div
          style={{
            display: "flex",
            flex: 1,
            minWidth: 0,
            color: THEME.text,
            fontSize: 20,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name ?? ""}
        </div>
        {trailing ? (
          <div style={{ display: "flex", color: THEME.muted, fontSize: 20 }}>
            {trailing}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          position: "relative",
          width: `${width}px`,
          height: `${TILE_IMAGE_HEIGHT}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={width}
          height={TILE_IMAGE_HEIGHT}
          style={{
            width: `${width}px`,
            height: `${TILE_IMAGE_HEIGHT}px`,
            objectFit: "cover",
          }}
        />
        {outlined ? (
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
    </div>
  );
}

/** The band across the top: what this card is, and which round it belongs to. */
export function BallotHeader({
  title,
  titleColor,
  trailing,
}: {
  title: string;
  titleColor: string;
  trailing: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        height: HEADER_HEIGHT,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: `1px solid ${THEME.hairline}`,
      }}
    >
      <div
        style={{
          display: "flex",
          color: titleColor,
          fontSize: 34,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", color: THEME.muted, fontSize: 24 }}>
        {trailing}
      </div>
    </div>
  );
}
