import { performCheckin } from "./checkins.ts";
import { getPlayer, grantLampStatement, joinPlayer } from "./db.ts";
import { logToDiscord, registerGuildCommands } from "./discord.ts";
import { handleInTime, postCheckinLine } from "./interactions.ts";
import { COMMANDS } from "./register.ts";
import { gameDay, parseHour } from "./schedule.ts";
import { gatherSheet, renderCard, sheetImageUrl } from "./sheet.ts";
import { runTick } from "./tick.ts";
import type { Env, Interaction } from "./types.ts";
import { verifyDiscordRequest } from "./verify.ts";
import { resolveWeekFor } from "./weekly.ts";
import { addDays, gameWeek } from "./schedule.ts";

/**
 * Two doors: Discord's interactions webhook, and the hourly cron. Plus the
 * /admin/* routes, which exist because a cron cannot be fired by hand and
 * waiting an hour to test a change is not a workable loop.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/interactions" && request.method === "POST") {
      const body = await request.text();
      const valid = await verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY);
      // Discord probes with a deliberately bad signature when you save the
      // endpoint URL and expects a 401 back.
      if (!valid) return new Response("Bad request signature", { status: 401 });

      try {
        return await handleInTime(env, ctx, JSON.parse(body) as Interaction);
      } catch (error) {
        await logToDiscord(env, `Interaction failed: ${String(error)}`);
        return Response.json({
          type: 4,
          data: { content: "Something broke. Try again.", flags: 64 },
        });
      }
    }

    if (url.pathname.startsWith("/admin/")) {
      if (url.searchParams.get("secret") !== env.ADMIN_SECRET) {
        return new Response("Nope", { status: 403 });
      }
      try {
        return Response.json(await admin(env, ctx, url));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await logToDiscord(env, `Admin ${url.pathname} failed: ${reason}`);
        return Response.json({ ok: false, error: reason }, { status: 502 });
      }
    }

    if (url.pathname === "/health") return new Response("ok");
    return new Response("yut-hut", { status: 200 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runTick(env, Date.now()));
  },
};

/**
 * The test seams. `at=` is an ISO timestamp for the tick's clock, so the
 * simulation can walk a year in minutes; `day=` on the check-in routes is the
 * game day to write against.
 */
async function admin(env: Env, ctx: ExecutionContext, url: URL): Promise<unknown> {
  const path = url.pathname.replace("/admin/", "");
  const at = url.searchParams.get("at");
  const now = at ? Date.parse(at) : Date.now();
  if (Number.isNaN(now)) return { ok: false, error: "bad at=" };
  const rollover = parseHour(env.ROLLOVER_HOUR_UTC) ?? 9;

  switch (path) {
    case "tick":
      return {
        ok: true,
        at: new Date(now).toISOString(),
        report: await runTick(env, now, {
          daily: url.searchParams.get("daily") === "1",
          post: url.searchParams.get("post") === "1",
          lastCall: url.searchParams.get("lastcall") === "1",
          reminders: url.searchParams.get("reminders") === "1",
        }),
      };

    case "grant-lamp": {
      // Hands a player a lamp dated day=, so the harness can test the reminders.
      const id = url.searchParams.get("player");
      if (!id) return { ok: false, error: "player=" };
      const day = url.searchParams.get("day") ?? gameDay(now, rollover);
      await grantLampStatement(
        env,
        id,
        Number(url.searchParams.get("xp") ?? "0"),
        url.searchParams.get("source") ?? "genie",
        day
      ).run();
      return { ok: true, player: id, day };
    }

    case "seed": {
      // Creates players by id, for the simulation.
      const ids = (url.searchParams.get("players") ?? "").split(",").filter(Boolean);
      const day = url.searchParams.get("day") ?? gameDay(now, rollover);
      for (const id of ids) await joinPlayer(env, id, url.searchParams.get(`name_${id}`) ?? id, now, day);
      return { ok: true, joined: ids };
    }

    case "checkin-as": {
      const id = url.searchParams.get("player");
      if (!id) return { ok: false, error: "player=" };
      const player = await getPlayer(env, id);
      if (!player) return { ok: false, error: "no such player" };
      const day = url.searchParams.get("day") ?? gameDay(now, rollover);
      const withPhoto = url.searchParams.get("photo") === "1";
      const kind = url.searchParams.get("video") === "1" ? ("video" as const) : ("image" as const);
      const input = {
        note: url.searchParams.get("note"),
        attachment: withPhoto
          ? { key: `discord:sim-${id}-${day}`, url: `https://cdn.discordapp.test/attachments/sim/${id}-${day}.${kind === "video" ? "mp4" : "png"}`, kind }
          : null,
      };
      const outcome = await performCheckin(env, player, day, now, input);
      if (outcome.ok && url.searchParams.get("post") === "1") {
        ctx.waitUntil(postCheckinLine(env, player, day, outcome, input));
      }
      return { ok: outcome.ok, outcome };
    }

    case "verify-as": {
      // Presses Verify on a check-in as a player, for the harness.
      const id = url.searchParams.get("player");
      const checkinId = Number(url.searchParams.get("checkin") ?? "0");
      if (!id || !checkinId) return { ok: false, error: "player= and checkin=" };
      const player = await getPlayer(env, id);
      if (!player) return { ok: false, error: "no such player" };
      const { verify } = await import("./interactions.ts");
      const answer = await verify(env, ctx, { id, username: player.username }, checkinId, gameDay(now, rollover), now);
      return { ok: true, answer: answer instanceof Response ? "response" : answer.content };
    }

    case "resolve-week": {
      const day = url.searchParams.get("day") ?? gameDay(now, rollover);
      const closed = url.searchParams.get("week") ?? addDays(gameWeek(day), -7);
      return { ok: true, summary: await resolveWeekFor(env, closed, day, now) };
    }

    case "render-sheet": {
      const id = url.searchParams.get("player");
      const player = id ? await getPlayer(env, id) : null;
      if (!player) return { ok: false, error: "no such player" };
      const day = gameDay(now, rollover);
      const data = await gatherSheet(env, player, day);
      const url2 = await renderCard(env, `sheets/${id}-${now}.png`, (attempt) => sheetImageUrl(env, data, attempt));
      return { ok: Boolean(url2), url: url2, signed: await sheetImageUrl(env, data) };
    }

    case "register-commands":
      return { ok: true, result: await registerGuildCommands(env, COMMANDS) };

    case "ballot": {
      // Casts a ballot on every open vote (or one, with vote=) for the harness.
      const id = url.searchParams.get("player");
      const idx = Number(url.searchParams.get("idx") ?? "0");
      if (!id) return { ok: false, error: "player=" };
      const { castBallot, openVotes } = await import("./votes.ts");
      const only = url.searchParams.get("vote");
      const votes = (await openVotes(env)).filter((v) => !only || String(v.id) === only);
      for (const vote of votes) await castBallot(env, vote.id, id, idx, now);
      return { ok: true, voted: votes.map((v) => v.id) };
    }

    case "sql": {
      // Read-only, for the harness: SELECT only.
      const query = url.searchParams.get("q") ?? "";
      if (!/^\s*select/i.test(query)) return { ok: false, error: "SELECT only" };
      const { results } = await env.DB.prepare(query).all();
      return { ok: true, results };
    }

    default:
      return { ok: false, error: "unknown admin route" };
  }
}
