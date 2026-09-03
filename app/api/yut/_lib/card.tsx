import type { ReactNode } from "react";
import { iconDataUrl, itemIconDataUrl } from "./icons";
import { formatCount, formatXp } from "./format";
import { FONT, RS } from "./theme";

/**
 * Pieces of the check-in loot cards: the OSRS "progress report" look at 2x so
 * it reads in a Discord embed. Every block has a fixed height and the routes
 * add those up, so a card is exactly as tall as what is on it.
 *
 * The panel is dark and nearly opaque rather than transparent: Discord draws
 * attachments on its own grey, and the yellow text needs something darker.
 */
export const CARD_WIDTH = 660;
export const CARD_BORDER = 3;
export const CARD_PAD = 20;
export const CARD_BG = "rgba(43,37,28,0.92)";

export const LOOT_COLS = 7;
export const LOOT_ICON = 64;
export const LOOT_CELL_W = 86;
export const LOOT_CELL_H = 78;

export const XP_COLS = 6;
export const XP_ICON = 48;
export const XP_CELL_W = 100;
export const XP_CELL_H = 86;

export const TITLE_H = 44;
export const SUBTITLE_H = 28;
export const LABEL_H = 34;
export const LINE_H = 34;
export const DATE_H = 26;

export interface LootItem {
  k: string;
  c: number;
}

export interface XpItem {
  k: string;
  x: number;
}

export function gridRows(count: number, cols: number): number {
  return count > 0 ? Math.ceil(count / cols) : 0;
}

/** Height of the whole card given the heights of the blocks stacked inside it. */
export function cardHeight(blocks: number[]): number {
  return CARD_BORDER * 2 + CARD_PAD * 2 + blocks.reduce((sum, h) => sum + h, 0);
}

/** Anything the Worker sent that is not shaped like a loot entry is dropped. */
export function cleanLoot(value: unknown): LootItem[] {
  if (!Array.isArray(value)) return [];
  const out: LootItem[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object" && typeof (entry as LootItem).k === "string") {
      const c = (entry as LootItem).c;
      out.push({ k: (entry as LootItem).k, c: typeof c === "number" && Number.isFinite(c) ? c : 1 });
    }
  }
  return out;
}

export function cleanXp(value: unknown): XpItem[] {
  if (!Array.isArray(value)) return [];
  const out: XpItem[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object" && typeof (entry as XpItem).k === "string") {
      const x = (entry as XpItem).x;
      out.push({ k: (entry as XpItem).k, x: typeof x === "number" && Number.isFinite(x) ? x : 0 });
    }
  }
  return out;
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: CARD_BG,
        border: `${CARD_BORDER}px solid ${RS.border}`,
        padding: CARD_PAD,
        fontFamily: FONT.body,
        color: RS.parchment,
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: TITLE_H,
        fontFamily: FONT.bold,
        fontSize: 36,
        lineHeight: 1,
        color: RS.yellow,
        textShadow: RS.shadow,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

export function CardSubtitle({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: SUBTITLE_H,
        fontFamily: FONT.chat,
        fontSize: 20,
        lineHeight: 1,
        color: RS.orange,
        textShadow: RS.shadow,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

/** "Loot:" / "XP:" in the report's yellow. */
export function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        height: LABEL_H,
        paddingBottom: 4,
        fontFamily: FONT.bold,
        fontSize: 22,
        lineHeight: 1,
        color: RS.yellow,
        textShadow: RS.shadow,
      }}
    >
      {text}
    </div>
  );
}

/** A grey square with the key on it, so an item this side has no art for still shows up. */
function Placeholder({ text, size }: { text: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        padding: 4,
        backgroundColor: "#4a4a4a",
        border: "2px solid #6b6b6b",
        fontFamily: FONT.chat,
        fontSize: 12,
        lineHeight: 1.1,
        color: "#dddddd",
        textAlign: "center",
        wordBreak: "break-all",
        overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}

/** One inventory slot: the sprite with its stack number bottom-right. */
export function LootCell({
  item,
  icon = LOOT_ICON,
  w = LOOT_CELL_W,
  h = LOOT_CELL_H,
}: {
  item: LootItem;
  icon?: number;
  w?: number;
  h?: number;
}) {
  const src = itemIconDataUrl(item.k);
  const count = Math.floor(item.c);
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        width: w,
        height: h,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={icon} height={icon} alt="" />
      ) : (
        <Placeholder text={item.k} size={icon} />
      )}
      {count > 1 ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: Math.floor((w - icon) / 2),
            bottom: Math.floor((h - icon) / 2) - 2,
            fontFamily: FONT.body,
            fontSize: 20,
            lineHeight: 1,
            color: RS.yellow,
            textShadow: RS.shadow,
          }}
        >
          {formatCount(count)}
        </div>
      ) : null}
    </div>
  );
}

/** The last slot when the drops did not all fit: "+12". */
function MoreCell({ count }: { count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LOOT_CELL_W,
        height: LOOT_CELL_H,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: LOOT_ICON,
          height: LOOT_ICON,
          backgroundColor: "rgba(74,74,74,0.6)",
          border: "2px solid #6b6b6b",
          fontFamily: FONT.bold,
          fontSize: 22,
          lineHeight: 1,
          color: RS.yellow,
          textShadow: RS.shadow,
        }}
      >
        {`+${count}`}
      </div>
    </div>
  );
}

/** Seven slots to a row, like the report's loot block; `more` adds a "+N" slot at the end. */
export function LootGrid({ items, more = 0 }: { items: LootItem[]; more?: number }) {
  const cells = items.length + (more > 0 ? 1 : 0);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: LOOT_CELL_W * LOOT_COLS,
        height: gridRows(cells, LOOT_COLS) * LOOT_CELL_H,
      }}
    >
      {items.map((item, i) => (
        <LootCell key={`${item.k}-${i}`} item={item} />
      ))}
      {more > 0 ? <MoreCell count={more} /> : null}
    </div>
  );
}

/** Skill icon over the XP it gained, six to a row. */
export function XpGrid({ items }: { items: XpItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: XP_CELL_W * XP_COLS,
        height: gridRows(items.length, XP_COLS) * XP_CELL_H,
      }}
    >
      {items.map((item, i) => {
        const src = iconDataUrl(item.k);
        return (
          <div
            key={`${item.k}-${i}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: XP_CELL_W,
              height: XP_CELL_H,
              paddingTop: 4,
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} width={XP_ICON} height={XP_ICON} alt="" />
            ) : (
              <Placeholder text={item.k} size={XP_ICON} />
            )}
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontFamily: FONT.body,
                fontSize: 20,
                lineHeight: 1,
                color: RS.yellow,
                textShadow: RS.shadow,
              }}
            >
              {formatXp(item.x)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A single line of text with an optional icon in front, e.g. a level-up or the Slayer task. */
export function CardLine({
  text,
  color,
  icon,
  iconSize = 26,
}: {
  text: string;
  color: string;
  icon?: string | null;
  iconSize?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: LINE_H }}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} width={iconSize} height={iconSize} alt="" style={{ marginRight: 10 }} />
      ) : null}
      <div
        style={{
          display: "flex",
          fontFamily: FONT.chat,
          fontSize: 22,
          lineHeight: 1,
          color,
          textShadow: RS.shadow,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** The date, small, bottom-right. `marginTop: auto` pins it to the floor of the card. */
export function DateStamp({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        height: DATE_H,
        marginTop: "auto",
        fontFamily: FONT.body,
        fontSize: 16,
        lineHeight: 1,
        color: RS.yellow,
        textShadow: RS.shadow,
      }}
    >
      {text}
    </div>
  );
}
