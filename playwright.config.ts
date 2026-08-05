import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration for Playwright Test runner.
 * 
 * Key points for this practice app:
 * - baseURL set to the public Heroku app
 * - Timeouts increased slightly since shared environment may have occasional latency
 * - Retries disabled for development (failures are informative, not flaky); enable in CI if needed
 * - Screenshots/videos captured on failure for debugging
 * - All tests run serially against shared DB to avoid data collision (optional: can parallelize if confident in test data isolation)
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  
  fullyParallel: false, // Run tests serially to avoid shared environment race conditions
  forbidOnly: !!process.env.CI, // Disallow .only() in CI
  retries: process.env.CI ? 1 : 0, // Single retry in CI for flaky network; 0 in local dev
  workers: 1, // Single worker to serialize against shared demo environment

  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'junit-results.xml' }],
  ],

  use: {
    baseURL: 'https://thinking-tester-contact-list.herokuapp.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  webServer: undefined, // App is already running on Heroku; don't start a local server

  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 120000, // Per-test timeout: 2 min (registration/login can be slow on shared environment)
  globalTimeout: 1800000, // 30 minute global timeout for entire suite (shared Heroku app may be slow)
});
