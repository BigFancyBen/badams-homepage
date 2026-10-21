import { test, expect, type Page } from '@playwright/test';

/**
 * Commander E2E Tests
 *
 * Undo, commander damage, history, saved games, rotation and wake lock.
 * Basic life and poison clicks live in singleplayer.spec.ts.
 */

const GAME_STATE_KEY = 'commander-game-state';

const lifeTotals = (page: Page) =>
  Promise.all([0, 1, 2, 3].map((i) => page.getByTestId(`life-total-${i}`).textContent()));

// The rotating wrapper inside a quadrant
const rotator = (page: Page, playerIndex: number) =>
  page.getByTestId(`player-quadrant-${playerIndex}`).locator('div.flex.flex-col.origin-center');

const loadWithSave = async (page: Page, save: unknown) => {
  await page.goto('/commander');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [GAME_STATE_KEY, JSON.stringify(save)]
  );
  await page.reload();
  await page.waitForSelector('[data-testid="life-total-0"]');
};

test.describe('Commander', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/commander');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-testid="life-total-0"]');
  });

  test('-1 others drains the other players and only its owner can undo it', async ({ page }) => {
    await page.getByTestId('damage-others-0').click();
    expect(await lifeTotals(page)).toEqual(['40', '39', '39', '39']);

    await expect(page.getByTestId('undo-damage-others-1')).toBeDisabled();
    await page.getByTestId('undo-damage-others-0').click();
    expect(await lifeTotals(page)).toEqual(['40', '40', '40', '40']);
    await expect(page.getByTestId('undo-damage-others-0')).toBeDisabled();
  });

  test('undo restores exact life for a player at 0', async ({ page }) => {
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('life-minus-5-1').click();
    }
    await expect(page.getByTestId('life-total-1')).toHaveText('0');

    await page.getByTestId('damage-others-0').click();
    await expect(page.getByTestId('life-total-1')).toHaveText('-1');
    await page.getByTestId('undo-damage-others-0').click();
    await expect(page.getByTestId('life-total-1')).toHaveText('0');
  });

  test('commander damage costs life and stops at 21', async ({ page }) => {
    await page.getByRole('button', { name: /Cmdr \/ Poison/ }).first().click();
    const quadrant = page.getByTestId('player-quadrant-0');
    const plus = quadrant.locator('.grid-cols-4.mt-1 > div').first().locator('button').first();

    for (let i = 0; i < 23; i++) {
      await plus.click();
    }
    await expect(page.getByTestId('life-total-0')).toHaveText('19');
    await expect(quadrant.getByText('P2 21')).toBeVisible();
  });

  test('quick taps merge into one history entry', async ({ page }) => {
    await page.getByTestId('life-minus-1-0').click();
    await page.getByTestId('life-minus-1-0').click();
    await page.getByTestId('life-minus-1-0').click();

    await page.getByTestId('life-total-0').click();
    const rows = page.getByTestId('history-list').locator('> div');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('3');
    await expect(rows.first()).toContainText('life');
  });

  test('progress survives a reload', async ({ page }) => {
    await page.getByTestId('life-minus-5-2').click();
    await page.reload();
    await expect(page.getByTestId('life-total-2')).toHaveText('35');
  });

  test('a malformed save loads with defaults instead of crashing', async ({ page }) => {
    await loadWithSave(page, { players: [{}, null, { life: 'x' }, { life: 12, history: 'nope' }] });
    expect(await lifeTotals(page)).toEqual(['40', '40', '40', '12']);
  });

  test('a save from the old string-history format still loads', async ({ page }) => {
    const now = Date.now();
    await loadWithSave(page, {
      players: [
        {
          life: 33,
          commanderDamage: [2, 0, 0],
          rotation: 0,
          name: 'Ann',
          history: [
            { action: '-5 life from Bob|negative', timestamp: now },
            { action: '+2 commander damage from Bob|commander', timestamp: now - 5000 },
          ],
        },
        { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Bob', history: [] },
        { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Cy', history: [] },
        { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Di', history: [] },
      ],
      timestamp: now,
    });

    await expect(page.getByTestId('life-total-0')).toHaveText('33');
    await page.getByTestId('life-total-0').click();
    const rows = page.getByTestId('history-list').locator('> div');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('life from Bob');
    await expect(rows.nth(1)).toContainText('commander damage from Bob');
  });

  test('turning a phone keeps a flipped player flipped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(rotator(page, 0)).toHaveClass(/(^|\s)rotate-0(\s|$)/);

    await page.getByTestId('player-quadrant-0').getByTitle('Flip view').click();
    await expect(rotator(page, 0)).toHaveClass(/(^|\s)rotate-180(\s|$)/);
    await expect(rotator(page, 1)).toHaveClass(/(^|\s)rotate-0(\s|$)/);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(rotator(page, 0)).toHaveClass(/(^|\s)-rotate-90(\s|$)/);
    await expect(rotator(page, 1)).toHaveClass(/(^|\s)rotate-90(\s|$)/);
  });
});

test.describe('Commander wake lock', () => {
  test.beforeEach(async ({ page }) => {
    // Fake wake lock that counts requests and can be released like the OS does
    await page.addInitScript(() => {
      const w = window as unknown as { __wakeRequests: number; __sentinel: EventTarget & { release(): Promise<void> } };
      w.__wakeRequests = 0;
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            w.__wakeRequests++;
            const sentinel = Object.assign(new EventTarget(), {
              released: false,
              type: 'screen',
              async release() {
                if (sentinel.released) return;
                sentinel.released = true;
                sentinel.dispatchEvent(new Event('release'));
              },
            });
            w.__sentinel = sentinel;
            return sentinel;
          },
        },
      });
    });
    await page.goto('/commander');
    await page.waitForSelector('[data-testid="life-total-0"]');
  });

  test('is requested again when the page comes back into view', async ({ page }) => {
    await page.getByTitle('Game Settings').click();
    await page.getByRole('button', { name: 'Keep Screen On' }).click();
    await expect(page.getByRole('button', { name: /Screen Locked On/ })).toBeVisible();

    // The browser drops the lock when the tab is hidden...
    await page.evaluate(() => (window as unknown as { __sentinel: { release(): Promise<void> } }).__sentinel.release());
    await expect(page.getByRole('button', { name: 'Keep Screen On' })).toBeVisible();

    // ...and it comes back once the tab is visible again
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByRole('button', { name: /Screen Locked On/ })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __wakeRequests: number }).__wakeRequests)).toBe(2);
  });

  test('stays off after the user turns it off', async ({ page }) => {
    await page.getByTitle('Game Settings').click();
    await page.getByRole('button', { name: 'Keep Screen On' }).click();
    await page.getByRole('button', { name: /Screen Locked On/ }).click();
    await expect(page.getByRole('button', { name: 'Keep Screen On' })).toBeVisible();

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByRole('button', { name: 'Keep Screen On' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __wakeRequests: number }).__wakeRequests)).toBe(1);
  });
});
