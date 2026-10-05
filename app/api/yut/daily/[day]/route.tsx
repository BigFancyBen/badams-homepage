import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { FONT, RS } from "../../_lib/theme";
import { formatDate } from "../../_lib/format";
import { CARD_WIDTH, Card, DATE_H, DateStamp, LABEL_H, SectionLabel, cardHeight } from "../../_lib/card";
import { HEADER_H, PanelHeader, PanelSections, cleanSections, sectionHeight, type PanelSection } from "../../_lib/panel";

/**
 * The morning post's card: the day's question and the group's shared bars.
 * Twice a week, midweek and on the last day, it also carries the roll call:
 * two slots a player for the week's two check-ins, and a count of any beyond.
 */
interface DailyPayload {
  /** Headline: the question */
  t: string;
  /** "Act 1 - Week 3 - Day 21 - Lumbridge" */
  sub: string;
  /** Today's featured container, drawn large */
  big?: string;
  /** The roll call, on the days it is shown: n name, c check-ins this week */
  players: { n: string; c: number }[];
  /** The board's label: "Midweek" or "Week's end" */
  rc?: string;
  /** How many more are on the roster than are listed */
  more?: number;
  sections: PanelSection[];
  d: string;
  r?: number;
}

const ACCENT = RS.orange;
const ROW_H = 40;
const MAX_PLAYERS = 14;
const GREEN = RS.barFill;
const DIM = "#8f8674";

export const maxDuration = 60;

function Slot({ filled }: { filled: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        width: 26,
        height: 26,
        marginRight: 6,
        backgroundColor: filled ? GREEN : RS.barTrack,
        border: `2px solid ${filled ? "#a9d477" : RS.border}`,
      }}
    />
  );
}

export async function GET(request: Request) {
  const result = await readYutPayload<DailyPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { payload } = result;
  const players = (Array.isArray(payload.players) ? payload.players : [])
    .filter((p) => p && typeof p.n === "string")
    .slice(0, MAX_PLAYERS)
    .map((p) => ({
      n: p.n.slice(0, 24),
      c: Number.isFinite(Number(p.c)) ? Math.max(0, Math.floor(Number(p.c))) : 0,
    }));
  const more = Number.isFinite(Number(payload.more)) ? Math.max(0, Math.floor(Number(payload.more))) : 0;
  const sections = cleanSections(payload.sections);
  const board = players.length > 0 ? LABEL_H + players.length * ROW_H + (more > 0 ? ROW_H : 0) : 0;
  const height = cardHeight([HEADER_H, board, ...sections.map(sectionHeight), 6 + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <PanelHeader
          title={typeof payload.t === "string" ? payload.t.slice(0, 60) : ""}
          sub={typeof payload.sub === "string" ? payload.sub.slice(0, 80) : ""}
          big={typeof payload.big === "string" ? payload.big : "casket"}
          accent={ACCENT}
        />

        {players.length > 0 ? <SectionLabel text={`${typeof payload.rc === "string" ? payload.rc.slice(0, 30) : "Roll call"}:`} /> : null}
        {players.map((player, i) => (
          <div
            key={`${player.n}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              height: ROW_H,
              paddingLeft: 10,
              paddingRight: 10,
              backgroundColor: i % 2 === 0 ? "rgba(26,22,16,0.55)" : "transparent",
            }}
          >
            <div style={{ display: "flex", width: 250, fontFamily: FONT.body, fontSize: 22, lineHeight: 1, color: RS.parchment, textShadow: RS.shadow, whiteSpace: "nowrap", overflow: "hidden" }}>
              {player.n}
            </div>
            <div style={{ display: "flex", alignItems: "center", width: 150 }}>
              <Slot filled={player.c >= 1} />
              <Slot filled={player.c >= 2} />
              {player.c > 2 ? (
                <div style={{ display: "flex", fontFamily: FONT.body, fontSize: 20, lineHeight: 1, color: RS.yellow, textShadow: RS.shadow }}>{`+${player.c - 2}`}</div>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                flexGrow: 1,
                justifyContent: "flex-end",
                fontFamily: FONT.body,
                fontSize: 21,
                lineHeight: 1,
                color: player.c >= 2 ? GREEN : RS.yellow,
                textShadow: RS.shadow,
                whiteSpace: "nowrap",
              }}
            >
              {player.c >= 2 ? "In form" : player.c === 1 ? "One to go" : ""}
            </div>
          </div>
        ))}
        {more > 0 ? (
          <div style={{ display: "flex", alignItems: "center", height: ROW_H, paddingLeft: 10, fontFamily: FONT.chat, fontSize: 18, color: DIM, textShadow: RS.shadow }}>
            {`+${more} more`}
          </div>
        ) : null}

        <PanelSections sections={sections} accent={ACCENT} />
        <DateStamp text={formatDate(payload.d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
