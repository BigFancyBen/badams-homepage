import { chromium, type Page } from "playwright";

const BASE_URL = "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const ARCHIDEKT_URL = "https://archidekt.com/decks/11819322/portland";

async function clearAndNavigate(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState("networkidle");
}

async function captureTutorHelper(page: Page) {
  console.log("📸 Capturing Tutor Helper...");
  await clearAndNavigate(page, "/tutor-helper");

  // Click "Add Your First Deck" button
  await page.click('button:has-text("Add Your First Deck")');
  await page.waitForTimeout(500);

  // Fill Archidekt URL and import
  await page.fill(
    'input[placeholder="https://archidekt.com/decks/..."]',
    ARCHIDEKT_URL
  );
  await page.click(
    'button:has-text("Import"):not(:has-text("Import Decklist"))'
  );

  // Wait for cards to load from Scryfall (can be slow)
  console.log("  Waiting for Scryfall card data...");
  await page.waitForTimeout(3000);
  await page.waitForLoadState("networkidle");
  // Wait for card images to appear in the grid
  await page.waitForSelector("img", { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Close the manage decks modal
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Click mana cost "3" filter button
  // Mana cost buttons are in the filter section; find the one with exact text "3"
  const manaCostButtons = page.locator(
    'button:has-text("3"):not(:has-text("30"))'
  );
  const allButtons = await manaCostButtons.all();
  for (const btn of allButtons) {
    const text = await btn.textContent();
    if (text?.trim() === "3") {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(500);

  // Click "Enchantment" type filter button
  await page.click('button:has-text("Enchantment")');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: "public/magic/tutor-helper.png",
    type: "png",
  });
  console.log("  ✅ tutor-helper.png saved");
}

async function captureCommander(page: Page) {
  console.log("📸 Capturing Commander...");
  await clearAndNavigate(page, "/commander");

  // Open settings
  await page.click('button[title="Game Settings"]');
  await page.waitForTimeout(500);

  // Set player names
  const nameInputs = page.locator('input[type="text"]');
  const names = ["Ben", "Jake", "Mike", "Sarah"];
  const inputCount = await nameInputs.count();
  for (let i = 0; i < Math.min(inputCount, names.length); i++) {
    await nameInputs.nth(i).fill(names[i]);
  }

  // Close settings
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Adjust life totals:
  // Player 1 (Jake, index 1): 38 → click -1 twice
  await page.click('[data-testid="life-minus-1-1"]');
  await page.click('[data-testid="life-minus-1-1"]');

  // Player 2 (Mike, index 2): 35 → click -5 once
  await page.click('[data-testid="life-minus-5-2"]');

  // Player 3 (Sarah, index 3): 42 → click +1 twice
  await page.click('[data-testid="life-plus-1-3"]');
  await page.click('[data-testid="life-plus-1-3"]');

  await page.waitForTimeout(500);

  await page.screenshot({
    path: "public/magic/commander.png",
    type: "png",
  });
  console.log("  ✅ commander.png saved");
}

async function captureTokenHelper(page: Page) {
  console.log("📸 Capturing Token Helper...");
  await clearAndNavigate(page, "/token-helper");

  // Click "Import a Deck" button (empty state)
  await page.click('button:has-text("Import a Deck")');
  await page.waitForTimeout(500);

  // Fill Archidekt URL and import
  await page.fill(
    'input[placeholder="https://archidekt.com/decks/..."]',
    ARCHIDEKT_URL
  );
  await page.click(
    'button:has-text("Import"):not(:has-text("Import Decklist"))'
  );

  // Wait for token discovery (hits Scryfall for each card, can be very slow)
  console.log("  Waiting for token discovery (this may take a while)...");
  await page.waitForTimeout(5000);

  // Wait for the token picker modal to auto-open
  // Look for "Add Selected" or discovered tokens header
  try {
    await page.waitForSelector('text="Discovered Tokens"', { timeout: 120000 });
    console.log("  Token discovery complete, picker modal open");
  } catch {
    console.log("  Token discovery timed out, trying to continue...");
  }

  await page.waitForTimeout(1000);

  // Select all tokens if "Select All" is available
  const selectAllBtn = page.locator('button:has-text("Select All")');
  if ((await selectAllBtn.count()) > 0) {
    await selectAllBtn.click();
    await page.waitForTimeout(500);
  }

  // Click "Add Selected" to add tokens to battlefield
  const addBtn = page.locator('button:has-text("Add Selected")');
  if ((await addBtn.count()) > 0) {
    await addBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({
    path: "public/magic/token-helper.png",
    type: "png",
  });
  console.log("  ✅ token-helper.png saved");
}

async function main() {
  console.log("🚀 Starting Magic screenshot capture...");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    // Verify dev server is running
    try {
      await page.goto(BASE_URL, { timeout: 5000 });
    } catch {
      console.error(
        "❌ Dev server not running. Start it with: npm run dev"
      );
      process.exit(1);
    }

    await captureTutorHelper(page);
    await captureCommander(page);
    await captureTokenHelper(page);

    console.log("\n✅ All screenshots captured successfully!");
  } catch (error) {
    console.error("\n❌ Screenshot capture failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
