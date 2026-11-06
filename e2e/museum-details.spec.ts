import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/* The project details panel, checked against a stand-in for the Godot engine (see museum.spec.ts). */
const SHOTS = process.env.MUSEUM_DETAILS_SHOTS_DIR;

async function enterStub(page: Page) {
  await page.route('**/museum/*/museum.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.Engine = class { startGame() { window.museumBridge.onReady(); return Promise.resolve(); } requestQuit() {} };',
    }),
  );
  await page.goto('/museum');
  await expect(page.locator('canvas')).toHaveCSS('opacity', '1');
}

const drain = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (let c = window.museumBridge!.pollCommand(); c; c = window.museumBridge!.pollCommand()) out.push(c);
    return out;
  });
const tour = (page: Page, state: string) => page.evaluate((s) => window.museumBridge!.onTour(s), state);
const focus = (page: Page, id: string) => page.evaluate((i) => window.museumBridge!.onFocus(i), id);
const rightInset = (page: Page) => page.evaluate(() => window.museumBridge!.rightInset());
const bottomInset = (page: Page) => page.evaluate(() => window.museumBridge!.bottomInset());
/* Real touch gestures over CDP, so the page sees pointer and touch events like a phone does. */
async function swipe(page: Page, x: number, y0: number, y1: number) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x, y }] });
  await send('touchStart', y0);
  for (let i = 1; i <= 6; i++) await send('touchMove', y0 + ((y1 - y0) * i) / 6);
  await send('touchEnd');
  await cdp.detach();
}
const swipeDown = (page: Page, x: number, y: number) => swipe(page, x, y, y + 80);
const swipeUp = (page: Page, x: number, y: number) => swipe(page, x, y, y - 80);
const panel = (page: Page) => page.getByRole('complementary');
/* On phones the sheet opens as a slim bar; unfold it to read or click the body (desktop: no-op). */
const unfold = async (page: Page) => {
  if (page.viewportSize()!.width < 640) {
    const b = page.getByRole('button', { name: 'Expand project details' });
    await expect(b).toBeVisible();
    await b.click();
    await page.waitForTimeout(450);
  }
  await expect(page.getByRole('button', { name: 'Close project details' })).toBeVisible();
};

