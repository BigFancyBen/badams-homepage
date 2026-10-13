import type { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { gameJsonLd } from "../site";
import { PutIn } from "./components/PutIn";
import { RIVER } from "./config";

/* Only the put-in page itself: a join link carries a trip code, and neither it
   nor the legal pages should claim to be this one. */
export const metadata: Metadata = { alternates: { canonical: "/river" } };

/**
 * `/river` on its own: the same page without a trip code. It is also the value
 * of the Deep Link URL field on the Discord application, since Discord builds
 * `/river/_discord/join?secret=...` off it.
 */
export default function RiverPage() {
  return (
    <>
      <JsonLd data={gameJsonLd("/river", "/river/og.jpg", RIVER.itchUrl)} />
      <PutIn />
    </>
  );
}
