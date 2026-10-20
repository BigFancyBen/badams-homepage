import type { Metadata, Viewport } from "next";
import { JsonLd } from "../components/JsonLd";
import { pageMetadata, webAppJsonLd } from "../site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = pageMetadata("/floatwise", {
  image: {
    url: "/floatwise/forecast.webp",
    width: 1280,
    height: 720,
    alt: "FloatWise forecast table with hourly temperature, wind, and precipitation for eight Yellowstone River towns, plus the live river flow",
  },
  keywords:
    "weather, hourly forecast, wind, temperature, float trip, river flow, Yellowstone River, Open-Meteo, USGS",
});

export default function FloatWiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={webAppJsonLd("/floatwise", "WeatherApplication", "/floatwise/forecast.webp")} />
      {children}
    </>
  );
}
