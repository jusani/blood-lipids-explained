import { defineConfig, devices } from '@playwright/test';

// Photo/PDF reading prototype: runs against the photo test build (dist-photo/, flag on).
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
  webServer: { command: 'npm run build:photo && vite preview --outDir dist-photo --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: true, timeout: 120_000 },
});
