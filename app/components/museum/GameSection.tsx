import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { DOWNLOAD_MB } from "./constants";
import { GamePoster } from "./GamePoster";

/** The homepage's full-screen game teaser, right below the hero: the poster and a link to /museum.
    Loads no engine, no canvas, no song; the game starts on the museum page. */
export function GameSection() {
  return (
    <section id="game" aria-label="Game version" className="relative z-10 h-svh w-full overflow-hidden bg-[#06070a]">
      <GamePoster lift>
        <Link
          href="/museum"
          className="inline-flex h-14 min-w-64 items-center justify-center bg-white px-6 text-sm font-bold uppercase tracking-widest sm:px-8 sm:text-base text-black transition-colors hover:bg-[#ff2a2a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Experience my portfolio
        </Link>
        <p className="mt-4 max-w-sm text-sm leading-snug text-gray-200 sm:max-w-md sm:text-base">
          Walk through every project in a 3D museum after dark, its lights synced to an original house track.
        </p>
        <p className="mt-1.5 font-mono text-[11px] text-gray-500">About {DOWNLOAD_MB} MB download</p>
        <a
          href="#catalogue"
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 px-3 text-xs text-gray-400 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Prefer the boring version? Keep scrolling
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </GamePoster>
    </section>
  );
}
