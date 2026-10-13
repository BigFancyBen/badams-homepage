import type { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";

export const metadata: Metadata = pageMetadata("/token-helper", {
  image: {
    url: "/magic/token-helper.webp",
    width: 960,
    height: 720,
    alt: "MTG Token Helper screenshot",
  },
});

export default function TokenHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={webAppJsonLd("/token-helper", "GameApplication", "/magic/token-helper.webp")} />
      {children}
    </>
  );
}
