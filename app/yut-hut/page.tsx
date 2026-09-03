import type { Metadata } from "next";
import { YutHutGuide } from "./components/YutHutGuide";

const title = "Yut Hut — the rules";
const description = "A workout-accountability campaign for the yut-hut channel";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
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

export default function YutHutPage() {
  return <YutHutGuide />;
}
