import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Multiplayer Commander E2E Tests
 *
 * These tests verify the multiplayer functionality including:
 * - Lobby creation
 * - Joining a lobby with a room code
 * - State synchronization between multiple clients
 */

// Helper to clear localStorage for a fresh session
async function clearMultiplayerSession(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('commander-multiplayer-session');
    localStorage.removeItem('commander-multiplayer-name');
  });
}

// Helper to wait for Ably connection
async function waitForConnection(page: Page, timeout = 10000) {
  // Wait for the game view to be visible (indicates Ably connected)
  await page.waitForSelector('[data-testid="game-settings-button"]', { timeout });
}

test.describe('Multiplayer Lobby', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/commander/multiplayer');
    await clearMultiplayerSession(page);
    await page.reload();
  });

  test('shows the multiplayer menu with create and join options', async ({ page }) => {
    await expect(page.getByText('Commander')).toBeVisible();
    await expect(page.getByText('Multiplayer')).toBeVisible();
    await expect(page.getByTestId('player-name-input')).toBeVisible();
    await expect(page.getByTestId('create-room-button')).toBeVisible();
    await expect(page.getByTestId('room-code-input')).toBeVisible();
    await expect(page.getByTestId('join-room-button')).toBeVisible();
  });

  test('requires a name to create a room', async ({ page }) => {
    // Clear any existing name
    await page.getByTestId('player-name-input').clear();

    // Try to create room without name
    await page.getByTestId('create-room-button').click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toHaveText('Please enter your name');
  });

  test('requires a name to join a room', async ({ page }) => {
    // Clear any existing name
    await page.getByTestId('player-name-input').clear();

    // Enter a room code
    await page.getByTestId('room-code-input').fill('ABC123');

    // Try to join without name
    await page.getByTestId('join-room-button').click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toHaveText('Please enter your name');
  });

  test('requires a valid room code to join', async ({ page }) => {
    // Enter a name
    await page.getByTestId('player-name-input').fill('Test Player');

    // Try to join with short code
    await page.getByTestId('room-code-input').fill('ABC');
    await page.getByTestId('join-room-button').click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toHaveText('Please enter a valid 6-character room code');
  });

  test('creates a room successfully and shows game view', async ({ page }) => {
    // Enter a name
    await page.getByTestId('player-name-input').fill('Host Player');

    // Create room
    await page.getByTestId('create-room-button').click();

    // Wait for connection
    await waitForConnection(page);

    // Verify we're in the game view
    await expect(page.getByTestId('game-settings-button')).toBeVisible();

    // Open menu to see room code
    await page.getByTestId('game-settings-button').click();

    // Verify room code is displayed (6 characters)
    const roomCodeElement = page.getByTestId('room-code-display');
    await expect(roomCodeElement).toBeVisible();
    const roomCode = await roomCodeElement.textContent();
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });
});

