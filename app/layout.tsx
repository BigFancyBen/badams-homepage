import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "badams-homepage",
  description: "Personal homepage and project showcase featuring web development tools and utilities",
  keywords: "web development, portfolio, tools, utilities",
  openGraph: {
    type: "website",
    siteName: "badams-homepage",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
