import type { Metadata } from "next";
import { Bungee } from "next/font/google";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";
import "./clave-boss.css";

const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bungee",
  display: "swap",
});

export const metadata: Metadata = pageMetadata("/clave-boss", {
  keywords: "salsa, salsa footwork, mambo basic, on2, rhythm game, osrs, tick, boss trainer",
});

export default function ClaveBossLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={bungee.variable}>
      <JsonLd data={webAppJsonLd("/clave-boss", "GameApplication")} />
      {children}
    </div>
  );
}