test.describe('Multiplayer State Sync', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let hostPage: Page;
  let joinPage: Page;
  let roomCode: string;

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts for isolation
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    hostPage = await context1.newPage();
    joinPage = await context2.newPage();
  });

  test.afterAll(async () => {
    await context1?.close();
    await context2?.close();
  });

  test('host creates a room and gets a room code', async () => {
    await hostPage.goto('/commander/multiplayer');
    await clearMultiplayerSession(hostPage);
    await hostPage.reload();

    // Enter name and create room
    await hostPage.getByTestId('player-name-input').fill('Host');
    await hostPage.getByTestId('create-room-button').click();

    // Wait for connection
    await waitForConnection(hostPage);

    // Open menu to get room code
    await hostPage.getByTestId('game-settings-button').click();
    const roomCodeElement = hostPage.getByTestId('room-code-display');
    await expect(roomCodeElement).toBeVisible();
    roomCode = (await roomCodeElement.textContent()) || '';
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Close menu
    await hostPage.getByText('Close').click();
  });

  test('second player joins the room', async () => {
    await joinPage.goto('/commander/multiplayer');
    await clearMultiplayerSession(joinPage);
    await joinPage.reload();

    // Enter name and room code
    await joinPage.getByTestId('player-name-input').fill('Joiner');
    await joinPage.getByTestId('room-code-input').fill(roomCode);
    await joinPage.getByTestId('join-room-button').click();

    // Wait for connection
    await waitForConnection(joinPage);

    // Verify game view is shown
    await expect(joinPage.getByTestId('game-settings-button')).toBeVisible();
  });

  test('both players can claim slots', async () => {
    // Host claims slot 0 (Player 1)
    const hostSlot0 = hostPage.getByTestId('unclaimed-slot-0');
    if (await hostSlot0.isVisible()) {
      await hostSlot0.click();
    }

    // Joiner claims slot 1 (Player 2)
    const joinSlot1 = joinPage.getByTestId('unclaimed-slot-1');
    if (await joinSlot1.isVisible()) {
      await joinSlot1.click();
    }

    // Wait for state sync
    await hostPage.waitForTimeout(1000);

    // Verify both can see controller view after claiming
    await expect(hostPage.getByTestId('controller-view')).toBeVisible();
    await expect(joinPage.getByTestId('controller-view')).toBeVisible();
  });

  test('life changes sync between players', async () => {
    // Host decreases their life by 1
    const hostMinusOne = hostPage.getByTestId('life-minus-1-0');
    await hostMinusOne.click();

    // Wait for sync
    await hostPage.waitForTimeout(500);

    // Verify host's life is now 39
    const hostLifeTotal = hostPage.getByTestId('life-total-0');
    await expect(hostLifeTotal).toHaveText('39');

    // Switch joiner to overview mode to see all players
    await joinPage.getByTestId('game-settings-button').click();
    await joinPage.getByText('View All Players').click();
    await joinPage.getByText('Close').click();

    // Wait for view switch and sync
    await joinPage.waitForTimeout(1000);

    // Joiner should see host's life as 39 in player-slot-0
    const joinSlot0LifeTotal = joinPage.locator('[data-testid="player-slot-0"] [data-testid="life-total-0"]');
    await expect(joinSlot0LifeTotal).toHaveText('39');
  });

  test('multiple life changes accumulate correctly', async () => {
    // Host increases life by 5
    const hostPlusFive = hostPage.getByTestId('life-plus-5-0');
    await hostPlusFive.click();

    // Wait for sync
    await hostPage.waitForTimeout(500);

    // Host's life should be 44 (39 + 5)
    const hostLifeTotal = hostPage.getByTestId('life-total-0');
    await expect(hostLifeTotal).toHaveText('44');

    // Joiner should see updated value
    await joinPage.waitForTimeout(1000);
    const joinSlot0LifeTotal = joinPage.locator('[data-testid="player-slot-0"] [data-testid="life-total-0"]');
    await expect(joinSlot0LifeTotal).toHaveText('44');
  });

  test('connection count shows both players', async () => {
    // Open menu on host
    await hostPage.getByTestId('game-settings-button').click();

    // Check connection count
    const connectedCount = hostPage.getByTestId('connected-count');
    await expect(connectedCount).toContainText('2 player');

    // Close menu
    await hostPage.getByText('Close').click();
  });
});

test.describe('Multiplayer Join via URL', () => {
  test('can join a room via URL parameter', async ({ browser }) => {
    // Create host context
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    // Host creates room
    await hostPage.goto('/commander/multiplayer');
    await clearMultiplayerSession(hostPage);
    await hostPage.reload();
    await hostPage.getByTestId('player-name-input').fill('URL Host');
    await hostPage.getByTestId('create-room-button').click();
    await waitForConnection(hostPage);

    // Get room code
    await hostPage.getByTestId('game-settings-button').click();
    const roomCode = await hostPage.getByTestId('room-code-display').textContent();
    await hostPage.getByText('Close').click();

    // Create joiner context and join via URL
    const joinContext = await browser.newContext();
    const joinPage = await joinContext.newPage();
    await joinPage.goto(`/commander/multiplayer?join=${roomCode}`);
    await clearMultiplayerSession(joinPage);

    // The room code should be pre-filled
    await joinPage.reload();
    await joinPage.goto(`/commander/multiplayer?join=${roomCode}`);

    const roomCodeInput = joinPage.getByTestId('room-code-input');
    await expect(roomCodeInput).toHaveValue(roomCode!);

    // Fill name and join
    await joinPage.getByTestId('player-name-input').fill('URL Joiner');
    await joinPage.getByTestId('join-room-button').click();

    // Verify joined successfully
    await waitForConnection(joinPage);
    await expect(joinPage.getByTestId('game-settings-button')).toBeVisible();

    // Cleanup
    await hostContext.close();
    await joinContext.close();
  });
});

