import { getState, setState } from "./db.ts";
import { logToDiscord, postMessage, startThread } from "./discord.ts";
import { hourSlotKey, parseHour } from "./schedule.ts";
import type { Env } from "./types.ts";

/**
 * While Yut Hut is paused the channel is lent to Oathkeep: a few times a week
 * the bot asks for playtest feedback and opens a thread with some questions to
 * start people off. One set of questions per post, rotating, so the thread
 * does not read the same every time.
 */
const QUESTION_SETS: string[][] = [
  [
    "What did you do the last time you opened Oathkeep?",
    "Was there a moment you didn't know what to do next?",
    "Did anything feel slow, laggy or broken?",
    "What's one thing you'd change first?",
  ],
  [
    "How does the daily bell and check-in feel? Too much, too little, just right?",
    "Does keeping your oath feel rewarding, or like a chore?",
    "Did you share a check-in with a photo? Did boons feel worth it?",
    "What would make you open the app on a day you didn't work out?",
  ],
  [
    "What build are you running, and is it fun?",
    "Have you found a skill gem, support or keystone that feels broken (good or bad)?",
    "Is gear and loot exciting, or do you skim past it?",
    "Is there anything in the constellation you don't understand?",
  ],
  [
    "How does playing with the guild feel: raids, shared fights, the hearth?",
    "Do you know what your guildmates have been up to when you open the app?",
    "Is guild chat somewhere you'd actually talk, or do you still use Discord?",
    "What would make the group side feel more like a team?",
  ],
  [
    "What's the best thing about Oathkeep so far?",
    "What's the most confusing thing?",
    "Any bugs, crashes or weird screens? Screenshots welcome.",
    "Would you tell a friend to try it yet? Why or why not?",
  ],
];

export function gamePaused(env: Env): boolean {
  return (env.GAME_PAUSED ?? "").trim() === "1";
}

/** Weekdays (0 = Sunday) the feedback post goes out, from a comma list like "1,3,5". */
export function parseWeekdays(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function feedbackDue(env: Env, now: number): boolean {
  const hour = parseHour(env.FEEDBACK_HOUR_UTC);
  if (hour === null) return false;
  const date = new Date(now);
  return parseWeekdays(env.FEEDBACK_WEEKDAYS).includes(date.getUTCDay()) && date.getUTCHours() === hour;
}

function threadTitle(now: number): string {
  const label = new Date(now).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Oathkeep feedback - ${label}`;
}

/**
 * Posts the ask, opens its thread and seeds the thread with questions. Guarded
 * by the hour slot so a retried tick posts once. Returns the message id, or
 * null when nothing was due.
 */
export async function postFeedbackAsk(env: Env, now: number, force = false): Promise<string | null> {
  const slot = hourSlotKey(now);
  if (!force && (!feedbackDue(env, now) || (await getState(env, "last_feedback_slot")) === slot)) return null;
  await setState(env, "last_feedback_slot", slot);

  const count = Number((await getState(env, "feedback_posts")) ?? "0") || 0;
  await setState(env, "feedback_posts", String(count + 1));
  const questions = QUESTION_SETS[count % QUESTION_SETS.length];

  const message = await postMessage(env, {
    content:
      "**Oathkeep feedback** :fire:\n" +
      "Yut Hut is on a break while we playtest Oathkeep. If you've played since the last ask, " +
      "tell us how it's going in the thread below: what's fun, what's confusing, what broke. " +
      "Short answers are great.",
    allowed_mentions: { parse: [] },
  });

  try {
    const threadId = await startThread(env, message.id, threadTitle(now), 10080);
    await postMessage(
      env,
      {
        content: `Some questions to get going (answer any, or none and just say what's on your mind):\n${questions
          .map((q) => `- ${q}`)
          .join("\n")}`,
        allowed_mentions: { parse: [] },
      },
      threadId
    );
  } catch (error) {
    await logToDiscord(env, `Feedback thread failed: ${String(error)}`);
  }
  return message.id;
}
