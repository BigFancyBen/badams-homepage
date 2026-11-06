import type { Metadata, Viewport } from "next";
import { Museum } from "../components/museum/Museum";

/* The game is a page of its own: the homepage only links here. Not for search results (the
   catalogue on the homepage is the same work as plain HTML). */
export const metadata: Metadata = {
  title: "Game version",
  description: "A walkable 3D museum of Ben Adams's projects, lit to an original track.",
  alternates: { canonical: "/museum" },
  robots: { index: false, follow: true },
};

/* The game fills the screen edge to edge; its controls pad themselves with
   env(safe-area-inset-*), which only applies under viewport-fit=cover. */
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#06070a" };

export default function MuseumPage() {
  return (
    <main className="bg-[#06070a]">
      <h1 className="sr-only">Ben Adams: game version</h1>
      <Museum />
    </main>
  );
}
