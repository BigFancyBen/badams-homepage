import { ImageResponse } from "next/og";
import { readYutPayload } from "../../_lib/signing";
import { yutFonts } from "../../_lib/fonts";
import { RS } from "../../_lib/theme";
import { formatDate } from "../../_lib/format";
import { CARD_WIDTH, Card, DATE_H, DateStamp, cardHeight } from "../../_lib/card";
import { HEADER_H, PanelHeader, PanelSections, cleanSections, sectionHeight, type PanelPayload } from "../../_lib/panel";

/**
 * The view cards, one endpoint a view: /api/yut/panel/bank, /boss, /farm,
 * /kingdom, /task, /menu, /tears. They share a layout and differ in their colour and
 * the sprite they lead with when the Worker names none.
 */
const KINDS: Record<string, { accent: string; big: string }> = {
  bank: { accent: "#c9a227", big: "coins" },
  boss: { accent: "#c0392b", big: "giant_key" },
  farm: { accent: "#7fb347", big: "seed_dibber" },
  kingdom: { accent: "#3a9ad9", big: "coins" },
  task: { accent: "#b36bff", big: "slayer" },
  menu: { accent: RS.orange, big: "hitpoints" },
  tears: { accent: "#3a9ad9", big: "frozen_tear" },
};

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = KINDS[url.pathname.split("/").filter(Boolean).pop() ?? ""];
  if (!kind) return new Response("Unknown card", { status: 404 });

  const result = await readYutPayload<PanelPayload>(url);
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const { payload } = result;
  const sections = cleanSections(payload.sections);
  const height = cardHeight([HEADER_H, ...sections.map(sectionHeight), 6 + DATE_H]);

  return new ImageResponse(
    (
      <Card>
        <PanelHeader
          title={typeof payload.t === "string" ? payload.t.slice(0, 60) : ""}
          sub={typeof payload.sub === "string" ? payload.sub.slice(0, 80) : ""}
          big={typeof payload.big === "string" ? payload.big : kind.big}
          accent={kind.accent}
        />
        <PanelSections sections={sections} accent={kind.accent} />
        <DateStamp text={formatDate(payload.d)} />
      </Card>
    ),
    { width: CARD_WIDTH, height, fonts: await yutFonts() }
  );
}
