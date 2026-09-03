/**
 * Calendar arithmetic. Everything here is pure and works in game days —
 * `YYYY-MM-DD` strings on a day that starts at ROLLOVER_HOUR_UTC rather than
 * midnight — so a session finished at 1am Mountain lands on the day it
 * belongs to.
 */

const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** "-1" or junk means off. */
export function parseHour(raw: string | undefined): number | null {
  const hour = Number((raw ?? "").trim());
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export function parseWeekday(raw: string | undefined): number | null {
  const day = Number((raw ?? "").trim());
  return Number.isInteger(day) && day >= 0 && day <= 6 ? day : null;
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The game day a moment falls in. */
export function gameDay(now: number, rolloverHourUtc: number): string {
  return isoDate(now - rolloverHourUtc * HOUR);
}

/** The Monday that starts the game week `day` is in. */
export function gameWeek(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const weekday = date.getUTCDay(); // 0 = Sunday
  const back = (weekday + 6) % 7;
  return isoDate(date.getTime() - back * DAY);
}

export function addDays(day: string, days: number): string {
  return isoDate(new Date(`${day}T00:00:00Z`).getTime() + days * DAY);
}

/** `b - a` in days. Negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) /
      DAY
  );
}

/** 0 = Sunday … 6 = Saturday, of a game day. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** 1-based campaign week for a game day, or 0 before the start. */
export function campaignWeek(day: string, start: string): number {
  const diff = daysBetween(gameWeek(start), day);
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}

/** Which act a campaign week falls in, 1-based. Past the last act it stays there. */
export function actForWeek(week: number, actWeeks: number, acts: number): number {
  if (week < 1) return 1;
  return Math.min(acts, Math.floor((week - 1) / actWeeks) + 1);
}

/** Identifies the hourly slot a moment falls in, as `2026-08-21T15`. */
export function hourSlotKey(now: number): string {
  return new Date(now).toISOString().slice(0, 13);
}

/** Whether a weekly slot's day and hour land on this tick. */
export function weeklySlotDue(
  now: number,
  weekday: number | null,
  hourUtc: number | null
): boolean {
  if (weekday === null || hourUtc === null) return false;
  const date = new Date(now);
  return date.getUTCDay() === weekday && date.getUTCHours() === hourUtc;
}

/** Whether a daily slot's hour lands on this tick. */
export function dailySlotDue(now: number, hourUtc: number | null): boolean {
  if (hourUtc === null) return false;
  return new Date(now).getUTCHours() === hourUtc;
}

/**
 * Whether a daily slot is due — at or past its hour, so a late tick still
 * fires — measured from the rollover rather than midnight, so a slot after
 * midnight UTC (an evening in Mountain time) belongs to the game day it is in.
 */
export function dailyHourDue(now: number, hourUtc: number | null, rolloverHourUtc: number): boolean {
  if (hourUtc === null) return false;
  const since = (hour: number) => (hour - rolloverHourUtc + 24) % 24;
  return since(new Date(now).getUTCHours()) >= since(hourUtc);
}

/** Sunday, Monday … for a weekday number. */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "14 Sep" for a game day. */
export function shortDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}
