import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4196');
const live = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = live ?? `http://127.0.0.1:${port}/chem-gemini/`;

export default defineConfig({
  testDir: './tests', testMatch: 'pages-pair.assembled.ts',
  use: { baseURL, headless: true },
  webServer: live ? undefined : {
    command: `npm run preview -- --mode pages --base /chem-gemini/ --outDir pages-dist --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL, reuseExistingServer: false,
  },
});
