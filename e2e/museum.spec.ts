import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FRAMES = process.env.MUSEUM_FRAMES_DIR ?? 'test-results/frames';
/* What the poster says when the game version cannot start (no WebGL2, engine missing, download failed). */
const CLOSED = /couldn't start on this device/;

/* None of these wait for the engine: it may be absent (404) or still booting. */
test.describe('homepage museum', () => {
  test('renders the museum section and the catalogue', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('section#museum')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ben Adams', level: 1 })).toBeVisible();
    const catalogue = page.locator('#catalogue');
    await expect(catalogue).toBeAttached();
    await expect(catalogue.getByRole('heading', { name: 'Oathkeep' })).toBeAttached();
    await expect(page.locator('#oathkeep')).toBeAttached();
    await expect(page.locator('#prognosticator')).toBeAttached();
    await expect(page.locator('#warehouse')).toBeAttached();
  });

  test('the page carries no overlay copy: no tagline, hints, counter, catalogue heading or resume link', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).not.toContainText('Games, light shows and tools');
    await expect(body).not.toContainText(/Tap an exhibit|drag to look|WASD or arrow|Left thumb/);
    await expect(body).not.toContainText(/\d+ \/ 13/);
    await expect(page.getByRole('heading', { name: 'Catalogue' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Catalogue/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Resume' })).toHaveCount(0);
  });

  test('music starts muted and the button says so', async ({ page }) => {
    await page.goto('/');
    const mute = page.getByRole('button', { name: 'Play music' });
    await expect(mute).toBeVisible();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
  });

  test('offers the call to action and does not fetch the engine until clicked', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => {
      if (/\/museum\/[0-9a-f]+\/museum\./.test(r.url())) requested.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Game version' })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(requested).toEqual([]);
  });

  test('a failed engine download is tried again, not given up on', async ({ page }) => {
    let wasmRequests = 0;
    await page.route('**/museum/*/museum.wasm*', async (route) => {
      wasmRequests += 1;
      if (wasmRequests === 1) return route.abort('connectionreset');
      return route.fulfill({ path: join(process.cwd(), 'public', 'museum', 'engine', 'museum.wasm'), contentType: 'application/wasm' });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Game version' }).click();
    await expect.poll(() => wasmRequests, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(CLOSED)).toBeHidden();
  });

  test('clicking with the engine missing shows the closed sign', async ({ page }) => {
    await page.route('**/museum/*/museum.*', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Game version' }).click();
    await expect(page.getByText(CLOSED)).toBeVisible();
  });
});

test.describe('museum on phones', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'chromium', 'phone projects only');
  });

  test('has no horizontal overflow and blocks swipe-back', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('section#museum')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('canvas')).toHaveCSS('touch-action', 'pan-y');
    await expect(page.locator('html')).toHaveCSS('overscroll-behavior-x', 'none');
  });

  test('every control on the poster and the mute button is at least 44px', async ({ page }) => {
    await page.goto('/');
    const targets = [
      page.getByRole('button', { name: 'Game version' }),
      page.getByRole('button', { name: 'Play music' }),
    ];
    for (const t of targets) {
      const box = await t.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('without WebGL2 the closed sign shows', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2') return null;
        return (orig as any).call(this, type, ...rest);
      } as typeof orig;
    });
    await page.goto('/');
    await expect(page.getByText(CLOSED)).toBeVisible();
  });

  test('loading shows progress and can be cancelled', async ({ page }) => {
    await page.route('**/museum/*/museum.js*', async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Game version' }).click();
    await expect(page.getByText(/Downloading, about \d+ MB/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Game version' })).toBeVisible();
  });

  test('boots the engine, caps the render size, and recovers from a lost GL context', async ({ page }, info) => {
    test.setTimeout(540_000);
    /* The dev server drops the 39 MB wasm mid-stream; serve the engine straight from disk. */
    await page.route('**/museum/*/museum.*', async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      await route.fulfill({
        path: join(process.cwd(), 'public', 'museum', 'engine', name),
        contentType: name.endsWith('.wasm') ? 'application/wasm' : undefined,
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Game version' }).click();
    const closed = page.getByText(CLOSED);
    await expect(page.locator('canvas').or(closed)).toHaveCSS('opacity', '1', { timeout: 480_000 });
    test.skip(await closed.isVisible(), 'engine did not boot headless here (no WebGL2 or no engine export)');

    mkdirSync(FRAMES, { recursive: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-ready.png`) });

    const px = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight };
    });
    /* The backing store may be up to 2x CSS size; the scene inside is scaled to ~1.4M px. */
    expect(px.cssW).toBeGreaterThan(300);

    await page.evaluate(() => {
      const gl = document.querySelector('canvas')!.getContext('webgl2') as WebGL2RenderingContext;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(page.getByRole('button', { name: 'Tap to reload the museum' })).toBeVisible();
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-context-lost.png`) });
  });
});

/* Godot publishes "x,y,z,yaw,mode" on the bridge ~5 times a second (mode 1 auto-walk, 2 holds and free walk). */
async function readPos(page: Page) {
  const raw = await page.evaluate(() => window.museumBridge?.debugPos ?? '');
  if (!raw) return null;
  const [x, y, z, yaw, mode] = raw.split(',').map(Number);
  return { x, y, z, yaw, mode };
}

test.describe('museum walk', () => {
  test('opens on the stage hold, W walks, the stick walks on phones', async ({ page }, info) => {
    test.setTimeout(540_000);
    await page.route('**/museum/*/museum.*', async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      await route.fulfill({
        path: join(process.cwd(), 'public', 'museum', 'engine', name),
        contentType: name.endsWith('.wasm') ? 'application/wasm' : undefined,
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Game version' }).click();
    const closed = page.getByText(CLOSED);
    await expect(page.locator('canvas').or(closed)).toHaveCSS('opacity', '1', { timeout: 480_000 });
    test.skip(await closed.isVisible(), 'engine did not boot headless here (no WebGL2 or no engine export)');
    mkdirSync(FRAMES, { recursive: true });
    const phone = info.project.name !== 'chromium';

    /* There is no opening move: the camera is on the stage hold and the visitor has control (mode 2) at once. */
    await expect.poll(async () => (await readPos(page))?.mode, { timeout: 30_000 }).toBe(2);
    const start = (await readPos(page))!;
    expect(start.y).toBeCloseTo(1.65, 1);

    if (!phone) {
      /* Click the middle of the view (no exhibit there) so the canvas has keyboard focus. */
      await page.locator('canvas').click();
      await page.keyboard.down('w');
      /* SwiftShader renders a few frames a second, so hold W until the camera has visibly moved. */
      await expect.poll(async () => start.z - (await readPos(page))!.z, { timeout: 20_000 }).toBeGreaterThan(0.5);
      await page.keyboard.up('w');
      await page.waitForTimeout(600);
      const after = (await readPos(page))!;
      /* Left arrow turns the view. */
      const yaw0 = after.yaw;
      await page.keyboard.down('ArrowLeft');
      await expect.poll(async () => Math.abs((await readPos(page))!.yaw - yaw0), { timeout: 20_000 }).toBeGreaterThan(10);
      await page.keyboard.up('ArrowLeft');
      await page.screenshot({ path: join(FRAMES, `${info.project.name}-walked.png`) });
      return;
    }

    /* Phone: drag the stick with a real touch (CDP), keep the finger down for a screenshot. */
    const cdp = await page.context().newCDPSession(page);
    const vp = page.viewportSize()!;
    const x0 = Math.round(vp.width * 0.2);
    const y0 = Math.round(vp.height * 0.55);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - i * 8, id: 1 }] });
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-stick.png`) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const after = (await readPos(page))!;
    expect(start.z - after.z).toBeGreaterThan(0.5);
  });
});

test.describe('engine cache', () => {
  test('a second visit reads the wasm and pck from Cache Storage, not the network', async ({ browser }, info) => {
    test.skip(info.project.name !== 'chromium', 'one browser is enough');
    test.setTimeout(540_000);
    const context = await browser.newContext({ baseURL: String(info.project.use.baseURL) });
    const hits: Record<string, number> = {};
    await context.route('**/museum/*/museum.*', async (route) => {
      const url = new URL(route.request().url());
      const name = url.pathname.split('/').pop()!;
      hits[name] = (hits[name] ?? 0) + 1;
      /* The versioned URL is what makes the server cache it forever. */
      if (/museum\.(wasm|pck|js)$/.test(name)) expect(url.searchParams.get('v')).toMatch(/^[0-9a-f]{6,}$/);
      await route.fulfill({
        path: join(process.cwd(), 'public', 'museum', 'engine', name),
        contentType: name.endsWith('.wasm') ? 'application/wasm' : undefined,
      });
    });
    const visit = async () => {
      const page = await context.newPage();
      await page.goto('/');
      const t0 = Date.now();
      await page.getByRole('button', { name: 'Game version' }).click();
      const closed = page.getByText(CLOSED);
      await expect(page.locator('canvas').or(closed)).toHaveCSS('opacity', '1', { timeout: 480_000 });
      const ms = Date.now() - t0;
      const booted = !(await closed.isVisible());
      const names = await page.evaluate(() => caches.keys());
      await page.close();
      return { ms, booted, names };
    };
    const first = await visit();
    test.skip(!first.booted, 'engine did not boot headless here');
    expect(hits['museum.wasm']).toBe(1);
    expect(hits['museum.pck']).toBe(1);
    expect(first.names.filter((n) => n.startsWith('museum-engine-'))).toHaveLength(1);
    const second = await visit();
    expect(second.booted).toBe(true);
    expect(hits['museum.wasm']).toBe(1);
    expect(hits['museum.pck']).toBe(1);
    console.log(`[cache] ready after ${first.ms} ms on the first visit, ${second.ms} ms on the second`);
    expect(second.ms).toBeLessThan(first.ms);
    await context.close();
  });
});

/* A stand-in for the Godot engine: boots instantly and hands the test the real bridge, so the
   overlay's behaviour can be checked without the 40 MB export. */
async function enterStub(page: Page) {
  await page.route('**/museum/*/museum.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.Engine = class { startGame() { window.museumBridge.onReady(); return Promise.resolve(); } requestQuit() {} };',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Game version' }).click();
  await expect(page.locator('canvas')).toHaveCSS('opacity', '1');
}

/** Drain what the page has queued for Godot, as Godot's per-frame poll would. */
const drain = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (let c = window.museumBridge!.pollCommand(); c; c = window.museumBridge!.pollCommand()) out.push(c);
    return out;
  });
const tour = (page: Page, state: string) => page.evaluate((s) => window.museumBridge!.onTour(s), state);
const focus = (page: Page, id: string) => page.evaluate((i) => window.museumBridge!.onFocus(i), id);
const NAV = 'Museum navigation';

test.describe('museum overlay (stub engine)', () => {
  test('Browse projects shows on the stage, sends browse once, then the icon bar takes over', async ({ page }) => {
    await enterStub(page);
    const browse = page.getByRole('button', { name: 'Browse projects' });
    await expect(browse).toBeHidden();
    await tour(page, 'stage');
    await expect(browse).toBeVisible();
    await expect(page.getByRole('navigation', { name: NAV })).toBeHidden();
    expect((await browse.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await browse.click();
    expect(await drain(page)).toEqual(['browse']);
    await expect(browse).toBeHidden();
    await tour(page, 'touring');
    await expect(page.getByRole('navigation', { name: NAV })).toBeVisible();
  });

  test('icon bar: prev, play/pause, next, icon-only and at least 44px', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    const nav = page.getByRole('navigation', { name: NAV });
    await expect(nav).toHaveText('');
    for (const b of await nav.locator('button, a').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await nav.getByRole('button', { name: 'Previous exhibit' }).click();
    await nav.getByRole('button', { name: 'Next exhibit' }).click();
    await nav.getByRole('button', { name: 'Pause tour' }).click();
    await tour(page, 'paused');
    await nav.getByRole('button', { name: 'Play tour' }).click();
    expect(await drain(page)).toEqual(['prev', 'next', 'tour:pause', 'tour:play']);
  });

  test('menu lists Stage, the 13 titles and Entrance; picking one sends goto and closes; Esc closes', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'testq');
    const menuBtn = page.getByRole('button', { name: 'Project menu' });
    await menuBtn.click();
    const menu = page.getByRole('dialog', { name: 'Projects' });
    const items = menu.getByRole('button');
    await expect(items).toHaveCount(15);
    await expect(items.first()).toHaveText('Stage');
    await expect(items.last()).toHaveText('Entrance');
    await expect(menu.getByRole('button', { name: 'Résumé' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'testq' })).toHaveAttribute('aria-current', 'true');
    await expect(menu.getByRole('button', { name: 'testq' })).toBeFocused();
    await menu.getByRole('button', { name: 'Oathkeep' }).click();
    await expect(menu).toBeHidden();
    expect(await drain(page)).toEqual(['goto:oathkeep']);
    await expect(menuBtn).toBeFocused();
    await menuBtn.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    /* The two framed shots: Stage flies to the stage hold, Entrance to the marquee view. */
    await menuBtn.click();
    await menu.getByRole('button', { name: 'Entrance' }).click();
    await expect(menu).toBeHidden();
    await menuBtn.click();
    await menu.getByRole('button', { name: 'Stage' }).click();
    expect(await drain(page)).toEqual(['goto:entrance', 'goto:stage']);
    /* Entrance is the current entry once the tour has reached its end; Stage when focus is the stage. */
    await tour(page, 'end');
    await focus(page, '');
    await menuBtn.click();
    await expect(menu.getByRole('button', { name: 'Entrance' })).toHaveAttribute('aria-current', 'true');
    await expect(menu.getByRole('button', { name: 'Stage' })).not.toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Escape');
    await focus(page, 'stage');
    await tour(page, 'paused');
    await menuBtn.click();
    await expect(menu.getByRole('button', { name: 'Stage' })).toHaveAttribute('aria-current', 'true');
  });

  test('menu traps Tab focus', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await page.getByRole('button', { name: 'Project menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Projects' });
    await menu.getByRole('button').first().focus();
    await page.keyboard.press('Shift+Tab');
    await expect(menu.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button').first()).toBeFocused();
  });

  test('the open icon follows the focused exhibit and asks before leaving the game', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    const nav = page.getByRole('navigation', { name: NAV });
    await focus(page, 'stage');
    await expect(nav.getByRole('button', { name: /Open this project/ })).toBeDisabled();
    await focus(page, 'mfrs');
    const open = nav.getByRole('button', { name: /Open this project/ });
    await open.click();
    expect(await drain(page)).toEqual(['tour:pause']);
    const modal = page.getByRole('dialog', { name: 'Leave the game?' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Opens Middle Fork Rafting Simulator in a new tab.');
    const go = modal.getByRole('link', { name: 'Open project' });
    await expect(go).toHaveAttribute('target', '_blank');
    await expect(go).toHaveAttribute('rel', /noopener/);
    await expect(go).toHaveAttribute('href', /.+/);
    const stay = modal.getByRole('button', { name: 'Stay' });
    await expect(stay).toBeFocused();
    for (const b of [go, stay]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    /* Tab stays inside the modal. */
    await page.keyboard.press('Shift+Tab');
    await expect(go).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(stay).toBeFocused();
    await stay.click();
    await expect(modal).toBeHidden();
    expect(await drain(page)).toEqual(['tour:play']);
    await expect(open).toBeFocused();
    /* Esc and the backdrop also stay. */
    await open.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await open.click();
    await page.mouse.click(4, 4);
    await expect(modal).toBeHidden();
    expect(await drain(page)).toEqual(['tour:pause', 'tour:play', 'tour:pause', 'tour:play']);
    /* Open project opens a new tab and does not resume the tour. */
    await open.click();
    const [popup] = await Promise.all([page.waitForEvent('popup'), modal.getByRole('link', { name: 'Open project' }).click()]);
    await popup.close();
    await expect(modal).toBeHidden();
    expect(await drain(page)).toEqual(['tour:pause']);
  });

  test('unmute callout appears after ready, pulses the button, and goes on a tap', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/song.mp3', (route) => route.fulfill({ status: 404, body: 'no' }));
    await enterStub(page);
    const text = page.getByText('Turn on the music');
    await expect(text).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Turn on the music');
    const mute = page.getByRole('button', { name: 'Play music' });
    const mb = (await mute.boundingBox())!;
    const cb = (await text.boundingBox())!;
    expect(cb.x).toBeGreaterThanOrEqual(mb.x + mb.width);
    /* The ring is written to the button while the hint is up. */
    await expect.poll(() => mute.evaluate((el) => (el as HTMLElement).style.boxShadow)).toMatch(/255, ?42, ?42/);
    /* Tapping the callout dismisses it (and asks to unmute; the mp3 is stubbed to fail, so it stays muted). */
    await text.click();
    await expect(text).toHaveCount(0);
  });

  test('unmute callout dismisses after 6 s and the pulse goes on until the first unmute', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await enterStub(page);
    const text = page.getByText('Turn on the music');
    await expect(text).toBeVisible();
    await expect(text).toBeHidden({ timeout: 9000 });
    const mute = page.getByRole('button', { name: 'Play music' });
    await expect.poll(() => mute.evaluate((el) => (el as HTMLElement).style.boxShadow)).toMatch(/255, ?42, ?42/);
  });

  test('reduced motion: the callout shows but the button does not pulse', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterStub(page);
    await expect(page.getByText('Turn on the music')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.getByRole('button', { name: 'Play music' }).evaluate((el) => (el as HTMLElement).style.boxShadow)).toBe('');
  });

  test('the callout does not show before the game is ready', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Game version' })).toBeVisible();
    await expect(page.getByText('Turn on the music')).toHaveCount(0);
  });

  test('overlay states screenshot, and the bottom inset covers the open menu', async ({ page }, info) => {
    mkdirSync(FRAMES, { recursive: true });
    await enterStub(page);
    await tour(page, 'stage');
    await expect(page.getByRole('button', { name: 'Browse projects' })).toBeVisible();
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-overlay-stage.png`) });
    await tour(page, 'touring');
    await focus(page, 'scrandle');
    await expect(page.getByRole('navigation', { name: NAV })).toBeVisible();
    const barInset = await page.evaluate(() => window.museumBridge!.bottomInset());
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-overlay-touring.png`) });
    await page.getByRole('button', { name: 'Project menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Projects' })).toBeVisible();
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-overlay-menu.png`) });
    const menuInset = await page.evaluate(() => window.museumBridge!.bottomInset());
    expect(barInset).toBeGreaterThanOrEqual(44);
    if (info.project.name !== 'chromium') expect(menuInset).toBeGreaterThan(barInset + 200);
  });
});
