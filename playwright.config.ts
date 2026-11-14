import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173/chem-gemini/',
    headless: true,
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/chem-gemini/',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
