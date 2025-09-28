import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FloatWise | NOAA Weather Tracker | badams-homepage",
  description: "Track weather conditions from NOAA data across multiple locations. View temperature and wind forecasts from 10am-7pm for planning your day on the water.",
  keywords: "NOAA, weather, marine forecast, wind, temperature, float trip, river conditions, weather tracker",
  openGraph: {
    title: "FloatWise - NOAA Weather Tracker",
    description: "Track weather conditions from NOAA data for multiple locations with detailed hourly forecasts",
    type: "website",
    siteName: "badams-homepage",
  },
  twitter: {
    card: "summary",
    title: "FloatWise - NOAA Weather Tracker",
    description: "NOAA weather tracking for multiple locations with hourly forecasts",
  },
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
};

export default function FloatWiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}