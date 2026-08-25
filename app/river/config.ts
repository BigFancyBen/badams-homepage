/**
 * Everything about the put-in page that changes when the store does.
 *
 * The game is not on sale yet — the itch page is restricted and the build is
 * still `0.1.0-spike` — so `mode` decides which call to action the page shows
 * and nothing else in the tree needs to know which world we are in.
 *
 *   restricted  the page is live before the store is: collect interest
 *   demo        a free channel exists, so lead with "get in the boat now"
 *   paid        the real thing, with `couponUrl` doing the discount
 */
export type StoreMode = "restricted" | "demo" | "paid";

export const RIVER = {
  mode: "restricted" as StoreMode,

  /** The itch project page. Public URL even while the project is restricted. */
  itchUrl: "https://bigfancyben.itch.io/middle-fork-rafting-simulator",

  /**
   * An itch coupon is a private sale with its own URL, built from the username
   * and the code — visiting it *is* the redemption, so this link is the whole
   * of the discount. That is fine here: this page hands it to people who were
   * invited onto somebody's trip, and a coupon that leaks is a coupon that
   * worked. Cap the redeems on itch if that ever stops being true.
   */
  couponUrl: "",
  couponLabel: "25% off",

  /** The free channel, once there is one. Empty means the page won't offer it. */
  demoUrl: "",

  /** Where somebody who wants to know when it opens should go. */
  interestUrl: "https://bigfancyben.itch.io/middle-fork-rafting-simulator",

  /**
   * The URI scheme the game registers with the OS at first run. A link to
   * `mfrs://join/<code>` is what hands a trip code to an installed copy — and
   * it is the only way this page can tell "installed" from "not" without
   * asking, because a browser will not answer that question directly.
   */
  scheme: "mfrs",

  /**
   * How long to wait for the handoff before deciding nothing took it. Long
   * enough that a cold-starting game still counts, short enough that nobody
   * reads it as the page being broken. The marketing below is on screen the
   * whole time regardless — this only governs one line of copy.
   */
  handoffMs: 1600,

  /**
   * The two blanks the legal text ships with. The markdown in
   * `app/river/legal/` writes them as `[SUPPORT EMAIL]` and `[STATE/COUNTRY]`;
   * fill these in and every occurrence across all three documents follows.
   * Left empty, the brackets render in orange so an unfinished policy cannot
   * pass for a finished one.
   */
  legal: {
    supportEmail: "",
    jurisdiction: "",
  },
} as const;
