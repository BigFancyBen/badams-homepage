import type { Metadata } from "next";
import { PutIn } from "../../components/PutIn";
import { isTripCode } from "../../trip-code";

/**
 * `/river/join/FrothGorgeSurf` — the link a player hands to a friend, and where
 * the Discord deep link lands after unwrapping its secret.
 *
 * A code that is not shaped like one of ours renders the same page without it.
 * Somebody who followed a mangled link should still see the game rather than a
 * 404, and the trip board will tell them the truth if they type it in anyway.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  if (!isTripCode(code)) return {};
  return {
    title: `Join ${code} — Middle Fork Rafting Simulator`,
    description: `Somebody is on the water on trip ${code}. There is a seat on the thwart.`,
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PutIn code={isTripCode(code) ? code : undefined} />;
}
