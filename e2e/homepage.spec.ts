import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FRAMES = process.env.MUSEUM_FRAMES_DIR ?? 'test-results/frames';

/* The homepage: the original hero, then a full-screen poster that links to the game, then the catalogue. */
test.describe('homepage', () => {
  test('hero first (the h1), then the game section, then the catalogue', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('benadams.dev');
    const order = await page.evaluate(() => {
      const top = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().top + window.scrollY;
      return [top('h1'), top('section#game'), top('#catalogue')];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    await expect(page.locator('#oathkeep')).toBeAttached();
    await expect(page.getByRole('link', { name: 'Resume' })).toHaveCount(0);
  });

  test('the game section is full bleed, with a Game version link to /museum and no engine', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => {
      if (/\/museum\/[0-9a-f]+\/museum\.|\/songs\/[\w-]+\.mp3/.test(r.url())) requested.push(r.url());
    });
    await page.goto('/');
    const section = page.locator('section#game');
    const link = section.getByRole('link', { name: 'Game version' });
    await expect(link).toHaveAttribute('href', '/museum');
    await expect(section).toContainText(/About \d+ MB download/);
    await expect(section.locator('p', { hasText: 'Ben Adams' })).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /music/i })).toHaveCount(0);
    const box = (await section.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(Math.abs(box.height - vp.height)).toBeLessThanOrEqual(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const lb = (await link.boundingBox())!;
    expect(lb.height).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(1000);
    expect(requested).toEqual([]);
  });

  test('screenshots of the hero and the game section, and the scroll arrow reaches the section', async ({ page }, info) => {
    mkdirSync(FRAMES, { recursive: true });
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-home-hero.png`) });
    await page.evaluate(() => document.getElementById('game')!.scrollIntoView());
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-home-game.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.locator('svg.text-gray-400').locator('xpath=..').click();
    await expect.poll(() => page.evaluate(() => document.getElementById('game')!.getBoundingClientRect().top), { timeout: 5000 }).toBeLessThan(5);
  });

  test('the Game version link opens /museum', async ({ page }) => {
    await page.route('**/museum/*/museum.*', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.goto('/');
    await page.locator('section#game').getByRole('link', { name: 'Game version' }).click();
    await expect(page).toHaveURL(/\/museum$/);
    await expect(page.locator('section#museum')).toBeVisible();
  });

  test('the museum is not in the sitemap', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(await res.text()).not.toContain('/museum');
  });
});
