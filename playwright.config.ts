import { defineConfig, devices } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Screenshot baselines are per platform; missing ones are written, not failed (see README).
  updateSnapshots: 'missing',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: `vite e2e/fixtures --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'vite --config demo/vite.config.ts --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
