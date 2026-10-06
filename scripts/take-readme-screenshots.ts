import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const OUTPUT_DIR = join(__dirname, "..", "public", "readme");

// The README leads with one picture of the homepage. Every other image in it
// is a project screenshot that already lives under /public for the site.
const HOMEPAGE_HEIGHT = 1500;

async function waitForPage(page: Page, timeout = 3000) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(timeout);
}

async function captureHomepage(page: Page) {
  console.log("📸 Capturing homepage...");
  await page.goto(BASE_URL);
  await waitForPage(page, 4000);

  // The dev server's indicator would otherwise sit in the corner of the shot.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  // Scroll through the page so every whileInView section has animated in.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
  }

  // Start the shot at the grid, below the full-screen hero.
  const top = await page.evaluate(() => window.innerHeight);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: join(OUTPUT_DIR, "homepage.png"),
    type: "png",
    fullPage: true,
    clip: { x: 0, y: top - 24, width: VIEWPORT.width, height: HOMEPAGE_HEIGHT },
  });
  console.log("  ✅ homepage.png");
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

    console.log("\n✅ All screenshots captured!");
  } catch (error) {
    console.error("\n❌ Screenshot capture failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
