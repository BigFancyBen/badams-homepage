import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "benadams.dev",
  description:
    "I'm always tinkering with something",
  keywords: "web development, portfolio, tools, utilities",
  openGraph: {
    title: "benadams.dev",
    description:
      "I'm always tinkering with something",
    type: "website",
    siteName: "benadams.dev",
    images: [
      {
        url: "/og-homepage.png",
        width: 1200,
        height: 630,
        alt: "benadams.dev project showcase",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "benadams.dev",
    description:
      "I'm always tinkering with something",
    images: ["/og-homepage.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
