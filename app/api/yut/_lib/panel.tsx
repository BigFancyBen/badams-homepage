import { iconDataUrl, itemIconDataUrl } from "./icons";
import { FONT, RS } from "./theme";
import { LABEL_H, LOOT_CELL_H, LOOT_COLS, LootGrid, SectionLabel, cleanLoot, gridRows, type LootItem } from "./card";

/**
 * The view cards: the bank, the boss, the farm, the kingdom, the Slayer task.
 * Each is a header with one large sprite and a stack of sections: a bar, a
 * grid of item slots, rows with an icon and a value, a strip of figures.
 * Every section has a fixed height, so a card is exactly as tall as it needs.
 */
export type Tone = "good" | "warn" | "bad" | "dim";

export type PanelSection =
  | { s: "bar"; l: string; h: number; g: number; r?: string; c?: Tone }
  | { s: "grid"; l?: string; items: LootItem[]; m?: number }
  | { s: "rows"; l?: string; rows: { k?: string; l: string; r?: string; c?: Tone }[] }
  | { s: "stats"; items: { l: string; v: string }[] };

export interface PanelPayload {
  /** Headline */
  t: string;
  sub?: string;
  /** The sprite drawn large beside the headline: an item key or a skill icon. */
  big?: string;
  sections: PanelSection[];
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

const TONE: Record<Tone, string> = { good: RS.barFill, warn: RS.orange, bad: "#c0392b", dim: "#8f8674" };

export const HEADER_H = 84;
const BAR_H = 58;
const ROW_H = 44;
const STATS_H = 70;
const GAP = 8;
const MAX_ROWS = 8;
const MAX_SECTIONS = 6;

function sprite(key: string | undefined): string | null {
  return key ? (itemIconDataUrl(key) ?? iconDataUrl(key)) : null;
}

function text(value: unknown, max = 80): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function tone(value: unknown): Tone | undefined {
  return value === "good" || value === "warn" || value === "bad" || value === "dim" ? value : undefined;
}

/** Whatever the Worker sent, cut down to sections this side knows how to draw. */
export function cleanSections(value: unknown): PanelSection[] {
  if (!Array.isArray(value)) return [];
  const out: PanelSection[] = [];
  for (const raw of value.slice(0, MAX_SECTIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const section = raw as Record<string, unknown>;
    if (section.s === "bar") {
      const g = Number(section.g);
      const h = Number(section.h);
      if (!Number.isFinite(g) || !Number.isFinite(h) || g <= 0) continue;
      out.push({ s: "bar", l: text(section.l), h: Math.max(0, h), g, r: text(section.r, 40) || undefined, c: tone(section.c) });
    } else if (section.s === "grid") {
      const items = cleanLoot(section.items).slice(0, LOOT_COLS * 4);
      const m = Number(section.m);
      if (items.length > 0) out.push({ s: "grid", l: text(section.l, 40) || undefined, items, m: Number.isFinite(m) && m > 0 ? Math.floor(m) : 0 });
    } else if (section.s === "rows" && Array.isArray(section.rows)) {
      const rows = (section.rows as Record<string, unknown>[])
        .filter((row) => row && typeof row === "object" && typeof row.l === "string")
        .slice(0, MAX_ROWS)
        .map((row) => ({ k: text(row.k, 60) || undefined, l: text(row.l, 60), r: text(row.r, 30) || undefined, c: tone(row.c) }));
      if (rows.length > 0) out.push({ s: "rows", l: text(section.l, 40) || undefined, rows });
    } else if (section.s === "stats" && Array.isArray(section.items)) {
      const items = (section.items as Record<string, unknown>[])
        .filter((item) => item && typeof item === "object")
        .slice(0, 4)
        .map((item) => ({ l: text(item.l, 24), v: text(item.v, 16) }));
      if (items.length > 0) out.push({ s: "stats", items });
    }
  }
  return out;
}

export function sectionHeight(section: PanelSection): number {
  switch (section.s) {
    case "bar":
      return BAR_H;
    case "grid":
      return (section.l ? LABEL_H : GAP) + gridRows(section.items.length + (section.m ? 1 : 0), LOOT_COLS) * LOOT_CELL_H;
    case "rows":
      return (section.l ? LABEL_H : GAP) + section.rows.length * ROW_H;
    case "stats":
      return GAP + STATS_H;
  }
}

/** The headline with its sprite in a framed slot, the way an interface tab leads with its icon. */
export function PanelHeader({ title, sub, big, accent }: { title: string; sub: string; big?: string; accent: string }) {
  const src = sprite(big);
  return (
    <div style={{ display: "flex", alignItems: "center", height: HEADER_H }}>
      {src ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            marginRight: 16,
            backgroundColor: RS.barTrack,
            border: `3px solid ${accent}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={60} height={60} alt="" />
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: FONT.bold, fontSize: 34, lineHeight: 1, color: RS.yellow, textShadow: RS.shadow, whiteSpace: "nowrap" }}>
          {title}
        </div>
        {sub ? (
          <div style={{ display: "flex", marginTop: 10, fontFamily: FONT.chat, fontSize: 20, lineHeight: 1, color: accent, textShadow: RS.shadow, whiteSpace: "nowrap" }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bar({ section, accent }: { section: Extract<PanelSection, { s: "bar" }>; accent: string }) {
  const share = Math.max(0, Math.min(1, section.h / section.g));
  const fill = section.c ? TONE[section.c] : accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: BAR_H }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.body, fontSize: 20, lineHeight: 1, textShadow: RS.shadow }}>
        <div style={{ display: "flex", color: RS.parchment }}>{section.l}</div>
        <div style={{ display: "flex", color: RS.yellow }}>{section.r ?? ""}</div>
      </div>
      <div style={{ display: "flex", height: 22, marginTop: 6, backgroundColor: RS.barTrack, border: `2px solid ${RS.border}` }}>
        <div style={{ display: "flex", width: `${Math.round(share * 100)}%`, height: "100%", backgroundColor: fill }} />
      </div>
    </div>
  );
}

function Rows({ section }: { section: Extract<PanelSection, { s: "rows" }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {section.l ? <SectionLabel text={section.l} /> : <div style={{ display: "flex", height: GAP }} />}
      {section.rows.map((row, i) => {
        const src = sprite(row.k);
        return (
          <div
            key={`${row.l}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              height: ROW_H,
              paddingLeft: 8,
              paddingRight: 10,
              backgroundColor: i % 2 === 0 ? "rgba(26,22,16,0.55)" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 36 }}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} width={34} height={34} alt="" />
              ) : null}
            </div>
            <div style={{ display: "flex", flexGrow: 1, marginLeft: 10, fontFamily: FONT.body, fontSize: 21, lineHeight: 1, color: RS.parchment, textShadow: RS.shadow, whiteSpace: "nowrap" }}>
              {row.l}
            </div>
            <div style={{ display: "flex", fontFamily: FONT.body, fontSize: 21, lineHeight: 1, color: row.c ? TONE[row.c] : RS.yellow, textShadow: RS.shadow, whiteSpace: "nowrap" }}>
              {row.r ?? ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stats({ section }: { section: Extract<PanelSection, { s: "stats" }> }) {
  return (
    <div style={{ display: "flex", height: GAP + STATS_H, paddingTop: GAP }}>
      {section.items.map((item, i) => (
        <div
          key={`${item.l}-${i}`}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            flexBasis: 0,
            marginLeft: i === 0 ? 0 : 8,
            paddingLeft: 12,
            backgroundColor: "rgba(26,22,16,0.7)",
            border: `2px solid ${RS.border}`,
          }}
        >
          <div style={{ display: "flex", fontFamily: FONT.bold, fontSize: 26, lineHeight: 1, color: RS.yellow, textShadow: RS.shadow, whiteSpace: "nowrap" }}>{item.v}</div>
          <div style={{ display: "flex", marginTop: 6, fontFamily: FONT.chat, fontSize: 16, lineHeight: 1, color: RS.parchment, textShadow: RS.shadow, whiteSpace: "nowrap" }}>{item.l}</div>
        </div>
      ))}
    </div>
  );
}

export function PanelSections({ sections, accent }: { sections: PanelSection[]; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {sections.map((section, i) => {
        switch (section.s) {
          case "bar":
            return <Bar key={i} section={section} accent={accent} />;
          case "rows":
            return <Rows key={i} section={section} />;
          case "stats":
            return <Stats key={i} section={section} />;
          case "grid":
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                {section.l ? <SectionLabel text={section.l} /> : <div style={{ display: "flex", height: GAP }} />}
                <LootGrid items={section.items} more={section.m ?? 0} />
              </div>
            );
        }
      })}
    </div>
  );
}
