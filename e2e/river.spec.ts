import { test, expect } from '@playwright/test';

/**
 * The put-in page, and the Discord deep link that feeds it.
 *
 * What matters here is the fallback: a browser with no `mfrs://` handler must
 * still show the game rather than a spinner or a dead end, because that is the
 * whole reason this page exists. The handoff attempt is fired on load and
 * nothing on the page waits for it.
 */

test('a join link shows the game to somebody who does not have it', async ({ page }) => {
  await page.goto('/river/join/FrothGorgeSurf');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('seat');
  await expect(page.getByRole('link', { name: /itch\.io/i }).first()).toBeVisible();

  // The trip code survives for anyone who owns the game and has to type it in.
  await expect(page.getByText('FrothGorgeSurf').first()).toBeVisible();

  // Nothing took the scheme, so the strip says so instead of promising a game.
  await expect(page.getByText('Nothing opened.')).toBeVisible({ timeout: 5000 });
});

test('a mangled code still lands on the game rather than a 404', async ({ page }) => {
  const response = await page.goto('/river/join/not-a-code');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One raft');
});

test('the Discord deep link unwraps a secret onto the trip', async ({ page }) => {
  await page.goto('/river/_discord/join?secret=mfrs1:PortageSieveBeater');

  await expect(page).toHaveURL(/\/river\/join\/PortageSieveBeater$/);
  await expect(page.getByText('PortageSieveBeater').first()).toBeVisible();
});

test('the legal pages serve, stay out of the index, and stay unlinked', async ({ page }) => {
  for (const [path, heading] of [
    ['/river/terms', 'Terms of Use'],
    ['/river/privacy', 'Privacy Policy'],
    ['/river/notices', 'Third-Party Notices'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading, {
      ignoreCase: true,
    });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  }

  // Discord holds these URLs. Nothing on the site hands them to a crawler.
  await page.goto('/river');
  await expect(page.locator('a[href*="/river/terms"], a[href*="/river/privacy"]')).toHaveCount(0);
});

test('a secret from a build we do not know falls back to the plain page', async ({ page }) => {
  await page.goto('/river/_discord/join?secret=someoneelse:Whatever');

  await expect(page).toHaveURL(/\/river$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One raft');
});