test.describe('museum project details (stub engine)', () => {
  test('arriving at an exhibit opens the panel with its homepage copy, after a short delay', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'mfrs');
    /* Not at once: a fly-by must not flash it. */
    await expect(panel(page)).toHaveCount(0);
    const p = panel(page);
    await expect(p).toBeVisible();
    await expect(p).toHaveAccessibleName(/Middle Fork Rafting Simulator/);
    await expect(p.getByRole('heading', { name: 'Middle Fork Rafting Simulator', level: 2 })).toBeVisible();
    await unfold(page);
    await expect(p).toContainText('A co-op rafting game where everyone paddles the same raft.');
    await expect(p).toContainText("A multiplayer rafting game I'm making in Godot.");
    await expect(p).toContainText('Join by code.');
    await expect(p).toContainText('Host-authoritative netcode');
    await expect(p.getByRole('link', { name: /Game page/ })).toHaveAttribute('target', '_blank');
    await expect(p.getByRole('link', { name: 'itch.io page' })).toHaveAttribute('href', /itch\.io/);
    /* Opening it does not touch the tour. */
    expect(await drain(page)).toEqual([]);
  });

  test('every exhibit shows the title the homepage gives it', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    const titles: Record<string, string> = {
      mfrs: 'Middle Fork Rafting Simulator',
      oathkeep: 'Oathkeep',
      prognosticator: 'Prognosticator',
      warehouse: 'Warehouse',
      'hobbit-house': 'hobbit.house',
      testq: 'testq',
      scrandle: 'Scrandle',
      'yut-hut': 'Yut Hut',
      magic: 'Magic: The Gathering',
      floatwise: 'FloatWise',
      'dota-randomizer': 'Dota 2 Randomizer',
      irlscape: 'IRLScape',
      resume: 'Résumé',
    };
    expect(Object.keys(titles)).toHaveLength(13);
    for (const [id, title] of Object.entries(titles)) {
      await focus(page, id);
      await expect(panel(page).getByRole('heading', { name: title, level: 2, exact: true })).toBeVisible();
    }
    /* A group shows what the grid shows for it. */
    await focus(page, 'magic');
    await expect(panel(page)).toBeVisible();
    await unfold(page);
    await expect(panel(page).getByRole('heading', { name: 'MTG Token Helper' })).toBeVisible();
    await focus(page, 'scrandle');
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeVisible();
    await unfold(page);
    await expect(panel(page).getByRole('heading', { name: 'Scranbot' })).toBeVisible();
    await focus(page, 'resume');
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeVisible();
    await unfold(page);
    await expect(panel(page).getByRole('link', { name: 'Resume', exact: true })).toHaveAttribute('href', '/resume');
    await expect(panel(page).getByRole('link')).toHaveCount(1);
  });

  test('when focus leaves for the stage, the entrance or another exhibit, the panel goes', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'oathkeep');
    await expect(panel(page)).toBeVisible();
    await focus(page, 'stage');
    await expect(panel(page)).toHaveCount(0);
    await focus(page, 'testq');
    await expect(panel(page).getByRole('heading', { name: 'testq' })).toBeVisible();
    await focus(page, '');
    await expect(panel(page)).toHaveCount(0);
    await focus(page, 'floatwise');
    await expect(panel(page).getByRole('heading', { name: 'FloatWise' })).toBeVisible();
    await focus(page, 'dota-randomizer');
    await expect(panel(page).getByRole('heading', { name: 'Dota 2 Randomizer' })).toBeVisible();
    await expect(panel(page)).toHaveCount(1);
  });

  test('the stage and the entrance show no panel', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'stage');
    await focus(page, 'stage');
    await page.waitForTimeout(800);
    await expect(panel(page)).toHaveCount(0);
    await tour(page, 'touring');
    await focus(page, 'stage');
    await page.waitForTimeout(800);
    await expect(panel(page)).toHaveCount(0);
    await tour(page, 'end');
    await focus(page, '');
    await page.waitForTimeout(800);
    await expect(panel(page)).toHaveCount(0);
    expect(await rightInset(page)).toBe(0);
  });

  test('the x closes it until focus changes; paused and end states open it too', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'paused');
    await focus(page, 'mfrs');
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Close project details' }).click();
    await expect(panel(page)).toHaveCount(0);
    await page.waitForTimeout(900);
    await expect(panel(page)).toHaveCount(0);
    /* Tour state changes do not reopen it. */
    await tour(page, 'touring');
    await page.waitForTimeout(600);
    await expect(panel(page)).toHaveCount(0);
    /* Another exhibit does, and coming back to the first opens it again. */
    await focus(page, 'oathkeep');
    await expect(panel(page).getByRole('heading', { name: 'Oathkeep' })).toBeVisible();
    await focus(page, 'mfrs');
    await expect(panel(page).getByRole('heading', { name: 'Middle Fork Rafting Simulator' })).toBeVisible();
    await tour(page, 'end');
    await focus(page, 'resume');
    await expect(panel(page).getByRole('heading', { name: 'Résumé' })).toBeVisible();
  });

  test('Esc closes it, and the page is not a dialog: no modal, no focus trap', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'testq');
    await expect(panel(page)).toBeVisible();
    await unfold(page);
    await expect(panel(page)).not.toHaveAttribute('aria-modal', 'true');
    /* Tab moves on past the panel to the controls underneath. */
    await panel(page).getByRole('button', { name: 'Close project details' }).focus();
    await page.keyboard.press('Tab');
    await expect(panel(page).getByRole('link', { name: /Source on GitHub/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Previous exhibit' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
  });

  test('links go through the Leave the game? modal, and staying keeps the panel', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'mfrs');
    await expect(panel(page)).toBeVisible();
    await unfold(page);
    await drain(page);
    await panel(page).getByRole('link', { name: 'itch.io page' }).click();
    expect(await drain(page)).toEqual(['tour:pause']);
    const modal = page.getByRole('dialog', { name: 'Leave the game?' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Opens Middle Fork Rafting Simulator in a new tab.');
    const go = modal.getByRole('link', { name: 'Open project' });
    await expect(go).toHaveAttribute('href', 'https://bigfancyben.itch.io/middle-fork-rafting-simulator');
    await expect(go).toHaveAttribute('target', '_blank');
    await expect(go).toHaveAttribute('rel', /noopener/);
    await modal.getByRole('button', { name: 'Stay' }).click();
    await expect(modal).toBeHidden();
    expect(await drain(page)).toEqual(['tour:play']);
    await expect(panel(page)).toBeVisible();
    /* A group's own links go through it too, titled with the app. */
    await focus(page, 'magic');
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeVisible();
    await unfold(page);
    const viewLink = panel(page).getByRole('link', { name: 'View project →' }).first();
    /* Scroll the sheet's own scroller to the link (Playwright's default would scroll the page too). */
    await viewLink.evaluate((el) => {
      const sc = el.closest('div.overflow-y-auto') as HTMLElement;
      sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 20;
    });
    await viewLink.click();
    await expect(modal).toContainText('Opens MTG Commander Scorekeeper in a new tab.');
    await expect(modal.getByRole('link', { name: 'Open project' })).toHaveAttribute('href', '/commander');
  });

  test('rightInset is the open desktop panel, else 0 (and always 0 on phones)', async ({ page }, info) => {
    await enterStub(page);
    expect(await rightInset(page)).toBe(0);
    await tour(page, 'touring');
    expect(await rightInset(page)).toBe(0);
    await focus(page, 'mfrs');
    await expect(panel(page)).toBeVisible();
    const phone = info.project.name !== 'chromium';
    if (phone) {
      expect(await rightInset(page)).toBe(0);
      return;
    }
    const box = (await panel(page).boundingBox())!;
    await expect.poll(() => rightInset(page)).toBeGreaterThanOrEqual(380);
    const inset = await rightInset(page);
    expect(inset).toBeLessThanOrEqual(380 + 40);
    /* The panel really does cover that strip. */
    const vw = page.viewportSize()!.width;
    expect(vw - box.x).toBeCloseTo(inset, -1);
    expect(box.width).toBeCloseTo(380, 0);
    await panel(page).getByRole('button', { name: 'Close project details' }).click();
    await expect(panel(page)).toHaveCount(0);
    expect(await rightInset(page)).toBe(0);
    await focus(page, 'stage');
    expect(await rightInset(page)).toBe(0);
  });

  test('phones: the sheet opens as a slim bar, unfolds to at most 40% high, scrolls inside, folds on a swipe down', async ({ page }, info) => {
    test.skip(info.project.name === 'chromium', 'phone projects only');
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'stage');
    const navEl = page.getByRole('navigation', { name: 'Museum navigation' });
    await expect(navEl).toBeVisible();
    const bare = await bottomInset(page);
    expect(bare).toBeGreaterThanOrEqual(44);
    await focus(page, 'prognosticator');
    const sheet = panel(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Prognosticator', level: 2 })).toBeInViewport();
    const vh = page.viewportSize()!.height;
    const nav = (await navEl.boundingBox())!;
    const height = () => sheet.evaluate((el) => el.getBoundingClientRect().height);
    /* Folded: a slim bar with the title, sitting on the nav, opaque. */
    await expect.poll(height).toBeGreaterThan(50);
    expect(await height()).toBeLessThanOrEqual(90);
    const peekBox = (await sheet.boundingBox())!;
    expect(peekBox.y + peekBox.height).toBeLessThanOrEqual(nav.y + 1);
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgb\(/);
    await expect(sheet.getByRole('button', { name: 'Expand project details' })).toBeVisible();
    await expect(sheet.getByRole('link').first()).toBeHidden();
    const peekInset = await bottomInset(page);
    expect(peekInset).toBeGreaterThan(bare + 40);
    expect(peekInset).toBeLessThanOrEqual(bare + 100);
    expect(await rightInset(page)).toBe(0);
    /* A tap on the bar unfolds it, capped at 40svh, and the inset follows. */
    await sheet.getByRole('heading', { name: 'Prognosticator', level: 2 }).click();
    await expect.poll(height).toBeGreaterThan(vh * 0.25);
    await page.waitForTimeout(400);
    expect(await height()).toBeLessThanOrEqual(vh * 0.4 + 1);
    expect(await bottomInset(page)).toBeGreaterThan(peekInset + 100);
    const box = (await sheet.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
    /* The body scrolls inside the sheet and never moves the page. */
    const scroller = sheet.locator('div.overflow-y-auto');
    expect(await scroller.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe('contain');
    expect(await scroller.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
    const scrollY = await page.evaluate(() => window.scrollY);
    await scroller.hover();
    await page.mouse.wheel(0, 2000);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(200);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await expect(sheet.getByRole('heading', { name: 'Prognosticator', level: 2 })).toBeInViewport();
    /* A swipe down on the bar folds it. */
    const bar = (await sheet.getByRole('heading', { level: 2 }).boundingBox())!;
    await swipeDown(page, bar.x + bar.width / 2, bar.y + 4);
    await expect.poll(height).toBeLessThanOrEqual(90);
    await expect.poll(() => bottomInset(page)).toBe(peekInset);
    /* A swipe up unfolds it again. */
    const folded = (await sheet.getByRole('heading', { level: 2 }).boundingBox())!;
    await swipeUp(page, folded.x + folded.width / 2, folded.y + 4);
    await expect.poll(height).toBeGreaterThan(vh * 0.25);
    /* A new exhibit starts folded. */
    await focus(page, 'warehouse');
    await expect(sheet.getByRole('heading', { name: 'Warehouse', level: 2 })).toBeVisible();
    await expect.poll(height).toBeLessThanOrEqual(90);
    /* Closed, the inset falls back. */
    await sheet.getByRole('button', { name: 'Close project details' }).click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => bottomInset(page)).toBe(bare);
  });

  test('the song is fetched once when the game starts, muted, and unmuting reuses it', async ({ page }, info) => {
    let hits = 0;
    await page.route('**/songs/*.mp3', async (route) => {
      hits++;
      /* A real (silent, 1 s) WAV body is enough: decodeAudioData reads the bytes, not the extension. */
      const n = 8000;
      const buf = Buffer.alloc(44 + n, 128);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(36 + n, 4);
      buf.write('WAVEfmt ', 8);
      buf.writeUInt32LE(16, 16);
      buf.writeUInt16LE(1, 20);
      buf.writeUInt16LE(1, 22);
      buf.writeUInt32LE(8000, 24);
      buf.writeUInt32LE(8000, 28);
      buf.writeUInt16LE(1, 32);
      buf.writeUInt16LE(8, 34);
      buf.write('data', 36);
      buf.writeUInt32LE(n, 40);
      await route.fulfill({ contentType: 'audio/wav', body: buf });
    });
    await enterStub(page);
    await expect.poll(() => hits).toBe(1);
    await page.waitForTimeout(500);
    expect(hits).toBe(1);
    await page.getByRole('button', { name: 'Play music' }).first().click();
    await expect(page.getByRole('button', { name: 'Mute music' }).first()).toBeVisible({ timeout: 1500 });
    expect(hits).toBe(1);
    void info;
  });

  test('reduced motion: the panel appears without sliding', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'scrandle');
    const p = panel(page);
    await expect(p).toBeVisible();
    /* No transform mid-flight: the first frame it exists is already in place. */
    await expect.poll(() => p.evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test('screenshots', async ({ page }, info) => {
    test.skip(!SHOTS, 'set MUSEUM_DETAILS_SHOTS_DIR to save frames');
    mkdirSync(SHOTS!, { recursive: true });
    await enterStub(page);
    await tour(page, 'touring');
    for (const id of ['mfrs', 'warehouse', 'magic']) {
      await focus(page, id);
      await expect(panel(page)).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(SHOTS!, `${info.project.name}-${id}-collapsed.png`) });
      await unfold(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(SHOTS!, `${info.project.name}-${id}.png`) });
    }
  });
});