test.describe('Session Persistence', () => {
  test('shows previous session prompt when session exists', async ({ page }) => {
    // First, create a room
    await page.goto('/commander/multiplayer');
    await clearMultiplayerSession(page);
    await page.reload();
    await page.getByTestId('player-name-input').fill('Session Test');
    await page.getByTestId('create-room-button').click();
    await waitForConnection(page);

    // Navigate away
    await page.goto('/commander');

    // Navigate back to multiplayer
    await page.goto('/commander/multiplayer');

    // Should see previous session prompt
    await expect(page.getByText('PREVIOUS SESSION')).toBeVisible();
    await expect(page.getByText('Rejoin')).toBeVisible();
    await expect(page.getByText('Dismiss')).toBeVisible();
  });

  test('can dismiss previous session', async ({ page }) => {
    await page.goto('/commander/multiplayer');

    // If there's a previous session, dismiss it
    const dismissButton = page.getByText('Dismiss');
    if (await dismissButton.isVisible()) {
      await dismissButton.click();

      // Previous session prompt should disappear
      await expect(page.getByText('PREVIOUS SESSION')).not.toBeVisible();
    }
  });
});

test.describe('Game Reset', () => {
  test('host can reset the game and it syncs to other players', async ({ browser }) => {
    // Create two contexts
    const hostContext = await browser.newContext();
    const joinContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const joinPage = await joinContext.newPage();

    // Host creates room
    await hostPage.goto('/commander/multiplayer');
    await clearMultiplayerSession(hostPage);
    await hostPage.reload();
    await hostPage.getByTestId('player-name-input').fill('Reset Host');
    await hostPage.getByTestId('create-room-button').click();
    await waitForConnection(hostPage);

    // Get room code
    await hostPage.getByTestId('game-settings-button').click();
    const roomCode = await hostPage.getByTestId('room-code-display').textContent();
    await hostPage.getByText('Close').click();

    // Joiner joins
    await joinPage.goto('/commander/multiplayer');
    await clearMultiplayerSession(joinPage);
    await joinPage.reload();
    await joinPage.getByTestId('player-name-input').fill('Reset Joiner');
    await joinPage.getByTestId('room-code-input').fill(roomCode!);
    await joinPage.getByTestId('join-room-button').click();
    await waitForConnection(joinPage);

    // Both claim slots
    const hostSlot0 = hostPage.getByTestId('unclaimed-slot-0');
    if (await hostSlot0.isVisible()) {
      await hostSlot0.click();
    }

    const joinSlot1 = joinPage.getByTestId('unclaimed-slot-1');
    if (await joinSlot1.isVisible()) {
      await joinSlot1.click();
    }

    await hostPage.waitForTimeout(1000);

    // Host changes their life
    await hostPage.getByTestId('life-minus-5-0').click();
    await hostPage.waitForTimeout(500);
    await expect(hostPage.getByTestId('life-total-0')).toHaveText('35');

    // Host resets the game
    await hostPage.getByTestId('game-settings-button').click();
    await hostPage.getByText('Reset Game').click();
    await hostPage.getByText('Yes, Reset').click();

    // Wait for sync
    await hostPage.waitForTimeout(1000);

    // Both should have life reset to 40
    await expect(hostPage.getByTestId('life-total-0')).toHaveText('40');

    // Switch joiner to overview to verify
    await joinPage.getByTestId('game-settings-button').click();
    await joinPage.getByText('View All Players').click();
    await joinPage.getByText('Close').click();
    await joinPage.waitForTimeout(500);

    const joinSlot0LifeTotal = joinPage.locator('[data-testid="player-slot-0"] [data-testid="life-total-0"]');
    await expect(joinSlot0LifeTotal).toHaveText('40');

    // Cleanup
    await hostContext.close();
    await joinContext.close();
  });
});
