import Link from "next/link";
import { DOWNLOAD_MB } from "./constants";
import { GamePoster } from "./GamePoster";

/** The homepage's full-screen game teaser, right below the hero: the poster and a link to /museum.
    Loads no engine, no canvas, no song; the game starts on the museum page. */
export function GameSection() {
  return (
    <section id="game" aria-label="Game version" className="relative z-10 h-svh w-full overflow-hidden bg-[#06070a]">
      <GamePoster>
        <Link
          href="/museum"
          className="inline-flex h-14 min-w-64 items-center justify-center bg-white px-8 text-base font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#ff2a2a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Game version
        </Link>
        <p className="mt-2 text-xs text-gray-400">About {DOWNLOAD_MB} MB download</p>
      </GamePoster>
    </section>
  );
}
