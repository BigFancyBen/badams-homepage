import { NextResponse } from "next/server";
import { tripCodeFromSecret } from "../trip-code";

/**
 * Where Discord sends somebody who accepted an invite it could not hand to a
 * running copy of the game.
 *
 * The live URL is `/river/_discord/join?secret=mfrs1:FrothGorgeSurf` — Discord
 * appends that path to the Deep Link URL configured on the application, so the
 * portal field is `https://benadams.dev/river` and a rewrite in
 * `next.config.ts` puts it here.
 *
 * All this does is unwrap the envelope and hand the code to the put-in page,
 * which is the one place that decides between opening the game and selling it.
 * A secret from a build we do not know unwraps to nothing and lands on the same
 * page without a code, which is the right outcome: marketing rather than an
 * error, for somebody whose only mistake was clicking a friend's invite.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  const code = tripCodeFromSecret(secret);
  const target = code ? `/river/join/${code}` : "/river";
  return NextResponse.redirect(new URL(target, request.url), 302);
}
