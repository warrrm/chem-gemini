import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4173');
const baseURL = `http://127.0.0.1:${port}/chem-gemini/`;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /pages\.spec\.ts/,
  timeout: 30000,
  use: {
    baseURL,
    headless: true,
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
