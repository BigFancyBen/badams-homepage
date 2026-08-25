import type { Metadata } from "next";
import { Archivo_Narrow, IBM_Plex_Mono } from "next/font/google";
import { SANS } from "./typography";

const archivo = Archivo_Narrow({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex",
  display: "swap",
});

const title = "Middle Fork Rafting Simulator";
const description =
  "Multiplayer whitewater. You and your friends crew one boat down an endless, procedurally generated river canyon.";

export const metadata: Metadata = {
  /* Discord unfurls these links in chat, so the card art has to resolve to an
     absolute URL rather than to whatever host rendered the page. */
  metadataBase: new URL("https://benadams.dev"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "benadams.dev",
    images: [{ url: "/river/og.jpg", width: 1200, height: 630, alt: "A paddle raft dropping into a whitewater reach" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/river/og.jpg"],
  },
};

export default function RiverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${archivo.variable} ${plexMono.variable} ${SANS} bg-[#0d1113] text-[#f2efe3]`}>
      {children}
    </div>
  );
}
