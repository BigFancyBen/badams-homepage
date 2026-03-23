import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const OUTPUT_DIR = join(__dirname, "..", "public", "readme");

async function waitForPage(page: Page, timeout = 3000) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(timeout);
}

async function captureHomepage(page: Page) {
  console.log("📸 Capturing homepage...");
  await page.goto(BASE_URL);
  await waitForPage(page, 4000);

  // Scroll past hero to the bento grid
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: join(OUTPUT_DIR, "homepage.png"),
    type: "png",
    fullPage: true,
  });
  console.log("  ✅ homepage.png");
}

async function captureResume(page: Page) {
  console.log("📸 Capturing resume...");
  await page.goto(`${BASE_URL}/resume`);
  await waitForPage(page, 3000);

  await page.screenshot({
    path: join(OUTPUT_DIR, "resume.png"),
    type: "png",
  });
  console.log("  ✅ resume.png");
}

async function captureFloatWise(page: Page) {
  console.log("📸 Capturing FloatWise...");
  await page.goto(`${BASE_URL}/floatwise`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForPage(page);

  await page.screenshot({
    path: join(OUTPUT_DIR, "floatwise.png"),
    type: "png",
  });
  console.log("  ✅ floatwise.png");
}

async function captureDotaRandomizer(page: Page) {
  console.log("📸 Capturing Dota Randomizer...");
  await page.goto(`${BASE_URL}/dota-randomizer`);
  await waitForPage(page, 5000);

  await page.screenshot({
    path: join(OUTPUT_DIR, "dota-randomizer.png"),
    type: "png",
  });
  console.log("  ✅ dota-randomizer.png");
}

async function main() {
  console.log("🚀 Starting README screenshot capture...");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    try {
      await page.goto(BASE_URL, { timeout: 5000 });
    } catch {
      console.error("❌ Dev server not running. Start it with: npm run dev");
      process.exit(1);
    }

    await captureHomepage(page);
    await captureResume(page);
    await captureFloatWise(page);
    await captureDotaRandomizer(page);

    console.log("\n✅ All screenshots captured!");
  } catch (error) {
    console.error("\n❌ Screenshot capture failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
