import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dota 2 Randomizer | benadams.dev",
  description:
    "Spin the wheel to get a random Dota 2 hero and item combination for your next game challenge",
  keywords: "dota 2, randomizer, hero picker, item picker, dota challenge",
};

export default function DotaRandomizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
