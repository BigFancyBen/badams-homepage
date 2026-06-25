import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for the FloatWise Android app.
 *
 * `webDir` is the static export produced by `npm run build:mobile`
 * (scripts/build-mobile.mjs). The app loads index.html, which redirects to the
 * bundled /floatwise/ route — so the UI and GPS track recording work fully
 * offline; only live weather/tiles need a network.
 *
 * Background location is provided by @capacitor-community/background-geolocation
 * (configured at runtime in the watcher; see app/floatwise/hooks/useFloatTracker.ts).
 */
const config: CapacitorConfig = {
  appId: "dev.benadams.floatwise",
  appName: "FloatWise",
  webDir: "out",
  android: {
    // Keep the WebView from being recycled aggressively while tracking.
    backgroundColor: "#1f2937",
  },
};

export default config;
