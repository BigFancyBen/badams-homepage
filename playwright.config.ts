import { defineConfig, devices } from '@playwright/test';

const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/* MUSEUM_PORT lets a run use its own server beside a dev server on 3000. */
const PORT = Number(process.env.MUSEUM_PORT ?? 3000);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: SOFTWARE_GL } },
    },
    /* Phones. Both run in Chromium with software WebGL2 (SwiftShader), so the museum engine
       can actually boot headless. iPhone WebKit needs `npx playwright install webkit`
       and MUSEUM_WEBKIT=1; headless WebKit often has no WebGL2, which exercises the fallback. */
    {
      name: 'pixel',
      use: { ...devices['Pixel 7'], launchOptions: { args: SOFTWARE_GL } },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium', launchOptions: { args: SOFTWARE_GL } },
    },
    ...(process.env.MUSEUM_WEBKIT
      ? [{ name: 'iphone-webkit', use: { ...devices['iPhone 14'] } }]
      : []),
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
