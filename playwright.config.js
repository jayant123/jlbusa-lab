import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 0,
  workers: 2, // each page renders WebGL in software here; more parallel pages starve the CPU and time out
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: true, timeout: 120000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'pixel5', use: { ...devices['Pixel 5'] } },
  ],
});
