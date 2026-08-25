import Image from "next/image";
import Link from "next/link";
import { RIVER } from "../config";
import { MONO } from "../typography";
import { CodeChip } from "./CodeChip";
import { Handoff } from "./Handoff";

/**
 * The put-in page: what somebody sees when they click a friend's join link and
 * the game did not take it.
 *
 * The page is mostly pictures. Somebody who has never heard of this game has
 * about four seconds of interest, and a screenshot of otters in helmets going
 * over a drop spends those seconds better than a paragraph does.
 *
 * Rendered on the server, complete without JavaScript. Two small client pieces
 * ride on top: the strip that knows whether the game opened, and the button
 * that copies the trip code. Neither one gates the page.
 */
export function PutIn({ code }: { code?: string }) {
  return (
    <main className="min-h-screen">
      <Hero code={code} />
      <Gallery />
      <Facts />
      {code ? <AlreadyOwn code={code} /> : null}
      <Close />
    </main>
  );
}

function Hero({ code }: { code?: string }) {
  return (
    <section className="relative isolate min-h-[90svh] overflow-hidden">
      <Image
        src="/river/hero.jpg"
        alt="A raft dropping into green water below a waterfall while a swimmer takes a throw rope"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Enough scrim to read white type over the falls, and no more. The
          picture is doing the selling. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d1113]/95 via-[#0d1113]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1113] via-transparent to-[#0d1113]/40" />

      <div className="relative mx-auto flex min-h-[90svh] max-w-6xl flex-col justify-between px-6 py-8 sm:px-10">
        <Image
          src="/river/lockup.png"
          alt="Middle Fork Rafting Simulator"
          width={2445}
          height={592}
          priority
          className="h-11 w-auto self-start sm:h-14"
        />

        <div className="max-w-xl py-8">
          {code ? <Handoff code={code} /> : null}

          <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight uppercase sm:text-6xl">
            {code ? (
              <>
                There is a seat
                <br />
                on the boat.
              </>
            ) : (
              <>
                One raft.
                <br />
                Everyone paddles.
              </>
            )}
          </h1>

          <p className="mt-4 text-lg text-[#f2efe3]/80">
            {code ? (
              <>
                Your friends are running trip{" "}
                <span className={`${MONO} text-[#e2650f]`}>{code}</span> right now.
              </>
            ) : (
              <>Multiplayer whitewater, down a canyon that builds itself as you run it.</>
            )}
          </p>

          <div className="mt-8">
            <Offer />
          </div>

          <p className={`${MONO} mt-6 text-xs tracking-widest text-[#f2efe3]/50 uppercase`}>
            Windows · Linux · Android
          </p>
        </div>

        <p className={`${MONO} text-xs text-[#f2efe3]/40`}>
          <Link href="/" className="underline underline-offset-4 hover:text-[#f2efe3]">
            benadams.dev
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Four screenshots, no captions. They carry the pitch. */
function Gallery() {
  return (
    <section>
      <Shot
        src="/river/shot-wave.jpg"
        alt="A raft crossing a sunlit reach with two swimmers alongside"
        className="aspect-[4/3] sm:aspect-[21/9]"
        sizes="100vw"
      />
      <div className="grid sm:grid-cols-2">
        <Shot
          src="/river/shot-dogleg.jpg"
          alt="A raft dropping a green tongue in a narrow gorge, swimmers ahead of it"
          className="aspect-[4/3]"
          sizes="(max-width: 640px) 100vw, 50vw"
        />
        <Shot
          src="/river/shot-keeper.jpg"
          alt="A raft stood on end against a midstream rock, crew spilling toward the tube"
          className="aspect-[4/3]"
          sizes="(max-width: 640px) 100vw, 50vw"
        />
      </div>
      <Shot
        src="/river/shot-wrap.jpg"
        alt="Two otters on a rock holding a rope out to a raft pinned in the current"
        className="aspect-[4/3] sm:aspect-[21/9]"
        sizes="100vw"
      />
    </section>
  );
}

function Shot({
  src,
  alt,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

const FACTS = [
  "One boat, every blade",
  "A canyon with no end",
  "Throw bags and swimmers",
  "No account, no launcher",
];

function Facts() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
      <ul className={`${MONO} grid gap-4 text-sm tracking-wide uppercase sm:grid-cols-4`}>
        {FACTS.map((f) => (
          <li key={f} className="border-t-2 border-[#e2650f] pt-3 text-[#f2efe3]/75">
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * For the player who already owns the game and got here anyway, which happens
 * whenever the `mfrs://` handoff fails. The code is the way in that predates
 * all of this and never breaks.
 */
function AlreadyOwn({ code }: { code: string }) {
  return (
    <section className="border-t border-[#f2efe3]/15">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-10 sm:px-10">
        <p className="text-[#f2efe3]/70">
          Already own it? Open the game and type this under{" "}
          <span className="text-[#f2efe3]">Another trip</span>.
        </p>
        <CodeChip code={code} />
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="border-t border-[#f2efe3]/15">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <Offer />
        <div
          className={`${MONO} mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-[#f2efe3]/50`}
        >
          {/* Terms and privacy belong here too. The text lives as markdown in
              the game repo (docs/legal/) and needs a home on the web before the
              Discord application's own fields can point at it. Not linked until
              it has one: a dead legal link is worse than a missing one. */}
          <a href={RIVER.itchUrl} className="hover:text-[#f2efe3]">
            itch.io
          </a>
          <Link href="/" className="ml-auto hover:text-[#f2efe3]">
            benadams.dev
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * The one call to action. Every branch says where the game actually is today,
 * because a button promising a download that does not exist yet costs more than
 * no button.
 */
function Offer() {
  if (RIVER.mode === "demo" && RIVER.demoUrl) {
    return (
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Primary href={RIVER.demoUrl}>Play free</Primary>
        <Secondary href={RIVER.couponUrl || RIVER.itchUrl}>
          {RIVER.couponUrl ? `Full game, ${RIVER.couponLabel}` : "Full game"}
        </Secondary>
      </div>
    );
  }

  if (RIVER.mode === "paid") {
    return (
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Primary href={RIVER.couponUrl || RIVER.itchUrl}>
          {RIVER.couponUrl ? `Get the game, ${RIVER.couponLabel}` : "Get the game"}
        </Primary>
        {RIVER.couponUrl ? (
          <span className={`${MONO} text-xs text-[#f2efe3]/50`}>
            Discount is in the link. Nothing to type.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <Primary href={RIVER.interestUrl}>See it on itch.io</Primary>
      <span className={`${MONO} text-xs text-[#f2efe3]/50`}>Still in testing.</span>
    </div>
  );
}

function Primary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="bg-[#e2650f] px-7 py-3.5 text-base font-semibold tracking-wide text-[#12100c] uppercase transition-colors hover:bg-[#f2efe3]"
    >
      {children}
    </a>
  );
}

function Secondary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="border border-[#f2efe3]/40 px-7 py-3.5 text-base tracking-wide uppercase transition-colors hover:border-[#f2efe3] hover:bg-[#f2efe3]/10"
    >
      {children}
    </a>
  );
}
