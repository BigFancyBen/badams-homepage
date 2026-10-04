import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { itemIconDataUrl } from "../../_lib/icons";
import { FONT, RS } from "../../_lib/theme";
import { formatCount, formatDate, formatXp } from "../../_lib/format";
import {
  CARD_WIDTH,
  Card,
  CardSubtitle,
  CardTitle,
  DATE_H,
  DateStamp,
  LABEL_H,
  SUBTITLE_H,
  SectionLabel,
  TITLE_H,
  cardHeight,
} from "../../_lib/card";

/** The Achievement Diary: four tiers with a bar each, and the open tier's tasks. */
interface DiaryPayload {
  /** Player name */
  n: string;
  tiers: { k: string; n: string; done: number; of: number; paid: boolean; lamp: number }[];
  /** The open tier's tasks: label, have, goal */
  tasks: { l: string; h: number; g: number }[];
  /** Key of the tier being worked on */
  open?: string;
  /** YYYY-MM-DD */
  d: string;
  /** Retry counter. Only there to make a re-render a different URL. */
  r?: number;
}

/** The diary's own colours: green, blue, red, gold. */
const TIER_COLOR: Record<string, string> = {
  easy: "#7fb347",
  medium: "#3a9ad9",
  hard: "#d94a3a",
  elite: "#c9a227",
};

const TIER_ROW_H = 44;
const TASK_ROW_H = 30;
const BAR_W = 260;
const GAP = 6;
const DONE = "#00ff80";

export const maxDuration = 60;

function Bar({ fraction, color, width, height }: { fraction: number; color: string; width: number; height: number }) {
  const fill = Math.round(Math.max(0, Math.min(1, fraction)) * (width - 4));
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: RS.barTrack,
        border: `2px solid ${RS.border}`,
      }}
    >
      <div style={{ display: "flex", width: fill, height: height - 4, backgroundColor: color }} />
    </div>
  );
}

export async function GET(request: Request) {
  const result = await readYutPayload<DiaryPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { n, d } = result.payload;
  const tiers = (Array.isArray(result.payload.tiers) ? result.payload.tiers : []).filter(
    (tier) => !!tier && typeof tier.k === "string" && typeof tier.n === "string"
  );
  const tasks = (Array.isArray(result.payload.tasks) ? result.payload.tasks : []).filter(
    (task) => !!task && typeof task.l === "string" && typeof task.h === "number" && typeof task.g === "number"
  );
  const open = tiers.find((tier) => tier.k === result.payload.open) ?? null;
  const paid = tiers.filter((tier) => tier.paid).length;
  const lamp = itemIconDataUrl("lamp");

  const tasksHeight = tasks.length ? LABEL_H + tasks.length * TASK_ROW_H : 0;
  const height = cardHeight([TITLE_H, SUBTITLE_H, GAP + tiers.length * TIER_ROW_H, tasksHeight, GAP + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <CardTitle text={`${n ?? ""}'s Achievement Diary`} />
        <CardSubtitle text={`${paid} of ${tiers.length} tiers complete`} />

        <div style={{ display: "flex", flexDirection: "column", marginTop: GAP }}>
          {tiers.map((tier) => {
            const color = TIER_COLOR[tier.k] ?? RS.barFill;
            return (
              <div key={tier.k} style={{ display: "flex", alignItems: "center", height: TIER_ROW_H }}>
                <div
                  style={{
                    display: "flex",
                    width: 110,
                    fontFamily: FONT.bold,
                    fontSize: 26,
                    lineHeight: 1,
                    color: tier.paid ? DONE : color,
                    textShadow: RS.shadow,
                  }}
                >
                  {tier.n}
                </div>
                <Bar fraction={tier.of > 0 ? tier.done / tier.of : 0} color={color} width={BAR_W} height={22} />
                <div
                  style={{
                    display: "flex",
                    width: 70,
                    marginLeft: 12,
                    fontFamily: FONT.body,
                    fontSize: 22,
                    lineHeight: 1,
                    color: RS.yellow,
                    textShadow: RS.shadow,
                  }}
                >
                  {`${tier.done}/${tier.of}`}
                </div>
                {lamp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lamp} width={30} height={30} alt="" style={{ marginRight: 6 }} />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    fontFamily: FONT.chat,
                    fontSize: 20,
                    lineHeight: 1,
                    color: tier.paid ? DONE : RS.parchment,
                    textShadow: RS.shadow,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tier.paid ? "Paid" : `${formatXp(tier.lamp)} XP`}
                </div>
              </div>
            );
          })}
        </div>

        {tasks.length ? <SectionLabel text={`${open?.n ?? "Open"} tasks:`} /> : null}
        {tasks.map((task, i) => {
          const done = task.h >= task.g;
          return (
            <div key={`${task.l}-${i}`} style={{ display: "flex", alignItems: "center", height: TASK_ROW_H }}>
              <div
                style={{
                  display: "flex",
                  width: 14,
                  height: 14,
                  marginRight: 12,
                  backgroundColor: done ? DONE : RS.barTrack,
                  border: `2px solid ${done ? DONE : RS.border}`,
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 360,
                  fontFamily: FONT.chat,
                  fontSize: 20,
                  lineHeight: 1,
                  color: done ? DONE : RS.parchment,
                  textShadow: RS.shadow,
                  whiteSpace: "nowrap",
                }}
              >
                {task.l}
              </div>
              <Bar fraction={task.g > 0 ? task.h / task.g : 0} color={done ? DONE : RS.barFill} width={130} height={16} />
              <div
                style={{
                  display: "flex",
                  marginLeft: 10,
                  fontFamily: FONT.body,
                  fontSize: 18,
                  lineHeight: 1,
                  color: RS.yellow,
                  textShadow: RS.shadow,
                  whiteSpace: "nowrap",
                }}
              >
                {`${formatCount(Math.min(task.h, task.g))}/${formatCount(task.g)}`}
              </div>
            </div>
          );
        })}

        <DateStamp text={formatDate(d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
