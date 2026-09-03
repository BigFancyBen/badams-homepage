/**
 * Stack numbers the way the OSRS inventory shows them: whole numbers under a
 * thousand, then a `k` with one decimal, then whole thousands, then `m`.
 */
export function formatCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}m`;
  if (n >= 100_000) return `${Math.floor(n / 1000)}k`;
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k`;
  return String(n);
}

/** "2,000" — thousands separators, no suffix. */
export function formatXp(xp: number): string {
  const n = Number.isFinite(xp) ? Math.floor(xp) : 0;
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-06" → "6 Oct 2026". Anything else is shown as sent. */
export function formatDate(d: string | undefined): string {
  if (typeof d !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return d;
  return `${Number(m[3])} ${month} ${m[1]}`;
}
