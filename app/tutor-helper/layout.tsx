import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Magic Tutor Helper",
  description:
    "Browse and filter Magic: The Gathering cards with advanced search capabilities.",
  openGraph: {
    title: "Magic Tutor Helper",
    description:
      "Browse and filter Magic: The Gathering cards with advanced search capabilities",
    type: "website",
    siteName: "badams-homepage",
    images: [
      {
        url: "/magic/tutor-helper.webp",
        width: 960,
        height: 720,
        alt: "Magic Tutor Helper screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magic Tutor Helper",
    description:
      "Browse and filter Magic: The Gathering cards with advanced search capabilities",
    images: ["/magic/tutor-helper.webp"],
  },
};

export default function TutorHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
