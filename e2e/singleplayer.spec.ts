import { test, expect } from '@playwright/test';

/**
 * Single Player Commander E2E Tests
 *
 * These tests verify the single player life tracker functionality including:
 * - Page loads with 4 player quadrants
 * - Life counter adjustments
 * - Game reset functionality
 */

test.describe('Single Player Commander', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/commander');
    await page.evaluate(() => {
      localStorage.removeItem('commander-settings');
      localStorage.removeItem('commander-player-names');
      localStorage.removeItem('commander-game-state');
    });
    await page.reload();
  });

  test('loads with 4 player quadrants at 40 life each', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="player-quadrant-0"]');

    // Verify all 4 quadrants are visible
    await expect(page.getByTestId('player-quadrant-0')).toBeVisible();
    await expect(page.getByTestId('player-quadrant-1')).toBeVisible();
    await expect(page.getByTestId('player-quadrant-2')).toBeVisible();
    await expect(page.getByTestId('player-quadrant-3')).toBeVisible();

    // Verify all players start at 40 life
    await expect(page.getByTestId('life-total-0')).toHaveText('40');
    await expect(page.getByTestId('life-total-1')).toHaveText('40');
    await expect(page.getByTestId('life-total-2')).toHaveText('40');
    await expect(page.getByTestId('life-total-3')).toHaveText('40');
  });

  test('can decrease life by 1', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Click -1 button for player 1
    await page.getByTestId('life-minus-1-0').click();

    // Verify life decreased
    await expect(page.getByTestId('life-total-0')).toHaveText('39');
  });

  test('can increase life by 1', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Click +1 button for player 1
    await page.getByTestId('life-plus-1-0').click();

    // Verify life increased
    await expect(page.getByTestId('life-total-0')).toHaveText('41');
  });

  test('can decrease life by 5', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Click -5 button for player 1
    await page.getByTestId('life-minus-5-0').click();

    // Verify life decreased
    await expect(page.getByTestId('life-total-0')).toHaveText('35');
  });

  test('can increase life by 5', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Click +5 button for player 1
    await page.getByTestId('life-plus-5-0').click();

    // Verify life increased
    await expect(page.getByTestId('life-total-0')).toHaveText('45');
  });

  test('life cannot go below 0', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Click -5 button 9 times (would be -45, but should stop at 0)
    for (let i = 0; i < 9; i++) {
      await page.getByTestId('life-minus-5-0').click();
    }

    // Verify life is 0, not negative
    await expect(page.getByTestId('life-total-0')).toHaveText('0');
  });

  test('multiple players can have different life totals', async ({ page }) => {
    await page.waitForSelector('[data-testid="life-total-0"]');

    // Modify different players
    await page.getByTestId('life-minus-5-0').click(); // Player 1: 35
    await page.getByTestId('life-plus-5-1').click();  // Player 2: 45
    await page.getByTestId('life-minus-1-2').click(); // Player 3: 39
    await page.getByTestId('life-plus-1-3').click();  // Player 4: 41

    // Verify each player has correct life
    await expect(page.getByTestId('life-total-0')).toHaveText('35');
    await expect(page.getByTestId('life-total-1')).toHaveText('45');
    await expect(page.getByTestId('life-total-2')).toHaveText('39');
    await expect(page.getByTestId('life-total-3')).toHaveText('41');
  });

  test('poison counter starts at 0', async ({ page }) => {
    await page.waitForSelector('[data-testid="poison-counter-0"]');

    // Verify all players start at 0 poison
    await expect(page.getByTestId('poison-counter-0')).toHaveText('0');
    await expect(page.getByTestId('poison-counter-1')).toHaveText('0');
    await expect(page.getByTestId('poison-counter-2')).toHaveText('0');
    await expect(page.getByTestId('poison-counter-3')).toHaveText('0');
  });
});
