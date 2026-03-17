import { Metadata } from "next";

export const metadata: Metadata = {
  title: "MTG Token Helper",
  description:
    "Import a deck, discover tokens it produces, and track them on the battlefield.",
  openGraph: {
    title: "MTG Token Helper",
    description:
      "Import a deck, discover tokens it produces, and track them on the battlefield",
    type: "website",
    siteName: "badams-homepage",
    images: [
      {
        url: "/magic/token-helper.webp",
        width: 960,
        height: 720,
        alt: "MTG Token Helper screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MTG Token Helper",
    description:
      "Import a deck, discover tokens it produces, and track them on the battlefield",
    images: ["/magic/token-helper.webp"],
  },
};

export default function TokenHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
