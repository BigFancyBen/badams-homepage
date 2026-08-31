import { logToDiscord } from "./discord";
import { classify } from "./classify";
import { backfill, ingest } from "./ingest";
import { handleInteraction } from "./interactions";
import {
  closeDueMatchups,
  postDrinkMatchupIfDue,
  postMatchupIfDue,
  postPersonMatchupIfDue,
  postStandingsIfDue,
  repairCard,
} from "./matchups";
import {
  closeDueRounds,
  postPlaceRoundIfDue,
  repairRoundCard,
} from "./rounds";
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
    // workable loop. Refuses if a matchup is already open unless `overlap=1`,
    // which puts a bonus matchup up beside the running one. A bonus post never
    // claims the hour's slot, so the schedule carries on untouched.
    if (url.pathname === "/admin/post-matchup") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        // `place=1` / `person=1` / `drink=1` post that slot on demand: that
        // category only, running beside whatever is open, on a flat window. A
        // bonus always overlaps. `place=1` posts the five-photograph ranking
        // round, which is what the place bonus became.
        const place = url.searchParams.get("place") === "1";
        const person = url.searchParams.get("person") === "1";
        const drink = url.searchParams.get("drink") === "1";
        const overlap =
          place || person || drink || url.searchParams.get("overlap") === "1";
        const posted = place
          ? await postPlaceRoundIfDue(env, Date.now(), { force: true })
          : person
            ? await postPersonMatchupIfDue(env, Date.now(), { force: true })
            : drink
              ? await postDrinkMatchupIfDue(env, Date.now(), { force: true })
              : await postMatchupIfDue(env, Date.now(), { force: true, overlap });
        const kind = place
          ? "place round"
          : person
            ? "person"
            : drink
              ? "drink"
              : "matchup";
        return Response.json({
          posted,
          kind,
          reason: posted
            ? null
            : place
              ? "fewer than three places available to rank, or too many of them one person's"
              : person
                ? "fewer than two people in the catalog, only one person's photographs, or both are already live"
                : drink
                  ? "fewer than two drinks in the catalog, only one person's drinks, or both are already live"
                  : overlap
                    ? "no pair could be drawn"
                    : "a matchup is already open, or no pair could be drawn",
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Manual post failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    // Closes whatever is open right now, ignoring closes_at — every matchup
    // and every ranking round, which is what "whatever is open" has always
    // meant here. Same reason as the manual post: a cron cannot be fired by
    // hand, and the close path is the one most worth exercising on demand.
    if (url.pathname === "/admin/close-matchup") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        const now = Date.now();
        const closed = await closeDueMatchups(env, now, { force: true });
        const rounds = await closeDueRounds(env, now, { force: true });
        return Response.json({ closed, rounds });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Manual close failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    // Puts a card back on a message that went out without one, or with one
    // Discord failed to fetch. Renders to a URL Discord has never seen, so it
    // cannot answer from the failure it cached the first time.
    if (url.pathname === "/admin/repair-card") {
      if (url.searchParams.get("secret") !== env.BACKFILL_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      // Either an id or the Discord message it went out as. The message id is
      // what a broken round actually hands you — it is the last segment of the
      // message link — and a card-less post shows its id nowhere at all. By
      // message it could be either kind, so try the matchups and then the
      // ranking rounds.
      const messageId = url.searchParams.get("message");
      const matchupId = Number(url.searchParams.get("matchup"));
      const roundId = Number(url.searchParams.get("round"));
      const byMatchup = Number.isInteger(matchupId) && matchupId > 0;
      const byRound = Number.isInteger(roundId) && roundId > 0;
      if (!messageId && !byMatchup && !byRound) {
        return Response.json(
          {
            ok: false,
            error: "pass ?matchup=<id>, ?round=<id> or ?message=<discord id>",
          },
          { status: 400 }
        );
      }
      try {
        if (byRound) {
          return Response.json(await repairRoundCard(env, { roundId }));
        }
        if (byMatchup) {
          return Response.json(await repairCard(env, { matchupId }));
        }
        const asMatchup = await repairCard(env, { messageId: messageId! });
        if (asMatchup.repaired || asMatchup.reason !== "no such matchup") {
          return Response.json(asMatchup);
        }
        return Response.json(
          await repairRoundCard(env, { messageId: messageId! })
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Card repair failed: ${reason}`);
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
      // A GIF or a WebP being turned away is the format filter doing its job —
      // someone posted a reaction GIF, and it is not meant to end up in the
      // pool. Only a download or a write that actually failed is worth a line;
      // the count is still in the ingest report either way. The reason comes
      // with it: a bare number cannot tell a dead attachment URL from a D1
      // blip, and only one of those is worth getting out of bed for.
      if (report.failed > 0) {
        await logToDiscord(
          env,
          `Ingest: ${report.failed} failed. First: ${report.firstFailure}`
        );
      }
    } catch (error) {
      await logToDiscord(env, `Ingest failed: ${String(error)}`);
    }

    // Classify before anything else touches the catalog — matchmaking skips
    // unlabelled dishes, so an unclassified photo is invisible to the game.
    try {
      const labelled = await classify(env);
      if (labelled.failed > 0) {
        await logToDiscord(
          env,
          `Classify: ${labelled.failed} failed, ${labelled.remaining} left.`
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

    // Its own try, so a ranking round that cannot close does not also stop the
    // matchups closing, or the reverse.
    try {
      await closeDueRounds(env, now);
    } catch (error) {
      await logToDiscord(env, `Round close failed: ${String(error)}`);
    }

    try {
      await postMatchupIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Post failed: ${String(error)}`);
    }

    // After the everyday matchup, and deliberately not gated on it: these run
    // alongside whatever is open rather than instead of it. Each fires only on
    // its own day and hour, so most ticks post none of them.
    try {
      await postPlaceRoundIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Place round failed: ${String(error)}`);
    }

    try {
      await postPersonMatchupIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Person matchup failed: ${String(error)}`);
    }

    try {
      await postDrinkMatchupIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Drink matchup failed: ${String(error)}`);
    }

    try {
      await postStandingsIfDue(env, now);
    } catch (error) {
      await logToDiscord(env, `Standings failed: ${String(error)}`);
    }
  },
};
