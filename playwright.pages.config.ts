import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4186');
const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalURL ?? `http://127.0.0.1:${port}/chem-gemini/p1/`;

export default defineConfig({
  testDir: './tests',
  testMatch: /(pages|learning-upgrade)\.spec\.ts/,
  timeout: 30000,
  use: { baseURL, headless: true, screenshot: 'only-on-failure' },
  webServer: externalURL ? undefined : {
    command: `npm run preview -- --mode pages --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
