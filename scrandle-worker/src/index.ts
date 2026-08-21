import { logToDiscord } from "./discord";
import { classify } from "./classify";
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
      try {
        return Response.json(await backfill(env, pages));
      } catch (error) {
        // This route gets run by hand, usually while working out whether the
        // bot can actually see the channel. A readable reason beats a stack.
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Backfill failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    // Posts a matchup immediately, ignoring the cadence floor. There is no way
    // to trigger a cron by hand, and waiting an hour to test a change is not a
    // workable loop. Still refuses if a matchup is already open.
    if (url.pathname === "/admin/post-matchup") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        const posted = await postMatchupIfDue(env, Date.now(), { force: true });
        return Response.json({
          posted,
          reason: posted ? null : "a matchup is already open, or no pair could be drawn",
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Manual post failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    // Closes whatever is open right now, ignoring closes_at. Same reason as
    // the manual post: a cron cannot be fired by hand, and the close path is
    // the one most worth being able to exercise on demand.
    if (url.pathname === "/admin/close-matchup") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        const closed = await closeDueMatchups(env, Date.now(), { force: true });
        return Response.json({ closed });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Manual close failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    if (url.pathname === "/admin/classify") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        const limit = Number(url.searchParams.get("limit") ?? "20");
        return Response.json(await classify(env, limit));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Classify failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
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

    // Classify before anything else touches the catalog — matchmaking skips
    // unlabelled dishes, so an unclassified photo is invisible to the game.
    try {
      const labelled = await classify(env);
      if (labelled.labelled > 0 || labelled.failed > 0) {
        await logToDiscord(
          env,
          `Classified ${labelled.labelled}, ${labelled.failed} failed, ${labelled.remaining} left.`
        );
      }
    } catch (error) {
      await logToDiscord(env, `Classify failed: ${String(error)}`);
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
