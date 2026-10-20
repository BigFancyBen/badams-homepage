import type { Metadata, Viewport } from "next";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = pageMetadata("/commander", {
  image: {
    url: "/magic/commander.webp",
    width: 960,
    height: 720,
    alt: "MTG Commander Life Tracker screenshot",
  },
  keywords:
    "MTG, Magic The Gathering, Commander, EDH, life tracker, commander damage, poison counters, life counter",
});

export default function CommanderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={webAppJsonLd("/commander", "GameApplication", "/magic/commander.webp")} />
      {children}
    </>
  );
}
