import type { Metadata } from "next";
import { ScrandlePlan } from "./components/ScrandlePlan";

const title = "Scrandle Build Plan | benadams.dev";
const description =
  "Build plan for a Scrandle-style food voting game: Discord photos ingested by a Cloudflare Worker, drops of 10 matchups, Elo standings, and a reveal at close.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "article",
    siteName: "benadams.dev",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function ScrandlePage() {
  return <ScrandlePlan />;
}
