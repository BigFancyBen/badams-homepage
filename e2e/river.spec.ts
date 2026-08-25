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

  // The trip code survives for anyone who owns the game and has to type it in,
  // and there is a button for a browser that blocked the automatic handoff.
  await expect(page.getByText('FrothGorgeSurf').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();

  // Nothing took the scheme, so the strip says so instead of promising a game.
  await expect(page.getByText('Nothing opened.')).toBeVisible({ timeout: 5000 });
});

test('Android gets its proof, verbatim and without a redirect', async ({ request }) => {
  // The whole of Android's App Link check. It follows no redirect and accepts
  // nothing but 200 with the JSON itself, so this asserts the shape as well as
  // the contents. Both values are facts about the built APK — package name from
  // export_presets.cfg, fingerprint from run_itch.sh — so a mismatch here is a
  // phone that shows a "complete action using" prompt instead of the game.
  const response = await request.get('/.well-known/assetlinks.json', {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(200);

  const [statement] = await response.json();
  expect(statement.relation).toContain('delegate_permission/common.handle_all_urls');
  expect(statement.target.namespace).toBe('android_app');
  expect(statement.target.package_name).toBe('com.middlefork.raftingsimulator');
  expect(statement.target.sha256_cert_fingerprints).toEqual([
    'EA:E1:91:96:2D:3C:22:25:C8:A2:2B:CF:AA:EF:07:C5:6E:D7:24:B4:83:A5:43:0A:F5:4B:CF:18:04:6E:19:91',
  ]);
});

test('a code the game would refuse lands on the game rather than a 404', async ({ page }) => {
  // The grammar is `Link.is_trip_code()`: an address is never a trip code, so
  // this page must not offer to open one. See app/river/trip-code.ts.
  const response = await page.goto('/river/join/203.0.113.7:27015');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One raft');
});

test('a code minted without the wordlist still opens', async ({ page }) => {
  // What the meetup server hands out when NORAY_ENABLE_WORDS_OID is unset.
  await page.goto('/river/join/V1StGXR8_Z5jdHi6B-myT');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('seat');
  await expect(page.getByText('V1StGXR8_Z5jdHi6B-myT').first()).toBeVisible();
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
