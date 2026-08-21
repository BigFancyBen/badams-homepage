import { logToDiscord } from "./discord";
import { backfill, ingest } from "./ingest";
import { handleInteraction } from "./interactions";
import {
  closeDueMatchups,
  postMatchupIfDue,
  postStandingsIfDue,
} from "./matchups";
import type { Env, Interaction } from "./types";
import { verifyDiscordRequest } from "./verify";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/interactions" && request.method === "POST") {
      const body = await request.text();
      const valid = await verifyDiscordRequest(
        request,
        body,
        env.DISCORD_PUBLIC_KEY
      );
      // Discord probes with a deliberately bad signature when you save the
      // endpoint URL and expects a 401 back.
      if (!valid) return new Response("Bad request signature", { status: 401 });

      try {
        return await handleInteraction(env, JSON.parse(body) as Interaction);
      } catch (error) {
        await logToDiscord(env, `Interaction failed: ${String(error)}`);
        return Response.json({
          type: 4,
          data: { content: "Something broke. Try again.", flags: 64 },
        });
      }
    }

    if (url.pathname === "/backfill") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      const pages = Math.min(Number(url.searchParams.get("pages") ?? "1"), 5);
      const report = await backfill(env, pages);
      return Response.json(report);
    }

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("scrandle", { status: 200 });
  },

  /**
   * One tick does everything: pull new photos, close what is due, post what is
   * due. Cron failures are silent and do not retry, so the whole thing is
   * wrapped and anything that escapes goes to the logs webhook.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = Date.now();

    try {
      const report = await ingest(env);
      if (report.stored > 0 || report.failed > 0 || report.skippedFormat > 0) {
        await logToDiscord(
          env,
          `Ingest: ${report.stored} stored, ${report.duplicates} duplicate, ` +
            `${report.skippedFormat} unsupported format, ${report.failed} failed.`
        );
      }
    } catch (error) {
      await logToDiscord(env, `Ingest failed: ${String(error)}`);
    }

    try {
      await closeDueMatchups(env, now);
    } catch (error) {
      await logToDiscord(env, `Close failed: ${String(error)}`);
    }

    try {
      await postMatchupIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Post failed: ${String(error)}`);
    }

    try {
      await postStandingsIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Standings failed: ${String(error)}`);
    }
  },
};
