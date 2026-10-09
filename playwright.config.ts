import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (service worker, CSP) on a phone-sized screen.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4173/',
    ...devices['Pixel 7'],
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173/', reuseExistingServer: true, timeout: 60_000 },
});
