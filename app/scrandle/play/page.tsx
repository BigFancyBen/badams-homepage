import type { Metadata } from "next";
import Link from "next/link";
import { BUCKET_BASE } from "../../api/scrandle/_lib/bucket";
import { WeeklyGame } from "./components/WeeklyGame";
import { isWeeklyPuzzle, type WeeklyPuzzle } from "./types";

/**
 * The week's puzzle is a JSON file the Scrandle Worker writes into its public
 * bucket once a week — see scrandle-worker/src/weekly.ts. The site only ever
 * reads it. SCRANDLE_WEEKLY_URL points it somewhere else for local work, where
 * the Worker serves the same file at /weekly.
 */
const WEEKLY_URL =
  process.env.SCRANDLE_WEEKLY_URL ?? `${BUCKET_BASE}/weekly/current.json`;

/**
 * Five minutes. The puzzle changes once a week, so nearly every check finds
 * the file it already had; the short window is for the one that does not, so
 * the page has caught up by the time anyone follows the bot's link.
 */
const REVALIDATE_SECONDS = 300;

const title = "Scrandle | benadams.dev";
const description =
  "Ten pairs of plates off the board. Pick the one the channel rated higher. A new one every week.";

export const metadata: Metadata = {
  title,
  description,
  // The photographs are a group chat's dinners. Reachable by link, which is
  // how the bot shares it, but not something to hand to a search index.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Scrandle",
    description,
    type: "website",
    siteName: "benadams.dev",
  },
  twitter: { card: "summary", title: "Scrandle", description },
};

async function loadPuzzle(): Promise<WeeklyPuzzle | null> {
  try {
    const response = await fetch(WEEKLY_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const puzzle: unknown = await response.json();
    return isWeeklyPuzzle(puzzle) ? puzzle : null;
  } catch {
    // The bucket being unreachable is not worth a crashed page — and at build
    // time, before the first puzzle exists, it is the expected answer.
    return null;
  }
}

export default async function ScrandlePlayPage() {
  const puzzle = await loadPuzzle();

  if (!puzzle) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <h1 className="text-4xl font-bold text-white tracking-tight">Scrandle</h1>
        <p className="max-w-md text-sm text-gray-400">
          No puzzle is up right now. A new one is drawn every week, and the bot
          says so in the channel when it lands.
        </p>
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono"
        >
          &larr; benadams.dev
        </Link>
      </main>
    );
  }

  return <WeeklyGame puzzle={puzzle} />;
}
