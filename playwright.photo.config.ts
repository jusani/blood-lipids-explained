import { defineConfig, devices } from '@playwright/test';

// Photo/PDF reading: runs against the default build (flag on), on its own port.
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'photo.spec.ts',
  timeout: 120_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4174/',
    ...devices['Pixel 7'],
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: { command: 'npm run build && vite preview --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: true, timeout: 120_000 },
});
