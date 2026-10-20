import type { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";

export const metadata: Metadata = pageMetadata("/dota-randomizer", {
  image: {
    url: "/dota-randomizer/wheels.webp",
    width: 1280,
    height: 720,
    alt: "Dota 2 Randomizer showing the hero and item wheels with Phantom Lancer and Urn of Shadows selected",
  },
  keywords:
    "dota 2, randomizer, hero picker, item picker, dota challenge",
});

export default function DotaRandomizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={webAppJsonLd("/dota-randomizer", "GameApplication", "/dota-randomizer/wheels.webp")} />
      {children}
    </>
  );
}
