import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "MTG Commander Life Tracker | badams-homepage",
  description: "Track life, commander damage, and poison counters for Magic: The Gathering Commander games. Features rotating quadrants, persistent game state, and mobile-optimized interface.",
  keywords: "MTG, Magic The Gathering, Commander, EDH, life tracker, commander damage, poison counters, life counter",
  openGraph: {
    title: "MTG Commander Life Tracker",
    description:
      "Professional MTG Commander life tracking app with persistent game state and mobile support",
    type: "website",
    siteName: "badams-homepage",
    images: [
      {
        url: "/magic/commander.webp",
        width: 960,
        height: 720,
        alt: "MTG Commander Life Tracker screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MTG Commander Life Tracker",
    description:
      "Track life, commander damage, and poison for MTG Commander games",
    images: ["/magic/commander.webp"],
  },
  robots: "index, follow",
};

export default function CommanderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
