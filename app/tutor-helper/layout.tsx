import type { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";

export const metadata: Metadata = pageMetadata("/tutor-helper", {
  image: {
    url: "/magic/tutor-helper.webp",
    width: 960,
    height: 720,
    alt: "Magic Tutor Helper screenshot",
  },
});

export default function TutorHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={webAppJsonLd("/tutor-helper", "GameApplication", "/magic/tutor-helper.webp")} />
      {children}
    </>
  );
}
