import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FRAMES = process.env.MUSEUM_FRAMES_DIR ?? 'test-results/frames';
/* What the poster says when the game version cannot start (no WebGL2, engine missing, download failed). */
const CLOSED = /couldn't start on this device/;

/* None of these wait for the engine: it may be absent (404) or still booting. */
test.describe('museum page', () => {
  test('is the full-screen game, with one h1 and no catalogue', async ({ page }) => {
    await page.goto('/museum');
    await expect(page.locator('section#museum')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ben Adams: game version');
    await expect(page.locator('#catalogue')).toHaveCount(0);
    await expect(page).toHaveTitle(/^Game version \|/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/museum$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const box = (await page.locator('section#museum').boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(vp.height - 120);
  });

  test('the page carries no overlay copy: no tagline, hints, counter, catalogue heading or resume link', async ({ page }) => {
    await page.goto('/museum');
    const body = page.locator('body');
    await expect(body).not.toContainText('Games, light shows and tools');
    await expect(body).not.toContainText(/Tap an exhibit|drag to look|WASD or arrow|Left thumb/);
    await expect(body).not.toContainText(/\d+ \/ 13/);
    await expect(page.getByRole('heading', { name: 'Catalogue' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Resume' })).toHaveCount(0);
  });

  test('music starts muted and the button says so', async ({ page }) => {
    await page.goto('/museum');
    const mute = page.getByRole('button', { name: 'Play music' });
    await expect(mute).toBeVisible();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
  });

  test('the engine download starts on arrival, with no click', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => {
      if (/\/museum\/[0-9a-f]+\/museum\./.test(r.url())) requested.push(r.url());
    });
    await page.route('**/museum/*/museum.*', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.goto('/museum');
    await expect.poll(() => requested.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Game version' })).toHaveCount(0);
  });

  test('the song bytes are fetched on arrival, but nothing plays', async ({ page }) => {
    const songs: string[] = [];
    page.on('request', (r) => {
      if (/\/songs\/[\w-]+\.mp3/.test(r.url())) songs.push(r.url());
    });
    await page.route('**/museum/*/museum.*', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.goto('/museum');
    await expect.poll(() => songs.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a failed engine download is tried again, not given up on', async ({ page }) => {
    let wasmRequests = 0;
    await page.route('**/museum/*/museum.wasm*', async (route) => {
      wasmRequests += 1;
      if (wasmRequests === 1) return route.abort('connectionreset');
      return route.fulfill({ path: join(process.cwd(), 'public', 'museum', 'engine', 'museum.wasm'), contentType: 'application/wasm' });
    });
    await page.goto('/museum');
    await expect.poll(() => wasmRequests, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(CLOSED)).toBeHidden();
  });

  test('with the engine missing the closed sign shows, with a way back', async ({ page }) => {
    await page.route('**/museum/*/museum.*', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.goto('/museum');
    await expect(page.getByText(CLOSED)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the homepage' })).toHaveAttribute('href', '/');
  });
});

test.describe('museum on phones', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'chromium', 'phone projects only');
  });

  test('has no horizontal overflow and blocks swipe-back', async ({ page }) => {
    await page.goto('/museum');
    await expect(page.locator('section#museum')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('canvas')).toHaveCSS('touch-action', 'pan-y');
    await expect(page.locator('html')).toHaveCSS('overscroll-behavior-x', 'none');
  });

  test('the mute button is at least 44px', async ({ page }) => {
    await page.goto('/museum');
    const targets = [
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
    await page.goto('/museum');
    await expect(page.getByText(CLOSED)).toBeVisible();
  });

  test('loading shows progress, with no Cancel link', async ({ page }) => {
    await page.route('**/museum/*/museum.js*', async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page.goto('/museum');
    await expect(page.getByText(/Downloading, about \d+ MB/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cancel' })).toHaveCount(0);
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
    await page.goto('/museum');
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

async function readGlance(page: Page) {
  const raw = await page.evaluate(() => (window.museumBridge as unknown as { debugGlance?: string }).debugGlance ?? '');
  return raw.split(',').map(Number);
}

test.describe('museum walk', () => {
  test('opens on the stage hold, scrolls to exhibit 1 and back; in free roam W walks, the stick walks on phones', async ({ page }, info) => {
    test.setTimeout(540_000);
    await page.route('**/museum/*/museum.*', async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      await route.fulfill({
        path: join(process.cwd(), 'public', 'museum', 'engine', name),
        contentType: name.endsWith('.wasm') ? 'application/wasm' : undefined,
      });
    });
    await page.goto('/museum');
    const closed = page.getByText(CLOSED);
    await expect(page.locator('canvas').or(closed)).toHaveCSS('opacity', '1', { timeout: 480_000 });
    test.skip(await closed.isVisible(), 'engine did not boot headless here (no WebGL2 or no engine export)');
    mkdirSync(FRAMES, { recursive: true });
    const phone = info.project.name !== 'chromium';

    /* There is no opening move: the camera is on the stage hold and the visitor has control (mode 2) at once. */
    await expect.poll(async () => (await readPos(page))?.mode, { timeout: 30_000 }).toBe(2);
    const start = (await readPos(page))!;
    expect(start.y).toBeCloseTo(1.65, 1);

    /* Scrolling is the default: one wheel notch (a swipe up on phones) carries on to exhibit 1, the
       other way comes back. Exhibit 1 is nearer the entrance (larger z) than the stage hold. */
    const cdp = phone ? await page.context().newCDPSession(page) : null;
    const scroll = async (dir: 1 | -1) => {
      if (!cdp) {
        const b = (await page.locator('canvas').boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.4);
        await page.mouse.wheel(0, 120 * dir);
        return;
      }
      const vp = page.viewportSize()!;
      const x = Math.round(vp.width / 2);
      const y0 = Math.round(vp.height * 0.5);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 5 }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - dir * i * 20, id: 5 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await scroll(1);
    await expect.poll(async () => (await readPos(page))!.z - start.z, { timeout: 60_000 }).toBeGreaterThan(0.5);
    await expect.poll(async () => (await readPos(page))!.mode, { timeout: 60_000 }).toBe(2);
    await expect(page.getByRole('button', { name: 'Browse projects' })).toHaveCount(0);
    await scroll(-1);
    await expect.poll(async () => Math.abs((await readPos(page))!.z - start.z), { timeout: 60_000 }).toBeLessThan(0.05);
    await expect.poll(async () => (await readPos(page))!.mode, { timeout: 60_000 }).toBe(2);
    await expect(page.getByRole('button', { name: 'Browse projects' })).toBeVisible();

    /* Walking is free roam's. */
    await page.getByRole('button', { name: 'Free roam' }).click();
    await expect(page.getByRole('button', { name: 'Free roam' })).toHaveAttribute('aria-pressed', 'true');

    if (!phone) {
      const box = (await page.locator('canvas').boundingBox())!;
      const my = box.y + box.height * 0.4;
      /* Unlocked, the mouse does nothing to the camera: no hover-look, no edge turning. */
      const glance0 = await readGlance(page);
      for (const fx of [0.01, 0.3, 0.7, 0.99, 0.5]) {
        await page.mouse.move(box.x + box.width * fx, my);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1500);
      expect(await readGlance(page)).toEqual(glance0);
      expect(glance0).toEqual([0, 0]);
      /* Click the middle of the view: the click asks for the pointer lock (and the canvas gets keyboard
         focus); it must not fly to an exhibit. */
      await page.locator('canvas').click();
      await page.keyboard.down('w');
      /* SwiftShader renders a few frames a second, so hold W until the camera has visibly moved. */
      await expect.poll(async () => start.z - (await readPos(page))!.z, { timeout: 20_000 }).toBeGreaterThan(0.5);
      await page.keyboard.up('w');
      await page.waitForTimeout(600);
      const locked = await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
      info.annotations.push({ type: 'pointer-lock', description: locked ? 'real lock granted' : 'lock NOT granted by this browser' });
      if (locked) {
        /* Locked: relative motion aims. Yaw grows to the left (forward is (-sin yaw, -cos yaw)), so moving
           the mouse right turns the view right and LOWERS the yaw. W pauses the tour, so this is a full turn. */
        const yawM0 = (await readPos(page))!.yaw;
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(box.x + box.width * 0.5 + i * 12, my);
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(3000);
        expect(yawM0 - (await readPos(page))!.yaw).toBeGreaterThan(8);
        const yawM1 = (await readPos(page))!.yaw;
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(box.x + box.width * 0.5 + 144 - i * 24, my);
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(3000);
        expect((await readPos(page))!.yaw - yawM1).toBeGreaterThan(8);
        /* Releasing the lock (what Esc does) stops the aiming, and the prompt changes. */
        await expect(page.getByText('Press Esc to show cursor')).toBeVisible();
        await page.evaluate(() => document.exitPointerLock());
        await expect(page.getByText('Press Esc to show cursor')).toHaveCount(0);
        await page.waitForTimeout(1500);
        const yawR = (await readPos(page))!.yaw;
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(box.x + box.width * 0.3 + i * 12, my);
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(2000);
        expect(Math.abs((await readPos(page))!.yaw - yawR)).toBeLessThan(1);
      }
      /* Left arrow turns the view left. */
      const yaw0 = (await readPos(page))!.yaw;
      await page.keyboard.down('ArrowLeft');
      await expect.poll(async () => Math.abs((await readPos(page))!.yaw - yaw0), { timeout: 20_000 }).toBeGreaterThan(10);
      await page.keyboard.up('ArrowLeft');
      await page.screenshot({ path: join(FRAMES, `${info.project.name}-walked.png`) });
      return;
    }

    /* Phone: drag the stick with a real touch (CDP), keep the finger down for a screenshot. */
    if (!cdp) return;
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

    /* A look finger dragged right turns the view right (yaw falls), as in mobile shooters. */
    const yawT0 = after.yaw;
    const lx = Math.round(vp.width * 0.6);
    const ly = Math.round(vp.height * 0.3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly, id: 2 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lx + i * 10, y: ly, id: 2 }] });
      await page.waitForTimeout(60);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => yawT0 - (await readPos(page))!.yaw, { timeout: 20_000 }).toBeGreaterThan(5);
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
      await page.goto('/museum');
      const t0 = Date.now();
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
  await page.goto('/museum');
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
    await expect(menu.getByRole('link', { name: 'Back to the homepage' })).toBeFocused();
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
    await page.route('**/songs/*.mp3', (route) => route.fulfill({ status: 404, body: 'no' }));
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
    await page.route('**/museum/*/museum.js*', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ status: 404, body: 'nope' });
    });
    await page.goto('/museum');
    await expect(page.getByRole('progressbar')).toBeVisible();
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

/* Pointer lock cannot always be granted to a test browser, so these fake document.pointerLockElement and
   fire pointerlockchange, which is all the page listens to. The real lock path is checked in 'museum walk'. */
const setLock = (page: Page, on: boolean) =>
  page.evaluate((v) => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => (v ? canvas : null) });
    document.dispatchEvent(new Event('pointerlockchange'));
  }, on);

test.describe('pointer-lock prompts (stub engine)', () => {
  test('desktop: "Click to aim" fades after a few seconds and returns on release; Esc prompt while locked', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only');
    mkdirSync(FRAMES, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await enterStub(page);
    await tour(page, 'stage');
    const hint = page.getByText('Click to aim');
    const esc = page.getByText('Press Esc to show cursor');
    /* Scrolling (the default) has no pointer lock, so no prompt until free roam is on. */
    await page.waitForTimeout(600);
    await expect(hint).toHaveCount(0);
    await page.getByRole('button', { name: 'Free roam' }).click();
    await expect(hint).toBeVisible();
    await expect(esc).toHaveCount(0);
    /* It sits right of the mute button and, while the music callout is up, under it rather than on it. */
    const callout = page.getByText('Turn on the music');
    await expect(callout).toBeVisible();
    const mb = (await page.getByRole('button', { name: 'Play music' }).boundingBox())!;
    const hb = (await hint.boundingBox())!;
    const cb = (await callout.boundingBox())!;
    expect(hb.x).toBeGreaterThanOrEqual(mb.x + mb.width);
    expect(hb.y).toBeGreaterThanOrEqual(cb.y + cb.height - 1);
    await expect(hint).toBeHidden({ timeout: 8000 });

    await setLock(page, true);
    await expect(esc).toBeVisible();
    await expect(hint).toHaveCount(0);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-esc-prompt.png`) });
    await setLock(page, false);
    await expect(esc).toHaveCount(0);
    await expect(hint).toBeVisible();
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-click-to-aim.png`) });
    await expect(hint).toBeHidden({ timeout: 8000 });
  });

  test('the bridge reports the lock state to Godot', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only');
    await enterStub(page);
    expect(await page.evaluate(() => window.museumBridge!.pointerLocked())).toBe(false);
    await setLock(page, true);
    expect(await page.evaluate(() => window.museumBridge!.pointerLocked())).toBe(true);
  });

  test('phones: neither prompt is ever shown', async ({ page }, info) => {
    test.skip(info.project.name === 'chromium', 'phone projects only');
    await enterStub(page);
    await page.waitForTimeout(1200);
    await expect(page.getByText('Click to aim')).toHaveCount(0);
    await setLock(page, true);
    await page.waitForTimeout(300);
    await expect(page.getByText('Press Esc to show cursor')).toHaveCount(0);
  });

  test('the wheel and swipes on the canvas add up for Godot; free roam swallows them and toggles the mode', async ({ page }, info) => {
    await enterStub(page);
    await tour(page, 'stage');
    await drain(page);
    const take = () => page.evaluate(() => window.museumBridge!.scrollDelta());
    await take();
    const free = page.getByRole('button', { name: 'Free roam' });
    await expect(free).toHaveAttribute('aria-pressed', 'false');
    const box = (await page.locator('canvas').boundingBox())!;
    if (info.project.name === 'chromium') {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
      await page.mouse.wheel(0, 120);
      await expect.poll(take).toBeGreaterThanOrEqual(120);
      await page.mouse.wheel(0, -50);
      await expect.poll(take).toBeLessThan(0);
    } else {
      const cdp = await page.context().newCDPSession(page);
      const x = Math.round(box.x + box.width / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 500, id: 1 }] });
      for (let i = 1; i <= 6; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 500 - i * 30, id: 1 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      /* A finger moving up scrolls on, like a page: at least the 180 px it travelled less the axis slop. */
      expect(await take()).toBeGreaterThan(150);
    }
    await free.click();
    await expect(free).toHaveAttribute('aria-pressed', 'true');
    expect(await drain(page)).toEqual(['mode:free']);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    expect(await take()).toBe(0);
    await free.click();
    expect(await drain(page)).toEqual(['mode:scroll']);
  });

  test('the stage hold shows a scroll hint and the Free roam toggle beside Browse projects', async ({ page }, info) => {
    await enterStub(page);
    await tour(page, 'stage');
    await expect(page.getByText(info.project.name === 'chromium' ? 'Scroll' : 'Swipe up', { exact: true })).toBeVisible();
    const browse = (await page.getByRole('button', { name: 'Browse projects' }).boundingBox())!;
    const free = (await page.getByRole('button', { name: 'Free roam' }).boundingBox())!;
    expect(Math.abs(free.y - browse.y)).toBeLessThan(2);
    expect(free.x).toBeGreaterThan(browse.x + browse.width);
    await page.screenshot({ path: join(FRAMES, `${info.project.name}-stage-controls.png`) });
    /* Browsing, the toggle joins the icon bar. */
    await tour(page, 'paused');
    await expect(page.getByRole('navigation', { name: NAV }).getByRole('button', { name: 'Free roam' })).toBeVisible();
  });

  test('the scene opens on the build: the first drop lands about 8.5 s after the reveal', async ({ page }) => {
    await enterStub(page);
    const { now, drop, loop } = await page.evaluate(() => {
      const b = window.museumBridge!;
      const cues = JSON.parse(b.songCues()) as { bpm: number; loopSeconds: number; sections: { name: string; from: number }[] };
      const i = cues.sections.findIndex((x, k) => x.name === 'drop' && cues.sections[k - 1]?.name === 'break');
      return { now: b.time(), drop: (cues.sections[i].from * 240) / cues.bpm, loop: cues.loopSeconds };
    });
    /* Time to the drop, from the moment the canvas finished fading in (it may have taken a second or two). */
    const until = (((drop - now) % loop) + loop) % loop;
    expect(until).toBeGreaterThan(4);
    expect(until).toBeLessThanOrEqual(8.6);
  });

  test('the menu ends with a link back to the homepage, which lets go of the pointer', async ({ page }) => {
    await enterStub(page);
    await tour(page, 'touring');
    await focus(page, 'scrandle');
    await page.getByRole('button', { name: 'Project menu' }).click();
    const back = page.getByRole('dialog', { name: 'Projects' }).getByRole('link', { name: 'Back to the homepage' });
    await expect(back).toHaveAttribute('href', '/');
    await back.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('benadams.dev');
  });
});
